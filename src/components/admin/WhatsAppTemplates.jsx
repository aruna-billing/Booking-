import { useRef, useState } from 'react';
import { Card } from './parts.jsx';
import { Field } from '../ui/Field.jsx';
import { sampleRequest } from '../../lib/emails.js';
import { WA_KINDS, WA_VARS, defaultWa, renderWa, waVars } from '../../lib/whatsapp.js';

/** Solicitud de ejemplo con pago y duración para la vista previa. */
function sample(brand, plan) {
  const r = sampleRequest(brand, plan);
  return {
    ...r,
    status: 'confirmed',
    quote: { ...r.quote, durationMin: plan?.durationMin ?? 60, lines: [], discount: 0 },
    payments: [{ status: 'verified', amount: r.quote.deposit }],
  };
}

/** Editor de las plantillas de WhatsApp de una marca (Personalización). */
export function WhatsAppTemplates({ number, brand, plan, value, onChange }) {
  const [kind, setKind] = useState('confirmed');
  const ref = useRef(null);
  const saved = value?.[kind] ?? '';
  const def = defaultWa(kind, brand);
  const text = saved.trim() ? saved : def;
  const set = (v) => onChange({ ...value, [kind]: v });

  // Inserta {variable} donde está el cursor (si el campo estaba vacío, parte de la predeterminada).
  const insert = (k) => {
    const el = ref.current;
    const base = saved.trim() ? saved : def;
    const at = el && saved.trim() ? el.selectionStart : base.length;
    const end = el && saved.trim() ? el.selectionEnd : base.length;
    const next = `${base.slice(0, at)}{${k}}${base.slice(end)}`;
    set(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus({ preventScroll: true });
      const pos = at + k.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <Card title={`${number} · Mensajes de WhatsApp`}>
      <p className="muted small">
        Desde Solicitudes puedes copiar este mensaje ya relleno con los datos de cada cliente y pegarlo en WhatsApp. Las palabras entre llaves se cambian solas; una línea cuyos datos quedan vacíos (por ejemplo, <code>{'{extras}'}</code> sin extras) no se muestra.
      </p>
      <div className="tabs" role="tablist" aria-label="Qué mensaje">
        {WA_KINDS.map((k) => (
          <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} className={`tab ${kind === k.key ? 'is-active' : ''}`} onClick={() => setKind(k.key)} data-testid={`wa-tab-${k.key}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="email-editor__grid">
        <div className="form">
          <p className="muted small">{WA_KINDS.find((k) => k.key === kind).when}</p>
          <Field label="Mensaje" counter={saved ? <button type="button" className="link-btn small" onClick={() => set('')}>Restaurar</button> : null}>
            <textarea ref={ref} rows={16} value={saved} placeholder={def} onChange={(e) => set(e.target.value)} data-testid="wa-template" />
          </Field>
          <div>
            <p className="field__label">Insertar un dato</p>
            <div className="chips" role="group" aria-label="Datos del cliente">
              {WA_VARS.map(([k, label]) => (
                <button key={k} type="button" className="chip" title={label} onClick={() => insert(k)} data-testid={`wa-var-${k}`}>
                  {`{${k}}`}
                </button>
              ))}
            </div>
            <details className="email-editor__vars">
              <summary>Qué es cada dato</summary>
              <ul>
                {WA_VARS.map(([k, label]) => (
                  <li key={k}><code>{`{${k}}`}</code> {label}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
        <div>
          <p className="field__label">Vista previa (cliente de ejemplo)</p>
          <p className="wa-bubble" data-testid="wa-preview">{renderWa(text, waVars(sample(brand, plan), brand, plan))}</p>
        </div>
      </div>
    </Card>
  );
}
