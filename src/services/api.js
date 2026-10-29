// Capa de servicios del prototipo.
// Cada función es asíncrona y tiene la misma firma que tendrá con Supabase.
// Ver docs/INTEGRACION.md para el mapeo tabla por tabla.
//
// · Modo demo: las escrituras modifican solo el estado local del navegador.
// · Modo real (LIVE): después de cambiar el estado local se guarda en Supabase
//   (services/cloud.js). Si el guardado falla, la función lanza un error.
// Google Calendar y WhatsApp NO están conectados en ninguno de los dos modos.

import { getState, setState } from '../store/mockDb.js';
import { computeQuote } from '../lib/pricing.js';
import { getDayAvailability } from '../lib/availability.js';
import { getCurrentUser, requirePermission } from '../lib/auth.js';
import { LIVE } from '../lib/mode.js';
import { agendaRequests } from '../lib/busy.js';
import * as cloud from './cloud.js';

// En la demo se simula la espera de un servidor; en modo real la espera es la de verdad.
const delay = (ms = 350) => (LIVE ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
/**
 * Modo real: guarda la configuración del sitio en Supabase.
 * No lanza error: si falla, el cambio queda en pantalla, el panel muestra un aviso con
 * «Reintentar» y la función devuelve false (igual que la demo cuando no hay espacio).
 */
const persistConfig = async () => {
  if (!LIVE) return true;
  try {
    await cloud.saveConfig();
    return true;
  } catch {
    return false;
  }
};

/** Mensaje cuando una función save* devuelve false. */
export const SAVE_FAILED = LIVE
  ? 'No se guardó en el servidor. Revisa el aviso de arriba y pulsa «Reintentar».'
  : 'Guardado solo hasta recargar: el navegador no tiene más espacio en esta demo.';
const now = () => new Date().toISOString();
// Nombre de quien hace el cambio (para el historial).
const actor = () => getCurrentUser()?.name ?? 'Equipo';
/** Comprueba permiso (y acceso a la marca de la solicitud, si se indica). */
const guard = (perm, requestId) => {
  const brandId = requestId ? getState().requests.find((r) => r.id === requestId)?.brandId : undefined;
  return requirePermission(perm, brandId);
};

async function updateRequest(id, patch, historyLabel) {
  setState((s) => ({
    ...s,
    requests: s.requests.map((r) =>
      r.id === id
        ? {
            ...r,
            ...patch,
            history: historyLabel ? [...r.history, { at: now(), label: historyLabel, by: actor() }] : r.history,
          }
        : r
    ),
  }));
  if (LIVE) await cloud.saveRequest(id);
}

// ───────────────────────── Público ─────────────────────────

/**
 * Crea una solicitud de reserva.
 * Futuro: RPC `create_booking_request` en Supabase que recalcula el precio en servidor,
 * vuelve a comprobar disponibilidad (y Google Calendar) y guarda archivos en Storage.
 */
export async function createBookingRequest(draft) {
  if (LIVE) return createBookingRequestLive(draft);
  await delay(900);
  const s = getState();
  const brand = s.brands.find((b) => b.id === draft.brandId);
  const plan = s.plans.find((p) => p.id === draft.planId);
  if (!brand || !plan) throw new Error('Plan o marca no válidos.');

  const quote = computeQuote({ plan, extras: s.extras, selection: draft.extras, depositPercent: brand.depositPercent });

  // Revalidación con la duración total (plan + minutos extra), como haría el servidor.
  const day = getDayAvailability(draft.date, {
    brandId: brand.id,
    rules: s.rules[brand.id],
    blockedDates: s.blockedDates,
    requests: s.requests,
  }, quote.durationMin);
  if (!day.slots.find((sl) => sl.time === draft.time && sl.available)) {
    throw new Error('Ese horario acaba de ocuparse en la demo. Vuelve al paso de fecha y elige otro.');
  }

  const nextNumber = Math.max(1000, ...s.requests.map((r) => Number(r.id.replace('req-', '')) || 0)) + 1;
  const id = `req-${nextNumber}`;
  const createdAt = now();
  const stripFile = ({ name, size, type }) => ({ name, size, type });

  const request = {
    id,
    brandId: brand.id,
    createdAt,
    status: 'pending_review',
    paymentStatus: 'submitted',
    paymentRejectionReason: null,
    client: {
      firstName: draft.details.firstName.trim(),
      lastName: draft.details.lastName.trim(),
      email: draft.details.email.trim(),
      phone: draft.details.phone.trim(),
    },
    notes: draft.details.notes.trim(),
    inspirationFiles: draft.details.inspirationFiles.map(stripFile),
    planId: plan.id,
    planName: plan.name,
    currency: brand.currency,
    quote,
    date: draft.date,
    time: draft.time,
    receipt: { ...stripFile(draft.payment.receipt), uploadedAt: createdAt, declaredAmount: quote.deposit },
    acceptedTermsVersion: s.terms[brand.id]?.version,
    confirmedAt: null,
    shotAt: null,
    deliveredAt: null,
    galleryUrl: '',
    // El anticipo reportado por el cliente queda «por verificar» hasta que el equipo lo revise.
    payments: [
      { id: `${id}-p1`, amount: quote.deposit, method: 'transfer', concept: 'deposit', date: createdAt.slice(0, 10), reference: 'Comprobante adjunto', status: 'pending', source: 'client', createdAt },
    ],
    history: [
      { at: createdAt, label: 'Solicitud recibida desde el formulario público', by: 'Cliente' },
      { at: createdAt, label: 'Comprobante adjuntado (simulado, sin subir archivo)', by: 'Cliente' },
    ],
    internalNotes: [],
  };
  setState((st) => ({ ...st, requests: [request, ...st.requests] }));
  return request;
}

/** Modo real: sube la reserva a Supabase. El servidor recalcula precio y horario. */
async function createBookingRequestLive(draft) {
  const s = getState();
  const brand = s.brands.find((b) => b.id === draft.brandId);
  const plan = s.plans.find((p) => p.id === draft.planId && p.active);
  if (!brand || !plan) throw new Error('El plan elegido ya no está disponible. Vuelve a elegir tu plan.');
  const receipt = draft.payment.receipt;
  if (!receipt?.path) throw new Error('Vuelve a adjuntar el comprobante de pago.');
  if (receipt.status === 'uploading' || draft.details.inspirationFiles.some((f) => f.status === 'uploading')) {
    throw new Error('Espera a que terminen de subir tus archivos.');
  }

  // Comprobación rápida con la agenda actual (el servidor vuelve a comprobarlo).
  const quote = computeQuote({ plan, extras: s.extras, selection: draft.extras, depositPercent: brand.depositPercent });
  try {
    await cloud.loadBusySlots(brand.id);
  } catch {
    /* si falla, decide el servidor */
  }
  const day = getDayAvailability(
    draft.date,
    { brandId: brand.id, rules: s.rules[brand.id], blockedDates: s.blockedDates, requests: agendaRequests(getState(), brand.id) },
    quote.durationMin
  );
  if (!day.slots.find((sl) => sl.time === draft.time && sl.available)) {
    throw new Error('Ese horario acaba de ocuparse. Vuelve al paso de fecha y elige otro.');
  }

  const d = draft.details;
  const result = await cloud.createRequest({
    brandId: brand.id,
    planId: plan.id,
    extras: draft.extras,
    date: draft.date,
    time: draft.time,
    client: { firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), phone: d.phone.trim() },
    notes: d.notes.trim(),
    acceptedTerms: d.acceptedTerms === true,
    receipt: { name: receipt.name, path: receipt.path },
    inspirationFiles: d.inspirationFiles.filter((f) => f.path).map((f) => ({ name: f.name, path: f.path })),
  });
  // Copia local mínima para la pantalla de gracias (el público no puede leer la tabla).
  const request = {
    id: result.id,
    brandId: brand.id,
    planId: plan.id,
    planName: result.planName ?? plan.name,
    quote: result.quote ?? quote,
    date: result.date ?? draft.date,
    time: result.time ?? draft.time,
    currency: brand.currency,
    status: 'pending_review',
    paymentStatus: 'submitted',
    createdAt: now(),
    client: { firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: '', phone: '' },
    payments: [],
    history: [],
    internalNotes: [],
    inspirationFiles: [],
    isLocalCopy: true,
  };
  setState((st) => ({ ...st, requests: [request, ...st.requests.filter((r) => r.id !== request.id)] }));
  cloud.loadBusySlots(brand.id).catch(() => {});
  return request;
}

