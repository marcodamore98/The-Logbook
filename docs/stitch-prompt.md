# Prompt per Google Stitch — The Logbook

*Aggiornato al 4 ottobre 2026: corrisponde all'app pubblicata (palette lime/lavanda/antracite, gesti, corsa, corsi e congressi, calcolo massa grassa).*

**Come usarli.** In Stitch scegli **App (mobile)**, incolla il **Prompt 0** (stile e regole) e genera. Poi incolla i prompt delle schermate uno alla volta, nella stessa conversazione, così Stitch mantiene lo stile. Se una schermata esce troppo diversa, aggiungi in coda: *"Keep exactly the design system from the first screen: same colors, font, radius, icon style."*

I prompt sono in inglese (Stitch rende meglio), i testi dell'interfaccia restano in italiano.

---

## Prompt 0 — Stile e sistema di design

```
Design a mobile-first progressive web app called "The Logbook": a personal daily diary for a hospital doctor (obstetrics and gynecology resident who also works night shifts as a locum GP) who trains in the gym and runs. Each day is a "page" summarizing work, training, nutrition and private life. Interface language: Italian. Primary device: Android phone in DARK MODE (design dark first, then a light variant).

VISUAL STYLE — modern, bold and friendly, like the best fitness apps (Hevy, Strava, Lifesum) but calm and uncluttered.
- Dark mode: background #131313, cards #222223 with a 1px #333335 border, secondary surfaces #2C2C2E, text #F4F4F1, secondary text #C8C8C4, muted #8D8D92.
- Light mode: background #E8E8E5 (paper grey), cards #FFFFFF with a very soft shadow, text #1D1D1F, muted #7A7A82.
- Brand accents: LIME #D6F25F (primary actions, "today", key numbers in dark mode) and LAVENDER #B9B0F5 (secondary highlights, sync badges). In dark mode primary buttons are lime with dark text; in light mode primary buttons are charcoal #1D1D1F with white text. Coral #E8603C for destructive actions, amber #E9B949 for personal records, water blue #6BB9F5 for hydration.
- Shapes: cards 22px radius, inputs 12px radius with no border (filled with the background color), chips and buttons fully rounded (pill). Generous spacing, 16px side gutters.
- Typography: Plus Jakarta Sans everywhere. Page titles bold 24px; big numbers extra-bold with tight letter spacing; small uppercase muted labels for sections.
- Icons: each section has a round PASTEL DISC (lime, lavender, mint #A6E9C4, sky #B3D8F7, peach #FFBD9C, lilac #DCBDF5, sand #DCDAD0) with a thin dark line icon on top (1.5px stroke). No glossy or material filled icons.
- Charts: minimal, rounded bars, thin lines with dots, donuts with a thick stroke; lime as the main series in dark mode, lavender as the second.
- "Lime banner": a full-width lime pill button with bold dark text on the left and a "›" chevron on the right. It is THE pattern for every navigation command and every "start" action (e.g. "Inizia allenamento ›", "Apri il diario alimentare ›", "‹ Pagina del giorno").

LAYOUT AND BEHAVIOUR
- Top bar: hamburger + app logo + "The Logbook" on the left (tap opens the left menu), the current section name in muted text, a small "Ricollega Google" ghost pill only when the Google session expired, and on the right a white/grey pill button "♡ Corpo" that opens the right "Corpo" panel.
- Under the top bar, on every section except the day page, a small lime pill "‹ Pagina del giorno".
- Sections are collapsible cards: pastel-disc icon, bold title, one-line summary when collapsed, chevron on the right, optional trash icon. Cards can be reordered with a long press (they lift and slide).
- Gestures (show as states, not as arrows): swipe left/right moves between days or tabs following the finger; swipe from the left edge opens the menu; swipe down closes bottom sheets; back closes the topmost overlay.
- Deletions never use confirmation dialogs: a dark snackbar at the bottom says "Allenamento eliminato · ANNULLA" for a few seconds.
- Bottom sheets have a grabber, a centered bold title, lime primary action, coral "Elimina" and a neutral "Annulla" full-width pill.
- No tab bar. Floating only: the active-workout bar and the rest timer at the bottom.
- Tone: quiet and professional, no confetti, no emoji.
```

---

## Prompt 1 — Pagina del giorno

