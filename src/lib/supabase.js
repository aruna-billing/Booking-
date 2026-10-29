import { createClient } from '@supabase/supabase-js';
import { LIVE, SUPABASE_KEY, SUPABASE_URL } from './mode.js';

// Cliente único de Supabase. La clave «publishable» es pública por diseño:
// la seguridad la ponen las políticas RLS de supabase/01_instalacion.sql.
export const supabase = LIVE
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'morel-booking-auth' },
    })
  : null;
