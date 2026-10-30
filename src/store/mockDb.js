// Estado de la app en memoria. Toda escritura pasa por src/services/api.js.
//
// · Modo demo (sin Supabase): datos de ejemplo, guardados en localStorage.
// · Modo real (LIVE): empieza vacío y se llena desde Supabase (src/services/cloud.js).
//   No se guarda nada en localStorage para no mostrar datos viejos.

import { useSyncExternalStore } from 'react';
import { brands } from '../data/brands.js';
import { organization } from '../data/organization.js';
import { users } from '../data/users.js';
import { plans, extras } from '../data/catalog.js';
import { bankAccounts } from '../data/bankAccounts.js';
import { terms } from '../data/terms.js';
import { availabilityRules, blockedDateOffsets } from '../data/availabilityRules.js';
import { buildDemoRequests } from '../data/demoRequests.js';
import { demoCoupons } from '../data/coupons.js';
import { addDays, toISODate, today } from '../lib/date.js';
import { LIVE } from '../lib/mode.js';

const STORAGE_KEY = 'morel-booking-demo-v1';

function buildInitialState() {
  const blockedDates = Object.entries(blockedDateOffsets).flatMap(([brandId, list]) =>
    list.map((b) => ({ brandId, date: toISODate(addDays(today(), b.offset)), reason: b.reason }))
  );
  return {
    organization: structuredClone(organization),
    users: structuredClone(users),
    brands: structuredClone(brands),
    plans: structuredClone(plans),
    extras: structuredClone(extras),
    bankAccounts: structuredClone(bankAccounts),
    terms: structuredClone(terms),
    rules: structuredClone(availabilityRules),
    blockedDates,
    requests: buildDemoRequests(),
    coupons: structuredClone(demoCoupons),
    builtOn: toISODate(today()),
  };
}

/** Estado inicial en modo real: vacío hasta que llega la configuración de Supabase. */
function buildLiveState() {
  return {
    organization: structuredClone(organization),
    users: [],
    brands: [],
    plans: [],
    extras: [],
    bankAccounts: [],
    terms: {},
    rules: {},
    blockedDates: [],
    requests: [],
    coupons: [], // solo los administradores los cargan (configuración privada)
    busy: {}, // { [brandId]: [{ date, time, durationMin }] } horarios ocupados (sin datos personales)
    builtOn: null,
  };
}

/**
 * Configuración inicial para un Supabase vacío: marca, planes, extras, términos y horario
 * de Morel Estudio. Sin solicitudes, sin cuentas bancarias y sin datos ficticios.
 */
export function buildFirstSetup() {
  const clean = (b) => ({
    ...structuredClone(b),
    whatsappDisplay: '',
    email: '',
  });
  const rules = Object.fromEntries(
    Object.entries(structuredClone(availabilityRules)).map(([k, r]) => [k, { ...r, simulatedAnchors: [], simulatedOccupancy: 0 }])
  );
  const termsLive = Object.fromEntries(
    Object.entries(structuredClone(terms)).map(([k, t]) => [k, { ...t, version: '1.0', updatedAt: toISODate(today()) }])
  );
  return {
    organization: structuredClone(organization),
    brands: brands.map(clean),
    plans: structuredClone(plans),
    extras: structuredClone(extras),
    bankAccounts: [],
    coupons: [],
    terms: termsLive,
    rules,
    blockedDates: [],
  };
}

function load() {
  if (LIVE) return buildLiveState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Las fechas demo son relativas: si cambió el día, se regeneran.
      if (parsed?.builtOn === toISODate(today())) {
        return { ...parsed, users: parsed.users ?? structuredClone(users), coupons: parsed.coupons ?? structuredClone(demoCoupons) };
      }
    }
  } catch {
    /* almacenamiento no disponible: se trabaja solo en memoria */
  }
  return buildInitialState();
}

let state = load();
const listeners = new Set();

/** Guarda en localStorage. Devuelve false si no cupo (p. ej. demasiadas imágenes). */
function persist() {
  if (LIVE) return true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export const getState = () => state;

export function setState(updater) {
  state = typeof updater === 'function' ? updater(state) : updater;
  const saved = persist();
  listeners.forEach((l) => l());
  return saved;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDemoData() {
  if (LIVE) return;
  state = buildInitialState();
  persist();
  listeners.forEach((l) => l());
}

/** Hook de lectura. Devuelve el estado completo; los componentes seleccionan lo que necesitan. */
export const useDb = () => useSyncExternalStore(subscribe, getState, getState);
