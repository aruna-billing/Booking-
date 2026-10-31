// Mensajes de WhatsApp para copiar y enviar al cliente desde el panel.
// Plantillas por marca en brand.web.whatsapp = { confirmed, review } (vacío = predeterminada).

import { isEventBrand } from '../data/brands.js';
import { REQUEST_STATUS } from '../data/statuses.js';
import { endTime } from './availability.js';
import { formatLongDate, formatTime } from './date.js';
import { balanceDue, paidAmount } from './finance.js';
import { formatDuration, formatMoney } from './format.js';

export const WA_KINDS = [
  { key: 'confirmed', label: 'Reserva confirmada', when: 'Para clientes con el pago comprobado y la reserva confirmada.' },
  { key: 'review', label: 'Solicitud recibida', when: 'Para solicitudes que aún están en revisión.' },
];

export const WA_VARS = [
  ['nombre', 'Nombre del cliente'],
  ['apellido', 'Apellido'],
  ['marca', 'Nombre de la marca'],
  ['plan', 'Plan elegido'],
  ['incluye', 'Lo que incluye el plan (una línea por cosa)'],
  ['extras', 'Extras y cargos añadidos (una línea por cada uno)'],
  ['fecha', 'Fecha (ej.: sábado, 14 de noviembre de 2026)'],
  ['hora', 'Hora de inicio'],
  ['hora_fin', 'Hora de fin'],
  ['duracion', 'Duración (ej.: 1 h 30 min)'],
  ['total', 'Total de la reserva'],
  ['pagado', 'Monto pagado (pagos verificados)'],
  ['pendiente', 'Monto pendiente por pagar'],
  ['pendiente_nota', 'Cuándo se paga lo pendiente (vacío si ya está todo pagado)'],
  ['descuento', 'Descuento del cupón'],
  ['solicitud', 'Número de solicitud'],
  ['estado', 'Estado de la solicitud'],
  ['whatsapp', 'WhatsApp de la marca'],
];

export function defaultWa(kind, brand) {
  if (kind === 'review') {
    return `¡Hola {nombre}! 👋 Te escribimos de {marca}.

Recibimos tu solicitud #{solicitud} y la estamos revisando:

📸 Plan: {plan}
📅 Fecha: {fecha}
🕒 Hora: {hora}
💰 Total: {total}
✅ Pagado: {pagado}

Te confirmamos en cuanto verifiquemos tu pago. ¡Gracias!`;
  }
  return `¡Hola {nombre}! 👋 Te escribimos de {marca}.

Tu pago fue comprobado y tu reserva está *confirmada* ✅

📸 Plan: {plan}
Incluye:
{incluye}
{extras}

📅 Fecha: {fecha}
🕒 Hora: {hora} a {hora_fin}

💰 Total: {total}
✅ Pagado: {pagado}
⏳ Pendiente: {pendiente} {pendiente_nota}

Número de reserva: #{solicitud}
¡Te esperamos! 🙌`;
}

/** Plantilla efectiva (lo guardado o, si está vacío, la predeterminada). */
export function waTemplate(brand, kind) {
  const saved = brand?.web?.whatsapp?.[kind];
  return saved && saved.trim() ? saved : defaultWa(kind, brand);
}

/** Qué plantilla corresponde a una solicitud. */
export const waKindFor = (r) => (r.status === 'confirmed' || r.status === 'completed' ? 'confirmed' : 'review');

const bullets = (list) => list.filter(Boolean).map((x) => `• ${x}`).join('\n');

/** Valores de las variables para una solicitud. */
export function waVars(r, brand, plan) {
  const cur = r.currency || brand.currency;
  const money = (n) => formatMoney(n ?? 0, cur);
  const lines = r.quote?.lines ?? [];
  const extras = lines.map((l) => `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''} (${money(l.total)})`);
  const dur = r.quote?.durationMin;
  return {
    nombre: r.client?.firstName ?? '',
    apellido: r.client?.lastName ?? '',
    marca: brand.name,
    plan: r.planName ?? plan?.name ?? '',
    incluye: bullets(plan?.deliverables ?? []),
    extras: extras.length ? `Extras:\n${bullets(extras)}` : '',
    fecha: r.date ? formatLongDate(r.date) : '',
    hora: r.time ? formatTime(r.time) : '',
    hora_fin: r.time && dur ? formatTime(endTime(r.time, dur)) : '',
    duracion: dur ? formatDuration(dur) : '',
    total: money(r.quote?.total),
    pagado: money(paidAmount(r)),
    pendiente: money(balanceDue(r)),
    pendiente_nota: balanceDue(r) > 0 ? `(se paga el día ${isEventBrand(brand) ? 'del evento' : 'de la sesión'})` : '',
    descuento: r.quote?.discount > 0 ? money(r.quote.discount) : '',
    solicitud: String(r.id ?? '').replace(/^req-/, '').toUpperCase(),
    estado: REQUEST_STATUS[r.status]?.label ?? '',
    whatsapp: brand.whatsappDisplay || '',
  };
}

/**
 * Rellena la plantilla. Una línea cuyas variables quedan todas vacías se quita
 * (ej.: «{extras}» sin extras, o «🕒 Hora: {hora}» en una marca sin horario).
 */
export function renderWa(template, vars) {
  const out = String(template ?? '')
    .split('\n')
    .flatMap((line) => {
      const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in vars);
      if (keys.length && keys.every((k) => !String(vars[k]).trim())) return [];
      return [line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/[ \t]+$/, '')];
    })
    .join('\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Mensaje final para una solicitud. */
export function waMessage(r, brand, plan, kind = waKindFor(r)) {
  return renderWa(waTemplate(brand, kind), waVars(r, brand, plan));
}

/**
 * Número para el enlace wa.me: solo dígitos y con código de país.
 * Los números de 10 dígitos (RD, EE. UU.: 809, 829, 849…) llevan delante el 1.
 */
export function waPhone(phone) {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10) d = `1${d}`;
  return d.length >= 8 ? d : '';
}

export const waLink = (phone, text) => {
  const p = waPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};
