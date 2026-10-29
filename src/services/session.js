// Inicio y cierre de sesión del panel con Supabase Auth (modo real).
import { supabase } from '../lib/supabase.js';
import { getAuthState, setAuthState } from '../lib/auth.js';
import { friendlyError, loadMyProfile, startStaffSession, stopStaffSession } from './cloud.js';

const NO_PROFILE = 'Tu cuenta no tiene acceso al panel. Pide a un administrador que te añada en «Usuarios y roles».';

let inFlight = null; // { id, promise } evita cargar el perfil dos veces a la vez

function applySession(session) {
  const id = session?.user?.id ?? null;
  if (inFlight && inFlight.id === id) return inFlight.promise;
  const promise = doApply(session).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { id, promise };
  return promise;
}

async function doApply(session) {
  const authUser = session?.user ?? null;
  if (!authUser) {
    if (getAuthState().user) stopStaffSession();
    setAuthState({ ready: true, user: null });
    return null;
  }
  if (getAuthState().user?.id === authUser.id) {
    setAuthState({ ready: true });
    return getAuthState().user;
  }
  try {
    const profile = await loadMyProfile(authUser.id);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setAuthState({ ready: true, user: null, error: profile ? 'Tu usuario está desactivado. Habla con un administrador.' : NO_PROFILE });
      return null;
    }
    setAuthState({ ready: true, user: profile, error: '' });
    startStaffSession(profile);
    return profile;
  } catch (e) {
    setAuthState({ ready: true, user: null, error: friendlyError(e) });
    return null;
  }
}

/** Recupera la sesión guardada y escucha cambios (otra pestaña, expiración…). */
export async function initSession() {
  const { data } = await supabase.auth.getSession();
  await applySession(data.session);
  supabase.auth.onAuthStateChange((event, session) => {
    // Fuera del callback: supabase-js recomienda no esperar otras llamadas aquí dentro.
    setTimeout(() => {
      if (event === 'SIGNED_OUT') applySession(null);
      else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') applySession(session);
    }, 0);
  });
}

export async function signIn(email, password) {
  setAuthState({ error: '' });
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const msg = /invalid login credentials/i.test(error.message)
      ? 'Correo o contraseña incorrectos.'
      : /email not confirmed/i.test(error.message)
        ? 'Tu correo aún no está confirmado. Revisa tu bandeja o pide al administrador que confirme la cuenta en Supabase.'
        : friendlyError(error);
    throw new Error(msg);
  }
  const profile = await applySession(data.session);
  if (!profile) throw new Error(getAuthState().error || NO_PROFILE);
  return profile;
}

export async function signOut() {
  await supabase.auth.signOut();
  await applySession(null);
}
