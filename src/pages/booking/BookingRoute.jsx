import { useEffect } from 'react';
import { useBookingData } from './useBookingData.js';
import { firstIncompleteStep } from '../../store/BookingContext.jsx';
import { STEPS, stepPath } from '../../components/booking/Stepper.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { StepPlans } from './StepPlans.jsx';
import { StepExtras } from './StepExtras.jsx';
import { StepSchedule } from './StepSchedule.jsx';
import { StepDetails } from './StepDetails.jsx';
import { StepPayment } from './StepPayment.jsx';
import { StepThanks } from './StepThanks.jsx';

const VIEWS = { planes: StepPlans, extras: StepExtras, fecha: StepSchedule, datos: StepDetails, pago: StepPayment, gracias: StepThanks };
const ORDER = STEPS.map((s) => s.key);

/** Decide a qué paso puede acceder el cliente según lo que ya completó. */
function resolveStep(draft, requested) {
  if (draft.submittedRequestId) return requested === 'planes' ? 'planes' : 'gracias';
  if (requested === 'gracias') return firstIncompleteStep(draft) ?? 'pago';
  const pending = firstIncompleteStep(draft);
  if (!pending) return requested;
  // `extras` es opcional: alcanzable en cuanto hay plan.
  const limit = pending === 'fecha' ? ORDER.indexOf('fecha') : ORDER.indexOf(pending);
  return ORDER.indexOf(requested) <= limit ? requested : pending;
}

export function BookingRoute({ brandId, stepKey }) {
  const data = useBookingData(brandId);
  const { brand, draft, dispatch } = data;

  // Inicia (o reinicia) el borrador si cambia la marca o si ya se envió y se vuelve a empezar.
  useEffect(() => {
    if (!brand) return;
    if (draft.brandId !== brandId) dispatch({ type: 'start', brandId });
    else if (draft.submittedRequestId && stepKey === 'planes') dispatch({ type: 'reset', brandId });
  }, [brand, brandId, draft.brandId, draft.submittedRequestId, stepKey, dispatch]);

  const ready = brand && draft.brandId === brandId;
  // Si el plan guardado en el borrador ya no existe o se desactivó, se trata como
  // «sin plan» y se vuelve al paso 1 en lugar de romper la página.
  const effectiveDraft = draft.planId && !data.plan ? { ...draft, planId: null } : draft;
  const allowed = ready ? resolveStep(effectiveDraft, stepKey) : stepKey;

  useEffect(() => {
    if (ready && allowed !== stepKey) navigate(stepPath(brandId, allowed), { replace: true });
  }, [ready, allowed, stepKey, brandId]);

  if (!brand) {
    return (
      <div className="notfound">
        <h1>Marca no encontrada</h1>
        <Link to="/">Volver al inicio</Link>
      </div>
    );
  }
  if (!ready || allowed !== stepKey) {
    return (
      <main className="booking-route-loading" role="status" aria-live="polite">
        <p>Preparando tu reserva…</p>
      </main>
    );
  }
  const View = VIEWS[stepKey];
  return <View data={data} />;
}