// ───────────────────────── Administración ─────────────────────────

export async function confirmRequest(id) {
  guard('payments.manage', id);
  await delay();
  await updateRequest(id, { status: 'confirmed', confirmedAt: now() }, LIVE ? 'Reserva confirmada' : 'Reserva confirmada (en producción: crearía el evento en Google Calendar)');
}

export async function cancelRequest(id, reason) {
  guard('requests.manage', id);
  await delay();
  await updateRequest(id, { status: 'cancelled' }, `Reserva cancelada${reason ? `: ${reason}` : ''}`);
}

export async function completeRequest(id) {
  guard('requests.manage', id);
  await delay();
  await updateRequest(id, { status: 'completed' }, 'Sesión marcada como completada');
}

export async function reopenRequest(id) {
  guard('requests.manage', id);
  await delay();
  await updateRequest(id, { status: 'pending_review' }, 'Solicitud reabierta para revisión');
}

const setPendingPayments = (r, status) =>
  (r.payments ?? []).map((p) => (p.status === 'pending' ? { ...p, status, reviewedAt: now() } : p));

/**
 * Aceptar sesión: verifica el comprobante que envió el cliente y confirma la reserva.
 * Es la acción del rol Asistente (y también puede usarla un administrador).
 */
export async function acceptSession(id) {
  guard('sessions.decide', id);
  await delay();
  const r = getState().requests.find((x) => x.id === id);
  if (!r || !['pending_review', 'awaiting_payment'].includes(r.status)) throw new Error('Esta solicitud ya no está pendiente.');
  if (r.paymentStatus !== 'submitted' && r.paymentStatus !== 'verified') throw new Error('Falta un comprobante de pago para aceptar la sesión.');
  await updateRequest(
    id,
    { status: 'confirmed', confirmedAt: now(), paymentStatus: 'verified', paymentRejectionReason: null, payments: setPendingPayments(r, 'verified') },
    'Sesión aceptada: comprobante verificado y reserva confirmada'
  );
}

