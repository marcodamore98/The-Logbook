import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { installBackNav } from './lib/backNav';
import { watchForUpdates } from './lib/update';
import { loadLibrary } from './lib/nutrition/library';
import './styles.css';

installBackNav();
registerSW({ immediate: true, onRegisteredSW: (_url, r) => watchForUpdates(r) });
void loadLibrary();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
