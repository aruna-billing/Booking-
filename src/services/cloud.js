// Conexión con Supabase (solo en modo real, ver lib/mode.js).
//
//   site_config 'public'   → marca, planes, extras, términos, horario, bloqueos y
//                            cuentas activas. La lee cualquiera (el sitio público).
//   site_config 'private'  → todas las cuentas bancarias (también las inactivas).
//   booking_requests       → solicitudes. Solo el equipo las lee; el público reserva
//                            con la función create_booking_request.
//   media + bucket media   → biblioteca de imágenes y videos (ver store/imageStore.js).
//   bucket receipts        → comprobantes e imágenes de inspiración (privado).
//
// Las pantallas no llaman a este archivo: lo usa services/api.js.

import { supabase } from '../lib/supabase.js';
import { getState, setState } from '../store/mockDb.js';
import { getCloudStatus, setCloudStatus } from '../store/cloudStatus.js';
import { addDays, toISODate, today } from '../lib/date.js';

const CONFIG_KEYS = ['organization', 'brands', 'plans', 'extras', 'terms', 'rules', 'blockedDates'];

/** Mensaje claro para errores de red o de permisos. */
export function friendlyError(error, fallback = 'No se pudo completar la acción.') {
  const msg = error?.message || String(error || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (/row-level security|permission denied|not authorized|jwt/i.test(msg)) return 'No tienes permiso para hacer esto, o tu sesión expiró. Vuelve a iniciar sesión.';
  if (/payload too large|exceeded the maximum allowed size|entity too large/i.test(msg)) return 'El archivo es demasiado grande.';
  if (/mime type|invalid_mime/i.test(msg)) return 'Ese tipo de archivo no está permitido.';
  return msg || fallback;
}
const fail = (error, fallback) => {
  const e = new Error(friendlyError(error, fallback));
  e.cause = error;
  return e;
};

// ───────────────────────── Configuración del sitio ─────────────────────────

let privateLoaded = false; // el admin ya tiene todas las cuentas: no reemplazarlas por las públicas

function applyConfig(pub, priv) {
  if (priv) privateLoaded = true;
  setState((s) => {
    const next = { ...s };
    CONFIG_KEYS.forEach((k) => {
      if (pub && pub[k] !== undefined) next[k] = pub[k];
    });
    next.bankAccounts = priv?.bankAccounts ?? (privateLoaded ? s.bankAccounts : pub?.bankAccounts ?? []);
    if (priv) next.coupons = priv.coupons ?? [];
    return next;
  });
}

/** Carga la configuración pública. Se llama al abrir la web. */
export async function loadPublicConfig() {
  if (getCloudStatus().phase !== 'ready') setCloudStatus({ phase: 'loading', error: null });
  const { data, error } = await supabase.from('site_config').select('id, data').eq('id', 'public').maybeSingle();
  if (error) {
    setCloudStatus({ phase: 'error', error: friendlyError(error, 'No se pudo cargar el sitio.') });
    return;
  }
  if (!data) {
    setCloudStatus({ phase: 'empty' });
    return;
  }
  applyConfig(data.data, null);
  setCloudStatus({ phase: 'ready' });
}

/** Admin: configuración pública + privada (cuentas inactivas). */
async function loadFullConfig() {
  const { data, error } = await supabase.from('site_config').select('id, data');
  if (error) throw fail(error);
  const pub = data.find((r) => r.id === 'public')?.data;
  const priv = data.find((r) => r.id === 'private')?.data;
  if (!pub) {
    setCloudStatus({ phase: 'empty' });
    return;
  }
  applyConfig(pub, priv);
  setCloudStatus({ phase: 'ready' });
}

// Las imágenes que la app guarda como data URL (logos) se suben a Storage antes de
// guardar la configuración, para que la configuración pese poco.
const inlineCache = new Map();

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = head.includes(';base64') ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export const extFor = (type, name = '') => EXT[type] || (name.includes('.') ? name.split('.').pop().toLowerCase().slice(0, 5) : 'bin');

async function uploadInline(dataUrl) {
  if (inlineCache.has(dataUrl)) return inlineCache.get(dataUrl);
  const blob = dataUrlToBlob(dataUrl);
  const path = `inline/${await sha(dataUrl)}.${extFor(blob.type)}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  if (error) throw fail(error, 'No se pudo subir una imagen.');
  const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  inlineCache.set(dataUrl, url);
  return url;
}

async function externalize(value) {
  if (typeof value === 'string') return value.startsWith('data:image/') && value.length > 200 ? uploadInline(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map(externalize));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await externalize(v);
    return out;
  }
  return value;
}

let saveChain = Promise.resolve();

/** Guarda la configuración completa (admin). Los guardados se hacen en orden. */
export function saveConfig() {
  const run = async () => {
    const s = getState();
    const config = {};
    for (const k of CONFIG_KEYS) config[k] = await externalize(s[k]);
    const bankAccounts = s.bankAccounts;
    const rows = [
      { id: 'public', data: { ...config, bankAccounts: bankAccounts.filter((a) => a.active) } },
      // Los cupones son privados: el público solo puede comprobar un código con check_coupon.
      { id: 'private', data: { bankAccounts, coupons: s.coupons ?? [] } },
    ];
    const { error } = await supabase.from('site_config').upsert(rows);
    if (error) throw fail(error, 'No se pudo guardar la configuración.');
    // Si se subieron imágenes, el estado pasa a usar sus URLs (más liviano).
    setState((st) => ({ ...st, ...config }));
    setCloudStatus({ saveError: null, phase: 'ready' });
  };
  const p = saveChain.then(run, run);
  saveChain = p.catch(() => {});
  return p.catch((e) => {
    setCloudStatus({ saveError: e.message, saveErrorKind: 'config' });
    throw e;
  });
}

// ───────────────────────── Solicitudes ─────────────────────────

const byNewest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

function upsertLocalRequest(payload) {
  if (!payload?.id) return;
  setState((s) => {
    const exists = s.requests.some((r) => r.id === payload.id);
    const requests = exists ? s.requests.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...s.requests];
    return { ...s, requests: requests.sort(byNewest) };
  });
}

async function loadRequests() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('payload')
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) throw fail(error, 'No se pudieron cargar las solicitudes.');
    all.push(...data.map((r) => r.payload));
    if (data.length < 1000) break;
  }
  setState((s) => ({ ...s, requests: all.sort(byNewest) }));
}

/** Guarda una solicitud ya modificada en el estado local. */
export async function saveRequest(id) {
  const r = getState().requests.find((x) => x.id === id);
  if (!r) throw new Error('Solicitud no encontrada.');
  const { data, error } = await supabase.from('booking_requests').update({ payload: r }).eq('id', id).select('payload');
  if (error || !data?.length) {
    await reloadRequest(id);
    const e = fail(error ?? new Error('No tienes acceso a esta solicitud.'), 'No se pudo guardar el cambio.');
    setCloudStatus({ saveError: e.message, saveErrorKind: 'request' });
    throw e;
  }
  upsertLocalRequest(data[0].payload);
}

async function reloadRequest(id) {
  const { data } = await supabase.from('booking_requests').select('payload').eq('id', id).maybeSingle();
  if (data?.payload) upsertLocalRequest(data.payload);
}

/** Público: crea la solicitud en el servidor (recalcula precio y comprueba el horario). */
/** Rutas de archivos privados (comprobantes e inspiración) de una solicitud. */
function requestFilePaths(r) {
  const out = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (typeof v.path === 'string' && v.path.startsWith('incoming/')) out.add(v.path);
      Object.values(v).forEach(walk);
    }
  };
  walk(r);
  return [...out];
}

/** Admin: borra la solicitud, su evento de Google Calendar y sus archivos. */
export async function deleteRequest(r) {
  // 1) Quitar el evento de Google Calendar (si lo hay): se marca cancelada y se sincroniza.
  if (calendar.active && ['confirmed', 'completed'].includes(r.status)) {
    try {
      const { data } = await supabase.from('booking_requests').update({ payload: { ...r, status: 'cancelled' } }).eq('id', r.id).select('id');
      if (data?.length) await syncCalendar(r.id);
    } catch {
      /* si falla, el evento queda en Google y se puede borrar a mano */
    }
  }
  // 2) Borrar la fila.
  const { data, error } = await supabase.from('booking_requests').delete().eq('id', r.id).select('id');
  if (error) throw fail(error, 'No se pudo borrar la solicitud.');
  if (!data?.length) throw new Error('No se pudo borrar: solo un administrador puede borrar solicitudes.');
  // 3) Borrar comprobantes e imágenes (si falla, quedan huérfanos sin afectar a nada).
  const paths = requestFilePaths(r);
  if (paths.length) await supabase.storage.from('receipts').remove(paths).catch(() => {});
}

export async function createRequest(input) {
  const { data, error } = await supabase.rpc('create_booking_request', { p: input });
  if (error) throw fail(error, 'No se pudo enviar tu solicitud. Inténtalo de nuevo.');
  return data;
}

/** Público: comprueba un cupón en el servidor (sin ver la lista de cupones). */
export async function checkCoupon(code, brandId, email, planId) {
  const { data, error } = await supabase.rpc('check_coupon', { p_code: code, p_brand: brandId, p_email: email || null, p_plan: planId || null });
  if (error) throw fail(error, 'No se pudo comprobar el cupón.');
  if (!data?.valid) throw new Error(data?.message || 'Este cupón no es válido.');
  return { code: data.code, type: data.type, value: Number(data.value), planIds: Array.isArray(data.planIds) && data.planIds.length ? data.planIds : null };
}

/**
 * Público: horarios ocupados de una marca (sin datos personales).
 * Suma las reservas activas y, si Google Calendar está conectado, las horas
 * ocupadas en ese calendario. Si Google falla, se sigue solo con las reservas.
 */
export async function loadBusySlots(brandId) {
  const from = toISODate(today());
  const to = toISODate(addDays(today(), 400));
  const ahead = Math.min(400, Math.max(30, Number(getState().rules?.[brandId]?.maxAdvanceDays) || 120));
  const [db, google] = await Promise.all([
    supabase.rpc('get_busy_slots', { p_brand: brandId, p_from: from, p_to: to }),
    loadCalendarBusy(from, toISODate(addDays(today(), ahead))).catch(() => []),
  ]);
  if (db.error) throw fail(db.error, 'No se pudo consultar la agenda.');
  const list = [
    ...(db.data ?? []).map((r) => ({ date: r.slot_date, time: r.slot_time, durationMin: r.duration_min })),
    ...google.map((b) => ({ ...b, source: 'google' })),
  ];
  setState((s) => ({ ...s, busy: { ...(s.busy ?? {}), [brandId]: list } }));
  return list;
}

/** Público: cupos usados de los planes limitados de una marca (sin datos personales). */
export async function loadPlanUsage(brandId) {
  const { data, error } = await supabase.rpc('get_plan_usage', { p_brand: brandId });
  if (error) throw fail(error, 'No se pudieron consultar los cupos.');
  const usage = Object.fromEntries((data ?? []).map((r) => [r.plan_id, Number(r.used) || 0]));
  setState((s) => ({ ...s, planUsage: { ...(s.planUsage ?? {}), ...usage } }));
  return usage;
}

// ───────────────────────── Google Calendar (función google-calendar) ─────────────────────────

let calendar = { checked: false, active: false, info: null };
export const getCalendarState = () => calendar;

/** Llama a la función. Devuelve { data } o lanza un error con el mensaje de la función. */
async function invokeCalendar(body) {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (!error) return data;
  let msg = '';
  try {
    msg = (await error.context?.json?.())?.error ?? '';
  } catch {
    /* sin cuerpo */
  }
  const e = new Error(msg || friendlyError(error, 'No se pudo contactar con Google Calendar.'));
  e.status = error.context?.status ?? 0;
  throw e;
}

/** Horas ocupadas en Google entre dos fechas: [{ date, time, durationMin }]. */
export async function loadCalendarBusy(from, to) {
  const data = await invokeCalendar({ action: 'busy', from, to });
  return data?.blocks ?? [];
}

/** Admin: envía un correo de prueba con la función booking-emails (usa los textos guardados). */
export async function sendTestEmail(brandId, kind, to) {
  const { data, error } = await supabase.functions.invoke('booking-emails', { body: { action: 'test', brandId, kind, to } });
  if (!error) return data;
  if (error.context?.status === 404) throw new Error('La función booking-emails no está desplegada (ver docs/CORREOS.md).');
  let msg = '';
  try {
    msg = (await error.context?.json?.())?.error ?? '';
  } catch {
    /* sin cuerpo */
  }
  throw new Error(msg || friendlyError(error, 'No se pudo enviar el correo de prueba.'));
}

/** Equipo: ¿está conectado Google Calendar? */
export async function checkCalendar() {
  try {
    const info = await invokeCalendar({ action: 'status' });
    calendar = { checked: true, active: Boolean(info?.configured && info?.ok), info };
  } catch (e) {
    // Función no desplegada o sin acceso: se considera «no conectado» sin molestar.
    calendar = { checked: true, active: false, info: { configured: false, reason: e.status === 404 ? 'La función google-calendar no está desplegada.' : e.message } };
  }
  setCloudStatus({ calendar: calendar.info });
  return calendar;
}

/** Equipo: actualiza en Google los eventos de estas solicitudes. Lanza error si alguna falla. */
export async function syncCalendar(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!list.length) return { ok: true };
  const data = await invokeCalendar({ action: 'sync', requestIds: list });
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Tras cambiar una solicitud: sincroniza en segundo plano y avisa en el panel si falla. */
export function queueCalendarSync(id) {
  if (!calendar.active) return;
  syncCalendar(id).catch((e) => {
    setCloudStatus({ saveError: `Google Calendar: ${e.message}`, saveErrorKind: 'calendar', saveErrorId: id });
  });
}

// ───────────────────────── Archivos del cliente ─────────────────────────

const safeName = (name) =>
  (name || 'archivo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80) || 'archivo';

/** Sube un comprobante o imagen de inspiración. Devuelve la ruta privada. */
export async function uploadClientFile(file) {
  const path = `incoming/${crypto.randomUUID()}/${safeName(file.name)}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw fail(error, 'No se pudo subir el archivo.');
  return path;
}

/** Enlace temporal (5 min) para que el equipo vea un archivo privado. */
export async function signedFileUrl(path) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
  if (error) throw fail(error, 'No se pudo abrir el archivo.');
  return data.signedUrl;
}

