// Cupones de descuento. Funciones puras: la misma regla se repite en el servidor
// (supabase/01_instalacion.sql → check_coupon y create_booking_request).
//
// Cupón: {
//   id, code, description,
//   type: 'percent' | 'fixed', value,      // 10 = 10 %, o RD$ 10
//   brandIds: null | string[],             // null = todas las marcas
//   validFrom: 'YYYY-MM-DD' | '', validTo: 'YYYY-MM-DD' | '',   // fechas en que se puede usar (incluidas)
//   maxUses: number | null,                // reservas que pueden usarlo en total (null = sin límite)
//   onePerClient: boolean,                 // un uso por correo electrónico
//   active: boolean,
// }
// Un uso = una solicitud no cancelada con ese cupón. Si se cancela, el uso se libera.

export const normalizeCode = (c) => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const CODE_RE = /^[A-Z0-9_-]{3,30}$/;

/** Solicitudes (no canceladas) que usan este cupón. */
export const couponUses = (coupon, requests = []) =>
  requests.filter((r) => r.status !== 'cancelled' && normalizeCode(r.quote?.coupon?.code) === normalizeCode(coupon.code));

/**
 * ¿Se puede usar este cupón ahora?
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function couponStatus(coupon, { brandId, today, requests = [], email } = {}) {
  if (!coupon || coupon.active === false) return { ok: false, reason: 'Este cupón no es válido.' };
  if (coupon.brandIds?.length && brandId && !coupon.brandIds.includes(brandId)) return { ok: false, reason: 'Este cupón no aplica para esta marca.' };
  if (coupon.validFrom && today < coupon.validFrom) return { ok: false, reason: 'Este cupón todavía no está activo.' };
  if (coupon.validTo && today > coupon.validTo) return { ok: false, reason: 'Este cupón ya expiró.' };
  const uses = couponUses(coupon, requests);
  if (coupon.maxUses != null && coupon.maxUses !== '' && uses.length >= Number(coupon.maxUses)) return { ok: false, reason: 'Este cupón ya alcanzó su límite de usos.' };
  if (coupon.onePerClient && email && uses.some((r) => (r.client?.email ?? '').trim().toLowerCase() === email.trim().toLowerCase())) {
    return { ok: false, reason: 'Ya usaste este cupón en otra reserva.' };
  }
  return { ok: true };
}

/** Busca un cupón por código (sin distinguir mayúsculas). */
export const findCoupon = (coupons = [], code) => coupons.find((c) => normalizeCode(c.code) === normalizeCode(code)) ?? null;

/** Descuento en dinero sobre un subtotal (nunca mayor que el subtotal). */
export function discountFor(coupon, subtotal) {
  if (!coupon) return 0;
  const v = Number(coupon.value) || 0;
  const raw = coupon.type === 'percent' ? Math.round((subtotal * Math.min(100, Math.max(0, v))) / 100) : Math.round(Math.max(0, v));
  return Math.min(subtotal, raw);
}

/** Texto corto del descuento: «10 %» o «RD$ 500». */
export const couponLabel = (coupon, money) => (coupon.type === 'percent' ? `${Number(coupon.value)} %` : money(Number(coupon.value)));

/** Valida el formulario del panel. Devuelve { campo: mensaje }. */
export function validateCoupon(c, others = []) {
  const e = {};
  const code = normalizeCode(c.code);
  if (!CODE_RE.test(code)) e.code = 'De 3 a 30 letras, números, guiones o guiones bajos, sin espacios.';
  else if (others.some((o) => o.id !== c.id && normalizeCode(o.code) === code)) e.code = 'Ya existe un cupón con ese código.';
  const v = Number(c.value);
  if (!(v > 0)) e.value = 'Escribe un descuento mayor que 0.';
  else if (c.type === 'percent' && v > 100) e.value = 'El porcentaje no puede pasar de 100.';
  if (c.validFrom && c.validTo && c.validTo < c.validFrom) e.validTo = 'La fecha final debe ser igual o posterior a la inicial.';
  if (c.maxUses !== null && c.maxUses !== '' && c.maxUses !== undefined && !(Number.isInteger(Number(c.maxUses)) && Number(c.maxUses) >= 1)) e.maxUses = 'Escribe un número entero (1 o más), o déjalo vacío para no limitar.';
  if (c.brandIds && c.brandIds.length === 0) e.brandIds = 'Elige al menos una marca.';
  return e;
}
