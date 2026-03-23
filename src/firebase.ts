import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let storageInstance: any = null;
export const getFirebaseStorage = () => {
  if (!storageInstance) {
    try {
      storageInstance = getStorage(app, firebaseConfig.storageBucket);
    } catch (err) {
      console.error('Firebase Storage not available:', err);
      return null;
    }
  }
  return storageInstance;
};
