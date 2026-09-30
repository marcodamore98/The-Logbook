// Configurazione pubblica dell'app. Questi valori NON sono segreti: Firebase li
// invia comunque a ogni browser che apre l'app, e la protezione dei dati è
// affidata alle regole di Firestore (firestore.rules). Si possono quindi
// salvare nel repository. Le variabili VITE_* in .env.local, se presenti,
// hanno la precedenza.
//
// Dove trovarli: Console Firebase → ⚙ Impostazioni progetto → Generali →
// Le tue app → App web → "Configurazione SDK" (oggetto firebaseConfig).

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBxOCyjkSq_uLTIokjP6vUOSR0y-Z4m_II',
  authDomain: 'the-logbook-8c70b.firebaseapp.com',
  projectId: 'the-logbook-8c70b',
  appId: '1:1026633603011:web:3e7b98e807361231428f76',
};

// Google Cloud Console → API e servizi → Credenziali → ID client OAuth 2.0 (tipo Web).
export const GOOGLE_CLIENT_ID = '';
