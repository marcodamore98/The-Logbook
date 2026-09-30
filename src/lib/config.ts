// Configurazione pubblica dell'app. Questi valori NON sono segreti: Firebase li
// invia comunque a ogni browser che apre l'app, e la protezione dei dati è
// affidata alle regole di Firestore (firestore.rules). Si possono quindi
// salvare nel repository. Le variabili VITE_* in .env.local, se presenti,
// hanno la precedenza.
//
// Dove trovarli: Console Firebase → ⚙ Impostazioni progetto → Generali →
// Le tue app → App web → "Configurazione SDK" (oggetto firebaseConfig).

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

// Google Cloud Console → API e servizi → Credenziali → ID client OAuth 2.0 (tipo Web).
export const GOOGLE_CLIENT_ID = '';