// ───────────────────────── Equipo ─────────────────────────

const fromProfile = (p) => ({
  id: p.user_id,
  name: p.full_name || p.email,
  email: p.email,
  role: p.role,
  brandIds: p.brand_ids ?? null,
  active: p.is_active,
});

export async function loadStaff() {
  const { data, error } = await supabase.from('staff_profiles').select('*').order('created_at');
  if (error) throw fail(error, 'No se pudo cargar el equipo.');
  setState((s) => ({ ...s, users: data.map(fromProfile) }));
}

export async function addStaff(u) {
  const { error } = await supabase.rpc('add_staff_member', { p_email: u.email, p_name: u.name, p_role: u.role, p_brand_ids: u.brandIds });
  if (error) throw fail(error);
  await loadStaff();
}

export async function updateStaff(u) {
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({ full_name: u.name, role: u.role, brand_ids: u.brandIds, is_active: u.active })
    .eq('user_id', u.id)
    .select('user_id');
  if (error || !data?.length) throw fail(error ?? new Error('No se pudo actualizar el usuario.'));
  await loadStaff();
}

export async function removeStaff(id) {
  const { data, error } = await supabase.from('staff_profiles').delete().eq('user_id', id).select('user_id');
  if (error || !data?.length) throw fail(error ?? new Error('No se pudo eliminar el usuario.'));
  await loadStaff();
}