```
Screen: the day page for Sunday 4 October 2026 (dark mode). Header: round back chevron, bold title "Domenica 4 ottobre 2026", a lime "OGGI" badge, small round icon buttons (reorder sections, print) and a next-day chevron.

Cards in this order:
1. "Turno" (only exists if there is a shift that day): pastel lavender icon, trash icon. Fields: shift type select "Reparto", "Dalle 08:00" "Alle 14:00" on one row, "In turno con" with removable dark name chips ("Sgro", "Paradiso") and a "+ Aggiungi collega" select, notes. Inside it, a collapsed sub-card "Tabellone" (department roster) with summary "Tu: SO · 17 attività".
2. "Guardia medica" — a separate small card with only "Dalle 20:00" and "Alle 08:00" on one row and a trash icon.
3. Two side-by-side cards "Impegni" ("14:30 Journal club", small lavender "G" = on Google Calendar) and "Da ricordare" ("2 da fare"), each with a "+" button.
4. "Attività chirurgica e clinica" — summary "Isterectomia laparoscopica · Primo operatore".
5. "Allenamento": when nothing is logged it shows two lime banners stacked: "Inizia allenamento ›" and "Inizia corsa ›". When done it shows compact summary rows instead: "Push · 62 min · 4.300 kg · 18 serie" and a run row with three mini stats "5,2 km · 28:40 · 5:31 /km".
6. "Alimentazione" with summary "1.850 / 2.300 kcal" and a lime banner "Apri il diario alimentare ›".
7. "Studio, corsi e congressi" — a multi-day congress card spanning several days: "Congresso SIGO · 2–5 ott" with a paperclip "Programma" and a crown "Attestato".
8. "Diario" — italic muted "Nessuna pagina scritta per questo giorno." and a ghost "✎ Scrivi" pill.
At the bottom a dashed full-width pill "+ Aggiungi scheda".
Also show the snackbar state at the bottom: "Turno eliminato · ANNULLA".
```

---

## Prompt 2 — "Aggiungi scheda" e schede unite

```
Bottom sheet "Aggiungi una scheda" over the dimmed day page. Groups with small uppercase labels:
TURNI: "Turno", "Guardia medica" (each shown only if missing that day).
ATTIVITÀ: three large rows with pastel icons and a one-line hint — "Attività chirurgica e clinica" (Interventi, ambulatori, ecografie), "Studio, corsi e congressi" (Studio, corsi, congressi, webinar), "Viaggi e uscite" (Viaggi di più giorni, gite, cene, eventi).

Then show three opened cards, each with a segmented switch at the top that changes the kind of record:
(a) [Chirurgica | Clinica] — Chirurgica: procedure search, role chips (Primo operatore, Secondo, Osservatore), approach chips (Laparoscopica, Vaginale, Laparotomica), complications switch.
(b) [Studio | Corsi e congressi] — Corsi e congressi: type chips "Corso · Congresso · Webinar", title "Congresso nazionale SIGO", date range "dal 2 ott al 5 ott", "Ora di inizio 09:00", a switch "Avvisami 30 e 5 minuti prima" (lime when on), and two file slots: "📎 Programma (PDF)" and "📎👑 Attestato (PDF)" showing a file name once attached.
(c) [Viaggio | Gita / uscita] — Gita / uscita: title "Sacra di San Michele", type select "Uscita con amici", place, "Con chi", a "Racconto" text area.
```

---

## Prompt 3 — Palestra (routine)

```
Screen: "Palestra" (dark mode). Title "Palestra", a segmented control Routine · Storico · Esercizi · Progressi (swipe between tabs).
Routine tab: two pills side by side — ghost "Nuova routine" and lime "Inizia un allenamento vuoto". Then a flat list of routine cards: title "Push", muted exercise list "Panca piana · Spinte manubri · Croci ai cavi · +3", a lime "Inizia" pill and a "⋮" menu. At the bottom a quiet link "Importa routine".
Progressi tab: stat tiles (lime, lavender, black, white) "3 allenamenti questa settimana", "12.400 kg volume 7 gg"; a rounded-bar chart "Allenamenti per settimana"; horizontal bars "Serie per muscolo · 7 giorni".
Exercise detail sheet: avatar circle with initials, big numbers "Peso massimo 82,5 kg", "1RM stimato 98 kg", a small line chart and recent sessions "80×8 · 80×6 · 82,5×5".
```

