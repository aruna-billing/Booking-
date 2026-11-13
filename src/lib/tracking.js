// Seguimiento del cliente: etapas, fechas y alertas. Funciones puras.
//
//   Solicitud → Reservado → Selección → En edición → Entregado
//
// · Reservado: reserva confirmada, antes de la sesión.
// · Selección: se marcó la sesión como hecha (status «completed», shotAt) y el
//   cliente está eligiendo sus fotos. r.selection = { sentAt, url, doneAt, count, note }.
// · En edición: el cliente ya eligió (selection.doneAt).
// · Entregado: se entregaron las fotos (deliveredAt, enlace de galería).
// La fecha límite de entrega = día en que el cliente eligió (o, si no hubo selección,
// el día de las fotos) + N días hábiles de la marca (o 72 horas con entrega exprés).
// Las sesiones marcadas antes de existir la etapa (sin r.selection) siguen en edición.

import { addDays, parseISODate, toISODate, today } from './date.js';

export const STAGES = [
  { key: 'booked', label: 'Reservado', hint: 'Sesión confirmada, aún no realizada' },
  { key: 'selecting', label: 'Selección', hint: 'El cliente está eligiendo sus fotos' },
  { key: 'shot', label: 'En edición', hint: 'Fotos elegidas, en edición' },
  { key: 'delivered', label: 'Entregado', hint: 'Fotos entregadas al cliente' },
];

const PENDING = ['pending_review', 'awaiting_payment'];

/** Etapa actual: 'request' | 'booked' | 'selecting' | 'shot' | 'delivered' | null (cancelada). */
export function stageOf(r) {
  if (r.status === 'cancelled') return null;
  if (PENDING.includes(r.status)) return 'request';
  if (r.deliveredAt) return 'delivered';
  if (r.shotAt || r.status === 'completed') return r.selection && !r.selection.doneAt ? 'selecting' : 'shot';
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

/** Días que puede tardar el cliente en elegir antes de que se marque en ámbar. */
export const SELECTION_WAIT_DAYS = 7;

export const isExpress = (r, extras = []) =>
  (r.quote?.lines ?? []).some((l) => extras.find((x) => x.id === l.id)?.expressDelivery);

/** Fecha límite de entrega (ISO). Se cuenta desde la selección del cliente o, si no hubo, desde el día de las fotos. */
export function deliveryDueDate(r, brand, extras = []) {
  const from = r.selection?.doneAt ?? r.shotAt ?? r.date;
  if (isExpress(r, extras)) return toISODate(addDays(parseISODate(from), 3));
  return addBusinessDays(from, brand?.deliveryDays ?? 10);
}

/** Días de calendario entre hoy y una fecha (negativo = ya pasó). */
export const daysFrom = (iso, ref = toISODate(today())) =>
  Math.round((parseISODate(iso) - parseISODate(ref)) / 86400000);

/**
 * Alerta de la tarjeta: { tone: 'red'|'amber'|'green'|'neutral', text, kind }.
 * kind: 'shoot_unmarked' | 'shoot_today' | 'shoot_soon' | 'shoot_later' | 'select_send' | 'selecting' | 'select_waiting'
 *       | 'overdue' | 'due_soon' | 'editing' | 'delivered'
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
  if (st === 'selecting') {
    const sent = r.selection?.sentAt;
    if (!sent) return { kind: 'select_send', tone: 'amber', text: 'Enviar fotos para elegir' };
    const d = -daysFrom(sent, ref);
    if (d >= SELECTION_WAIT_DAYS) return { kind: 'select_waiting', tone: 'amber', text: `Sin elegir desde hace ${d} días` };
    return { kind: 'selecting', tone: 'neutral', text: d <= 0 ? 'Eligiendo desde hoy' : `Eligiendo hace ${d} día${d === 1 ? '' : 's'}` };
  }
  if (st === 'shot') {
    const due = deliveryDueDate(r, brand, extras);
    const d = daysFrom(due, ref);
    if (d < 0) return { kind: 'overdue', tone: 'red', text: `Entrega vencida hace ${-d} día${d === -1 ? '' : 's'}` };
    if (d <= 2) return { kind: 'due_soon', tone: 'amber', text: d === 0 ? 'Entregar hoy' : `Entregar en ${d} día${d === 1 ? '' : 's'}` };
    return { kind: 'editing', tone: 'neutral', text: `Entregar en ${d} días` };
  }
  if (st === 'delivered') {
    const late = (r.selection?.doneAt ?? r.shotAt) && r.deliveredAt > deliveryDueDate(r, brand, extras);
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
  const sum = { booked: 0, selecting: 0, selectWaiting: 0, shot: 0, delivered: 0, sessionsWeek: 0, overdue: 0, dueSoon: 0, unmarked: 0, deliveredMonth: 0 };
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
    if (a?.kind === 'select_send' || a?.kind === 'select_waiting') sum.selectWaiting++;
    if (st === 'delivered' && r.deliveredAt?.slice(0, 7) === monthKey) sum.deliveredMonth++;
  });
  return sum;
}
