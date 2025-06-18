
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole, UserProfile } from '@/lib/types';
import { USER_ROLES_LIST, USERS_COLLECTION } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext'; 

const DEFAULT_ROLE: UserRole = USER_ROLES_LIST[3]; 

export function useUserRole() {
  const { currentUser, userProfile: authContextProfile, loading: authLoading } = useAuth(); 
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setIsLoadingRole(true); 
      return;
    }

    // Auth is done loading at this point.
    if (currentUser) {
      if (authContextProfile) {
        if (USER_ROLES_LIST.includes(authContextProfile.role)) {
          setCurrentRole(authContextProfile.role);
        } else {
          console.warn(`User ${currentUser.uid} has an invalid role: ${authContextProfile.role}. Defaulting.`);
          setCurrentRole(DEFAULT_ROLE);
        }
      } else {
        // User is authenticated, but profile is missing/failed to load.
        console.warn(`User profile not available for ${currentUser.uid}. Defaulting role.`);
        setCurrentRole(DEFAULT_ROLE); 
      }
    } else {
      // No user logged in.
      setCurrentRole(null);
    }
    setIsLoadingRole(false); // Set loading to false once auth is done and role determination is attempted.
  }, [currentUser, authContextProfile, authLoading]);


  const updateUserRoleInFirestore = useCallback(async (uid: string, newRole: UserRole) => {
    if (!USER_ROLES_LIST.includes(newRole)) {
      console.error("Attempted to set an invalid user role:", newRole);
      throw new Error("Invalid role specified.");
    }
    try {
      const userRoleDocRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(userRoleDocRef, { role: newRole, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Failed to save user role to Firestore:", error);
      throw error; 
    }
  }, []);

  return {
    currentRole,
    isLoadingRole: isLoadingRole, // isLoadingRole is now solely managed by this hook after authLoading is false
    availableRoles: USER_ROLES_LIST,
    updateUserRoleInFirestore, 
  };
}
