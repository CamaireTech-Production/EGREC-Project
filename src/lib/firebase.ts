import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCaMvnjmBFr3vM_Q4VVR3yZtVmM_tT_B_0",
  authDomain: "egrec-bd-gestion.firebaseapp.com",
  projectId: "egrec-bd-gestion",
  storageBucket: "egrec-bd-gestion.appspot.com",
  messagingSenderId: "893867947081",
  appId: "1:893867947081:web:5d1b6c3ae8d14ca8a13b98"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable Firebase Auth persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error enabling auth persistence:", error);
});

// Enable Firestore offline persistence
enableIndexedDbPersistence(db).catch((error) => {
  console.error("Error enabling Firestore persistence:", error);
  if (error.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (error.code === 'unimplemented') {
    console.warn('The current browser does not support offline persistence.');
  }
});

// Firebase security rules
export const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User document rules
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && (
        request.auth.uid == userId || 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMINISTRATEUR'
      );
      allow delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMINISTRATEUR';
    }
  }
}`;