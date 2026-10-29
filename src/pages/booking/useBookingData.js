import { useMemo } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useBooking } from '../../store/BookingContext.jsx';
import { computeQuote, extraAppliesToPlan } from '../../lib/pricing.js';
import { agendaRequests } from '../../lib/busy.js';

/** Datos derivados que comparten todos los pasos del flujo público. */
export function useBookingData(brandId) {
  const db = useDb();
  const { draft, dispatch } = useBooking();

  return useMemo(() => {
    const brand = db.brands.find((b) => b.id === brandId);
    const plans = db.plans.filter((p) => p.brandId === brandId && p.active);
    const plan = plans.find((p) => p.id === draft.planId) ?? null;
    const extras = db.extras.filter((e) => e.brandId === brandId && plan && extraAppliesToPlan(e, plan.id));
    // Solo cuentan extras válidos para el plan actual.
    const selection = Object.fromEntries(Object.entries(draft.extras).filter(([id]) => extras.some((e) => e.id === id)));
    const quote = computeQuote({ plan, extras, selection, depositPercent: brand?.depositPercent });
    const availabilityCtx = brand
      ? { brandId, rules: db.rules[brandId], blockedDates: db.blockedDates, requests: agendaRequests(db, brandId) }
      : null;
    return {
      db,
      draft,
      dispatch,
      brand,
      plans,
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
