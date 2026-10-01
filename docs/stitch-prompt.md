# Prompt per Google Stitch — The Logbook

Come usarli: in Stitch carica prima l'immagine di riferimento, poi incolla il **Prompt 0** (stile e regole), scegli "mobile" e genera. Poi incolla uno alla volta i prompt delle schermate (1–7). Alla fine genera la versione desktop della pagina del giorno (prompt 8).

Se Stitch ignora il riferimento, aggiungi in coda a ogni prompt: *"Match the visual style of the attached reference image exactly: same colors, typography, spacing, corner radius."*

---

## Prompt 0 — Stile e sistema di design

```
Design a mobile-first progressive web app called "The Logbook": a personal daily diary for a hospital surgeon (obstetrics, gynecology and urogynecology resident) who also works as a locum GP doctor, and trains in the gym. Each day is a "page" that summarizes work, training, nutrition and private life. The interface language is Italian.

VISUAL STYLE — minimal, calm, clean, editorial, like a premium paper journal translated to a modern app. Match the attached reference image.
- Warm paper background (#F7F4EE), cards in warm white (#FFFDF9), 1px hairline borders (#E6E0D5), very soft shadows, 14px corner radius, generous whitespace and 16px side gutters.
- Text: ink (#2B2A27), secondary (#57534B), muted (#8A8479). Accent: terracotta (#A4492F) used sparingly for today, primary actions and highlights.
- Typography: a refined serif for page titles and big numbers (Fraunces), a clean humanist sans for everything else (Inter). Large calm titles, small uppercase muted labels for sections.
- Icons: artistic hand-drawn "ink and watercolor" icons — a thin ink line (1.5px) over a soft pastel watercolor blot behind it. Each area has its own pigment: shifts rose, surgery terracotta, clinical rose, study indigo, gym sage, nutrition sage/green, calendar ochre, stats indigo, notes sand, photos teal. Never use filled glossy or generic material icons.
- Data colors: one calm blue (#2A78D6) for charts and progress bars; sage green for "done"; amber for records. Charts are minimal: thin bars with rounded tops, hairline grid, no 3D, no gradients.
- Supports light and dark mode (dark: warm charcoal #1C1B19, cards #252422, same accents slightly lighter).

LAYOUT RULES
- Collapsible cards: every section is a card with a title, a one-line summary visible when collapsed, and a small chevron on the right. Expanded cards show full details. Keep pages short and scannable.
- Navigation: a left drawer opened by tapping the app name/logo at the top left (hamburger + logo + "The Logbook"). Drawer items with the watercolor icons: Mese, Settimana, Oggi (a calendar icon showing the current day number), Palestra, Alimentazione, Statistiche, Impostazioni. A second right-side drawer "Corpo" opens from a small ghost button at the top right.
- Bottom area: no tab bar; the content breathes. Floating elements only for the rest timer (dark pill).
- Tone: quiet, professional, no gamification, no confetti, no emoji except a small mood icon.
```

---

## Prompt 1 — Pagina del giorno

```
Screen: "Oggi" — the daily page for Thursday 1 October 2026, mobile. Header: back chevron, serif title "Giovedì 1 ottobre 2026", and two small round icon buttons (reorder sections, print) plus a next-day chevron.

Cards in this order (a vertical stack, all collapsed except the first):
1. "Turno" (always open, no chevron): a left color bar in blue-grey. Row of fields: type "Sala operatoria", from 08:00 to 20:00, place "Ginecologia – S. Anna". Below, label "In turno con" and removable name chips (dark pills): "Sgro", "Paradiso" + a "+ Aggiungi collega" select. Hours badge "12 h" and a small "G" badge showing it is synced to Google Calendar. Under a dashed divider, a sub-section "GUARDIA MEDICA" with type "Guardia medica notturna", 20:00–08:00 and a notes field.
2. "Tabellone" collapsed, summary "Tu: SO · SOp · 17 attività".
3. Two side-by-side small cards "Impegni" (summary "14:30 Journal club") and "Da ricordare" (summary "2 da fare") — each with a "+" button and a chevron.
4. "Attività chirurgica" collapsed with summary "Sling medio-uretrale TOT/TVT-O · Primo operatore con tutor · Vaginale".
5. "Allenamento" collapsed, summary "Push A · 62′ · 4.300 kg · 18 serie · 2 PR", with a "+" button.
6. "Alimentazione" collapsed, summary "1.850 / 2.400 kcal · proteine 120 / 150 g".
7. "Note" collapsed, summary with a small category badge "Lavoro".
At the bottom a dashed full-width button "+ Aggiungi scheda".

Also show the state of the same screen with the "Alimentazione" card expanded: two big focus tiles side by side, "Calorie 1.850" and "Proteine 120 g", each with a thin progress bar toward its goal, a short list of meals with kcal and protein, and a ghost button "Apri il diario alimentare".
```

