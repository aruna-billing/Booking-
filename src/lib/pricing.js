import { discountFor, normalizeCode } from './coupons.js';
// Cálculo de precios. Función pura: la misma lógica deberá repetirse en el
// servidor (Supabase Edge Function / RPC) para no confiar en el total que envía el navegador.

/**
 * @param {object} args
 * @param {object|null} args.plan             Plan seleccionado ({ price, name })
 * @param {Array}  args.extras                 Catálogo de extras de la marca
 * @param {Record<string, number>} args.selection  { [extraId]: cantidad }
 * @param {number} args.depositPercent         Porcentaje de anticipo (0–100)
 */
export function computeQuote({ plan, extras = [], selection = {}, depositPercent = 0, coupon = null }) {
  const planPrice = plan ? toAmount(plan.price) : 0;

  const lines = Object.entries(selection)
    .map(([extraId, qty]) => {
      const extra = extras.find((e) => e.id === extraId);
      const quantity = Math.max(0, Math.floor(Number(qty) || 0));
      if (!extra || quantity === 0) return null;
      const units = extra.pricing === 'per_unit' ? Math.min(quantity, extra.maxQty ?? quantity) : 1;
      return {
        id: extra.id,
        name: extra.name,
        unitPrice: toAmount(extra.price),
        quantity: units,
        total: toAmount(extra.price) * units,
        minutes: (Number(extra.addsMinutes) || 0) * units,
      };
    })
    .filter(Boolean);

  const extrasTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const subtotal = planPrice + extrasTotal;
  // Cupón: se descuenta del total (plan + extras); el anticipo se calcula ya con descuento.
  const discount = coupon ? discountFor(coupon, subtotal) : 0;
  const total = subtotal - discount;
  const pct = Math.min(100, Math.max(0, Number(depositPercent) || 0));
  const deposit = Math.round((total * pct) / 100);

  // Duración: tiempo del plan + minutos que suman los extras (p. ej. 30 min adicionales × 2).
  const baseDurationMin = plan ? Math.max(0, Number(plan.durationMin) || 0) : 0;
  const extraMinutes = lines.reduce((sum, l) => sum + l.minutes, 0);

  return {
    planPrice,
    lines,
    extrasTotal,
    subtotal,
    discount,
    coupon: coupon && discount > 0 ? { code: normalizeCode(coupon.code), type: coupon.type, value: Number(coupon.value) } : null,
    total,
    depositPercent: pct,
    deposit,
    balance: total - deposit,
    baseDurationMin,
    extraMinutes,
    durationMin: baseDurationMin + extraMinutes,
  };
}

const toAmount = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
};

/** ¿El extra está disponible para el plan elegido? */
export const extraAppliesToPlan = (extra, planId) =>
  extra.active !== false && (!extra.appliesTo || extra.appliesTo.length === 0 || extra.appliesTo.includes(planId));