/** Rechazar sesión: cancela la solicitud (la fecha queda libre) y rechaza el comprobante pendiente. */
export async function rejectSession(id, reason) {
  guard('sessions.decide', id);
  if (!reason?.trim()) throw new Error('Indica el motivo del rechazo.');
  await delay();
  const r = getState().requests.find((x) => x.id === id);
  if (!r || !['pending_review', 'awaiting_payment'].includes(r.status)) throw new Error('Esta solicitud ya no está pendiente.');
  await updateRequest(
    id,
    {
      status: 'cancelled',
      paymentStatus: r.paymentStatus === 'submitted' ? 'rejected' : r.paymentStatus,
      paymentRejectionReason: r.paymentStatus === 'submitted' ? reason : r.paymentRejectionReason,
      payments: setPendingPayments(r, 'rejected'),
    },
    `Sesión rechazada: ${reason}`
  );
}

export async function verifyPayment(id, { alsoConfirm = false } = {}) {
  guard('payments.manage', id);
  await delay();
  const r = getState().requests.find((x) => x.id === id);
  const patch = { paymentStatus: 'verified', paymentRejectionReason: null, payments: setPendingPayments(r, 'verified') };
  if (alsoConfirm) {
    patch.status = 'confirmed';
    patch.confirmedAt = now();
  }
  await updateRequest(id, patch, alsoConfirm ? 'Pago verificado y reserva confirmada' : 'Pago verificado');
}

/**
 * Registra un pago hecho por el cliente (anticipo, abono o saldo).
 * Futuro: insert en `payments` + recálculo del saldo en servidor.
 */
