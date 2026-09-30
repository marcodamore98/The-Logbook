import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || FIREBASE_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId,
  appId: env.VITE_FIREBASE_APP_ID || FIREBASE_CONFIG.appId,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;

function ensureApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(config);
  }
  return app;
}

export function db(): Firestore {
  if (!firestore) {
    // Offline-first: writes land in the IndexedDB cache and sync when online.
    firestore = initializeFirestore(ensureApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  }
  return firestore;
}

export function watchUser(cb: (u: User | null) => void): () => void {
  return onAuthStateChanged(getAuth(ensureApp()), cb);
}

export async function signIn(): Promise<void> {
  await signInWithPopup(getAuth(ensureApp()), new GoogleAuthProvider());
}

export async function logOut(): Promise<void> {
  await signOut(getAuth(ensureApp()));
}
