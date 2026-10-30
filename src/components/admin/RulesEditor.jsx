import { useState } from 'react';
import { Card } from './parts.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { useToast } from '../ui/misc.jsx';
import { validateRules } from '../../lib/rules.js';
import * as api from '../../services/api.js';

// Lunes primero, como en el calendario. Valor = getDay() (0 = domingo).
const DAYS = [
  [1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom'],
];

/** Editor de las reglas de agenda: días, horario, pausas y límites. */
export function RulesEditor({ brand, rules }) {
  const toast = useToast();
  const [r, setR] = useState(() => structuredClone(rules));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const errors = validateRules(r);
  const err = (k) => (tried ? errors[k] : undefined);
  const dirty = JSON.stringify(r) !== JSON.stringify(rules);
  const timed = r.mode !== 'exclusive_day';

  const toggleDay = (d) => set({ workingDays: r.workingDays.includes(d) ? r.workingDays.filter((x) => x !== d) : [...r.workingDays, d] });
  const setBreak = (i, patch) => set({ breaks: r.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      const ok = await api.saveRules(brand.id, r);
      toast(ok === false ? api.SAVE_FAILED : 'Horario guardado: la web ya muestra los nuevos horarios', ok === false ? 'red' : 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy(false);
  };

  return (
    <Card title={`Horario y reglas · ${brand.shortName}`} className="rules-editor">
      <div className="form" data-testid="rules-editor">
        <fieldset className="fieldset">
          <legend className="field__label">Días de trabajo</legend>
          <div className="day-chips">
            {DAYS.map(([d, label]) => (
              <label key={d} className={`day-chip ${r.workingDays.includes(d) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={r.workingDays.includes(d)} onChange={() => toggleDay(d)} data-testid={`rules-day-${d}`} />
                {label}
              </label>
            ))}
          </div>
          {err('workingDays') && <p className="field__error" role="alert">{err('workingDays')}</p>}
        </fieldset>

        {timed ? (
          <>
            <div className="form__row">
              <Field label="Abre" required error={err('openTime')}>
                <input type="time" step={900} value={r.openTime} onChange={(e) => set({ openTime: e.target.value })} data-testid="rules-open" />
              </Field>
              <Field label="Cierra" required error={err('closeTime')} hint="La sesión completa debe terminar antes.">
                <input type="time" step={900} value={r.closeTime} onChange={(e) => set({ closeTime: e.target.value })} data-testid="rules-close" />
              </Field>
            </div>
            <div className="form__row">
              <Field label="Horarios cada" required error={err('startStepMin')}>
                <select value={r.startStepMin} onChange={(e) => set({ startStepMin: Number(e.target.value) })}>
                  {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </Field>
              <Field label="Margen entre sesiones (min)" required error={err('bufferMin')}>
                <input type="number" min={0} max={180} step={5} value={r.bufferMin} onChange={(e) => set({ bufferMin: e.target.value })} />
              </Field>
            </div>

            <fieldset className="fieldset">
              <legend className="field__label">Pausas (opcional)</legend>
              {(r.breaks ?? []).length === 0 && <p className="muted small">Sin pausas: se ofrecen horarios todo el día.</p>}
              {(r.breaks ?? []).map((b, i) => (
                <div key={i} className="break-row">
                  <input aria-label={`Nombre de la pausa ${i + 1}`} value={b.label ?? ''} placeholder="Almuerzo" onChange={(e) => setBreak(i, { label: e.target.value })} />
                  <input type="time" step={900} aria-label={`Inicio de la pausa ${i + 1}`} value={b.start} onChange={(e) => setBreak(i, { start: e.target.value })} />
                  <span aria-hidden="true">–</span>
                  <input type="time" step={900} aria-label={`Fin de la pausa ${i + 1}`} value={b.end} onChange={(e) => setBreak(i, { end: e.target.value })} />
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => set({ breaks: r.breaks.filter((_, j) => j !== i) })} aria-label={`Quitar pausa ${i + 1}`} data-testid={`rules-break-remove-${i}`}>✕</button>
                  {err(`break${i}`) && <p className="field__error break-row__error" role="alert">{err(`break${i}`)}</p>}
                </div>
              ))}
              <div>
                <Button variant="ghost" size="sm" onClick={() => set({ breaks: [...(r.breaks ?? []), { start: '13:00', end: '14:00', label: '' }] })}>+ Añadir pausa</Button>
              </div>
            </fieldset>
          </>
        ) : (
          <Field label="Horas de inicio" hint="Separadas por coma, por ejemplo: 10:00, 15:00" error={err('startTimes')}>
            <input value={(r.startTimes ?? []).join(', ')} onChange={(e) => set({ startTimes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </Field>
        )}

        <div className="form__row form__row--3">
          <Field label="Máx. reservas por día" required error={err('maxBookingsPerDay')}>
            <input type="number" min={1} max={50} value={r.maxBookingsPerDay} onChange={(e) => set({ maxBookingsPerDay: e.target.value })} />
          </Field>
          <Field label="Antelación mínima (días)" required error={err('minNoticeDays')} hint="0 = se puede reservar para hoy.">
            <input type="number" min={0} max={60} value={r.minNoticeDays} onChange={(e) => set({ minNoticeDays: e.target.value })} />
          </Field>
          <Field label="Reservable hasta (días)" required error={err('maxAdvanceDays')}>
            <input type="number" min={7} max={365} value={r.maxAdvanceDays} onChange={(e) => set({ maxAdvanceDays: e.target.value })} />
          </Field>
        </div>

        <div className="rules-editor__actions">
          <Button variant="ghost" disabled={!dirty} onClick={() => { setR(structuredClone(rules)); setTried(false); }}>Descartar</Button>
          <Button disabled={!dirty} loading={busy} onClick={save} data-testid="rules-save">Guardar horario</Button>
        </div>
        <p className="muted small">Las reservas ya hechas no cambian. Los días bloqueados se gestionan arriba, día por día.</p>
      </div>
    </Card>
  );
}
