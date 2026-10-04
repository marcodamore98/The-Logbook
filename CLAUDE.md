# The Logbook — regole di lavoro

Diario quotidiano (PWA) per una specializzanda in ginecologia e ostetricia. Interfaccia e messaggi all'utente in italiano.

## Rami e pubblicazione

- `claude/bold-cray-v91cjk` — app principale, pubblicata su `/<repo>/`.
- `claude/prova-navigazione` — versione di prova, pubblicata su `/<repo>/prova/`. Le modifiche grandi si fanno prima qui.
- `claude/copia-precedente` — copia dell'app principale **prima dell'ultimo aggiornamento**, pubblicata su `/<repo>/precedente/`.

**Prima di ogni passaggio di modifiche nell'app principale** (merge della prova o modifiche importanti): sposta `claude/copia-precedente` sul commit attuale dell'app principale e fai push, *poi* aggiorna l'app principale. Così resta sempre online la versione precedente alle modifiche.

Restiamo una web app (PWA): niente APK/app native finché l'utente non lo chiede.

## Prompt di Google Stitch

`docs/stitch-prompt.md` descrive l'app com'è. **A ogni modifica dell'interfaccia o delle funzionalità aggiorna nello stesso commit il prompt della schermata coinvolta** (e la tabella "Stato delle schermate"), poi **avvisa l'utente** nella risposta con una riga del tipo: "Ho aggiornato il prompt di Stitch: Prompt N (…)".

In sospeso: il **Prompt 12** (Menù, pannello "Riepilogo del giorno", Impostazioni) non è ancora stato generato dall'utente; quando arriva il suo HTML, applicalo come gli altri.

## Design

- Palette lime `#D6F25F` / lavanda `#B9B0F5` / antracite, Plus Jakarta Sans, icone disegnate su dischi pastello (non usare Material Symbols).
- Quando arriva un HTML di Stitch: riporta solo ciò che l'app sa già fare o che l'utente approva; escludi dati inventati (FC, HRV, cadenza, ID pazienti, target ECM…) e dillo.
- Le kcal rimanenti nel pannello "Riepilogo del giorno" (ex Corpo) restano. Il pannello si apre scorrendo dal bordo destro, il Menù dal bordo sinistro o con ☰; niente pulsante "Corpo" in alto.

## Verifica

`npx tsc -b`, `npm run build`, e per l'interfaccia screenshot Playwright su viewport 412×915 in modalità scura (e chiara quando cambia il colore).
