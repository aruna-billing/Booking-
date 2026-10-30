import { addDays, parseISODate, today, toISODate } from './date.js';
import { LIVE } from './mode.js';

// Estados de día: 'past' | 'out_of_range' | 'closed' | 'blocked' | 'full' | 'limited' | 'available'
//
// Dos modos de agenda (ver data/availabilityRules.js):
//  · 'timed'          → sesiones con duración. Un horario solo se ofrece si la sesión
//                       COMPLETA (plan + minutos extra) cabe antes del cierre, no cruza
//                       una pausa y no se solapa con otra reserva (+ margen entre sesiones).
//  · 'exclusive_day'  → bodas: un evento por día; la duración se informa pero no limita.

/** Hash determinista: la misma fecha muestra siempre la misma ocupación simulada. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const endTime = (start, durationMin) => fromMin(toMin(start) + durationMin);

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

/** Bloques ocupados de forma simulada (no son reservas reales). */
function simulatedBusy(brandId, iso, rules) {
  // Con Supabase (sitio real) nunca se inventa ocupación: solo cuentan reservas y bloqueos.
  if (LIVE || !rules.simulatedOccupancy) return [];
  if (rules.mode === 'exclusive_day') {
    return hash(`${brandId}|${iso}`) < rules.simulatedOccupancy ? [{ start: 0, end: 1440 }] : [];
  }
  return rules.simulatedAnchors
    .filter((a) => hash(`${brandId}|${iso}|${a}`) < rules.simulatedOccupancy)
    .map((a) => ({ start: toMin(a), end: toMin(a) + 60 }));
}

/** Reservas del prototipo que ocupan agenda ese día (todas menos canceladas). */
function bookedBlocks(brandId, iso, requests, rules) {
  return requests
    .filter((r) => r.brandId === brandId && r.date === iso && r.status !== 'cancelled' && r.time)
    .map((r) => {
      const dur = r.quote?.durationMin ?? rules.defaultDurationMin;
      return { start: toMin(r.time), end: toMin(r.time) + dur };
    });
}

/**
 * Disponibilidad de un día para una sesión de `durationMin` minutos.
 * @param {object} ctx { brandId, rules, blockedDates, requests, window? { from, to } }
 * @returns {{status, reason?, slots: {time, end, available}[]}}
 */
export function getDayAvailability(iso, { brandId, rules, blockedDates = [], requests = [], window = null }, durationMin) {
  const dur = durationMin || rules.defaultDurationMin;
  const date = parseISODate(iso);
  const t = today();
  const first = addDays(t, rules.minNoticeDays);
  const last = addDays(t, rules.maxAdvanceDays);

  if (date < t) return { status: 'past', slots: [] };
  if (date < first || date > last) return { status: 'out_of_range', slots: [] };
  // Plan limitado a ciertas fechas de sesión.
  if (window && ((window.from && iso < window.from) || (window.to && iso > window.to))) return { status: 'out_of_range', slots: [] };
  if (!rules.workingDays.includes(date.getDay())) return { status: 'closed', slots: [] };
  const block = blockedDates.find((b) => b.brandId === brandId && b.date === iso);
  if (block) return { status: 'blocked', reason: block.reason, slots: [] };

  const busy = [...simulatedBusy(brandId, iso, rules), ...bookedBlocks(brandId, iso, requests, rules)];

  if (rules.mode === 'exclusive_day') {
    const full = busy.length >= rules.maxBookingsPerDay;
    const slots = rules.startTimes.map((time) => ({ time, end: endTime(time, dur), available: !full }));
    return { status: full ? 'full' : 'available', slots };
  }

  const open = toMin(rules.openTime);
  const close = toMin(rules.closeTime);
  const buffer = rules.bufferMin ?? 0;
  const breaks = (rules.breaks ?? []).map((b) => ({ start: toMin(b.start), end: toMin(b.end) }));

  const slots = [];
  for (let s = open; s + dur <= close; s += rules.startStepMin) {
    const e = s + dur;
    // Un horario que cruza una pausa no se ofrece.
    if (breaks.some((b) => overlaps(s, e, b.start, b.end))) continue;
    const taken = busy.some((b) => overlaps(s, e, b.start - buffer, b.end + buffer));
    slots.push({ time: fromMin(s), end: fromMin(e), available: !taken });
  }
  const free = slots.filter((x) => x.available).length;
  if (free === 0 || busy.length >= rules.maxBookingsPerDay) {
    return { status: 'full', slots: slots.map((x) => ({ ...x, available: false })) };
  }
  return { status: free <= 3 ? 'limited' : 'available', slots };
}

export const isSelectable = (status) => status === 'available' || status === 'limited';

export const firstSelectableDate = (ctx, durationMin) => {
  let d = addDays(today(), ctx.rules.minNoticeDays);
  for (let i = 0; i < ctx.rules.maxAdvanceDays; i++) {
    const iso = toISODate(d);
    if (isSelectable(getDayAvailability(iso, ctx, durationMin).status)) return iso;
    d = addDays(d, 1);
  }
  return null;
};

export const DAY_STATUS_LABEL = {
  past: 'Fecha pasada',
  out_of_range: 'Fuera del periodo de reserva',
  closed: 'Sin sesiones este día',
  blocked: 'No disponible',
  full: 'Completo',
  limited: 'Pocos horarios',
  available: 'Disponible',
};
