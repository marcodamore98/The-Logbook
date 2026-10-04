# Prompt per Google Stitch — The Logbook

*Aggiornato al 4 ottobre 2026 (banner lime più piccoli e discreti), dopo il restyling Stitch portato nell'app principale. Questo file viene aggiornato a ogni modifica dell'app (vedi `CLAUDE.md`).*

**Stato delle schermate**

| Prompt | Schermata | Stato |
|---|---|---|
| 0 | Stile e sistema di design | applicato |
| 1 | Pagina del giorno | applicato |
| 2 | "Aggiungi scheda" e schede unite | applicato |
| 3 | Palestra e dettaglio esercizio | applicato |
| 4 | Allenamento in corso | da rigenerare se vuoi un restyling |
| 5 | Fine allenamento | applicato |
| 6 | Corsa | applicato |
| 7 | Alimentazione | applicato |
| 8 | Corsi e congressi, archivio attestati | applicato |
| 9 | Diario | applicato |
| 10 | Mese e Settimana | applicato |
| 11 | Statistiche | applicato |
| **12** | **Menu, pannello Corpo, Impostazioni** | **in sospeso: da generare in Stitch** |
| 13 | Versione desktop | applicato |

**Come usarli.** In Stitch scegli **App (mobile)**, incolla il **Prompt 0** (stile e regole) e genera. Poi incolla i prompt delle schermate uno alla volta, nella stessa conversazione, così Stitch mantiene lo stile. Se una schermata esce troppo diversa, aggiungi in coda: *"Keep exactly the design system from the first screen: same colors, font, radius, icon style."*

I prompt sono in inglese (Stitch rende meglio), i testi dell'interfaccia restano in italiano. Descrivono l'app com'è oggi: rigenerando una schermata ottieni una proposta di restyling coerente con quello che l'app sa già fare.

---

## Prompt 0 — Stile e sistema di design

```
Design a mobile-first progressive web app called "The Logbook": a personal daily diary for a hospital doctor (obstetrics and gynecology resident who also works night shifts as a locum GP) who trains in the gym and runs. Each day is a "page" summarizing work, training, nutrition and private life. Interface language: Italian. Primary device: Android phone in DARK MODE (design dark first, then a light variant).

VISUAL STYLE — modern, bold and friendly, like the best fitness apps (Hevy, Strava, Lifesum) but calm and uncluttered.
- Dark mode: background #131313, cards #222223 with a 1px #333335 border, secondary surfaces #2C2C2E, text #F4F4F1, secondary text #C8C8C4, muted #8D8D92.
- Light mode: background #E8E8E5 (paper grey), cards #FFFFFF with a very soft shadow, text #1D1D1F, muted #7A7A82.
- Brand accents: LIME #D6F25F (primary actions, "today", key numbers in dark mode) and LAVENDER #B9B0F5 (secondary highlights). In dark mode primary buttons are lime with dark text; in light mode primary buttons are charcoal #1D1D1F with white text. Coral #E8603C for destructive actions, amber #E9B949 for personal records, water blue #6BB9F5 for hydration.
- Shapes: cards 22px radius, inputs 12px radius with no border (filled with the background color), chips and buttons fully rounded (pill). Generous spacing, 16px side gutters.
- Typography: Plus Jakarta Sans everywhere. Page titles bold; big numbers extra-bold with tight letter spacing; small UPPERCASE muted labels (10–11px, letter-spaced) above titles and values.
- Icons: each section has a round PASTEL DISC (lime, lavender, mint #A6E9C4, sky #B3D8F7, peach #FFBD9C, lilac #DCBDF5, sand #DCDAD0) with a thin dark hand-drawn line icon on top. Never use Material Symbols or filled glossy icons.
- Tiles: key numbers live in small rounded tiles (surface #2C2C2E) with an uppercase label on top and a big extra-bold value; lime for the main value in dark mode.
- Two-way switches: dark track, the active option is a raised pill with LIME text.
- Charts: minimal, rounded bars, thin lines with dots, donuts with a thick stroke; lime as the main series in dark mode, lavender as the second; goals as a dashed line.
- "Lime banner": a SLIM lime pill (about 40px tall, 14px semibold dark text, small "›" at the right) for navigation commands and "start" actions (e.g. "Apri il diario alimentare ›"); two of them can sit side by side ("Inizia allenamento ›" | "Inizia corsa ›"). It must stay discreet and never dominate the card.
- "‹ Pagina del giorno": a small quiet pill (12px text) with a light lime tint and lime text in dark mode, not a filled lime button.

LAYOUT AND BEHAVIOUR
- Top bar: hamburger + app logo + "The Logbook" on the left (tap opens the left menu), the current section name in muted text, a small "Ricollega Google" ghost pill only when the Google session expired, and on the right a pill button "♡ Corpo" that opens the right "Corpo" panel. No bottom tab bar.
- Under the top bar, on every section except the day page, a small quiet lime-tinted pill "‹ Pagina del giorno".
- Sections are collapsible cards: pastel-disc icon, small uppercase category label above a bold title (LAVORO, AGENDA, SPORT, SALUTE, FORMAZIONE, TEMPO LIBERO, PERSONALE), one-line summary when collapsed, a six-dot drag handle and a chevron inside a round grey button. Cards can be reordered with a long press.
- Gestures (show as states, not as arrows): swipe left/right moves between days or tabs following the finger; swipe from the left edge opens the menu; swipe down closes bottom sheets; back closes the topmost overlay.
- Deletions never use confirmation dialogs: a dark snackbar with a coral dot says "Allenamento eliminato · ANNULLA" (ANNULLA in lime, uppercase).
- Bottom sheets have a grabber, a centered bold title, a round × at the right, lime primary action and a neutral "Annulla" pill.
- Floating only: the active-workout bar and the rest timer at the bottom.
- Tone: quiet and professional, no confetti, no emoji. Never invent data the app does not record (no heart rate, HRV, cadence, calories burned by a watch, ECM "targets", patient IDs).
```

