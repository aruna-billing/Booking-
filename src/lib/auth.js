// Sesión del panel y comprobación de permisos.
//
// · Modo real (LIVE): inicio de sesión con Supabase Auth. El perfil (rol, marcas)
//   viene de la tabla staff_profiles y las políticas RLS repiten los permisos en
//   el servidor: aunque alguien manipule el navegador, la base de datos no le deja.
// · Modo demo: sin inicio de sesión; el usuario se elige en «Ver como».

import { useSyncExternalStore } from 'react';
import { ROLES } from '../data/roles.js';
import { getState, useDb } from '../store/mockDb.js';
import { LIVE } from './mode.js';

const KEY = 'booking-admin-user';
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ───────── Modo real ─────────
let auth = { ready: !LIVE, user: null, error: '' };
export const getAuthState = () => auth;
export function setAuthState(patch) {
  auth = { ...auth, ...patch };
  emit();
}
/** { ready, user, error } — solo modo real. */
export const useAuthState = () => useSyncExternalStore(subscribe, getAuthState, getAuthState);

// ───────── Modo demo ─────────
let currentId = (() => {
  try {
    return sessionStorage.getItem(KEY) || 'u-admin';
  } catch {
    return 'u-admin';
  }
})();

export function setCurrentUser(id) {
  if (LIVE) return;
  currentId = id;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* ignorar */
  }
  emit();
}

/** Usuario activo; si el elegido ya no existe o está inactivo, el primer administrador activo. */
export function resolveUser(users, id = currentId) {
  const u = users.find((x) => x.id === id && x.active);
  return u ?? users.find((x) => x.role === 'admin' && x.active) ?? users[0];
}

export const getCurrentUser = () => (LIVE ? auth.user : resolveUser(getState().users ?? []));

export function useCurrentUser() {
  const id = useSyncExternalStore(subscribe, () => (LIVE ? auth.user : currentId), () => currentId);
  const { users = [] } = useDb();
  return LIVE ? id : resolveUser(users, id);
}

export const can = (user, perm) => !!user && user.active !== false && (ROLES[user.role]?.permissions ?? []).includes(perm);

/** ¿El usuario puede ver datos de esta marca? (brandIds null = todas) */
export const canSeeBrand = (user, brandId) => !!user && (!user.brandIds || user.brandIds.includes(brandId));

export const visibleBrands = (user, brands) => brands.filter((b) => canSeeBrand(user, b.id));

/** Para la capa de servicios: lanza un error si el usuario activo no tiene el permiso. */
export function requirePermission(perm, brandId) {
  const u = getCurrentUser();
  if (!can(u, perm)) throw new Error(LIVE && !u ? 'Tu sesión terminó. Vuelve a iniciar sesión.' : 'No tienes permiso para realizar esta acción.');
  if (brandId && !canSeeBrand(u, brandId)) throw new Error('No tienes acceso a esta marca.');
  return u;
}
