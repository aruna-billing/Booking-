import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initImageStore } from './store/imageStore.js';
import { LIVE } from './lib/mode.js';
import { loadPublicConfig } from './services/cloud.js';
import { initSession } from './services/session.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/booking.css';
import './styles/admin.css';
import './styles/v2.css';

initImageStore(); // biblioteca de imágenes: Supabase (modo real) o IndexedDB (demo)
if (LIVE) {
  loadPublicConfig();
  initSession().catch((e) => console.error('No se pudo recuperar la sesión:', e));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