---

## Prompt 1 — Pagina del giorno

```
Screen: the day page for Sunday 4 October 2026 (dark mode).
Header on two rows: round prev chevron, bold "Domenica 4 ottobre" with a lime "OGGI" badge, round next chevron; below, a muted line "Turno 08:00–14:00 · Guardia 20:00–08:00 · Settimana 40" and two round icon buttons (reorder sections, print).
Under the header a row of pills: "SONNO 7,3 h" (lavender value), "ACQUA 1,5 L" (blue value), "PASSI 8.200" — tapping opens the Corpo panel.

Cards in this order:
1. LAVORO "Turno" (only if there is a shift that day): "TIPO TURNO" as a pill with the shift colour dot ("● Reparto ▾"); two time tiles "DALLE 08:00" and "ALLE 14:00" (label inside, big bold time); "IN TURNO CON" with name pills "Sgro ×" and a dashed lime pill "+ Aggiungi collega"; a note line with an icon "Aggiungi una nota al turno…"; inside, a collapsed sub-card "Tabellone · 4 attività".
2. LAVORO "Guardia medica": only two time tiles DALLE / ALLE and a trash icon.
3. Three tiles above the surgery cards: "INTERVENTI 2", "TEMPO OPERATORIO 3h 40m", "COMPLICANZE 0".
4. LAVORO "Attività chirurgica" cards (collapsed, summary "Isterectomia laparoscopica · Primo operatore").
5. AGENDA "Impegni" ("14:30 Journal club") and AGENDA "Da ricordare" ("2 da fare · Firmare lettere") side by side, compact, each with a round "+".
6. SPORT "Allenamento": a summary block "Push" with an amber banner "👑 Nuovo record · Panca piana 82,5 kg × 6" and three tiles CARICO SOLLEVATO 975 kg (lime) · DURATA 1h 02m · ORARIO 07:00–08:02; a run block with tiles DISTANZA 5,20 km · DURATA 21:40 · PASSO 4:10/km; a "QUESTA SETTIMANA · 2 h 53 min" mini bar chart L–D with the current day ringed in lime. If nothing is logged: two slim lime pills side by side "Inizia allenamento ›" | "Inizia corsa ›".
7. SALUTE "Alimentazione" — a normal collapsible card with drag handle and round chevron like the others; collapsed summary "1.850 / 2.300 kcal · proteine 120 / 175 g"; open: "Calorie 1.850 / 2.300 kcal" with a lime progress bar, "Proteine 120 / 175 g" with a thin lavender bar, lime banner "Apri il diario alimentare ›".
8. FORMAZIONE "Corsi e congressi" (collapsed) showing a box: "● Congresso SIGO" with a date pill "4 OTT – 7 OTT" and chips "📎 Programma", "👑 Attestato".
9. PERSONALE "Diario": italic muted "Nessuna pagina scritta per questo giorno." and a ghost "✎ Scrivi" pill on the same row.
At the bottom a dashed full-width pill "+ Aggiungi scheda" (lime text in dark mode).
Also show the snackbar state: "● Guardia medica eliminata   ANNULLA".
```