---

## Prompt 4 — Allenamento in corso (stile Hevy)

```
Screen: active workout (dark mode). Header: back chevron, big bold editable title "Push" (tap to edit, a ✓ to confirm), date below, trash icon.
A stats row with three columns: "Durata 0:42:10", "Volume 4.300 kg", "Serie 18".
Exercise blocks (no card borders, separated by space): round avatar, exercise name in lime (tappable), "⋮" menu, an auto-growing notes field "Aggiungi note…", a single line "Riposo: 2 min 30 s ▾".
Set table columns: SERIE · PRECEDENTE · KG · RIPS · ✓. Rows: set number (or "W" amber warm-up), muted previous "70 × 8", kg and reps inputs, a square check. Completed rows get a lime-tinted background and a lime check; a small gold crown next to a personal record. One row is swiped left revealing a coral "Elimina". Sets must be ticked in order (later checks look disabled).
Below the last exercise: "+ Aggiungi esercizi" (full-width grey pill) and, at the very bottom, the lime "Termina" pill.
Floating at the bottom: a dark rest bar "Recupero 1:29" with −15 / +15 / × and a thin lime progress line. Second state: the rest bar dragged up into a big full-screen stopwatch with a huge "1:29" ring.
```

---

## Prompt 5 — Fine allenamento

```
Three steps, dark mode:
(a) Dialog "Vuoi terminare l'allenamento?" with three stacked pills: neutral "Torna all'allenamento", coral "Abbandona ed elimina", lime "Termina e salva".
(b) Full screen "Salva allenamento": title field "Push", editable "Durata 62 min", "Volume 4.300 kg", "Serie 18", notes area, a checkbox "Salva questo allenamento come routine", a lime "Salva" and a quiet coral link "Abbandona".
(c) Full screen "Ottimo lavoro!": big lime check, workout name, three big numbers (durata, volume, serie), number of personal records with gold crowns, lime "Fine".
```

---

## Prompt 6 — Corsa (senza mappa)

```
Screen: "Corsa" (dark mode). Subtitle "Ultimi 7 giorni: 14,2 km · 1:18:30".
Card "Che corsa fai?": segmented "Continua | A intervalli", a checkbox "Usa il GPS (disattivalo per il tapis roulant)". For intervals: a select "Sessione preimpostata o salvata", a list of steps (Riscaldamento 10 min, 6 × [Veloce 400 m, Recupero 90 s], Defaticamento 5 min) and "Salva questa sessione".
Live card: in interval mode a phase strip on top ("VELOCE · 0:48 rimanenti", progress bar, "Fase 3 di 14 · poi Recupero 90 s"); three huge metrics "24:10 tempo", "4,36 km", "5:32 passo medio"; a big "5:18 passo attuale · min/km"; "GPS ok (±6 m)". Buttons: huge lime "Avvia", then "Pausa" / "Riprendi" / "Fine" and "Salta fase".
Run summary screen (no map): big distance, time, average pace, max speed, a table of 1 km splits with the fastest highlighted in lime, interval laps, and a lime "Fine".
List "Le tue corse" with date, km, time, pace.
```

---

## Prompt 7 — Alimentazione

```
Screen: food diary (dark mode), swipe between days. Summary card: thick lime ring with "1.305 kcal rimanenti" in the center, "1.095 mangiate · 2.300 obiettivo · 450 attive", three thin macro bars Proteine 67/175 g, Carboidrati, Grassi.
Meal cards Colazione, Pranzo, Cena, Spuntini: total "245 kcal · P 22 g", round "+" button, food rows "Yogurt greco · 170 g · P 17" with kcal at right. Empty meals show just the "+" (no extra text).
Water card: 8 small glasses filled in water blue, "1 L / 2,5 L".
"Ultimi 7 giorni" mini bar chart.
Bottom sheet "Aggiungi a Colazione": chips Cerca · Recenti · Preferiti · Codice a barre · Nuovo alimento · Aggiunta rapida, search field, results with kcal/100 g and a star; quantity step with portion chips and a lime "Aggiungi".
```

---

## Prompt 8 — Corsi e congressi e archivio attestati

