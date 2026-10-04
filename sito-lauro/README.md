# lauroantonio.it — Antonio Lauro, pittore e scultore

Sito statico (HTML/CSS/JS, nessuna build). Pagine: `index.html` (foto, biografia, ricerca, critica),
`galleria.html` (filtri + lightbox), `mostre.html` (1958–1989), `contatti.html`.

## Da completare
- **Recapiti**: compila `email` e `telefono` in `js/config.js`. Finché sono vuoti, la pagina Contatti mostra solo "Napoli".
- **Titoli, anni, tecniche e misure delle opere**: le didascalie sono provvisorie ("Dipinto 1", "Scultura 2").
  Si modificano in `galleria.html` (attributi `data-title` e `data-alt`, e `<figcaption>`).
- **Immagini**: provengono dal portfolio PDF (max ~1300 px). Sostituirle con gli originali appena disponibili,
  mantenendo gli stessi nomi in `img/opere/` e `img/thumbs/`.

## Anteprima locale
```
python3 -m http.server 8000   # poi apri http://localhost:8000
```

## Pubblicazione su Firebase Hosting
```
npm i -g firebase-tools
firebase login
firebase use --add        # scegli (o crea) il progetto Firebase del sito
firebase deploy --only hosting
```
Poi in Console Firebase → Hosting → *Aggiungi dominio personalizzato*: `www.lauroantonio.it`
(inserisci i record DNS indicati presso il registrar). Aggiungi anche `lauroantonio.it` con reindirizzamento a `www`.