---

## Prompt 2 — "Aggiungi scheda" e schede unite

```
Bottom sheet "Aggiungi una scheda" (grabber, centered title, round ×) over the dimmed day page. One tap adds the card immediately.
TURNI: two tiles side by side "Turno · Turno in ospedale" and "Guardia medica · Dalle … alle …" (each shown only if missing that day).
ATTIVITÀ: three rows with a pastel icon, title, one-line hint and a round outlined "+" on the right: "Attività chirurgica e clinica", "Studio, corsi e congressi", "Viaggi e uscite".

Then show three opened cards, each with a two-way switch at the top (dark track, active option lime):
(a) [Chirurgica | Clinica] — "Intervento / procedura" search field with a magnifier and a dropdown of matches; "Ruolo in sala" chips (selected chip lime with ✓); "Via d'accesso" chips; regime and duration; a "Complicanze" switch that, when on, reveals "Grado Clavien-Dindo"; tutor; notes.
(b) [Studio | Corsi e congressi] — type chips "Corso · Congresso · Webinar"; title; "Luogo" with a pin icon; "Crediti ECM"; date tiles DAL / AL and a tile ORA DI INIZIO; a boxed row with a bell "Avvisami 30 e 5 minuti prima" and a lime switch; "DOCUMENTI ALLEGATI (PDF)": rows "📎 Programma" and "📎👑 Attestato" with file name and trash.
(c) [Viaggio | Gita / uscita] — title; type select; "Luogo" with a pin icon; "Con chi" as name pills "Elena ×", "Marco ×" and a lime "+ Aggiungi"; "Racconto".
```

---

## Prompt 3 — Palestra e dettaglio esercizio

```
Screen: "Palestra" (dark mode). Title "Palestra" with a pill "🔥 3 sett. di fila" (consecutive weeks with a workout). Lime two-way-style switch with four options Routine · Storico · Esercizi · Progressi.
Routine tab: "Nuova routine" (grey) and lime "Inizia un allenamento vuoto" side by side. Routine cards: coloured disc with a dumbbell, name "Push", muscles "Petto · Tricipiti · Spalle", exercises on one line "Panca piana · Panca inclinata · Spinte manubri · +1", a divider, "2 giorni fa · 62 min" and a small lime pill "Inizia"; "⋯" menu.
"Panoramica 7 giorni": tiles ALLENAMENTI 2 (lime) and VOLUME TOTALE 2.923 kg (lavender) with "+14% vs 7 giorni prima"; card "Volume per giorno" with rounded bars and today ringed; card "Serie per muscolo · 7 giorni" with coloured horizontal bars (lime, lavender, mint…).
Exercise detail sheet: initials avatar, label DETTAGLIO ESERCIZIO, "Panca piana con bilanciere", "Petto · Bilanciere"; tabs Sommario / Cronologia; two big tiles PESO MASSIMO 82,5 kg (5 rip.) and 1RM STIMATO 96,3 kg in amber ("formula di Epley"); line chart with period select and metric chips; "ULTIME SERIE REGISTRATE" as pills with an amber "PR" badge on the record; "ALTRI RECORD" list.
```

---

## Prompt 4 — Allenamento in corso (stile Hevy)

```
Screen: active workout (dark mode). Header: back chevron, big bold editable title "Push" (tap to edit, a ✓ to confirm), date below, trash icon.
A stats row with three columns: "Durata 0:42:10", "Volume 4.300 kg", "Serie 18".
Exercise blocks: round avatar, exercise name in lime (tappable → detail sheet), "⋮" menu, an auto-growing notes field, a single line "Riposo: 2 min 30 s ▾".
Set table columns: SERIE · PRECEDENTE · KG · RIP · ✓. Completed rows lime-tinted with a lime check; a small gold crown on a personal record. One row swiped left revealing a coral "Elimina". Sets must be ticked in order.
Below the last exercise: "+ Aggiungi esercizi" and, at the very bottom, the lime "Termina" pill.
Floating at the bottom: a dark rest bar "Recupero 1:29" with −15 / +15 / × and a thin lime progress line; dragged up it becomes a full-screen stopwatch.
```

