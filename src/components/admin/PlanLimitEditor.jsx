import { Toggle } from './parts.jsx';
import { Field } from '../ui/Field.jsx';
import { LIMIT_DEFAULTS, TEXT_MAX, availabilityText, planAvailability } from '../../lib/planLimits.js';
import { formatShortDate } from '../../lib/date.js';

/**
 * «Plan limitado»: fechas para reservar, fechas de la sesión, cupos y los textos
 * que ve el cliente. Al llenarse los cupos (o pasar la fecha) el plan se bloquea solo.
 */
export function PlanLimitEditor({ plan, used, today, errors = {}, onChange }) {
  const l = { ...LIMIT_DEFAULTS, ...(plan.limit ?? {}) };
  const set = (patch) => onChange({ ...l, ...patch });
  const av = planAvailability({ limit: { ...l, enabled: true } }, { today, used });
  const preview = availabilityText(av, formatShortDate);

  return (
    <fieldset className="fieldset plan-limit" data-testid="plan-limit">
      <legend className="field__label">Plan limitado</legend>
      <Toggle
        checked={l.enabled}
        onChange={(v) => set({ enabled: v })}
        label={l.enabled ? 'Sí: tiene fechas o cupos limitados' : 'No: se puede reservar siempre'}
      />
      {l.enabled && (
        <>
          <p className="muted small">
            Cuando se llenan los cupos o pasa la fecha final, el plan se bloquea solo en la web. Si una reserva se cancela, su cupo se libera.
          </p>

          <div className="form__row">
            <Field label="Cupos (reservas en total)" hint="Vacío = sin límite de cupos." error={errors.maxBookings}>
              <input type="number" min={1} step={1} value={l.maxBookings ?? ''} placeholder="Sin límite" onChange={(e) => set({ maxBookings: e.target.value })} data-testid="limit-max" />
            </Field>
            <div className="plan-limit__used">
              <span className="field__label">Ocupados ahora</span>
              <strong data-testid="limit-used">
                {used}
                {l.maxBookings ? ` de ${l.maxBookings}` : ''}
              </strong>
            </div>
          </div>

          <div className="form__row">
            <Field label="Se puede reservar desde" hint="Vacío = desde ya.">
              <input type="date" value={l.saleFrom} onChange={(e) => set({ saleFrom: e.target.value })} data-testid="limit-sale-from" />
            </Field>
            <Field label="Hasta (incluido)" hint="Vacío = sin fecha final." error={errors.saleTo}>
              <input type="date" value={l.saleTo} min={l.saleFrom || undefined} onChange={(e) => set({ saleTo: e.target.value })} data-testid="limit-sale-to" />
            </Field>
          </div>

          <div className="form__row">
            <Field label="Fechas de sesión: desde" hint="El calendario solo ofrece estos días. Vacío = cualquier día.">
              <input type="date" value={l.sessionFrom} onChange={(e) => set({ sessionFrom: e.target.value })} data-testid="limit-session-from" />
            </Field>
            <Field label="Hasta (incluido)" error={errors.sessionTo}>
              <input type="date" value={l.sessionTo} min={l.sessionFrom || undefined} onChange={(e) => set({ sessionTo: e.target.value })} data-testid="limit-session-to" />
            </Field>
          </div>

          <Toggle checked={l.showRemaining} onChange={(v) => set({ showRemaining: v })} label="Mostrar cuántos cupos quedan" />
          <div className="form__row">
            <Field label="Texto de cupos" hint="{n} = cupos que quedan. Puedes usar emojis." error={errors.remainingText}>
              <input value={l.remainingText} maxLength={TEXT_MAX} placeholder={LIMIT_DEFAULTS.remainingText} onChange={(e) => set({ remainingText: e.target.value })} disabled={!l.showRemaining} data-testid="limit-remaining-text" />
            </Field>
            <Field label="Texto cuando se agota" error={errors.soldOutText}>
              <input value={l.soldOutText} maxLength={TEXT_MAX} placeholder={LIMIT_DEFAULTS.soldOutText} onChange={(e) => set({ soldOutText: e.target.value })} data-testid="limit-soldout-text" />
            </Field>
          </div>

          <fieldset className="fieldset">
            <legend className="field__label">Cuando se agota o vence</legend>
            <div className="seg" role="radiogroup" aria-label="Cuando se agota o vence">
              {[['show', 'Se ve bloqueado'], ['hide', 'Se oculta de la web']].map(([k, label]) => (
                <label key={k} className={`seg__opt ${l.whenClosed === k ? 'is-on' : ''}`}>
                  <input type="radio" name="limit-closed" checked={l.whenClosed === k} onChange={() => set({ whenClosed: k })} data-testid={`limit-closed-${k}`} /> {label}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="muted small plan-limit__preview" data-testid="limit-preview">
            Hoy el cliente ve: <strong>{preview || (av.open ? 'el plan disponible, sin aviso' : '')}</strong>
            {!av.open && <> · el plan está {l.whenClosed === 'hide' ? 'oculto' : 'bloqueado'}</>}
          </p>
        </>
      )}
    </fieldset>
  );
}
