
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

console.log("--- Firebase Init Start (firebase.ts top level) ---");

let firebaseConfig;

// In Firebase App Hosting, the config is provided as a JSON string
// in the FIREBASE_WEBAPP_CONFIG environment variable.
if (process.env.FIREBASE_WEBAPP_CONFIG) {
  try {
    firebaseConfig = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    console.log(`Firebase.ts: Successfully parsed FIREBASE_WEBAPP_CONFIG. ProjectID: ${firebaseConfig.projectId}`);
  } catch (e) {
    console.error("Firebase.ts: Failed to parse FIREBASE_WEBAPP_CONFIG.", e);
  }
}

// Fallback for local development or other environments
if (!firebaseConfig) {
  console.log("Firebase.ts: FIREBASE_WEBAPP_CONFIG not found or failed to parse. Falling back to NEXT_PUBLIC_ variables for local dev.");
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Final check to ensure a valid config object exists before initializing
if (!firebaseConfig || !firebaseConfig.apiKey) {
    const errorMessage = "Firebase.ts: Firebase configuration is missing or incomplete. Ensure FIREBASE_WEBAPP_CONFIG (for App Hosting) or NEXT_PUBLIC_FIREBASE_ variables are set correctly.";
    console.error(errorMessage);
    throw new Error(errorMessage);
}


let app: FirebaseApp;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase.ts: Firebase App initialized successfully.");
  } catch (error: any) {
    console.error("Firebase.ts: CRITICAL ERROR DURING initializeApp():", error.message);
    throw new Error(`Firebase.ts: Firebase initialization failed: ${error.message}`);
  }
} else {
  app = getApps()[0];
  console.log("Firebase.ts: Firebase app already initialized. Getting existing instance.");
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

console.log("--- Firebase Init End (firebase.ts services obtained) ---");

export { app, db, auth };