```
Screen: "Corsi e congressi" (dark mode). A lime-tinted folder banner at the top "📁 Archivio attestati · 7 PDF ›".
A list of cards: type chip (Congresso / Corso / Webinar), title, dates "2–5 ottobre 2026", start time "09:00" with a small bell when reminders are on, a quiet "📎 Programma" link, and when the certificate exists a lime banner "👑 Vedi attestato ›"; otherwise a ghost "Aggiungi l'attestato".
Second screen "Archivio attestati": a grid of PDF tiles (PDF icon, title, year) grouped by year, tap opens the PDF.
```

---

## Prompt 9 — Diario

```
Screen: "Diario" (dark mode), one page per day, swipe between days like turning pages. Header with date and prev/next, a lime banner "Diario · salta alle pagine scritte ›" that opens a list of written pages. The page: a large comfortable text area with generous line height, optional photos in a 3-column grid. A print button opens "Stampa il diario" with a date range and a checkbox "Includi le foto".
```

---

## Prompt 10 — Mese e Settimana

```
Screen: "Mese" October 2026 (dark mode), swipe between months. 7-column grid Lun–Dom; each cell: day number (today in a lime pill), up to two small shift chips colored by shift type, tiny pastel dots for logged activities (surgery, gym, run, study, congress). Days outside the month faded.
"Settimana": vertical list of 7 day cards (7 columns on desktop): weekday, big day number, shift chip and time, Google Calendar events with a lavender left rule, short module summaries with pastel icons. Tap a day → day page.
```

---

## Prompt 11 — Statistiche

```
Screen: "Statistiche" (dark mode). Segmented Settimana / Mese / Anno, period title with prev/next (swipe changes period), print button.
"Il periodo in sintesi": tiles colored lime, lavender, black, white: "192 h di turno", "18 interventi", "32 prestazioni cliniche", "6 h di studio", "10 allenamenti", "3 corse".
"Andamento" with a metric select and rounded bars. Themed cards: Turni (per tipo, colleghi in turno), Chirurgia (per area, ruolo, via d'accesso, interventi più frequenti), Attività clinica, Studio, Allenamento (sessioni per tipo, volume per esercizio, serie per muscolo), Corsa (distanza, passo medio, corsa più lunga, km più veloce, progressione del passo as a line chart), Alimentazione (ripartizione delle calorie as a donut, giorni nel target), Corpo (medie: peso, sonno, passi), Vita privata (gite e uscite), Impegni e promemoria.
Print sheet "Stampa / PDF" with checkboxes per section.
```

---

## Prompt 12 — Menu, pannello "Corpo", Impostazioni

```
(a) Left menu drawer over a dimmed page: logo + "The Logbook", close ×; items with big pastel-disc icons: Mese, Settimana, Oggi (calendar icon with today's number), Diario, Palestra, Corsa, Alimentazione, Corsi e congressi, Statistiche, Impostazioni. Active item = lighter pill.
(b) Right panel "Corpo" (dark): lime "OGGI" badge, bold date, round close ×. RIEPILOGO: "Nessun turno", "Push · 4.300 kg · 18 serie". CORPO: two-column inputs with pastel icons and goals — "Peso / 80 kg", "Massa grassa %" with a small lime link "Calcola" under it, "Sonno / 7 h", "Passi / 8500", "Acqua / 2,5 L", thin progress bars. CALORIE: assunte / 2300, attive, proteine / 175, lime link "oppure registra i pasti nel diario alimentare". "PESO · 30 GIORNI" line chart with dots and 7-day averages. Collapsible "Obiettivi".
(c) Bottom sheet "Calcola la massa grassa": short muted explanation (US Navy method, ±3–4%), chips "Donna | Uomo", inputs in cm with hints — Altezza (viene ricordata), Collo (appena sotto la laringe), Vita (nel punto più stretto), Fianchi (nel punto più largo dei glutei); big result "27,6% massa grassa stimata" in lime; lime "Usa questo valore ›", neutral "Annulla".
(d) Impostazioni: collapsible cards Account e dati, Google Calendar (calendar select, "Ricollega"), Tabellone di reparto, Colleghi (groups "Strutturato · 16", "Specializzando · 23"), Tipi di turno (name, color, start, end).
```

---

## Prompt 13 — Versione desktop

```
Desktop (1440px) day page: persistent right "Corpo" sidebar 340px, central column max 860px with the collapsible cards, "Impegni" and "Da ricordare" side by side, same dark style. The "Corpo" button in the top bar is hidden because the sidebar is always visible.
```
