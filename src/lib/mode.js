// ¿Funciona con Supabase (sitio real) o como demo local?
// LIVE = true cuando el build tiene VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
// Sin esas variables la app funciona como prototipo con datos de ejemplo en el navegador.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
export const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
export const LIVE = Boolean(SUPABASE_URL && SUPABASE_KEY);
