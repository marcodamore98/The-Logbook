# Prompt per Google Stitch — The Logbook

*Aggiornato al 6 ottobre 2026 (Prompt 12 applicato: menù con informazioni e stato, riepilogo a riquadri con grafico del peso, impostazioni riducibili, nuova massa grassa; corsi e archivio attestati rifiniti; pagina del giorno da Stitch: intestazione compatta, riquadri su una riga, riepiloghi in pillola, snackbar a pillola; pagina "Aggiungi alimenti" in stile Lifesum, gruppi di procedure salvati; scanner del codice a barre con messa a fuoco e riquadro, tolto "Applica un piano alimentare"; webinar di un giorno con link per collegarsi, luogo aperto in Maps, programma in PDF o foto, eventi "Webinar:/Corso:/Congresso:" importati da Google Calendar; attività chirurgica e clinica per pazienti, con più procedure e ruoli; banner lime più piccoli e discreti), dopo il restyling Stitch portato nell'app principale. Questo file viene aggiornato a ogni modifica dell'app (vedi `CLAUDE.md`).*

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
| 12 | Menù, Riepilogo del giorno, Impostazioni | applicato |
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
- Icons: Google Material Symbols Rounded (weight 400). Section icons sit in dark ink on a round PASTEL DISC (lime, lavender, mint #A6E9C4, sky #B3D8F7, peach #FFBD9C, lilac #DCBDF5, sand #DCDAD0): calendar_month, view_week, medical_services (turno), surgical, stethoscope, menu_book (studio), school (corsi), fitness_center, directions_run, restaurant, landscape (uscite), luggage (viaggi), edit_note (diario), checklist, event, bar_chart, settings, bedtime, water_drop, footprint, monitor_weight, local_fire_department. Small buttons use the same set without the disc (chevron_left/right, add, close, delete, print, download, search, location_on, link, notifications, drag_indicator). No glossy or 3D icons.
- Tiles: key numbers live in small rounded tiles (surface #2C2C2E) with an uppercase label on top and a big extra-bold value; lime for the main value in dark mode.
- Two-way switches: dark track, the active option is a raised pill with LIME text.
- Charts: minimal, rounded bars, thin lines with dots, donuts with a thick stroke; lime as the main series in dark mode, lavender as the second; goals as a dashed line.
- "Lime banner": a SLIM lime pill (about 40px tall, 14px semibold dark text, small "›" at the right) for navigation commands and "start" actions (e.g. "Apri il diario alimentare ›"); two of them can sit side by side ("Inizia allenamento ›" | "Inizia corsa ›"). It must stay discreet and never dominate the card.
- "‹ Pagina del giorno": a small quiet pill (12px text) with a light lime tint and lime text in dark mode, not a filled lime button.

LAYOUT AND BEHAVIOUR
- Top bar: hamburger + app logo (a rounded charcoal tile: an open book with a lime left page and a lavender right page and a dark heartbeat line across both, centred over two identical silver instruments crossed in an X behind it — each one a pointed scalpel blade at the top and a fountain-pen nib at the bottom) + "The Logbook" on the left (tap opens the left menu), the current section name in muted text, a small "Ricollega Google" ghost pill only when the Google session expired, and nothing on the right on phones (with a mouse, when the window is too narrow for the fixed summary column, a small ghost pill "📅 Riepilogo" on the right opens it). The right panel "Riepilogo del giorno" opens by swiping left from the right edge of the screen (the left "Menù" by swiping right from the left edge, or with the hamburger). No bottom tab bar.
- Under the top bar, on every section except the day page, a small quiet lime-tinted pill "‹ Pagina del giorno".
- Sections are collapsible cards: pastel-disc icon, small uppercase category label above a bold title (LAVORO, AGENDA, SPORT, SALUTE, FORMAZIONE, TEMPO LIBERO, PERSONALE), one-line summary when collapsed, a six-dot drag handle and a chevron inside a round grey button. Cards can be reordered with a long press.
- Gestures (show as states, not as arrows): swipe left/right moves between days or tabs following the finger; swipe from the left edge opens the menu; swipe down closes bottom sheets; back closes the topmost overlay.
- Deletions never use confirmation dialogs: a dark snackbar with a coral dot says "Allenamento eliminato · ANNULLA" (ANNULLA in lime, uppercase).
- Bottom sheets have a grabber, a centered bold title, a round × at the right, lime primary action and a neutral "Annulla" pill.
- Floating only: the active-workout bar and the rest timer at the bottom.
- Tone: quiet and professional, no confetti, no emoji. Never invent data the app does not record (no heart rate, HRV, cadence, calories burned by a watch, ECM "targets", patient IDs).
Times and durations are never typed in plain boxes: a field shows the value ("06:30", "3′ 00″", "1 h 20′") and tapping it opens a bottom sheet like the phone's alarm clock — the label on top, two vertical wheels with big bold numbers (the middle one bright, the ones above and below faded) separated by ":" or with small "min"/"sec" units, a muted hint "Scorri le rotelle o tocca il numero al centro per scriverlo.", and "Annulla · (Togli) · Salva" (Salva in lime in dark mode).
Back rule (Android back button): it closes the open sheet, menu or panel first, then goes up to the parent page, never through the history of earlier taps — a workout goes back to Palestra, Palestra and the other sections to the day page, another day to today, and from today the app closes.

Reordering rule for every list that has an order (day cards, exercises, sets, run phases, reminders, shopping items, section order): hold and drag. The lifted row scales slightly with a soft shadow and the others slide aside; rows made only of fields show a small muted six-dot grip on the left. While a big block is dragged (a day card, an exercise with its sets) every block shrinks to a one-line row (icon + title) so the order is easy to see. Swipe left deletes directly: a red "Elimina" grows under the finger and, past about a third of the row, releasing removes the item (an "Annulla" snackbar appears) — no button to tap.
```

---

## Prompt 1 — Pagina del giorno

```
Screen: the day page for Sunday 4 October 2026 (dark mode).
Header inside one rounded card on two rows: small prev chevron, bold centred "Domenica 4 ottobre" with a lime "OGGI" badge, small next chevron; a thin divider, then one muted line "Turno 08:00–14:00 · Guardia 20:00–08:00 · Settimana 40" (ellipsis if long) with two small borderless icon buttons on its right (reorder sections, print).
Under the header a row of pills: "SONNO 7,3 h" (lavender value), "ACQUA 1,5 L" (blue value), "PASSI 8.200" — tapping opens the "Riepilogo del giorno" panel.

Cards in this order:
1. LAVORO "Turno" (only if there is a shift that day): "TIPO TURNO" as a pill with the shift colour dot ("● Reparto ▾"); two time tiles "DALLE 08:00" and "ALLE 14:00" (label inside, big bold time); "IN TURNO CON" with name pills "Sgro ×" and a dashed lime pill "+ Aggiungi collega"; a note line with an icon "Aggiungi una nota al turno…"; inside, a collapsed sub-card "Tabellone · 4 attività".
2. LAVORO "Guardia medica": only two time tiles DALLE / ALLE and a trash icon.
3. Tiles above the surgery/clinical cards, on one line that scrolls sideways: "INTERVENTI 2" (patients operated, lime), "PROCEDURE 5", "PAZIENTI IN CLINICA 6", "TEMPO OPERATORIO 3h 40m", "COMPLICANZE 0".
4. LAVORO "Attività chirurgica" card (collapsed: the summary "2 pazienti · 5 procedure" sits in a small rounded pill under the title — every closed card shows its summary this way, keeping the pastel icon disc) and LAVORO "Attività clinica" (collapsed, summary "6 pazienti · 8 prestazioni").
5. AGENDA "Impegni" ("14:30 Journal club") and AGENDA "Da ricordare" ("2 da fare · Firmare lettere") side by side, compact, each with a round "+". Inside "Da ricordare" a segmented switch "Promemoria | Spesa · 3": Spesa is a plain shopping checklist (one list shared by every day) — rows with a square checkbox and the item name only, thin dividers, ticked rows struck through and moved down, a last row with a dashed "+" box and placeholder "Aggiungi…", and a quiet underlined link "Togli gli spuntati (1)".
6. SPORT "Allenamento": a summary block "Push" with an amber banner "👑 Nuovo record · Panca piana 82,5 kg × 6" and three tiles CARICO SOLLEVATO 975 kg (lime) · DURATA 1h 02m · ORARIO 07:00–08:02; a run block with tiles DISTANZA 5,20 km · DURATA 21:40 · PASSO 4:10/km; a "QUESTA SETTIMANA · 2 h 53 min" mini bar chart L–D with the current day ringed in lime. If nothing is logged: two slim lime pills side by side "Inizia allenamento ›" | "Inizia corsa ›".
7. SALUTE "Alimentazione" — a normal collapsible card with drag handle and round chevron like the others; collapsed summary "1.850 / 2.300 kcal · proteine 120 / 175 g"; open: "Calorie 1.850 / 2.300 kcal" with a lime progress bar, "Proteine 120 / 175 g" with a thin lavender bar, lime banner "Apri il diario alimentare ›".
8. FORMAZIONE "Corsi e congressi" (collapsed) showing a box: "● Congresso SIGO" with a date pill "4 OTT – 7 OTT" and chips "📍 Lingotto, Torino" (opens Maps), "📎 Programma", "👑 Attestato"; a webinar shows the chip "Collegati al webinar ›" instead of the place.
9. PERSONALE "Diario": italic muted "Nessuna pagina scritta per questo giorno." and a ghost "✎ Scrivi" pill on the same row.
At the bottom a dashed full-width pill "+ Aggiungi scheda" (lime text in dark mode).
Also show the snackbar state: a fully rounded pill "● Guardia medica eliminata   ANNULLA" (red dot, lime ANNULLA).
Workout and run summaries in the day page: tapping one opens the workout (or Corsa) directly; a small "⋮" in its top-right corner opens a sheet with only "Elimina" (coral) and "Annulla".
```

---

## Prompt 2 — "Aggiungi scheda" e schede unite

```
Bottom sheet "Aggiungi una scheda" (grabber, centered title, round ×) over the dimmed day page. One tap adds the card immediately.
TURNI: two tiles side by side "Turno · Turno in ospedale" and "Guardia medica · Dalle … alle …" (each shown only if missing that day).
ATTIVITÀ: three rows with a pastel icon, title, one-line hint and a round outlined "+" on the right: "Attività chirurgica e clinica", "Studio, corsi e congressi", "Viaggi e uscite".

Then show three opened cards, each with a two-way switch at the top (dark track, active option lime):
(a) [Chirurgica | Clinica] — one card holds the whole day's list of patients (no identifying data, just numbered). Each patient is a rounded row that folds with a round chevron: a lavender pill "Paziente 1" and bold "Isterectomia radicale + 2" on the same line, under the name a muted line "3 procedure · 2h 10m" and, if there was a complication, a small coral pill "Clavien IIIa". Rows are reordered by holding and dragging (every row shrinks to one line while dragging) and deleted by swiping left (red "Elimina" under the finger, then the snackbar "Paziente 2 eliminata · ANNULLA").
Opened patient, top to bottom: "PROCEDURE" — a list on a thin lime rail on the left; each procedure is its own small folding row with a 6-dot grip: name ("Annessiectomia bilaterale"), and a line with my role (lime highlight when "Primo operatore") · access route; pelvic floor steps carry a small tag "DEMOLITIVO" (peach) or "RICOSTRUTTIVO" (mint), e.g. "DEMOLITIVO Isterectomia subtotale (per prolasso)" and "RICOSTRUTTIVO Sacrocervicopessi (mesh)", each with a different role. An opened procedure shows "IL MIO RUOLO" chips (Primo operatore · Primo con tutor · Secondo · Aiuto · Osservatore, selected lime with ✓), "VIA D'ACCESSO" chips on one sideways-scrolling line, and "Cambia procedura". Under the list a search field "Aggiungi un'altra procedura…" with a pill "Elenco" beside it (browse by group); typing any words in any order shows matches with their group, and combinations with a lime tag "3 procedure" (e.g. "Isterectomia radicale + annessiectomia bilaterale + linfonodo sentinella pelvico") that add each procedure separately. Saved groups ("I miei gruppi"): on an empty patient a row of chips with a small lime count ("3 Radicale ESGO", "2 Gruppo 2") loads a group in one tap; under the procedures a soft lavender box "GRUPPO [Radicale ESGO]" with the name editable in place, and when the procedures were changed a lime-outlined state "Hai modificato le procedure del gruppo." with ghost "Aggiorna “Radicale ESGO”" and lime "Salva come nuovo gruppo"; a patient with two or more procedures and no group shows a ghost pill "Salva queste procedure come gruppo". Under "+ Aggiungi paziente" a folding row "I miei gruppi di procedure · 2" lists the groups (name field, procedures in muted text, 6-dot grip; swipe left deletes). Then "REGIME" as a full-width segmented Elezione | Urgenza | Emergenza (lime selected); two tiles side by side: "DURATA INTERVENTO" with a wheel field "2 h 10′" and "TUTOR · Dr.ssa Rossi ›" (tapping opens the list of colleagues); "NOTE (SENZA DATI IDENTIFICATIVI)"; a folding row "Complicanze · Nessuna ›" (opened: Clavien-Dindo chips Nessuna · I · II · IIIa · IIIb · IVa · IVb · V and a description); ghost buttons "Duplica paziente" and coral "🗑 Elimina". At the bottom a wide soft button "+ Aggiungi paziente".
[Clinica] works the same way: rows "Paziente 1" (or "Pazienti 3–6" when several patients had the same activities) with "Ecografia morfologica + Lettura CTG"; opened, each activity is a row with a grip, a select and a segmented Autonomia | Supervisione | Osservazione (lavender selected); a search field "Aggiungi un'altra prestazione…" + "Elenco"; "Pazienti con queste stesse prestazioni − 1 +"; folding "Tutor"; notes; "Duplica paziente" / "Elimina".
(b) [Studio | Corsi e congressi] — type chips "Corso · Congresso · Webinar"; title; for Corso/Congresso a "Luogo" field with a pin icon and an outlined pill "Maps" beside it (opens the place in Google Maps), and date tiles DAL / AL; for Webinar the place is replaced by "Link per accedere" with a link icon and a lime pill "Collegati", and a single date tile GIORNO beside ORA DI INIZIO; a row "☆ Crediti formativi" with an amber pill "12 ECM" (editable); a boxed row with a bell on a small disc, "Promemoria evento" and muted "Avvisami 30 e 5 minuti prima", and a lime switch; "PROGRAMMA": rows with a small photo thumbnail or a coral "PDF" tile ("Programma 1 · Immagine", "Programma 2 · programma.pdf") with trash, and a dashed row "📎 Aggiungi altre pagine o foto"; "ATTESTATO (PDF)": a dashed amber-outlined row with the amber paperclip-crown "Aggiungi l'attestato di partecipazione (PDF)"; when Google Calendar is connected a muted centred line "⟳ Sincronizzato automaticamente con Google Calendar".
Events written in Google Calendar as "Webinar: …", "Corso: …" or "Congresso: …" appear by themselves as these cards on their day (with the Meet/Zoom link taken from the event).
(c) [Viaggio | Gita / uscita] — title; type select; "Luogo" with a pin icon; "Con chi" as name pills "Elena ×", "Marco ×" and a lime "+ Aggiungi"; "Racconto".
```

---

## Prompt 3 — Palestra e dettaglio esercizio

```
Screen: "Palestra" (dark mode). Title "Palestra" with a pill "🔥 3 sett. di fila" (consecutive weeks with a workout). Lime two-way-style switch with four options Routine · Storico · Esercizi · Progressi.
Routine tab: "Nuova routine" (grey) and lime "Inizia un allenamento vuoto" side by side. Routine cards can be reordered by holding their header and dragging (they shrink to one-line rows while dragging). The exercise search matches every typed word in any order ("french cavi" → "French press ai cavi"). Routine cards: coloured disc with a dumbbell, name "Push", muscles "Petto · Tricipiti · Spalle", exercises on one line "Panca piana · Panca inclinata · Spinte manubri · +1", a divider, "2 giorni fa · 62 min" and a small lime pill "Inizia"; "⋯" menu.
"Panoramica 7 giorni": tiles ALLENAMENTI 2 (lime) and VOLUME TOTALE 2.923 kg (lavender) with "+14% vs 7 giorni prima"; card "Volume per giorno" with rounded bars and today ringed; card "Serie per muscolo · 7 giorni" with coloured horizontal bars (lime, lavender, mint…).
Exercise detail sheet: initials avatar, label DETTAGLIO ESERCIZIO, "Panca piana con bilanciere", "Petto · Bilanciere"; tabs Sommario / Cronologia; two big tiles PESO MASSIMO 82,5 kg (5 rip.) and 1RM STIMATO 96,3 kg in amber ("formula di Epley"); line chart with period select and metric chips; "ULTIME SERIE REGISTRATE" as pills with an amber "PR" badge on the record; "ALTRI RECORD" list.
```

---

## Prompt 4 — Allenamento in corso (stile Hevy)

```
Screen: active workout (dark mode). Header: back chevron, big bold editable title "Push" (tap to edit, a ✓ to confirm), date below, trash icon.
A stats row with three columns: "Durata 0:42:10", "Volume 4.300 kg", "Serie 18".
Exercise blocks: round avatar, exercise name in lime (tappable → detail sheet), "⋮" menu (Sostituisci esercizio, Superserie con il successivo, coral Rimuovi esercizio — no move up/down: exercises move only by dragging), an auto-growing notes field, a single line "Riposo: 2 min 30 s ▾". Each superset has its own colour on its left rule and "Superset A/B" pill (A lavender, B lime, C blue, D coral, E green). Holding an exercise header lifts the whole block (slight scale and shadow) and it can be dragged to a new place while the others slide aside, like the day-page cards; the routine editor works the same way and has a "⇄" replace button.
Set table columns: SERIE · PRECEDENTE · KG · RIP · ✓. Typing a weight or reps in a working set copies them to the next working sets not ticked yet. The amber "W" warm-up badge only appears on the first sets (never after a working set); tapping a badge cycles 1 → D → F. Completed rows lime-tinted with a lime check; a small gold crown on a personal record. One row swiped left revealing a coral "Elimina". Sets must be ticked in order.
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
Save screen: instead of a single checkbox, a "LA ROUTINE “PUSH”" choice of three radio cards (selected one with a lime border): "Lasciala com’è — Le modifiche valgono solo per oggi", "Aggiorna “Push” — Sovrascrive la routine con esercizi e serie di oggi", "Salva come nuova routine — “Push” resta com’è"; choosing the last shows a name field prefilled "Push (2)". Without a starting routine only "Non salvare come routine" / "Salva come nuova routine".
```

---

## Prompt 6 — Corsa (senza mappa)

```
Screen: "Corsa" (dark mode). Subtitle "Ultimi 7 giorni: 12 km · 1:04:55".
Card "Che corsa fai?" with a lime running disc: switch "Continua | A intervalli | Tapis roulant", checkbox "Usa il GPS" (hidden for the treadmill); for intervals a select "Sessione preimpostata o salvata", a generator (ripetizioni, corsa veloce, recupero, riscaldamento, defaticamento, lime "Crea le fasi") and the list of phases with coloured left borders; "Salva questa sessione". Tapis roulant: no generator — a session is a list of series. Presets ("Camminata in salita 12% · 30′", "Salite progressive (2 → 10%)", "Corsa e camminata 5 × (2′ + 2′)") or "+ Aggiungi una serie". Each series is a card with a six-dot grip, "Serie 1", a muted "12:00 /km" and a trash icon, then one row VELOCITÀ "5 km/h" · INCLINAZIONE "10 %" · DURATA "3′ 0″"; a line "2 serie · 5:30 · circa 0,50 km". While running: pill "SERIE 1" with the time left, two big tiles "5,0 km/h · 12:00 /km" and "10% pendenza" (lavender), and "Serie 1 di 2 · poi serie 2: 6,0 km/h · 8% · 2:30"; KM becomes "km stimati".
Live card: a lime pill "RISCALDAMENTO" with "9:57" remaining in lime, a lime progress bar, "Fase 1 di 13 · poi Corsa veloce 400 m"; a tile "PASSO ATTUALE 5:18 min/km"; three tiles TEMPO · KM · PASSO MEDIO; a small "GPS ok (±6 m)" pill; a big lime "❚❚ Pausa" and below two pills "⏭ Salta fase" and coral "■ Termina".
"Le tue corse": cards with a running disc, "3 OTT" and a tag "CONTINUA" / "INTERVALLI", title, "5,20 km · 28:40 · 5:31 /km", chevron, trash.
Run summary (no map): "Corsa completata!" lime header; a card DISTANZA TOTALE "4,36 km" with a comparison line; three tiles TEMPO · PASSO MEDIO (km/h below) · PASSO MAX (lime, km/h below); "● Split al chilometro" rows with index boxes and bars, the fastest with a lime left rule and badge "⚡ Miglior split"; "● Ripetute" rows "R1 400 m in 1:26 · 3:35 /km", the best with an amber rule and badge "Ripetuta migliore"; title, notes, lime "Salva la corsa".
```

---

## Prompt 7 — Alimentazione

```
Screen: food diary (dark mode, Lifesum-like), swipe between days. A day strip "‹ OGGI, 04 OTT ›" in small uppercase letters.
Gauge card: a large lime half-circle arc with "1.637" big in the middle and "RIMANENTI" under it; below, left "663 ASSUNTE", centre "Obiettivo 2.300 kcal", right "0 BRUCIATE".
Three small macro cards side by side: Carboidrati (lime bar) "95/260g", Proteine (lavender bar) "63/175g", Grassi (blue bar) "4/65g".
Small uppercase kicker "REGISTRO ALIMENTARE".
Meal cards Colazione, Pranzo, Cena, Spuntini: pastel meal icon disc, title, subtitle "Consigliato 460 - 690 kcal" when empty (a share of the daily goal) or "143 kcal · P 18 · C 17 · G 0" when there are foods, a round grey "+" (lime glyph in dark). Food rows "Yogurt greco / 170 g · P 17 · C 6,8 · G 0" with "97 kcal" at the right. A round lime "+" floating at the bottom right opens a fan: the screen dims, the + turns into ✕ and four round discs with the meal icons fan out on a quarter circle around it (Colazione straight up, then Pranzo, Cena, Spuntini straight left), each with a small dark label pill just outside it; the meal of the current time has a lime ring; tapping one opens "Aggiungi alimenti" for that meal.
Swiping a food row to the left reveals a red "🗑 Elimina" area (a long swipe deletes at once, with an "Annulla" snackbar). Holding a row starts multi-select: round check circles appear (lime with a check when picked, rows tinted lime) and a dark floating bar at the bottom shows "× · 2 selezionati · Sposta in… · red Elimina".
A floating round lime "+" at the bottom right adds a food to the meal of the current time.
Water card "1 L / 2,5 L" in blue, a row of glasses and a pill "+ 250 ml".
"Ultimi 7 giorni · Calorie assunte · 1.969 kcal media": rounded bars with a dashed goal line labelled "2.300", today in lime.
Adding foods opens a full page (not a sheet), like Lifesum: a top bar with a back arrow, the meal name in bold capitals inside a rounded pill "COLAZIONE ▾" in the middle (tapping changes the meal) and a ✕ on the right; a rounded search field "Cibo, piatto o marca" with a magnifier and, on its right, a lime barcode-frame icon. Then a white/anthracite card "Assunzione giornaliera 9% · 196 / 2300 kcal" (the percentage in a small lime pill) with a lime bar and three columns Carboidrati (lime bar) · Proteine (lavender) · Grassi (blue) with "7 g / 260 g". Under it four icon tabs with tiny labels — Recenti (clock), Preferiti (heart), Nuovo alimento (list with +), Aggiunta rapida (bolt) — the active one with a lime icon and a lime underline. Section label "RECENTI" and food cards with large rounded corners: bold name ("Cottage cheese · Esselunga" with the brand muted), a line "1 vasetto (100 g) · 98 kcal", a row of tinted macro pills "C 3,4 g" (lime) "P 11 g" (lavender) "G 4,3 g" (blue), a heart on the right (filled lime when favourite) and a large round grey "+" that adds the usual portion at once; a dark snackbar at the bottom "✓ Cottage cheese aggiunto a Colazione"; the page stays open to add more. Swiping a recent card left removes it from the recents (red "Elimina" under the finger, "Annulla" snackbar); it comes back when the food is logged again. Preferiti shows four folder tiles in a row — Colazione, Pranzo, Cena, Spuntini — each with its meal icon disc, name and "3 alimenti", the open one with a lime border; below, the foods of that folder (swipe left takes one out of the folder). Tapping the heart opens a small sheet "Nei preferiti di…" with the food name and four toggles with the meal icons and a lime check (the meal being filled is already on), "Togli dai preferiti" and a lime "Fatto". Typing in the search replaces the tabs with results ("ALIMENTI"), a ghost pill "Cerca anche tra i prodotti online" and a link "Chiudi la ricerca"; generic CIQUAL foods end with "· CIQUAL" and canteen dishes with "· stima" (standard portion "1 piatto (280 g)"). Tapping a card gives it a thick lime border with a soft glow and opens inside the same card: "PORZIONE RAPIDA" 2×2 grid plus a wide "Porzione libera" chip, a "Grammi − 280 g +" stepper, a summary "● 364 kcal · Proteine 12,6 g · Carboidrati 64,4 g · Grassi 7 g", "Pasto" select, lime "Aggiungi a Colazione ›" and a link "Annulla o scegli un altro alimento".
The barcode icon opens the scanner page and starts the camera at once: "‹ Torna agli alimenti", title "Scanner codice" with a muted line "Inquadra la confezione o scrivi il numero sotto il codice"; a square camera view with rounded corners, four thick lime corner brackets around a dashed guide, a lime laser line sweeping up and down, the outside slightly darkened, and a dark pill inside at the bottom "Avvicina il codice dentro il riquadro · tocca per mettere a fuoco"; below, wide ghost pills "Torcia" (lime when on), "Galleria" (reads the code from a photo) and "Annulla"; a card "Oppure scrivi il codice (EAN / UPC) · 8–13 CIFRE" with a field and a lime "Cerca ›"; after a code is read a card "✓ Ultimo prodotto riconosciuto · EAN 8076809513388" with the product row and a lime "+ Aggiungi"; a muted centred help line. Older description, still valid for the camera view: the camera preview with rounded corners, a lime rectangular guide frame in the middle (the rest slightly darkened), a muted hint "Avvicina il codice dentro il riquadro · tocca per mettere a fuoco", ghost pills "Torcia" (lime when on) and "Annulla"; below, the field "oppure scrivi il codice (EAN)" with "Cerca". There is no "Applica un piano alimentare" select in the food log.
```

---

## Prompt 8 — Corsi e congressi e archivio attestati

```
Screen: "Corsi e congressi" (dark mode), subtitle "Formazione continua e crediti ECM · 4 in elenco". A lime-tinted banner with a folder tile "Archivio attestati ● 3 PDF · Tutti gli attestati in un posto ›".
Groups "● ATTIVITÀ FORMATIVE 2026" with "3 EVENTI · 26 CREDITI" on the right. Cards: type chip (Corso mint, Congresso lavender, Webinar peach) and "✓ 12 crediti ECM"; at the right a time pill with a bell (filled lime when the reminder is on, crossed out when off) "09:00"; big title; "📅 2–5 ottobre 2026 · Roma ↗" (the place in lavender, underlined, opens Maps; a webinar shows "● Online" with a peach dot instead); a thin divider, then underlined "📎 Programma" (one per file, PDF or photo) and, for webinars, a peach "Collegati al webinar ›"; lime "👑 Vedi attestato ›" or an outlined "+ Aggiungi l'attestato".
"Archivio attestati": back link, title with muted "Attestati di corsi, congressi e webinar", a summary card with a glowing lime folder disc "3 attestati archiviati · 26 crediti ECM totali"; search field; chips "Tutti (3) · 2026 (2) · 2025 (1)"; per year "2026 ● 2 attestati" with an ECM pill; a 2-column grid of tiles: coloured disc with a paperclip-crown icon, amber "12 ECM" pill, title (2 lines), date with place "5 ottobre 2026 · Roma", footer "PDF · 1,3 MB" with two small icons (eye = view, arrow-down = download). At the bottom a dashed full-width pill "+ Carica un nuovo attestato PDF" that opens a card "Nuovo attestato": PDF slot, title, type chips Corso · Congresso · Webinar, date and ECM fields, lime "Salva nell'archivio" and ghost "Annulla" (it also creates the course card on that day).
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
Screen: "Statistiche" (dark mode). Lime switch Settimana · Mese · Anno; a strip "‹ Settembre 2026 🖨 ›"; a small grey hint "Tocca una sezione per ridurla o aprirla. Le frecce ▲▼ confrontano con il mese prima."
Then one collapsible card per topic, in the order and with the small uppercase labels of the day page (LAVORO, FORMAZIONE, SPORT, SALUTE, AGENDA, TEMPO LIBERO), each with its pastel icon disc and a chevron; when closed, the card shows its key numbers in grey under the title (e.g. "Turni · 114 h · 18 turni", "Attività chirurgica · 24 interventi · 63% da primo").
Every open card starts with 2–4 number tiles (uppercase label, big number, unit in grey, a small ▲/▼ change against the previous period: green when better, coral when worse, grey when neither, e.g. hours on shift), then only the charts that answer a question:
- LAVORO · Turni: ORE 114 h ▼24 h · TURNI 18 · NOTTI 1; thin rounded columns "Ore di turno, giorno per giorno" (month by month in the year view); bar lists "Per tipo di turno" and "Colleghi con cui hai lavorato di più".
- LAVORO · Attività chirurgica (CSV button in the header): INTERVENTI 24 (24 procedure) · DA PRIMO OPERATORE 63% ▲21 pt (15 proc., 7 senza tutor) · TEMPO OPERATORIO 29,3 h (media 1h 13m per intervento) · COMPLICANZE 2 (8,3% dei pazienti); weekly columns "Interventi, settimana per settimana" (Sett 1…5 with the number above each column; month by month in the year view); "Ruolo nelle procedure" as one stacked bar in a single hue from dark (Primo operatore) to light (Osservatore) with a legend with numbers and %; in the year view a line "Autonomia: procedure da primo operatore, mese per mese"; plain lists "name … number" with hairline dividers for Per area and Procedure più frequenti; then two side-by-side columns VIA D'ACCESSO and REGIME with percentages ("Laparoscopico 75%"). The CSV has one row per procedure with "Paziente N".
- LAVORO · Attività clinica: PAZIENTI · PRESTAZIONI (1,33 per paziente); weekly columns "Pazienti"; "Ruolo" stacked bar (Autonomia → Supervisione → Osservazione); bar list "Per prestazione".
- FORMAZIONE · Studio, corsi e congressi: STUDIO h · CORSI E CONGRESSI (the event names when they are one or two, e.g. "SIGO") · CREDITI ECM; columns of study hours; bar lists per area and per tipo (hours).
- SPORT · Palestra: ALLENAMENTI · TEMPO · VOLUME 10,5 t (27 serie); columns "Volume sollevato"; bar lists "Serie per muscolo" and "Esercizi con più volume".
- SPORT · Corsa: DISTANZA km · CORSE · PASSO MEDIO 5:42/km ▼15 s (green); columns "Chilometri"; line "Passo di ogni corsa" (faster drawn higher) with "▲ In miglioramento / ▼ Più lento: da 5:34 a 5:37"; a grey box "Record del periodo" with the records side by side in centred columns (corsa più lunga, miglior passo, km più veloce, velocità massima, only when known); "Tipo di corsa" stacked bar.
- SALUTE · Alimentazione: KCAL MEDIE 2.020 (obiettivo 2.000) · PROTEINE MEDIE 104 g · GIORNI REGISTRATI 15; "Obiettivi rispettati" as thin meters "Calorie entro ±10% 15 su 15", "Proteine raggiunte 8 su 15"; "Da dove vengono le calorie" as a 3-colour stacked bar (carboidrati violet, proteine coral, grassi teal) with kcal and %.
- SALUTE · Corpo: PESO MEDIO 61,5 kg (obiettivo 60 kg) · PASSI AL GIORNO · SONNO MEDIO; line "Andamento del peso" with "min 61,1 · max 61,9" at the right of the title and a dashed reference line "obiettivo 60 kg" (never zoomed below a 2 kg range).
- AGENDA · Impegni e promemoria: IMPEGNI · PROMEMORIA FATTI 77% (23 su 30); bar lists per categoria.
- TEMPO LIBERO · Gite, uscite e ricordi: USCITE E GITE · FOTO NEL DIARIO (· UMORE MEDIO when recorded); bar list per tipo.
Chart rules: no pies or donuts; columns and bars thin with 4px rounded ends, solid hairline gridlines, one colour (lime on dark, violet on light) unless a legend is needed; tap a column or point for a tooltip; "Vedi come tabella" under each time chart. Two columns of cards on desktop. Ranking lists elsewhere are rows "name … value" with a thin 6px rounded bar under each. Print sheet "Stampa / PDF" with checkboxes per section (Lavoro, Formazione, Sport, Salute, Impegni, Tempo libero) and a segmented choice "A4 verticale | A4 orizzontale".
```

---

## Prompt 12 — Menù, pannello "Riepilogo del giorno", Impostazioni

```
(a) Left drawer over a dimmed page, opened by swiping right from the left edge or with the hamburger: bold title "Menù", close ×; items with big pastel-disc icons and, on the right, small grey pills with a fact: Mese "ott", Settimana "Sett. 41", Oggi (calendar icon with today's number, active item = white pill with a lime "6 ott"), Diario, Palestra (a lime-tinted pill with the workout in progress, e.g. "Push"), Corsa, Alimentazione, Corsi e congressi "26 ECM 2026", Statistiche, Impostazioni. At the bottom, above a thin line, a status row with a dot: "Dati sincronizzati tra i dispositivi · Google Calendar collegato" (lime dot) or "Dati solo su questo dispositivo".
(b) Right panel opened by swiping left from the right edge (it follows the finger): bold title "Riepilogo del giorno", muted "Oggi · domenica 4 ottobre 2026", round close ×. Card IN BREVE: a strip with the shift icon, lavender "TURNO" and "Reparto 08:00–14:00 · Guardia 20:00–08:00" with "6 h" on the right; two tiles "LAVORO · 2 interventi · 6 prestazioni" and "ALLENAMENTO · Push · 975 kg". Card CORPO: a 2×2 grid of tiles, each with a tiny "OB. 80 KG" goal on top and the pastel icon, a big editable number with its unit, the name under it — Peso, Massa grassa (with a lime "Calcola →"), Sonno, Passi; then an Acqua box: "Acqua / 2,5 L" and a big blue "1,5 L" on the right, a blue progress bar, a row of small glasses and a pill "+ 250 ml". (No resting heart rate: it will come later from a smartwatch.) Card BILANCIO ENERGETICO: a lime ring with "1.305 KCAL RIMANENTI · 1.095 mangiate / 2.400", then three small tiles ASSUNTE · PROTEINE (lavender, "/ 160 g") · ATTIVE (lime label, editable), a lime link "apri il diario alimentare ›". Card "PESO · 30 GIORNI" with a pill "−1,4 kg": a box with "Max · Min · Obiettivo" on top, a lime line with a soft lime area and small dots, a grey dashed 7-day moving average, light dashed grid lines, dates under it and a lime "Ultimo (74,2)"; a tiny legend; under it Media 7 gg, Variazione, Kcal medie, Passi medi, Sonno medio. Collapsible "Obiettivi" (the user's own goals, editable).
(c) Bottom sheet "Calcola la massa grassa" with a ✕: short muted explanation (US Navy method, ±3–4%); "SESSO BIOLOGICO" as a full-width segmented pill Donna | Uomo (selected lime with a soft glow); a 2×2 grid of fields with the name in bold above, big number and "cm" inside the field, a muted hint under it — Altezza (viene ricordata), Collo (appena sotto la laringe), Vita (nel punto più stretto), Fianchi (nel punto più largo dei glutei); a result card "● STIMA CALCOLATA" with a big lime "27,6%" and "massa grassa stimata"; lime "Usa questo valore ›", neutral "Annulla".
(d) Impostazioni: collapsible cards with a pastel disc, title, a muted subtitle and a round chevron — Account e dati ("Sincronizzazione cloud · backup"), Google Calendar (subtitle "● COLLEGATO E SINCRONIZZATO" in lime; text about the two-way sync; calendar select; "Sincronizza elementi in sospeso", "Scollega"), Tabellone di reparto ("26 tuoi turni da importare"), Colleghi ("39 colleghi · per ruolo": inside, one rounded box per role with a coloured dot, "Strutturato", a dark pill "16 colleghi", a chevron and a divider line with "Bianchi, Moretti, Lombardi +13"), Tipi di turno ("49 tipi · colori e orari": groups like the roles; each type is one line with its colour dot, name, "conta come lavoro" and the time in a dark pill "08:00 – 14:00", tap to edit). At the bottom a small card: muted "Versione del 4 ottobre 2026, ore 15:55", an outlined pill "Cerca aggiornamenti" and a one-line result ("Hai già l’ultima versione."), then a muted line crediting the food data (CIQUAL 2025 ANSES, Open Food Facts, estimates).
```

---

## Prompt 13 — Versione desktop

```
Desktop (1440px) day page: persistent right "Riepilogo del giorno" sidebar 340px (cards CORPO, BILANCIO ENERGETICO with the lime calories-left ring, PESO · 30 GIORNI), central column max 860px with the collapsible cards. Header: "‹ Domenica 4 ottobre OGGI" with a segmented "Ieri | Oggi | Domani", reorder and print buttons, "›"; subtitle with shifts and week number; Sonno / Acqua / Passi pills. "Impegni" and "Da ricordare" always side by side. Same dark style; the top bar has no button on the right because the sidebar is always visible. In a narrower desktop window (under 1180px) the summary opens from the "Riepilogo" pill as a wide floating panel (about 1100px) with the cards in three newspaper-style columns (In breve + Corpo, Bilancio energetico, Peso · 30 giorni + Obiettivi) so it all fits without scrolling. No search bar, notifications or avatar.
```