export async function addPayment(id, payment) {
  guard('payments.manage', id);
  await delay(300);
  const r = getState().requests.find((x) => x.id === id);
  if (!r) throw new Error('Solicitud no encontrada.');
  const record = { ...payment, id: `${id}-m${Date.now().toString(36)}`, source: 'admin', createdAt: now() };
  const payments = [...(r.payments ?? []), record];
  const verifiedTotal = payments.filter((p) => p.status === 'verified').reduce((a, p) => a + p.amount, 0);
  const patch = { payments };
  // Si con este pago queda cubierto el anticipo, el pago de la solicitud pasa a «Verificado».
  if (record.status === 'verified' && verifiedTotal >= r.quote.deposit && r.paymentStatus !== 'verified') {
    patch.paymentStatus = 'verified';
    patch.paymentRejectionReason = null;
  }
  const money = `${r.currency === 'USD' ? 'US$' : 'RD$'} ${record.amount.toLocaleString('en-US')}`;
  await updateRequest(id, patch, `Pago registrado: ${money}${record.status === 'pending' ? ' (por verificar)' : ''}`);
  return record;
}

export async function voidPayment(id, paymentId, reason) {
  guard('payments.manage', id);
  await delay(250);
  const r = getState().requests.find((x) => x.id === id);
  const p = r.payments.find((x) => x.id === paymentId);
  await updateRequest(
    id,
    { payments: r.payments.map((x) => (x.id === paymentId ? { ...x, status: 'void', voidReason: reason } : x)) },
    `Pago anulado (${p.amount.toLocaleString('en-US')})${reason ? `: ${reason}` : ''}`
  );
}

export async function rejectPayment(id, reason) {
  guard('payments.manage', id);
  await delay();
  await updateRequest(
    id,
    { paymentStatus: 'rejected', status: 'awaiting_payment', paymentRejectionReason: reason, payments: setPendingPayments(getState().requests.find((x) => x.id === id), 'rejected') },
    `Comprobante rechazado: ${reason}`
  );
}

export async function addInternalNote(id, text) {
  guard('requests.manage', id);
  await delay(150);
  setState((s) => ({
    ...s,
    requests: s.requests.map((r) =>
      r.id === id ? { ...r, internalNotes: [...r.internalNotes, { at: now(), text, by: actor() }] } : r
    ),
  }));
  if (LIVE) await cloud.saveRequest(id);
}

export async function toggleBlockedDate(brandId, date, reason = 'Bloqueado manualmente') {
  requirePermission('calendar.manage', brandId);
  await delay(150);
  setState((s) => {
    const exists = s.blockedDates.some((b) => b.brandId === brandId && b.date === date);
    return {
      ...s,
      blockedDates: exists
        ? s.blockedDates.filter((b) => !(b.brandId === brandId && b.date === date))
        : [...s.blockedDates, { brandId, date, reason }],
    };
  });
  return persistConfig();
}

export async function savePlan(plan) {
  requirePermission('catalog.manage');
  await delay(200);
  const saved = setState((s) => {
    const exists = s.plans.some((p) => p.id === plan.id);
    return { ...s, plans: exists ? s.plans.map((p) => (p.id === plan.id ? plan : p)) : [...s.plans, plan] };
  });
  return LIVE ? persistConfig() : saved;
}

export async function saveExtra(extra) {
  requirePermission('catalog.manage');
  await delay(200);
  setState((s) => {
    const exists = s.extras.some((e) => e.id === extra.id);
    return { ...s, extras: exists ? s.extras.map((e) => (e.id === extra.id ? extra : e)) : [...s.extras, extra] };
  });
  return persistConfig();
}

export async function saveBankAccount(account) {
  requirePermission('accounts.manage');
  await delay(200);
  setState((s) => {
    const exists = s.bankAccounts.some((a) => a.id === account.id);
    return {
      ...s,
      bankAccounts: exists ? s.bankAccounts.map((a) => (a.id === account.id ? account : a)) : [...s.bankAccounts, account],
    };
  });
  return persistConfig();
}

