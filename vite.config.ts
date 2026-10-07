import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets the same build run at the domain root (Firebase Hosting)
// or under /The-Logbook/ (GitHub Pages).
const base = process.env.BASE_PATH ?? '/';
// The test version is published under <base>prova/: it gets its own name, and the main
// app's service worker must not answer for those pages.
const isTest = process.env.APP_VARIANT === 'prova';

export default defineConfig({
  base,
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: separate files stay cached across app updates.
        manualChunks: (id: string) =>
          /node_modules\/(@firebase|firebase)\//.test(id) ? 'firebase' : /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id) ? 'react' : undefined,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: isTest ? 'The Logbook (prova)' : 'The Logbook',
        short_name: isTest ? 'Logbook prova' : 'Logbook',
        description: 'Diario giornaliero di turni, attività chirurgica, studio e vita privata.',
        lang: 'it',
        theme_color: '#1d1d1f',
        background_color: '#e8e8e5',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // The main app must not answer for the test copy and the previous copy published next to it.
        navigateFallbackDenylist: isTest ? [] : [/\/prova\//, /\/precedente\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Optional parts of the PDF library the app never uses.
        globIgnores: ['**/html2canvas*.js', '**/purify*.js'],
      },
    }),
  ],
});