/** Perfil del equipo del usuario que inició sesión (o null). */
export async function loadMyProfile(userId) {
  const { data, error } = await supabase.from('staff_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail(error, 'No se pudo comprobar tu perfil.');
  return data ? fromProfile(data) : null;
}

// ───────────────────────── Panel: carga y tiempo real ─────────────────────────

let channel = null;
let pollTimer = null;
const onVisible = () => {
  if (document.visibilityState === 'visible') loadRequests().catch(() => {});
};

export async function startStaffSession(user) {
  setCloudStatus({ staff: 'loading', saveError: null });
  try {
    const jobs = [loadRequests()];
    if (user.role === 'admin') jobs.push(loadFullConfig(), loadStaff());
    await Promise.all(jobs);
    subscribeRealtime(user);
    checkCalendar();
    // Respaldo del tiempo real: refresca al volver a la pestaña y cada 2 minutos.
    clearInterval(pollTimer);
    pollTimer = setInterval(() => document.visibilityState === 'visible' && loadRequests().catch(() => {}), 120000);
    document.addEventListener('visibilitychange', onVisible);
    setCloudStatus({ staff: 'ready' });
  } catch (e) {
    setCloudStatus({ staff: 'error', saveError: e.message, saveErrorKind: 'load' });
  }
}

function subscribeRealtime(user) {
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel('booking-panel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, (msg) => {
      if (msg.eventType === 'DELETE') {
        const id = msg.old?.id;
        if (id) setState((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== id) }));
      } else if (msg.new?.payload) {
        upsertLocalRequest(msg.new.payload);
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, () => {
      (user.role === 'admin' ? loadFullConfig() : loadPublicConfig()).catch(() => {});
    })
    .subscribe();
}

export function stopStaffSession() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  privateLoaded = false;
  clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', onVisible);
  setState((s) => ({ ...s, requests: [], users: [], coupons: [], bankAccounts: s.bankAccounts.filter((a) => a.active) }));
  setCloudStatus({ staff: 'idle', saveError: null });
}

/** Reintenta el último guardado fallido (banner del panel). */
export async function retrySave() {
  const kind = getCloudStatus().saveErrorKind;
  setCloudStatus({ saveError: null });
  if (kind === 'config' && getCloudStatus().phase !== 'empty') await saveConfig();
  if (kind === 'calendar') queueCalendarSync(getCloudStatus().saveErrorId);
}
