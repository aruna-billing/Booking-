// Planes limitados: fechas en que se pueden reservar, fechas de sesión y cupos.
// Funciones puras. La misma regla se repite en el servidor
// (supabase/01_instalacion.sql → plan_limit_check y create_booking_request).
//
// plan.limit = {
//   enabled: boolean,
//   saleFrom, saleTo: 'YYYY-MM-DD' | '',     // días en que se puede reservar (incluidos)
//   sessionFrom, sessionTo: 'YYYY-MM-DD' | '', // días en que puede ser la sesión (incluidos)
//   maxBookings: number | null,               // cupos (null = sin límite)
//   showRemaining: boolean,                   // mostrar «Quedan N cupos»
//   remainingText: string,                    // con {n}, ej.: «¡Solo quedan {n} cupos!»
//   soldOutText: string,                      // ej.: «Agotado»
//   whenClosed: 'show' | 'hide',              // agotado o vencido: se ve bloqueado u oculto
// }
// Un cupo = una solicitud no cancelada con ese plan. Si se cancela, el cupo se libera.

export const LIMIT_DEFAULTS = {
  enabled: false,
  saleFrom: '',
  saleTo: '',
  sessionFrom: '',
  sessionTo: '',
  maxBookings: null,
  showRemaining: true,
  remainingText: 'Quedan {n} cupos',
  soldOutText: 'Agotado',
  whenClosed: 'show',
};

export const TEXT_MAX = 40;

/** Ajustes completos del límite (o null si el plan no es limitado). */
export function planLimit(plan) {
  if (!plan?.limit?.enabled) return null;
  const l = { ...LIMIT_DEFAULTS, ...plan.limit };
  const n = Number(l.maxBookings);
  return {
    ...l,
    maxBookings: l.maxBookings === '' || l.maxBookings == null || !(n >= 1) ? null : Math.floor(n),
    remainingText: String(l.remainingText ?? '').trim() || LIMIT_DEFAULTS.remainingText,
    soldOutText: String(l.soldOutText ?? '').trim() || LIMIT_DEFAULTS.soldOutText,
    whenClosed: l.whenClosed === 'hide' ? 'hide' : 'show',
  };
}

/** Reservas que ocupan cupo de este plan. */
export const planUses = (planId, requests = []) => requests.filter((r) => r.planId === planId && r.status !== 'cancelled').length;

/**
 * Estado del plan hoy.
 * @param used reservas que ya ocupan cupo
 * @returns {{ open: boolean, reason: null | 'soon' | 'ended' | 'soldout', remaining: number | null, limit }}
 */
export function planAvailability(plan, { today, used = 0 } = {}) {
  const limit = planLimit(plan);
  if (!limit) return { open: true, reason: null, remaining: null, limit: null };
  const remaining = limit.maxBookings == null ? null : Math.max(0, limit.maxBookings - used);
  let reason = null;
  if (limit.saleFrom && today < limit.saleFrom) reason = 'soon';
  else if (limit.saleTo && today > limit.saleTo) reason = 'ended';
  else if (limit.sessionTo && today > limit.sessionTo) reason = 'ended';
  else if (remaining === 0) reason = 'soldout';
  return { open: reason === null, reason, remaining, limit };
}

/** Texto para el cliente según el estado. */
export function availabilityText(av, fmtDate = (d) => d) {
  if (!av.limit) return '';
  if (av.reason === 'soldout') return av.limit.soldOutText;
  if (av.reason === 'ended') return 'Ya no está disponible';
  if (av.reason === 'soon') return `Disponible desde el ${fmtDate(av.limit.saleFrom)}`;
  if (av.limit.showRemaining && av.remaining != null) return av.limit.remainingText.replace(/\{n\}/g, String(av.remaining));
  return '';
}

/** ¿Se muestra el plan en la web? (oculto si está cerrado y así se eligió). */
export const planVisible = (av) => av.open || av.limit?.whenClosed !== 'hide';

/** ¿La fecha de sesión cae en el rango del plan? */
export function sessionDateAllowed(plan, iso) {
  const l = planLimit(plan);
  if (!l || !iso) return true;
  if (l.sessionFrom && iso < l.sessionFrom) return false;
  if (l.sessionTo && iso > l.sessionTo) return false;
  return true;
}

/** Mensaje de error al reservar (o null si se puede). */
export function planBookingError(plan, { today, used, date }) {
  const av = planAvailability(plan, { today, used });
  if (av.reason === 'soldout') return 'Este plan ya no tiene cupos disponibles. Elige otro plan.';
  if (av.reason === 'soon') return 'Este plan todavía no está disponible.';
  if (av.reason === 'ended') return 'Este plan ya no está disponible. Elige otro plan.';
  if (!sessionDateAllowed(plan, date)) return 'Esa fecha no está disponible para este plan. Elige otra.';
  return null;
}

/** Valida el formulario del panel. Devuelve { campo: mensaje }. */
export function validateLimit(limit) {
  const e = {};
  if (!limit?.enabled) return e;
  const l = { ...LIMIT_DEFAULTS, ...limit };
  if (l.saleFrom && l.saleTo && l.saleTo < l.saleFrom) e.saleTo = 'La fecha final debe ser igual o posterior a la inicial.';
  if (l.sessionFrom && l.sessionTo && l.sessionTo < l.sessionFrom) e.sessionTo = 'La fecha final debe ser igual o posterior a la inicial.';
  if (l.maxBookings !== '' && l.maxBookings != null && !(Number.isInteger(Number(l.maxBookings)) && Number(l.maxBookings) >= 1)) {
    e.maxBookings = 'Escribe un número entero (1 o más), o déjalo vacío para no limitar.';
  }
  if (String(l.remainingText ?? '').length > TEXT_MAX) e.remainingText = `Máximo ${TEXT_MAX} caracteres.`;
  if (String(l.soldOutText ?? '').length > TEXT_MAX) e.soldOutText = `Máximo ${TEXT_MAX} caracteres.`;
  return e;
}