---

## Prompt 5 — Fine allenamento

```
Three steps, dark mode:
(a) Dialog: round icon on top, "Vuoi terminare l'allenamento?", muted "Verrà salvato nella pagina del giorno.", lime "✓ Termina e salva", grey "Torna all'allenamento", coral-outlined "Abbandona ed elimina".
(b) Full screen "Salva allenamento" (back chevron, lime "Salva" top right): a card with a lime dumbbell disc and the big editable name "Push"; three tiles DURATA (editable minutes) · VOLUME · SERIE; a card "Note sull'allenamento"; a card with a round lime check "Salva questo allenamento come routine · Crea una nuova scheda pronta per i prossimi allenamenti"; an underlined coral link "Abbandona ed elimina allenamento".
(c) Full screen "Ottimo lavoro!": big lime check disc with a soft glow, lavender "Push completato · oggi · 09:53", muted "È il tuo allenamento numero 4"; one card with three numbers divided by hairlines DURATA 60 min · VOLUME 1.225 kg (lime) · SERIE 3; an amber-bordered card "👑 2 nuovi record personali" with rows "Panca piana con bilanciere · 85 kg × 5 rip · +2,5 kg"; lime "Fine" at the bottom.
```

---

## Prompt 6 — Corsa (senza mappa)

```
Screen: "Corsa" (dark mode). Subtitle "Ultimi 7 giorni: 12 km · 1:04:55".
Card "Che corsa fai?" with a lime running disc: switch "Continua | A intervalli", checkbox "Usa il GPS (disattivalo per il tapis roulant)"; for intervals a select "Sessione preimpostata o salvata", a generator (ripetizioni, corsa veloce, recupero, riscaldamento, defaticamento, lime "Crea le fasi") and the list of phases with coloured left borders; "Salva questa sessione".
Live card: a lime pill "RISCALDAMENTO" with "9:57" remaining in lime, a lime progress bar, "Fase 1 di 13 · poi Corsa veloce 400 m"; a tile "PASSO ATTUALE 5:18 min/km"; three tiles TEMPO · KM · PASSO MEDIO; a small "GPS ok (±6 m)" pill; a big lime "❚❚ Pausa" and below two pills "⏭ Salta fase" and coral "■ Termina".
"Le tue corse": cards with a running disc, "3 OTT" and a tag "CONTINUA" / "INTERVALLI", title, "5,20 km · 28:40 · 5:31 /km", chevron, trash.
Run summary (no map): "Corsa completata!" lime header; a card DISTANZA TOTALE "4,36 km" with a comparison line; three tiles TEMPO · PASSO MEDIO (km/h below) · PASSO MAX (lime, km/h below); "● Split al chilometro" rows with index boxes and bars, the fastest with a lime left rule and badge "⚡ Miglior split"; "● Ripetute" rows "R1 400 m in 1:26 · 3:35 /km", the best with an amber rule and badge "Ripetuta migliore"; title, notes, lime "Salva la corsa".
```

---

## Prompt 7 — Alimentazione

```
Screen: food diary (dark mode), swipe between days. A day strip "‹ Oggi, dom 4 ottobre ›".
Summary card: big centered lime ring "1.637 KCAL RIMANENTI", a line "663 mangiate · 2.300 obiettivo · — attive", then three macro rows with coloured dots and bars: Proteine (lavender) 63 / 175 g, Carboidrati (lime) 95 / 260 g, Grassi (blue) 4 / 65 g.
Meal cards Colazione, Pranzo, Cena, Spuntini: meal icon, title with "245 kcal · P 22 g" under it, a round "+" (lime in dark), food rows "Yogurt greco · 170 g · P 17 · C 6,8 · G 0" with kcal at the right.
Water card "1 L / 2,5 L" in blue, a row of glasses and a pill "+ 250 ml".
"Ultimi 7 giorni · Calorie assunte · 1.969 kcal media": rounded bars with a dashed goal line labelled "2.300", today in lime.
Bottom sheet "Aggiungi a Colazione": chips with small icons (Cerca, Recenti, Preferiti, Codice a barre, Nuovo alimento, Aggiunta rapida); search field with a magnifier and a round ×, "Cerca prodotti online"; results as rows with a coloured initial disc, name, "370 kcal / 100 g · P 13 · C 60 · G 7" and a star. The chosen food gets a lime border and opens right below it: "PORZIONE RAPIDA" 2×2 grid, a "Grammi − 40 g +" stepper, a summary "● 148 kcal · Proteine 5,2 g · Carboidrati 24 g · Grassi 2,8 g", "Pasto" select, lime "Aggiungi a Colazione ›" and a link "Annulla o scegli un altro alimento".
```

