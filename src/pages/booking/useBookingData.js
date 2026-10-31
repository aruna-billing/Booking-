import { useMemo } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useBooking } from '../../store/BookingContext.jsx';
import { computeQuote, extraAppliesToPlan, wantsFullPayment } from '../../lib/pricing.js';
import { agendaRequests } from '../../lib/busy.js';
import { planAvailability, planLimit, planUses, planVisible } from '../../lib/planLimits.js';
import { LIVE } from '../../lib/mode.js';
import { toISODate, today } from '../../lib/date.js';

/** Datos derivados que comparten todos los pasos del flujo público. */
export function useBookingData(brandId) {
  const db = useDb();
  const { draft, dispatch } = useBooking();

  return useMemo(() => {
    const brand = db.brands.find((b) => b.id === brandId);
    // Planes limitados: cupos usados (en el sitio real los da el servidor, sin datos personales).
    const todayIso = toISODate(today());
    const usedOf = (p) => (LIVE ? Number(db.planUsage?.[p.id] ?? 0) : planUses(p.id, db.requests));
    const planAv = {};
    db.plans.forEach((p) => {
      if (p.brandId === brandId && p.active) planAv[p.id] = planAvailability(p, { today: todayIso, used: usedOf(p) });
    });
    const plans = db.plans.filter((p) => p.brandId === brandId && p.active && planVisible(planAv[p.id]));
    // Un plan agotado o fuera de fecha no se puede seguir reservando.
    const plan = plans.find((p) => p.id === draft.planId && planAv[p.id].open) ?? null;
    const limit = planLimit(plan);
    const extras = db.extras.filter((e) => e.brandId === brandId && plan && extraAppliesToPlan(e, plan.id));
    // Solo cuentan extras válidos para el plan actual.
    const selection = Object.fromEntries(Object.entries(draft.extras).filter(([id]) => extras.some((e) => e.id === id)));
    const quote = computeQuote({ plan, extras, selection, depositPercent: brand?.depositPercent, coupon: draft.coupon, payFull: wantsFullPayment(brand, draft) });
    const availabilityCtx = brand
      ? {
          brandId,
          rules: db.rules[brandId],
          blockedDates: db.blockedDates,
          requests: agendaRequests(db, brandId),
          window: limit && (limit.sessionFrom || limit.sessionTo) ? { from: limit.sessionFrom, to: limit.sessionTo } : null,
        }
      : null;
    return {
      db,
      draft,
      dispatch,
      brand,
      plans,
      planAv,
      plan,
      extras,
      selection,
      quote,
      availabilityCtx,
      terms: db.terms[brandId],
      bankAccounts: db.bankAccounts.filter((a) => a.brandId === brandId && a.active),
    };
  }, [db, draft, dispatch, brandId]);
}
