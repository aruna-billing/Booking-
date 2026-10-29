import { Link } from '../../lib/router.jsx';
import { useBooking, firstIncompleteStep } from '../../store/BookingContext.jsx';

export const STEPS = [
  { slug: '', key: 'planes', label: 'Plan' },
  { slug: 'extras', key: 'extras', label: 'Extras' },
  { slug: 'fecha', key: 'fecha', label: 'Fecha' },
  { slug: 'datos', key: 'datos', label: 'Tus datos' },
  { slug: 'pago', key: 'pago', label: 'Pago' },
  { slug: 'gracias', key: 'gracias', label: 'Listo' },
];

const ORDER = STEPS.map((s) => s.key);

export const stepPath = (brandId, key) => {
  const s = STEPS.find((x) => x.key === key);
  return `/reservar/${brandId}${s.slug ? `/${s.slug}` : ''}`;
};

/** Índice máximo al que el usuario puede saltar desde el indicador. */
function maxReachable(draft) {
  if (draft.submittedRequestId) return 5;
  const pending = firstIncompleteStep(draft);
  if (!pending) return 4;
  const idx = ORDER.indexOf(pending);
  return pending === 'fecha' ? 2 : idx; // extras siempre accesible tras elegir plan
}

export function Stepper({ brandId, current }) {
  const { draft } = useBooking();
  const reach = draft.submittedRequestId ? -1 : maxReachable(draft);
  const pct = ((current + 1) / STEPS.length) * 100;

  return (
    <nav className="stepper" aria-label="Progreso de la reserva">
      <p className="stepper__mobile" aria-hidden="true">
        <span>
          Paso {current + 1} de {STEPS.length}
        </span>
        <strong>{STEPS[current].label}</strong>
      </p>
      <div className="stepper__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="stepper__list">
        {STEPS.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const clickable = i !== current && i <= reach && i < 5;
          const inner = (
            <>
              <span className="stepper__num" aria-hidden="true">
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="stepper__label">{s.label}</span>
              <span className="visually-hidden">{state === 'done' ? ' (completado)' : state === 'current' ? ' (paso actual)' : ''}</span>
            </>
          );
          return (
            <li key={s.key} className={`stepper__item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              {clickable ? <Link to={stepPath(brandId, s.key)}>{inner}</Link> : <span>{inner}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