---

## Prompt 2 — Allenamento (registro)

```
Screen: workout logger "Push A", mobile, like the best gym tracker apps but calmer and more elegant, in the style defined above.

Top: back chevron, title "Push A", subtitle date. A rounded bar with a large serif running clock "0:42", a dark pill button "Termina allenamento" and muted stats "4.300 kg · 18 serie".
Below, a list of exercise cards. Each exercise card has: exercise name in bold ("Panca piana con bilanciere"), muted "Petto · Bilanciere", small up/down/trash icon buttons, a notes input, a rest-time selector "⏱ 2:30", and a ghost chip "⛓ Superserie con il successivo".
Inside, a compact set table with columns: SERIE, PRECEDENTE (muted, e.g. "70 × 8"), KG, RIP, RPE, and a square check button. Set rows: a small rounded badge with the set number; "W" in amber for warm-up, "D" in indigo for drop set, "F" in terracotta for failure. Completed rows have a soft sage background and a green check; a small amber "PR" badge appears next to a record set. Show one exercise in a superset with a purple left border and a letter tag "A" on two consecutive exercises.
A floating dark pill at the bottom: "Recupero · Panca piana 1:29 [−15] [+15] [×]" with a thin sage progress bar along its bottom edge.
Bottom actions: "+ Aggiungi esercizi", "Salva come scheda".
```

---

## Prompt 3 — Palestra (schede, esercizi, progressi)

```
Screen: "Palestra" hub, mobile. Title "Palestra", a primary dark button "Allenamento libero oggi" and ghost buttons. A segmented control with four tabs: Schede, Storico, Esercizi, Progressi.

Tab Schede: folders ("PPL") with routine cards in a responsive grid. Each routine card: title "Push", a small badge "Push", an exercise list like "4 × Panca piana con bilanciere", "4 × Panca inclinata al multipower", with a link icon for supersets, and three actions: primary "Inizia oggi", ghost "Modifica", "Duplica".
Also design the Progressi tab: two stat tiles (workouts this week, volume last 7 days in kg), a minimal bar chart "Allenamenti per settimana" (12 weeks), and horizontal bar lists "Serie per muscolo · 7 giorni" and "Split · 30 giorni". And an exercise detail view: big serif numbers for max weight and estimated 1RM, a small line/bar chart of 1RM over time and a list of recent sessions ("80×8 80×6 80×6").
```

---

## Prompt 4 — Alimentazione (diario alimentare, stile Lifesum)