// Las funciones save* devuelven `false` si el navegador no tuvo espacio para guardar
// (las imágenes del prototipo viven en localStorage). En producción irán a Storage.
// La tarjeta de la marca no edita la web: se conservan los textos e imágenes actuales
// (web, lema, descripción y textos de portada) para no pisar lo guardado en Personalización.
export async function saveBrand(brand) {
  requirePermission('brands.manage');
  await delay(250);
  const saved = setState((s) => ({
    ...s,
    brands: s.brands.map((b) =>
      b.id === brand.id
        ? { ...brand, web: b.web, tagline: b.tagline, description: b.description, studio: { ...b.studio, instagram: brand.studio?.instagram ?? b.studio?.instagram } }
        : b
    ),
  }));
  return LIVE ? persistConfig() : saved;
}

export async function saveOrganization(org) {
  requirePermission('brands.manage');
  await delay(250);
  const saved = setState((s) => ({ ...s, organization: { ...org, web: s.organization.web } }));
  return LIVE ? persistConfig() : saved;
}

export async function saveTerms(brandId, sections) {
  requirePermission('terms.manage');
  await delay(250);
  setState((s) => {
    const prev = s.terms[brandId];
    const [maj, min] = String(prev?.version ?? '1.0').replace('-demo', '').split('.').map(Number);
    return {
      ...s,
      terms: {
        ...s.terms,
        [brandId]: { version: `${maj || 1}.${(min || 0) + 1}${LIVE ? '' : '-demo'}`, updatedAt: new Date().toISOString().slice(0, 10), sections },
      },
    };
  });
  return persistConfig();
}

// ───────────────────────── Marcas: crear y eliminar ─────────────────────────

const slugify = (t) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'marca';

/** Datos que impiden borrar una marca (historial que se perdería). */
export function brandUsage(state, brandId) {
  const requests = state.requests.filter((r) => r.brandId === brandId);
  return {
    requests: requests.length,
    payments: requests.reduce((a, r) => a + (r.payments ?? []).length, 0),
    plans: state.plans.filter((p) => p.brandId === brandId).length,
    extras: state.extras.filter((x) => x.brandId === brandId).length,
    accounts: state.bankAccounts.filter((a) => a.brandId === brandId).length,
  };
}

/**
 * Crea una marca nueva (oculta) a partir del estilo de otra.
 * Futuro: insert en `brands` + reglas y términos por defecto en una transacción.
 */
export async function createBrand({ name, currency, depositPercent, bookingType, copyStyleFrom }) {
  requirePermission('brands.manage');
  await delay(300);
  const s = getState();
  let id = slugify(name);
  let n = 2;
  while (s.brands.some((b) => b.id === id)) id = `${slugify(name)}-${n++}`;
  const base = s.brands.find((b) => b.id === copyStyleFrom);
  const isEvent = bookingType === 'event';
  const brand = {
    id,
    name: name.trim(),
    shortName: name.trim().split(' ')[0],
    tagline: '',
    description: '',
    currency,
    locale: 'es-DO',
    depositPercent,
    bookingType,
    deliveryDays: 10,
    published: false,
    whatsappDisplay: '',
    email: '',
    theme: structuredClone(base?.theme ?? s.brands[0].theme),
    heroTone: base?.heroTone ?? 'warm',
    logo: null,
    logoOnDark: null,
    studio: {
      headline: isEvent ? 'Reserva tu fecha' : 'Reserva tu cita',
      intro: '',
      cta: isEvent ? 'Consulta tu fecha' : 'Reserva una cita',
      gallery: ['Muestra', 'Muestra', 'Muestra', 'Muestra', 'Muestra'],
      instagram: '',
    },
  };
  const rulesTemplate = Object.values(s.rules).find((r) => r.mode === (isEvent ? 'exclusive_day' : 'timed'));
  const rules = structuredClone(
    (rulesTemplate && LIVE ? { ...rulesTemplate, simulatedAnchors: [], simulatedOccupancy: 0 } : rulesTemplate) ??
      (isEvent
        ? { mode: 'exclusive_day', workingDays: [0, 5, 6], startTimes: ['10:00', '15:00'], defaultDurationMin: 480, maxBookingsPerDay: 1, minNoticeDays: 30, maxAdvanceDays: 540, simulatedOccupancy: 0.3 }
        : { mode: 'timed', workingDays: [1, 2, 3, 4, 5, 6], openTime: '09:00', closeTime: '18:00', startStepMin: 30, bufferMin: 15, breaks: [], defaultDurationMin: 60, maxBookingsPerDay: 5, minNoticeDays: 2, maxAdvanceDays: 120, simulatedAnchors: [], simulatedOccupancy: 0.3 })
  );
  const terms = {
    version: LIVE ? '1.0' : '0.1-demo',
    updatedAt: new Date().toISOString().slice(0, 10),
    sections: [
      { title: 'Reserva y anticipo', body: `La fecha se considera reservada cuando se confirma el anticipo del ${depositPercent} % del total. El saldo restante se paga el día de la sesión.` },
      { title: 'Cambios y cancelaciones', body: 'Escribe aquí las condiciones de cambio de fecha y cancelación.' },
    ],
  };
  setState((st) => ({ ...st, brands: [...st.brands, brand], rules: { ...st.rules, [id]: rules }, terms: { ...st.terms, [id]: terms } }));
  if (!(await persistConfig())) throw new Error(SAVE_FAILED);
  return brand;
}

