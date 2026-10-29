import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prototipo: se usa enrutado por hash (#/ruta) para que funcione
// en cualquier hosting estático (Cloudflare Pages incluido) sin reglas de reescritura.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
