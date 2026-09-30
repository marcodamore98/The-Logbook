# The Logbook

Diario giornaliero per un medico ospedaliero (ginecologia, ostetricia e uroginecologia): turni, attività chirurgica, clinica e studio, ma anche allenamenti, gite e note personali. Tutto è collegato a Google Calendar e produce statistiche settimanali, mensili e annuali.

È una **PWA**: si installa sul telefono ("Aggiungi a schermata Home") e sul computer, funziona anche offline e sincronizza i dati nel cloud tramite Firebase.

## Funzioni

| Area | Cosa fa |
|---|---|
| **Calendario** | Vista mensile e settimanale con turno del giorno, impegni, eventi di Google Calendar e icone delle schede compilate. |
| **Pagina del giorno** | Turno (tipo, orario, colleghi, reparto), impegni, promemoria/to-do, umore della giornata e schede aggiungibili. |
| **Schede di lavoro** | *Attività chirurgica* (intervento da catalogo standard, ruolo, via d'accesso, regime, durata, complicanze Clavien-Dindo, tutor) · *Attività clinica* (ambulatori, ecografie, urodinamica, PS…) · *Studio* (tipo, area, durata). |
| **Schede personali** | *Allenamento* (tipo, durata, RPE, esercizi con serie × ripetizioni × kg, distanza) · *Gita / uscita* · *Immagini* · *Note*. |
| **Statistiche** | Per settimana, mese e anno: ore e turni, notti, colleghi, interventi per area/tipo/ruolo/via, prestazioni cliniche, ore di studio, allenamenti e volume, uscite. Export CSV del logbook chirurgico. |
| **Google Calendar** | Bidirezionale: turni, impegni e promemoria con orario vengono creati, aggiornati ed eliminati su Google Calendar; gli eventi di Google compaiono nel logbook; se sposti su Google un evento creato dal logbook, l'orario si aggiorna anche nel logbook. |

I termini di lavoro e palestra usano **vocabolari standardizzati** (`src/lib/vocab.ts`): ogni voce ha un id stabile, così le statistiche restano coerenti. Le etichette si possono riformulare liberamente, ma gli id non vanno cambiati una volta che ci sono dati.

**Colleghi e tipi di turno** si gestiscono da *Impostazioni*. Ci sono tipi di turno predefiniti (mattino, pomeriggio, notte, guardia 24h, sala operatoria, sala parto, ambulatorio, reperibilità, guardia medica notturna/prefestiva/festiva, smonto, riposo, ferie), tutti modificabili. I colleghi si possono incollare in blocco, uno per riga o separati da virgola.

> **Privacy:** non inserire dati identificativi delle pazienti. Il logbook registra solo attività e tipologie di intervento.

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # facoltativo: senza Firebase l'app funziona in modalità locale
npm run dev
```

Senza variabili Firebase i dati restano sul dispositivo (IndexedDB) e si possono spostare con *Impostazioni → Esporta/Importa backup*.

## Configurare la sincronizzazione cloud (Firebase)

1. Crea un progetto su <https://console.firebase.google.com>.
2. **Authentication → Sign-in method** → abilita **Google**. In *Authorized domains* aggiungi il dominio dove pubblicherai l'app (es. `marcodamore98.github.io`).
3. **Firestore Database** → crea il database (modalità produzione).
4. **Storage** → attivalo (serve per le foto).
5. **Impostazioni progetto → Le tue app → Web** → registra l'app e copia i valori in `.env.local`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`.
6. Pubblica le regole di sicurezza incluse: `npx firebase-tools deploy --only firestore:rules,storage`. Ogni utente può leggere e scrivere solo i propri dati.

Struttura dei dati: `users/{uid}/meta/settings`, `users/{uid}/days/{YYYY-MM-DD}`; le foto sono in `users/{uid}/photos/`.

## Configurare Google Calendar

1. Apri <https://console.cloud.google.com> e seleziona **lo stesso progetto di Firebase**.
2. **API e servizi → Libreria** → abilita **Google Calendar API**.
3. **Schermata consenso OAuth** → tipo *Esterno*, aggiungi gli ambiti `calendar.events` e `calendar.readonly`, e aggiungi il tuo indirizzo Gmail come *utente di test*.
4. **Credenziali** → apri l'ID client OAuth "Web client (auto created by Google Service)", oppure creane uno di tipo *Applicazione web*. In *Origini JavaScript autorizzate* aggiungi `http://localhost:5173` e il dominio di produzione.
5. Copia l'ID client in `VITE_GOOGLE_CLIENT_ID`.
6. Nell'app vai su **Impostazioni → Google Calendar → Collega**. Poi scegli il calendario su cui scrivere (consiglio di creare un calendario dedicato, es. "Turni") e quali calendari mostrare.

Il token di Google dura circa un'ora. Quando scade, in alto compare "Ricollega Google". Le modifiche fatte nel frattempo restano in sospeso e vengono inviate con *Sincronizza elementi in sospeso*.

## Pubblicazione

**GitHub Pages:** il workflow `.github/workflows/deploy.yml` pubblica a ogni push su `main`.
1. Attiva la pubblicazione in *Settings → Pages → Source: GitHub Actions*.
2. Aggiungi i valori di `.env.example` come *Secrets* del repository.

**Firebase Hosting:** in alternativa esegui `npm run build && npx firebase-tools deploy --only hosting`.

## Struttura del codice

```
src/
  lib/
    types.ts            modello dati (DayEntry, moduli, Settings)
    vocab.ts            vocabolari standardizzati e turni predefiniti
    stats.ts            aggregazioni ed export CSV
    store/              repository locale (IndexedDB) e cloud (Firestore/Storage) + contesto React
    google/             client Google Calendar (GIS) e sincronizzazione bidirezionale
  components/           icone "ink & wash", controlli, editor delle schede
  pages/                Giorno, Mese/Settimana, Statistiche, Impostazioni
```
