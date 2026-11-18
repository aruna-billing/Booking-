import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { useDb } from '../../store/mockDb.js';
import { formatDuration, formatMoney } from '../../lib/format.js';
import { validateCharge } from '../../lib/charges.js';
import * as api from '../../services/api.js';

/**
 * Añadir un cargo a una reserva ya hecha (más fotos, un retoque, tiempo extra…).
 * Con `propose` (asistente) el cargo no se suma todavía: queda pendiente hasta que un
 * administrador lo apruebe.
 */
export function AddChargeModal({ request: r, onClose, onSaved, propose = false }) {
  const db = useDb();
  const extras = db.extras.filter((x) => x.brandId === r.brandId);
  const cur = r.currency;
  const [mode, setMode] = useState(extras.length ? 'extra' : 'custom');
  const [extraId, setExtraId] = useState(extras[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const extra = extras.find((x) => x.id === extraId);
  const errors = validateCharge({ mode, extra, qty, name, amount });
  const err = (k) => (tried ? errors[k] : undefined);
  const lineTotal = mode === 'extra' ? (extra ? Math.round(extra.price) * Math.max(1, Math.floor(Number(qty) || 1)) : 0) : Math.max(0, Math.round(Number(amount) || 0));
  const minutes = mode === 'extra' && extra?.addsMinutes ? extra.addsMinutes * Math.max(1, Math.floor(Number(qty) || 1)) : 0;

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      const input = { mode, extraId, qty: Number(qty), name, amount: Number(amount) };
      const line = propose ? await api.proposeCharge(r.id, { ...input, note }) : await api.addCharge(r.id, input);
      onSaved?.(line);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={propose ? 'Proponer cargo' : 'Agregar cargo'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="charge-save">{propose ? 'Enviar para aprobación' : 'Agregar cargo'}</Button>
        </>
      }
    >
      <div className="form">
        {propose ? (
          <p className="callout callout--amber small" data-testid="charge-propose-note">
            Un administrador debe aprobar este cargo. Hasta entonces no se suma al total ni se le cobra al cliente.
          </p>
        ) : (
          <p className="muted small">El cargo se suma al total de la reserva. Después registra su pago con «+ Agregar pago». El anticipo no cambia.</p>
        )}
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <div className="seg" role="radiogroup" aria-label="Tipo de cargo">
          {[['extra', 'Extra del catálogo'], ['custom', 'Otro concepto']].map(([k, label]) => (
            <label key={k} className={`seg__opt ${mode === k ? 'is-on' : ''}`}>
              <input type="radio" name="charge-mode" checked={mode === k} onChange={() => setMode(k)} disabled={k === 'extra' && !extras.length} data-testid={`charge-mode-${k}`} /> {label}
            </label>
          ))}
        </div>

        {mode === 'extra' ? (
          <div className="form__row">
            <Field label="Extra" required error={err('extra')}>
              <select value={extraId} onChange={(e) => setExtraId(e.target.value)} data-testid="charge-extra">
                {extras.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {formatMoney(x.price, cur)}{x.pricing === 'per_unit' ? ' c/u' : ''}
                    {x.active ? '' : ' (oculto en la web)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cantidad" required error={err('qty')}>
              <input type="number" min={1} max={99} step={1} value={qty} onChange={(e) => setQty(e.target.value)} data-testid="charge-qty" />
            </Field>
          </div>
        ) : (
          <div className="form__row">
            <Field label="Concepto" required error={err('name')}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Retoque especial" data-testid="charge-name" />
            </Field>
            <Field label={`Monto (${cur})`} required error={err('amount')}>
              <input type="number" min={1} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="charge-amount" />
            </Field>
          </div>
        )}

        {propose && (
          <Field label="Nota para el administrador" hint="Opcional. Por ejemplo: «El cliente pidió 3 fotos más el día de la sesión».">
            <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} data-testid="charge-note" />
          </Field>
        )}

        <dl className="pay-modal__facts" data-testid="charge-preview">
          <div><dt>Total actual</dt><dd>{formatMoney(r.quote.total, cur)}</dd></div>
          <div><dt>Cargo</dt><dd>+ {formatMoney(lineTotal, cur)}</dd></div>
          <div><dt>{propose ? 'Total si se aprueba' : 'Nuevo total'}</dt><dd><strong>{formatMoney(r.quote.total + lineTotal, cur)}</strong></dd></div>
        </dl>
        {minutes > 0 && <p className="muted small">También suma {formatDuration(minutes)} a la duración de la sesión.</p>}
      </div>
    </Modal>
  );
}