/** Elimina una marca y su catálogo, cuentas, términos y reglas. Solo si no tiene solicitudes. */
export async function deleteBrand(brandId) {
  requirePermission('brands.manage');
  await delay(300);
  const s = getState();
  if (s.brands.length <= 1) throw new Error('Debe quedar al menos una marca.');
  if (brandUsage(s, brandId).requests > 0) throw new Error('La marca tiene solicitudes registradas. Ocúltala en lugar de eliminarla.');
  setState((st) => {
    const { [brandId]: _r, ...rules } = st.rules;
    const { [brandId]: _t, ...terms } = st.terms;
    return {
      ...st,
      brands: st.brands.filter((b) => b.id !== brandId),
      plans: st.plans.filter((p) => p.brandId !== brandId),
      extras: st.extras.filter((x) => x.brandId !== brandId),
      bankAccounts: st.bankAccounts.filter((a) => a.brandId !== brandId),
      blockedDates: st.blockedDates.filter((b) => b.brandId !== brandId),
      rules,
      terms,
    };
  });
  return persistConfig();
}

// ───────────────────────── Personalización web ─────────────────────────

/** Guarda la página de una marca (portada, galería, textos) y las imágenes de sus planes. */
export async function saveBrandWeb(brandId, { tagline, studio, web, description }, planImages = {}) {
  requirePermission('web.manage');
  await delay(250);
  const saved = setState((s) => ({
    ...s,
    brands: s.brands.map((b) => (b.id === brandId ? { ...b, tagline, description: description ?? b.description, studio: { ...b.studio, ...studio }, web } : b)),
    plans: s.plans.map((p) => (p.brandId === brandId && p.id in planImages ? { ...p, imageId: planImages[p.id] } : p)),
  }));
  return LIVE ? persistConfig() : saved;
}

export async function saveOrgWeb(web) {
  requirePermission('web.manage');
  await delay(200);
  const saved = setState((s) => ({ ...s, organization: { ...s.organization, web } }));
  return LIVE ? persistConfig() : saved;
}

/** Quita una imagen de todos los lugares donde se usa (antes de borrarla de la biblioteca). */
export async function clearImageReferences(imageId) {
  requirePermission('web.manage');
  const clear = (id) => (id === imageId ? null : id);
  setState((s) => ({
    ...s,
    brands: s.brands.map((b) => {
      if (!b.web) return b;
      const w = b.web;
      return {
        ...b,
        web: {
          ...w,
          hero: w.hero ? { ...w.hero, imageId: clear(w.hero.imageId), videoId: clear(w.hero.videoId ?? null) } : w.hero,
          cardImageId: clear(w.cardImageId ?? null),
          gallery: w.gallery ? { ...w.gallery, items: w.gallery.items.map((it) => ({ ...it, imageId: clear(it.imageId) })) } : w.gallery,
        },
      };
    }),
    plans: s.plans.map((p) => (p.imageId === imageId ? { ...p, imageId: null } : p)),
  }));
  return persistConfig();
}

// ───────────────────────── Usuarios y roles ─────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const activeAdmins = (users) => users.filter((u) => u.role === 'admin' && u.active);