---

## Prompt 8 — Corsi e congressi e archivio attestati

```
Screen: "Corsi e congressi" (dark mode). A lime-tinted banner with a folder tile "Archivio attestati ● 3 PDF · Tutti gli attestati in un posto ›".
Groups "● ATTIVITÀ FORMATIVE 2026 · 3 EVENTI". Cards: type chip (Corso mint, Congresso lavender, Webinar peach) and "✓ 12 crediti ECM"; at the right a time pill with a bell (filled lime when the reminder is on, crossed out when off) "09:00"; big title; "📅 2–5 ottobre 2026 · Roma"; underlined "📎 Programma (PDF)"; lime "👑 Vedi attestato ›" or an outlined "+ Aggiungi l'attestato".
"Archivio attestati": back link, "3 attestati · 26 crediti ECM", a lime folder disc; search field; chips "Tutti (3) · 2026 (2) · 2025 (1)"; per year "2026 ● 2 attestati" with an ECM pill; a 2-column grid of tiles: coloured disc with a paperclip-crown icon, amber "12 ECM" pill, title (2 lines), date, footer "PDF · 1,3 MB →".
```

---

## Prompt 9 — Diario

```
Screen: "Diario" (dark mode), swipe between days. A strip "‹ 📖 Domenica 4 ottobre 2026 ›" with "PAGINA 3" in lime under the date.
A lime banner "Salta alle pagine scritte" with a dark pill "3 pagine ›" and a round print button next to it. A row "‹ Prec. · date picker · Succ. ›" to jump between written pages.
The page card: comfortable text, "✎ Modifica"; a section "Foto della giornata (3)" with a round "+" and a 3-column grid of square photos.
A collapsible "Tutte le pagine · 3 scritte" list.
Print sheet "Stampa il diario": chips Questo mese · Ultimi 30 giorni · Quest'anno · Tutto, date tiles DAL / AL, a card with a round lime check "Includi le foto della giornata · 2 pagine nel periodo scelto", lime "Genera l'anteprima di stampa (PDF) ›", "Annulla".
```

---

## Prompt 10 — Mese e Settimana

```
Both screens start with a switch "Mese | Settimana | Giorno".
"Mese" (dark mode): "‹ Ottobre 2026 ›" with a pill "Mese corrente" (or a lime "Oggi" link); summary pills "● 3 Turni", "● 1 Guardie", "● 4 Allenamenti", "● 1 Interventi"; a card with the 7-column grid (LUN…DOM, SAB lavender, DOM lime): each cell a rounded tile with the day number, a tiny tag tinted with the shift colour "08-14", and coloured dots for activities; today with a lime border and the number in a lime pill; days outside the month faded; a legend "Sala / clinica · Palestra · Corsa · Studio e corsi · Tempo libero". Tapping a day shows a preview card below: "Domenica 4 ottobre OGGI", shift pills "Turno · 08:00–14:00", activity rows with icon discs, "1 impegno in agenda", lime "Apri la pagina del giorno ›".
"Settimana": a strip "‹ Settimana 40 · 28 settembre – 4 ottobre 2026 ›" with "Oggi"; three tiles LAVORO 30 h (4 turni) · ALLENAMENTO 4 (lime, di cui 2 corse) · FORMAZIONE 1,5 h (lavender); then one card per day: "GIO 1 OTTOBRE ›", a shift pill "Turno · 08:00–14:00", calendar items with a lavender left rule, activity rows with icon discs; today with a lime border and an "OGGI" badge.
```

