import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// User Profile
export const getUserProfile = async (userId: string) => {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const createUserProfile = async (userId: string, data: any) => {
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, path), {
      ...data,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Portfolio
export const subscribeToPortfolio = (userId: string, callback: (assets: any[]) => void) => {
  const path = `users/${userId}/portfolio`;
  const q = query(collection(db, path), orderBy('symbol'));
  return onSnapshot(q, (snapshot) => {
    const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(assets);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addPortfolioAsset = async (userId: string, asset: any) => {
  const path = `users/${userId}/portfolio`;
  try {
    const docRef = doc(collection(db, path));
    await setDoc(docRef, {
      ...asset,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updatePortfolioAsset = async (userId: string, assetId: string, data: any) => {
  const path = `users/${userId}/portfolio/${assetId}`;
  try {
    await updateDoc(doc(db, path), {
      ...data,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deletePortfolioAsset = async (userId: string, assetId: string) => {
  const path = `users/${userId}/portfolio/${assetId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Alerts
export const subscribeToAlerts = (userId: string, callback: (alerts: any[]) => void) => {
  const path = `users/${userId}/alerts`;
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(alerts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addPriceAlert = async (userId: string, alert: any) => {
  const path = `users/${userId}/alerts`;
  try {
    const docRef = doc(collection(db, path));
    await setDoc(docRef, {
      ...alert,
      active: true,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deletePriceAlert = async (userId: string, alertId: string) => {
  const path = `users/${userId}/alerts/${alertId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
