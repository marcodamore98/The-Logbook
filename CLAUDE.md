# The Logbook — regole di lavoro

Diario quotidiano (PWA) per una specializzanda in ginecologia e ostetricia. Interfaccia e messaggi all'utente in italiano.

## Rami e pubblicazione

- `claude/bold-cray-v91cjk` — **l'app in uso**, pubblicata su `/<repo>/`. Tutte le modifiche vanno direttamente qui (l'utente non vuole versioni di prova).
- `claude/copia-precedente` — copia dell'app **prima dell'ultimo aggiornamento**, pubblicata su `/<repo>/precedente/`: serve solo per tornare indietro su cose minori.
- `claude/prova-navigazione` — non più usato; tienilo allineato all'app principale (o ignoralo).

**Prima di ogni aggiornamento dell'app**: sposta `claude/copia-precedente` sul commit attuale dell'app principale e fai push, *poi* fai push delle modifiche. Così resta sempre online la versione precedente.

Restiamo una web app (PWA): niente APK/app native finché l'utente non lo chiede.

## Prompt di Google Stitch

`docs/stitch-prompt.md` descrive l'app com'è. **A ogni modifica dell'interfaccia o delle funzionalità aggiorna nello stesso commit il prompt della schermata coinvolta** (e la tabella "Stato delle schermate"), poi **avvisa l'utente** nella risposta con una riga del tipo: "Ho aggiornato il prompt di Stitch: Prompt N (…)".

Tutti i prompt (0–13) sono stati applicati; quando arriva un nuovo HTML di Stitch, confrontalo con l'app e chiedi all'utente quali differenze portare.

## Design

- Palette lime `#D6F25F` / lavanda `#B9B0F5` / antracite, Plus Jakarta Sans. Icone: **Material Symbols Rounded** (quelle di Stitch) in inchiostro scuro sui dischi pastello (`Icon*` in `src/components/icons.tsx`) e, senza disco, nei pulsanti (`Sym`). Sono tracciati SVG copiati in `src/components/ms.ts` (niente font, funzionano offline): per una nuova icona copia il `d` da `@material-symbols/svg-400/rounded/<nome>.svg`.
- Quando arriva un HTML di Stitch: riporta solo ciò che l'app sa già fare o che l'utente approva; escludi dati inventati (FC, HRV, cadenza, ID pazienti, target ECM…) e dillo.
- **Tutto ciò che si può spostare sopra/sotto si sposta tenendo premuto e trascinando** (schede del giorno, esercizi, serie, fasi della corsa, promemoria, spesa, "Ordina le sezioni"…): usa `useSortableList` / `useBlockDrag` (`src/components/useBlockDrag.ts`) e, sulle righe fatte solo di campi, la maniglia `DragGrip`. Vale anche per ogni nuovo elenco ordinabile. Durante il trascinamento i blocchi grandi (schede, esercizi con le serie) diventano righe di una sola linea (`useBlockDrag(..., { compact: true })` + stile `.is-compacting`).
- **Scorrere verso sinistra elimina direttamente**: compare il rosso "Elimina" sotto il dito e, oltre la soglia, al rilascio l'elemento sparisce (con "Annulla"), senza dover toccare un pulsante.
- **Serie in palestra**: peso, ripetizioni o tempo scritti in una serie non di riscaldamento si copiano nelle serie successive non ancora spuntate.
- **Attività chirurgica e clinica**: una scheda per giorno contiene l'elenco dei pazienti ("Paziente 1, 2…", mai dati identificativi), ognuno con più procedure/prestazioni e un ruolo per ciascuna (`src/components/modules/WorkLogEditors.tsx`, dati letti tramite `src/lib/worklog.ts`, che converte le vecchie schede a intervento singolo). Pazienti, procedure, Tutor e Complicanze si riducono con la freccetta; le complicanze stanno in fondo. Gli interventi seguono le linee guida ESGO; la statica pelvica è divisa in tempo demolitivo e ricostruttivo; le combinazioni (`PROCEDURE_COMBOS`) aggiungono procedure separate; i gruppi salvati dall'utente (`settings.procedureGroups`, nome modificabile, "Gruppo N") si caricano su un paziente e, se modificati, si aggiornano o si salvano come nuovo gruppo. In `vocab.ts` gli id non si cambiano mai: le voci superate restano con `legacy: true`.
- **Corsi e congressi**: i webinar sono di un solo giorno e al posto del luogo hanno il "Link per accedere"; corsi e congressi hanno il luogo che si apre in Google Maps (`src/lib/links.ts`). Il programma accetta PDF e foto (più file), l'attestato solo PDF. Gli eventi di Google Calendar che iniziano con "Webinar:", "Corso:" o "Congresso:" diventano da soli schede Corsi e congressi (`pullFromGoogle` in `src/lib/google/sync.ts`).
- **Orari e durate si impostano con le rotelle** (come la sveglia): `TimeField` per gli orari (ore : minuti), `DurationField` per le durate (minuti : secondi, oppure ore : minuti con `unit="min"`), in `src/components/WheelPicker.tsx`. Toccando il numero al centro si può scriverlo, ma solo valori sensati (ore 0–23, minuti e secondi 0–59). Niente `<input type="time">` o campi numerici liberi per tempi.
- **Statistiche**: una scheda riducibile per argomento, come nella pagina del giorno (Lavoro, Formazione, Sport, Salute, Agenda, Tempo libero); ognuna apre con 2–4 numeri chiave con ▲▼ rispetto al periodo precedente e poi solo grafici utili (`src/components/charts.tsx`: colonne nel tempo, linee per le progressioni, barre orizzontali per le classifiche, barra a segmenti per le parti di un tutto, ruoli in un solo colore dal più scuro al più chiaro). Niente torte o anelli; i colori a più categorie (`--cat-1..3`) sono verificati per il daltonismo.
- Le kcal rimanenti nel pannello "Riepilogo del giorno" (ex Corpo) restano. Il pannello si apre scorrendo dal bordo destro, il Menù dal bordo sinistro o con ☰; niente pulsante "Corpo" in alto.

## Verifica

`npx tsc -b`, `npm run build`, e per l'interfaccia screenshot Playwright su viewport 412×915 in modalità scura (e chiara quando cambia il colore).