---

## Prompt 11 — Statistiche

```
Screen: "Statistiche" (dark mode). Lime switch Settimana · Mese · Anno; a strip "‹ Ottobre 2026 🖨 ›".
"Il periodo in sintesi" as a bento grid: a full-width lime tile "OSPEDALE E TURNI · 192 h di turno · 28 turni · 4 notti"; tiles CHIRURGIA "18 interventi" with a lavender pill "11 da primo (61%)", CLINICA "32 prestazioni cliniche", STUDIO "6 h di studio", PALESTRA "10 allenamenti · 12 h in palestra" (lime value); full-width rows "3 corse · 22,4 km (lime) · passo medio 5:28/km" and "1 gita o uscita".
"Tempo e obiettivi": donut of hours (turni, studio, allenamento) and rings (promemoria completati, giorni nel target calorico, interventi da primo operatore).
"Andamento" with a metric select and rounded bars.
"Chirurgia" card with CSV export: a split box PRIMO OPERATORE 11 (61%) | ALTRI RUOLI 7 (39%); "Per area" as one rounded stacked bar with a legend; "Via d'accesso" as small tiles (Laparoscopico 12 · Laparotomico 4 · Vaginale 2); "Interventi più frequenti" and "Ruolo" as lime bars; complications and operative time line.
Then cards Turni (per tipo, colleghi in turno), Attività clinica, Studio, Allenamento, Corsa (progressione del passo), Vita privata, Impegni e promemoria, Alimentazione (ripartizione delle calorie), Corpo (medie). Print sheet "Stampa / PDF" with checkboxes per section.
```

---

## Prompt 12 — Menu, pannello "Corpo", Impostazioni  ⟵ IN SOSPESO: da generare

```
(a) Left menu drawer over a dimmed page: logo + "The Logbook", close ×; items with big pastel-disc icons: Mese, Settimana, Oggi (calendar icon with today's number), Diario, Palestra, Corsa, Alimentazione, Corsi e congressi, Statistiche, Impostazioni. Active item = lighter pill.
(b) Right panel "Corpo" (dark): lime "OGGI" badge, bold date, round close ×. RIEPILOGO: shifts line with hours, "2 interventi", "Push · 975 kg · 2 serie". Card CORPO: two-column inputs with pastel icons and goals — "Peso / 80 kg", "Massa grassa %" with a small lime link "Calcola" under it, "Sonno / 7 h", "Passi / 8500", "Acqua / 2,5 L" with thin progress bars; a row of 8 small water glasses and a pill "+ 250 ml". (No resting heart rate: it will come later from a smartwatch.) Card BILANCIO ENERGETICO: a small lime ring with "1.305 KCAL RIMANENTI · 1.095 mangiate / 2.400", assunte, proteine, calorie attive input, lime link "apri il diario alimentare". Card "PESO · 30 GIORNI": line chart with dots and 7-day averages. Collapsible "Obiettivi".
(c) Bottom sheet "Calcola la massa grassa": short muted explanation (US Navy method, ±3–4%), chips "Donna | Uomo", inputs in cm with hints — Altezza (viene ricordata), Collo (appena sotto la laringe), Vita (nel punto più stretto), Fianchi (nel punto più largo dei glutei); big result "27,6% massa grassa stimata" in lime; lime "Usa questo valore ›", neutral "Annulla".
(d) Impostazioni: collapsible cards Account e dati, Google Calendar (calendar select, "Ricollega"), Tabellone di reparto, Colleghi (groups "Strutturato · 16", "Specializzando · 23"), Tipi di turno (name, color, start, end).
```

---

## Prompt 13 — Versione desktop

```
Desktop (1440px) day page: persistent right "Corpo" sidebar 340px (cards CORPO, BILANCIO ENERGETICO with the lime calories-left ring, PESO · 30 GIORNI), central column max 860px with the collapsible cards. Header: "‹ Domenica 4 ottobre OGGI" with a segmented "Ieri | Oggi | Domani", reorder and print buttons, "›"; subtitle with shifts and week number; Sonno / Acqua / Passi pills. "Impegni" and "Da ricordare" always side by side. Same dark style; the "Corpo" button in the top bar is hidden because the sidebar is always visible. No search bar, notifications or avatar.
```
