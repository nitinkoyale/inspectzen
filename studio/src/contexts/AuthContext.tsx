
"use client";

import type { User as FirebaseUser, UserCredential } from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback
} from 'react';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, Timestamp } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/lib/types';
import { USERS_COLLECTION, USER_ROLES_LIST } from '@/lib/constants';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<UserCredential>;
  signup: (name: string, mobile: string, email: string, pass: string, requestedRole: UserRole) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUserProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    const uid = firebaseUser.uid;
    console.log(`AuthContext: Attempting to fetch profile for UID: ${uid}`);
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile;
        console.log(`AuthContext: Profile FOUND for UID: ${uid}`, profileData);
        setUserProfile(profileData);
      } else {
        console.warn(`AuthContext: Profile DOCUMENT NOT FOUND in Firestore for UID: ${uid}. Attempting to create a default profile.`);
        
        const defaultUserProfile: UserProfile = {
          uid: uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email || 'User',
          mobile: firebaseUser.phoneNumber || '',
          role: USER_ROLES_LIST[3], // Default to DATA_VIEWER
          status: 'pending_approval', // CHANGED: Align with security rule for new user creation
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };
        try {
          await setDoc(userDocRef, defaultUserProfile);
          console.log(`AuthContext: Default profile CREATED for UID: ${uid} with status 'pending_approval'`, defaultUserProfile);
          setUserProfile(defaultUserProfile);
        } catch (creationError: any) {
          console.error(`AuthContext: FAILED to create default profile for UID: ${uid}. THIS IS VERY LIKELY A FIRESTORE SECURITY RULE ISSUE. Ensure rules allow authenticated users to create their own document in the 'users' collection (e.g., allow create: if request.auth.uid == userId;). Error:`, creationError.message, creationError);
          setUserProfile(null); 
        }
      }
    } catch (fetchError: any) {
      console.error(`AuthContext: ERROR DURING getDoc() for UID: ${uid}. This could be a security rule issue denying read access to own profile. Error:`, fetchError.message, fetchError);
      setUserProfile(null); 
    }
  }, []); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user ? user.uid : 'null');
      setCurrentUser(user);
      if (user) {
        console.log("AuthContext: User authenticated, calling fetchUserProfile for UID:", user.uid);
        await fetchUserProfile(user);
      } else {
        console.log("AuthContext: No user authenticated, setting userProfile to null.");
        setUserProfile(null);
      }
      console.log("AuthContext: Setting authLoading to false. Current user UID if available:", user ? user.uid : 'null');
      setLoading(false);
    });
    return () => {
      console.log("AuthContext: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = (email: string, pass: string) => {
    setLoading(true); 
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (name: string, mobile: string, email: string, pass: string, requestedRole: UserRole) => {
    setLoading(true); 
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    const userDocRef = doc(db, USERS_COLLECTION, user.uid);
    const newUserProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      name,
      mobile,
      role: USER_ROLES_LIST.includes(requestedRole) ? requestedRole : USER_ROLES_LIST[3], // Ensure role is valid
      status: 'pending_approval', // New signups are always pending approval
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    await setDoc(userDocRef, newUserProfile);
    // Don't setLoading(false) here, onAuthStateChanged will handle it when profile is fetched/created
    return userCredential;
  };

  const logout = async () => {
    console.log("AuthContext: logout called.");
    await signOut(auth);
    setCurrentUser(null); 
    setUserProfile(null); 
    setLoading(false); 
    router.push('/login');
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