```
Screen: "Alimentazione" food diary, mobile, in the spirit of Lifesum but calmer, with the paper-journal style defined above.

Top: date navigation. A summary card with a thick calorie ring (sage green, track warm grey) showing "1.305 kcal rimanenti" in the center in serif, next to three numbers "1.095 mangiate · 2.400 obiettivo · 450 attive", and below three thin macro bars: Proteine 67/150 g, Carboidrati 31/280 g, Grassi 3/70 g.
Then meal cards: Colazione, Pranzo, Cena, Spuntini — each with the meal name, total "245 kcal · P 22 g" and a round "+" button; inside, food rows (name + muted "170 g · P 17 · C 6,8 · G 0" and bold kcal at right). Empty meals show a ghost "+ Aggiungi alimento" and "Copia da ieri".
A water card with a row of 8 small glass icons (filled in blue watercolor when drunk), "1 L / 2,5 L".
A bottom sheet "Aggiungi a colazione": chips for tabs (Cerca, Recenti, Preferiti, Codice a barre, Nuovo alimento, Aggiunta rapida), a search field, a list of foods with kcal per 100 g and a star favourite toggle; and the quantity step with portion chips (½ porzione, 1 vasetto 170 g, 2 ×, 100 g), a numeric field, a live macro preview and a dark "Aggiungi" button. Also a barcode scanner state with a camera viewfinder.
```

---

## Prompt 5 — Mese e Settimana

```
Screen: "Mese" calendar for October 2026, mobile and tablet. Serif title "Ottobre 2026" with prev/next. A 7-column grid (Lun–Dom). Each day cell is a small rounded card: day number; below it colored pill chips for the shift ("Sala operatoria" in teal, "Notte" in indigo, "Riposo" grey, "Guardia medica notturna" in slate) — up to two chips; a tiny "2 impegni" label; and a row of tiny watercolor icons for logged modules (surgery, gym, study). Today has a terracotta outline. Days outside the month are faded.
Second screen: "Settimana" as a vertical list of 7 day cards on mobile (7 columns on desktop), each with weekday, big serif day number, shift chip and time range, Google-Calendar events marked with a teal left rule, and small module summaries with icons.
```

---

## Prompt 6 — Statistiche

```
Screen: "Statistiche", mobile. A segmented control Settimana / Mese / Anno, a title with prev/next, and a print button. A grid of six stat tiles with watercolor icons: ore di turno "192 h", interventi "18", prestazioni cliniche "32", studio "6 h", allenamenti "10", gite "1". Then a card "Andamento" with a metric dropdown and a minimal rounded-bar chart with a tooltip. Then themed cards: Chirurgia (bar lists by area, by procedure, by role, by approach, complications), Turni (by type, colleagues), Attività clinica, Studio, Allenamento (sessions, volume per exercise, sets per muscle), Alimentazione (daily averages), Impegni per categoria. Bar lists are single-hue blue with value labels in ink on the right. Print mode: show a "Stampa / PDF" sheet with checkboxes for the sections to include.
```

---

## Prompt 7 — Menu laterale, barra "Corpo" e Impostazioni

```
Three screens, mobile:
(a) Left navigation drawer over a dimmed page: header with logo and "The Logbook", then 7 items with large watercolor icons: Mese, Settimana, Oggi (calendar icon with the number 1), Palestra, Alimentazione, Statistiche, Impostazioni. The active item is a white pill with hairline border.
(b) Right drawer "Corpo": kicker "OGGI", serif date; section RIEPILOGO (shift line, workout line); CORPO with small input fields (Peso kg, Massa grassa %, Sonno h, FC a riposo bpm, Passi, Acqua L) each with a thin progress bar toward its goal; CALORIE (assunte, attive, proteine, daily balance); a small line chart "Peso · 30 giorni" with dots; weekly averages in a 2-column list; a collapsible "Obiettivi" section.
(c) Impostazioni: stacked collapsible cards (Account e dati, Google Calendar, Tabellone di reparto, Personal trainer, Colleghi, Tipi di turno). Inside "Colleghi", sub-groups "Strutturato · 16" and "Specializzando · 23" each with its own chevron; rows with a name field, a role field and a trash icon.
```

---

## Prompt 8 — Versione desktop

```
Desktop version (1440px wide) of the "Oggi" daily page: the persistent right sidebar "Corpo" (320px, hairline left border) next to a central column of max 860px with the collapsible cards. Top bar: hamburger + logo + "The Logbook" at left, the current section name in muted text, "Corpo" ghost button hidden because the sidebar is visible. Keep the same style, and show the "Impegni" and "Da ricordare" cards side by side.
```