/**
 * Crea o actualiza un usuario del panel.
 * Futuro: invitación por correo con Supabase Auth + fila en `staff`.
 */
export async function saveUser(user) {
  requirePermission('users.manage');
  await delay(250);
  const s = getState();
  const name = user.name.trim();
  const email = user.email.trim().toLowerCase();
  if (!name) throw new Error('Escribe el nombre.');
  if (!EMAIL_RE.test(email)) throw new Error('Revisa el correo electrónico.');
  if (s.users.some((u) => u.email === email && u.id !== user.id)) throw new Error('Ya existe un usuario con ese correo.');
  if (user.brandIds && user.brandIds.length === 0) throw new Error('Elige al menos una marca.');
  const exists = s.users.some((u) => u.id === user.id);
  const next = exists ? s.users.map((u) => (u.id === user.id ? { ...user, name, email } : u)) : [...s.users, { ...user, name, email }];
  if (activeAdmins(next).length === 0) throw new Error('Debe quedar al menos un administrador activo.');
  if (LIVE) {
    // La cuenta (correo y contraseña) se crea en Supabase → Authentication; aquí se le da acceso.
    if (exists) await cloud.updateStaff({ ...user, name, email });
    else await cloud.addStaff({ ...user, name, email });
    return;
  }
  setState((st) => ({ ...st, users: next }));
}

export async function deleteUser(id) {
  const me = requirePermission('users.manage');
  await delay(200);
  if (id === me.id) throw new Error('No puedes eliminar tu propio usuario.');
  const next = getState().users.filter((u) => u.id !== id);
  if (activeAdmins(next).length === 0) throw new Error('Debe quedar al menos un administrador activo.');
  if (LIVE) return cloud.removeStaff(id);
  setState((st) => ({ ...st, users: next }));
}

// ───────────────────────── Seguimientos ─────────────────────────

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;

/** Marca que la sesión se realizó (pasa a «Fotos realizadas · en edición»). */
export async function markShot(id) {
  guard('tracking.update', id);
  await delay(250);
  const r = getState().requests.find((x) => x.id === id);
  if (!r || r.status !== 'confirmed') throw new Error('Solo se pueden marcar sesiones reservadas.');
  if (r.date > todayIso()) throw new Error('La sesión todavía no ha llegado. Podrás marcarla el día de la sesión.');
  await updateRequest(id, { status: 'completed', shotAt: r.date <= todayIso() ? r.date : todayIso() }, 'Fotos realizadas');
}

/** Marca la entrega de las fotos al cliente. */
export async function markDelivered(id, { date, galleryUrl = '', note = '' } = {}) {
  guard('tracking.update', id);
  await delay(250);
  const r = getState().requests.find((x) => x.id === id);
  if (!r || r.status !== 'completed' || r.deliveredAt) throw new Error('Primero marca la sesión como realizada.');
  const d = date || todayIso();
  if (d > todayIso()) throw new Error('La fecha de entrega no puede ser futura.');
  if (r.shotAt && d < r.shotAt) throw new Error('La entrega no puede ser antes del día de las fotos.');
  const url = galleryUrl.trim();
  if (url && !URL_RE.test(url)) throw new Error('El enlace de la galería debe empezar con https://');
  await updateRequest(id, { deliveredAt: d, galleryUrl: url, deliveryNote: note.trim() }, `Fotos entregadas al cliente${url ? ' (enlace de galería guardado)' : ''}`);
}

/** Deshace la última etapa (entregado → en edición → reservado). Solo administradores. */
export async function undoTrackingStep(id) {
  guard('requests.manage', id);
  await delay(200);
  const r = getState().requests.find((x) => x.id === id);
  if (r.deliveredAt) return updateRequest(id, { deliveredAt: null, galleryUrl: '', deliveryNote: '' }, 'Entrega deshecha: vuelve a «en edición»');
  if (r.status === 'completed') return updateRequest(id, { status: 'confirmed', shotAt: null }, 'Fotos realizadas deshecho: vuelve a «reservado»');
  throw new Error('No hay ninguna etapa para deshacer.');
}
