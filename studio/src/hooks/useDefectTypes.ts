
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_CONFIG_COLLECTION, DEFECT_TYPES_DOC_ID, DEFECT_LIST_FIELD, INITIAL_DEFECT_TYPES } from '@/lib/constants';
import type { DefectTypesDocument } from '@/lib/types';
import { useToast } from './use-toast';

export function useDefectTypes() {
  const [defectTypes, setDefectTypes] = useState<string[]>(INITIAL_DEFECT_TYPES);
  const [isLoading, setIsLoading] = useState(true); // isLoading is true by default
  const { toast } = useToast();

  const defectTypesDocRef = doc(db, APP_CONFIG_COLLECTION, DEFECT_TYPES_DOC_ID);

  useEffect(() => {
    // setIsLoading(true) removed from here; it's already true via useState.
    // This prevents resetting to true if the effect re-runs unexpectedly.
    console.log("useDefectTypes: Main useEffect triggered.");

    const unsubscribe = onSnapshot(defectTypesDocRef, (docSnap) => {
      console.log("useDefectTypes: onSnapshot callback received.");
      if (docSnap.exists()) {
        const data = docSnap.data() as DefectTypesDocument;
        console.log("useDefectTypes: Document exists. Data:", data);
        setDefectTypes(data && Array.isArray(data[DEFECT_LIST_FIELD]) ? data[DEFECT_LIST_FIELD] : []);
      } else {
        console.warn("useDefectTypes: Defect types document not found in Firestore. Using initial defaults locally. Admin should add a defect type to create the document.");
        // setDefectTypes(INITIAL_DEFECT_TYPES); // useState already initializes with this
      }
      console.log("useDefectTypes: Setting isLoading to false in onSnapshot success/doc-not-found.");
      setIsLoading(false);
    }, (error) => {
      console.error("useDefectTypes: Error fetching defect types:", error);
      toast({ title: "Error", description: "Could not fetch defect types. Displaying local defaults.", variant: "destructive" });
      // setDefectTypes(INITIAL_DEFECT_TYPES); // useState already initializes with this
      console.log("useDefectTypes: Setting isLoading to false in onSnapshot error.");
      setIsLoading(false);
    });

    return () => {
      console.log("useDefectTypes: Unsubscribing from onSnapshot in main useEffect cleanup.");
      unsubscribe();
    };
  }, [defectTypesDocRef, toast]);

  useEffect(() => {
    console.log(`useDefectTypes Internal: isLoading state is now: ${isLoading}`);
  }, [isLoading]);

  const addDefectType = useCallback(async (newDefect: string) => {
    if (!newDefect || newDefect.trim() === "") {
      toast({ title: "Invalid Input", description: "Defect type cannot be empty.", variant: "destructive" });
      return false;
    }
    const trimmedDefect = newDefect.trim();

    const currentDefectsInFirestore = async () => {
        const docSnap = await getDoc(defectTypesDocRef);
        if (docSnap.exists()) {
            return (docSnap.data() as DefectTypesDocument).defects || [];
        }
        return [];
    };

    const existingDefects = await currentDefectsInFirestore();
    if (existingDefects.some(d => d.toLowerCase() === trimmedDefect.toLowerCase())) {
        toast({ title: "Duplicate Defect", description: `"${trimmedDefect}" already exists.`, variant: "destructive" });
        return false;
    }

    try {
      await updateDoc(defectTypesDocRef, {
        [DEFECT_LIST_FIELD]: arrayUnion(trimmedDefect)
      });
      toast({ title: "Defect Type Added", description: `"${trimmedDefect}" has been added.`, variant: "default" });
      return true;
    } catch (error: any) {
      console.warn("useDefectTypes: updateDoc failed for addDefectType, checking if document exists to create it:", error.message);
      const docSnap = await getDoc(defectTypesDocRef);
      if (!docSnap.exists()) {
        try {
          await setDoc(defectTypesDocRef, { [DEFECT_LIST_FIELD]: [trimmedDefect] });
          toast({ title: "Defect Type Added", description: `"${trimmedDefect}" has been added and new defect list created.`, variant: "default" });
          return true;
        } catch (setDocError) {
          console.error("useDefectTypes: Error creating defect types document with setDoc:", setDocError);
          toast({ title: "Error", description: "Could not add defect type (failed to create list).", variant: "destructive" });
          return false;
        }
      } else {
        console.error("useDefectTypes: Error adding defect type (updateDoc failed, doc exists):", error);
        toast({ title: "Error", description: `Could not add defect type: ${error.message || 'Unknown error'}`, variant: "destructive" });
        return false;
      }
    }
  }, [defectTypesDocRef, toast]);

  return { defectTypes, addDefectType, isLoading };
}
