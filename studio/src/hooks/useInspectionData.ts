
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InspectionRecord, PartName, InspectionFormData, Shift } from '@/lib/types';
import { PART_NAMES_LIST, MONTHLY_TARGET_KEY, SHIFT_OPTIONS, INSPECTION_RECORDS_COLLECTION, APP_CONFIG_COLLECTION, MONTHLY_TARGETS_DOC_ID } from '@/lib/constants';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

export function useInspectionData() {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<Record<PartName, number>>(() => {
    const initialTargets = {} as Record<PartName, number>;
    PART_NAMES_LIST.forEach(part => {
      initialTargets[part] = 0;
    });
    return initialTargets;
  });
  const [isLoading, setIsLoading] = useState(true); // Start true

  const initialRecordsLoaded = useRef(false);
  const initialTargetsLoaded = useRef(false);

  useEffect(() => {
    // This effect now runs only once on mount
    const recordsQuery = query(collection(db, INSPECTION_RECORDS_COLLECTION), orderBy("date", "desc"), orderBy("shift", "desc"));
    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date,
        shift: doc.data().shift || SHIFT_OPTIONS[0], // Default to Shift A if not present
      } as InspectionRecord));
      setRecords(fetchedRecords);

      if (!initialRecordsLoaded.current) {
        initialRecordsLoaded.current = true;
        if (initialTargetsLoaded.current && isLoading) { 
          setIsLoading(false);
        }
      }
    }, (error) => {
      console.error("Error fetching inspection records:", error);
      if (!initialRecordsLoaded.current) {
        initialRecordsLoaded.current = true; 
        if (initialTargetsLoaded.current && isLoading) {
          setIsLoading(false);
        }
      }
    });

    const targetsDocRef = doc(db, APP_CONFIG_COLLECTION, MONTHLY_TARGETS_DOC_ID);
    const unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const targetsData = docSnap.data() as Record<PartName, number>;
        const fullTargets = {} as Record<PartName, number>;
        PART_NAMES_LIST.forEach(part => {
            fullTargets[part] = targetsData[part] || 0;
        });
        setMonthlyTargets(fullTargets);
      } else {
        const initialTargets = {} as Record<PartName, number>;
        PART_NAMES_LIST.forEach(part => {
          initialTargets[part] = 0;
        });
        setMonthlyTargets(initialTargets);
      }
      
      if (!initialTargetsLoaded.current) {
        initialTargetsLoaded.current = true;
        if (initialRecordsLoaded.current && isLoading) { 
          setIsLoading(false);
        }
      }
    }, (error) => {
      console.error("Error fetching monthly targets:", error);
      if (!initialTargetsLoaded.current) {
        initialTargetsLoaded.current = true;
        if (initialRecordsLoaded.current && isLoading) {
          setIsLoading(false);
        }
      }
    });
    
    const loadingTimeout = setTimeout(() => {
        if (isLoading) { 
            console.warn("useInspectionData: Initial data load timeout. Forcing loading state to false.");
            setIsLoading(false);
        }
    }, 7000); 

    return () => {
      unsubscribeRecords();
      unsubscribeTargets();
      clearTimeout(loadingTimeout);
    };
  }, []); // Dependency array changed from [isLoading] to []

  const addRecord = useCallback(async (formData: InspectionFormData) => {
    try {
      const newRecordData = {
        ...formData,
        date: format(new Date(formData.date), 'yyyy-MM-dd'),
      };
      const docRef = await addDoc(collection(db, INSPECTION_RECORDS_COLLECTION), newRecordData);
      return { ...newRecordData, id: docRef.id, shift: formData.shift } as InspectionRecord;
    } catch (error) {
      console.error("Error adding record to Firestore:", error);
      throw error;
    }
  }, []);

  const updateRecord = useCallback(async (updatedRecord: InspectionRecord) => {
    try {
      const recordRef = doc(db, INSPECTION_RECORDS_COLLECTION, updatedRecord.id);
      const dataToUpdate = {
        ...updatedRecord,
        date: format(new Date(updatedRecord.date), 'yyyy-MM-dd'),
      };
      delete (dataToUpdate as any).id;
      await updateDoc(recordRef, dataToUpdate);
    } catch (error) {
      console.error("Error updating record in Firestore:", error);
      throw error;
    }
  }, []);

  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      const recordRef = doc(db, INSPECTION_RECORDS_COLLECTION, recordId);
      await deleteDoc(recordRef);
    } catch (error) {
      console.error("Error deleting record from Firestore:", error);
      throw error;
    }
  }, []);
  
  const getRecordByDatePartAndShift = useCallback((date: string, partName: PartName, shift: Shift): InspectionRecord | undefined => {
    const formattedDate = format(new Date(date), 'yyyy-MM-dd');
    return records.find(r => r.date === formattedDate && r.partName === partName && r.shift === shift);
  }, [records]);

  const getCumulativeValuesBeforeEntry = useCallback((currentEntryDate: string, partName: PartName, currentEntryShift: Shift): { cumRfd: number, cumDispatch: number } => {
    const entryDateObj = parseISO(currentEntryDate);
    
    let latestRfd = 0;
    let latestDispatch = 0;

    const recordsForPart = records.filter(r => r.partName === partName);

    const sortedRecordsForPart = recordsForPart.sort((a, b) => {
        const dateA = parseISO(a.date).getTime();
        const dateB = parseISO(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.shift.localeCompare(b.shift);
    });

    let lastRecordBeforeCurrentEntry: InspectionRecord | undefined;
    for (let i = sortedRecordsForPart.length - 1; i >= 0; i--) {
        const record = sortedRecordsForPart[i];
        const recordDateObj = parseISO(record.date);
        if (recordDateObj.getTime() < startOfDay(entryDateObj).getTime()) {
            lastRecordBeforeCurrentEntry = record;
            break;
        }
        if (record.date === currentEntryDate && record.shift < currentEntryShift) {
            lastRecordBeforeCurrentEntry = record;
            break;
        }
    }
    
    if (lastRecordBeforeCurrentEntry) {
        latestRfd = lastRecordBeforeCurrentEntry.dispatch.rfd.cumulative;
        latestDispatch = lastRecordBeforeCurrentEntry.dispatch.dispatch.cumulative;
    }
    
    return { cumRfd: latestRfd, cumDispatch: latestDispatch };
  }, [records]);


  const getHistoricalDataForAI = useCallback((partName: PartName): string => {
    const relevantRecords = records.filter(r => r.partName === partName);
    const simplifiedRecords = relevantRecords.map(r => ({
      date: r.date,
      shift: r.shift,
      materialInspection: r.materialInspection,
      finalInspection: r.finalInspection,
      tpiInspection: r.tpiInspection,
      dispatch: r.dispatch,
      rejections: r.rejections,
      tpiRejections: r.tpiRejections,
    }));
    return JSON.stringify(simplifiedRecords);
  }, [records]);

  const updateMonthlyTarget = useCallback(async (partName: PartName, target: number) => {
    try {
      const targetsDocRef = doc(db, APP_CONFIG_COLLECTION, MONTHLY_TARGETS_DOC_ID);
      const newTargetsData = { ...monthlyTargets, [partName]: target };
      await setDoc(targetsDocRef, newTargetsData, { merge: true });
    } catch (error) {
      console.error("Failed to save monthly targets to Firestore", error);
      throw error;
    }
  }, [monthlyTargets]);

  const getAggregatedData = useCallback((partName?: PartName, dateRange?: {start: string, end: string}) => {
    let filteredRecords = records;
    if (partName) {
        filteredRecords = filteredRecords.filter(r => r.partName === partName);
    }
    const totalOkFinalInspection = filteredRecords.reduce((sum, r) => sum + r.finalInspection.multigauge.ok + r.finalInspection.visual.ok, 0);
    return { totalOkFinalInspection };
  }, [records]);

  const clearAllInspectionRecords = useCallback(async (): Promise<{success: boolean, message: string}> => {
    const recordsCollectionRef = collection(db, INSPECTION_RECORDS_COLLECTION);
    try {
      const querySnapshot = await getDocs(recordsCollectionRef);
      if (querySnapshot.empty) {
        return { success: true, message: "No inspection records found to delete." };
      }

      const batchArray: writeBatch[] = [];
      batchArray.push(writeBatch(db));
      let operationCount = 0;
      let batchIndex = 0;

      querySnapshot.docs.forEach(docSnapshot => {
        batchArray[batchIndex].delete(docSnapshot.ref);
        operationCount++;
        if (operationCount === 499) { 
          batchArray.push(writeBatch(db));
          batchIndex++;
          operationCount = 0;
        }
      });

      await Promise.all(batchArray.map(batch => batch.commit()));
      return { success: true, message: "All inspection records have been cleared successfully." };
    } catch (error) {
      console.error("Error clearing inspection records:", error);
      return { success: false, message: `Failed to clear inspection records: ${error instanceof Error ? error.message : String(error)}` };
    }
  }, []);

  return {
    records,
    addRecord,
    updateRecord,
    deleteRecord,
    getRecordByDatePartAndShift,
    getHistoricalDataForAI,
    monthlyTargets,
    updateMonthlyTarget,
    getAggregatedData,
    isLoading,
    getCumulativeValuesBeforeEntry,
    clearAllInspectionRecords,
  };
}

