// Seguimiento del cliente: etapas, fechas y alertas. Funciones puras.
//
//   Solicitud → Reservado → Fotos realizadas (en edición) → Entregado
//
// · Reservado: reserva confirmada, antes de la sesión.
// · Fotos realizadas: se marcó la sesión como hecha (status «completed», shotAt).
// · Entregado: se entregaron las fotos (deliveredAt, enlace de galería).
// La fecha límite de entrega = día de las fotos + N días hábiles de la marca
// (o 72 horas si el cliente contrató un extra de entrega exprés).

import { addDays, parseISODate, toISODate, today } from './date.js';

export const STAGES = [
  { key: 'booked', label: 'Reservado', hint: 'Sesión confirmada, aún no realizada' },
  { key: 'shot', label: 'Fotos realizadas', hint: 'En edición' },
  { key: 'delivered', label: 'Entregado', hint: 'Fotos entregadas al cliente' },
];

const PENDING = ['pending_review', 'awaiting_payment'];

/** Etapa actual: 'request' | 'booked' | 'shot' | 'delivered' | null (cancelada). */
export function stageOf(r) {
  if (r.status === 'cancelled') return null;
  if (PENDING.includes(r.status)) return 'request';
  if (r.deliveredAt) return 'delivered';
  if (r.shotAt || r.status === 'completed') return 'shot';
  return 'booked';
}

/** Suma días hábiles (lunes a viernes). */
export function addBusinessDays(iso, n) {
  let d = parseISODate(iso);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return toISODate(d);
}

export const isExpress = (r, extras = []) =>
  (r.quote?.lines ?? []).some((l) => extras.find((x) => x.id === l.id)?.expressDelivery);

/** Fecha límite de entrega (ISO). Se cuenta desde el día de las fotos (o desde la fecha de sesión si aún no se marcó). */
export function deliveryDueDate(r, brand, extras = []) {
  const from = r.shotAt ?? r.date;
  if (isExpress(r, extras)) return toISODate(addDays(parseISODate(from), 3));
  return addBusinessDays(from, brand?.deliveryDays ?? 10);
}

/** Días de calendario entre hoy y una fecha (negativo = ya pasó). */
export const daysFrom = (iso, ref = toISODate(today())) =>
  Math.round((parseISODate(iso) - parseISODate(ref)) / 86400000);

/**
 * Alerta de la tarjeta: { tone: 'red'|'amber'|'green'|'neutral', text, kind }.
 * kind: 'shoot_unmarked' | 'shoot_today' | 'shoot_soon' | 'shoot_later' | 'overdue' | 'due_soon' | 'editing' | 'delivered'
 */
export function alertOf(r, brand, extras = [], ref = toISODate(today())) {
  const st = stageOf(r);
  if (st === 'booked') {
    const d = daysFrom(r.date, ref);
    if (d < 0) return { kind: 'shoot_unmarked', tone: 'amber', text: `La sesión fue hace ${-d} día${d === -1 ? '' : 's'}. ¿Se realizó?` };
    if (d === 0) return { kind: 'shoot_today', tone: 'green', text: 'Sesión hoy' };
    if (d <= 3) return { kind: 'shoot_soon', tone: 'neutral', text: d === 1 ? 'Sesión mañana' : `Sesión en ${d} días` };
    return { kind: 'shoot_later', tone: 'neutral', text: `Sesión en ${d} días` };
  }
  if (st === 'shot') {
    const due = deliveryDueDate(r, brand, extras);
    const d = daysFrom(due, ref);
    if (d < 0) return { kind: 'overdue', tone: 'red', text: `Entrega vencida hace ${-d} día${d === -1 ? '' : 's'}` };
    if (d <= 2) return { kind: 'due_soon', tone: 'amber', text: d === 0 ? 'Entregar hoy' : `Entregar en ${d} día${d === 1 ? '' : 's'}` };
    return { kind: 'editing', tone: 'neutral', text: `Entregar en ${d} días` };
  }
  if (st === 'delivered') {
    const late = r.shotAt && r.deliveredAt > deliveryDueDate(r, brand, extras);
    return { kind: 'delivered', tone: 'green', text: late ? 'Entregado (con retraso)' : 'Entregado a tiempo' };
  }
  return null;
}

/** Fecha en que se confirmó la reserva (campo o, en datos antiguos, el historial). */
export function confirmedAtOf(r) {
  if (r.confirmedAt) return r.confirmedAt;
  const h = (r.history ?? []).find((x) => /confirmada/i.test(x.label));
  return h?.at ?? null;
}

/** Resumen para el tablero y el dashboard. */
export function trackingSummary(requests, brandsById, extras = [], ref = toISODate(today())) {
  const sum = { booked: 0, shot: 0, delivered: 0, sessionsWeek: 0, overdue: 0, dueSoon: 0, unmarked: 0, deliveredMonth: 0 };
  const monthKey = ref.slice(0, 7);
  requests.forEach((r) => {
    const st = stageOf(r);
    if (!st || st === 'request') return;
    sum[st]++;
    const a = alertOf(r, brandsById[r.brandId], extras, ref);
    if (st === 'booked' && daysFrom(r.date, ref) >= 0 && daysFrom(r.date, ref) <= 6) sum.sessionsWeek++;
    if (a?.kind === 'overdue') sum.overdue++;
    if (a?.kind === 'due_soon') sum.dueSoon++;
    if (a?.kind === 'shoot_unmarked') sum.unmarked++;
    if (st === 'delivered' && r.deliveredAt?.slice(0, 7) === monthKey) sum.deliveredMonth++;
  });
  return sum;
}
