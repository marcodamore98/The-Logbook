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

## Tabellone di reparto

`src/data/roster-2026-10.ts` contiene i turni di ottobre 2026: gli specializzandi sono estratti dal PDF, gli strutturati sono trascritti dalla foto del tabellone. Le sigle sono normalizzate in `src/lib/roster.ts` (`ROSTER_CODES`), e gli stessi codici fanno da tipi di turno.

- Ogni pagina giorno mostra il **Tabellone**, cioè chi fa cosa. Specializzandi e strutturati sono su due schede, e le tue attività sono evidenziate.
- Se non hai ancora inserito un turno, l'app propone quello del tabellone con i colleghi che fanno la stessa attività (pulsante **Usa**).
- *Impostazioni → Tabellone di reparto → Importa i miei turni* copia tutti i tuoi turni del mese, senza toccare i giorni già compilati.

Nel tabellone ogni attività mostra insieme strutturati (in grassetto con la stella da sceriffo ★) e specializzandi.

Per un nuovo mese si aggiunge un file `roster-AAAA-MM.ts` e lo si registra in `ROSTERS`.

## Palestra

La pagina **Palestra** funziona come Hevy, senza la parte social.
- **Schede (routine):** organizzate in cartelle (es. PPL). Per ogni esercizio imposti le serie (normale, riscaldamento **W**, dropset **D**, a cedimento **F**), il range di ripetizioni, il peso, l'RPE, il recupero e le note. Puoi collegare gli esercizi in **superserie**.
- **Allenamento:** si avvia con *Inizia oggi* oppure dalla scheda *Allenamento* nella pagina del giorno. Durante l'allenamento hai:
  - cronometro della sessione;
  - colonna *Precedente* con i valori dell'ultima volta;
  - spunta delle serie, che avvia il **timer di recupero** (in una superserie parte dopo l'ultimo esercizio del gruppo);
  - badge **PR** quando batti un record (peso, 1RM stimato, volume della serie);
  - *Salva come scheda*.
- **Esercizi:** libreria di circa 100 esercizi con muscoli e attrezzi, più quelli che crei tu. Per ognuno vedi lo storico, i record e il 1RM stimato nel tempo.
- **Progressi:** allenamenti per settimana, serie per gruppo muscolare (principale 1, secondari ½), split Push/Pull/Legs.

## Barra laterale “Corpo”

Su schermi larghi è sempre visibile; su telefono si apre con il pulsante *Corpo*. Mostra:
- il riepilogo della giornata (turno, lavoro, allenamento, umore);
- peso, massa grassa, sonno, FC a riposo, passi, acqua;
- calorie assunte e attive, proteine, bilancio;
- l'andamento del peso a 30 giorni, le medie a 7 giorni e gli obiettivi.

Le schede della pagina del giorno si chiudono con la freccetta, e l'app ricorda la scelta su ogni dispositivo.

## Allenamenti da Hevy

In Hevy apri *Profilo → ⚙ Impostazioni → Esporta e importa dati → Esporta allenamenti*, poi carica il CSV in *Impostazioni → Allenamenti da Hevy*.
- Ogni allenamento diventa una scheda *Allenamento* nel giorno giusto.
- Il tipo (Push / Pull / Legs) viene dal nome della routine.
- Gli esercizi più comuni sono mappati sui nomi standard (`src/lib/hevy.ts`); gli altri mantengono il nome di Hevy.
- Le serie di riscaldamento sono escluse dal volume.
- Reimportare lo stesso file aggiorna gli allenamenti, senza duplicarli.

## Avvio in locale

```bash
npm install
# facoltativo: senza configurazione Firebase l'app funziona in modalità locale
npm run dev
```

Senza variabili Firebase i dati restano sul dispositivo (IndexedDB) e si possono spostare con *Impostazioni → Esporta/Importa backup*.

## Messa online (GitHub Pages + Firebase)

GitHub e Firebase non vanno collegati direttamente. GitHub **pubblica il sito**, mentre il sito, dal browser, parla con **Firebase** (login e dati) usando la configurazione in `src/lib/config.ts`. Quei valori sono pubblici per natura: la protezione dei dati è data dal login Google e dalle regole di Firestore.

### 1. Firebase (una volta sola)
1. Nella [console Firebase](https://console.firebase.google.com) apri **Authentication → Metodo di accesso** e verifica che **Google** sia attivo.
2. Vai in **Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio** e inserisci `marcodamore98.github.io`.
3. Vai in **Firestore Database → Regole**, incolla il contenuto di [`firestore.rules`](firestore.rules) e premi **Pubblica**. Ogni utente vedrà solo i propri dati.
4. Vai in **⚙ Impostazioni progetto → Generali → Le tue app → Configurazione SDK** e copia i valori `apiKey`, `authDomain`, `projectId` e `appId` in [`src/lib/config.ts`](src/lib/config.ts).

Firebase Storage **non** serve, perché per i progetti nuovi richiede il piano Blaze a pagamento. Le foto vengono compresse (circa 350 KB l'una) e salvate in Firestore, che nel piano gratuito Spark offre 1 GiB: circa 2500 foto, oltre ai dati del diario.

### 2. GitHub (una volta sola)
1. In **Settings → General → Danger Zone → Change visibility → Make public** rendi pubblico il repository. È pubblico solo il codice: i dati personali stanno in Firestore.
2. In **Settings → Pages → Build and deployment → Source** scegli **GitHub Actions**.
3. In **Actions** apri il workflow **Pubblica su GitHub Pages** e premi **Run workflow**. In seguito si avvia da solo a ogni modifica del branch predefinito.

Dopo circa 1 minuto l'app è su **https://marcodamore98.github.io/The-Logbook/**. Dal telefono aprila e scegli "Aggiungi a schermata Home".

## Configurare Google Calendar

1. Apri <https://console.cloud.google.com> e seleziona **lo stesso progetto di Firebase**.
2. **API e servizi → Libreria** → abilita **Google Calendar API**.
3. **Schermata consenso OAuth** → tipo *Esterno*, aggiungi gli ambiti `calendar.events` e `calendar.readonly`, e aggiungi il tuo indirizzo Gmail come *utente di test*.
4. **Credenziali** → apri l'ID client OAuth "Web client (auto created by Google Service)". In *Origini JavaScript autorizzate* aggiungi `https://marcodamore98.github.io` (e `http://localhost:5173` se sviluppi in locale).
5. Copia l'ID client in `GOOGLE_CLIENT_ID` dentro `src/lib/config.ts`.
6. Nell'app vai su **Impostazioni → Google Calendar → Collega**. Poi scegli il calendario su cui scrivere (consiglio di creare un calendario dedicato, es. "Turni") e quali calendari mostrare.

Il token di Google dura circa un'ora. Quando scade, in alto compare "Ricollega Google". Le modifiche fatte nel frattempo restano in sospeso e vengono inviate con *Sincronizza elementi in sospeso*.

Struttura dei dati in Firestore: `users/{uid}/meta/settings`, `users/{uid}/days/{YYYY-MM-DD}`, `users/{uid}/photos/{id}`.

## Struttura del codice

```
src/
  lib/
    types.ts            modello dati (DayEntry, moduli, Settings)
    vocab.ts            vocabolari standardizzati e turni predefiniti
    stats.ts            aggregazioni ed export CSV
    config.ts           configurazione pubblica Firebase / Google
    store/              repository locale (IndexedDB) e cloud (Firestore) + contesto React
    google/             client Google Calendar (GIS) e sincronizzazione bidirezionale
  components/           icone "ink & wash", controlli, editor delle schede
  pages/                Giorno, Mese/Settimana, Statistiche, Impostazioni
```
