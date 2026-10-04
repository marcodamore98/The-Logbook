import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { watchForUpdates } from './lib/update';
import './styles.css';

registerSW({ immediate: true, onRegisteredSW: (_url, r) => watchForUpdates(r) });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
