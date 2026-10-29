import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, Checkbox } from '../ui/Field.jsx';
import { formatMoney } from '../../lib/format.js';
import { toISODate, today } from '../../lib/date.js';
import { PAYMENT_CONCEPTS, PAYMENT_METHODS, balanceDue, paidAmount, suggestConcept } from '../../lib/finance.js';
import * as api from '../../services/api.js';

/** Registrar un pago recibido de un cliente (anticipo, abono o saldo final). */
export function AddPaymentModal({ request: r, open, onClose, onSaved }) {
  const due = balanceDue(r);
  const [amount, setAmount] = useState(String(due || ''));
  const [concept, setConcept] = useState(() => suggestConcept(r, due));
  const [conceptTouched, setConceptTouched] = useState(false);
  const [method, setMethod] = useState('transfer');
  const [date, setDate] = useState(toISODate(today()));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [verified, setVerified] = useState(true);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const cur = r.currency;

  const n = Math.round(Number(amount));
  const onAmount = (v) => {
    setAmount(v);
    setErrors((e) => ({ ...e, amount: undefined }));
    const num = Math.round(Number(v));
    if (!conceptTouched && num > 0) setConcept(suggestConcept(r, num));
  };

  const save = async () => {
    const e = {};
    if (!(n > 0)) e.amount = 'Escribe un monto mayor que 0.';
    else if (n > due) e.amount = `El monto supera lo que falta por pagar (${formatMoney(due, cur)}).`;
    if (!date) e.date = 'Indica la fecha del pago.';
    else if (date > toISODate(today())) e.date = 'La fecha no puede ser futura.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    await api.addPayment(r.id, {
      amount: n,
      concept,
      method,
      date,
      reference: reference.trim(),
      note: note.trim(),
      status: verified ? 'verified' : 'pending',
    });
    setBusy(false);
    onSaved?.(n);
    onClose();
  };

  const quick = [
    paidAmount(r) === 0 && r.quote.deposit < due ? { label: `Anticipo ${formatMoney(r.quote.deposit, cur)}`, value: r.quote.deposit } : null,
    { label: `Todo el saldo ${formatMoney(due, cur)}`, value: due },
  ].filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar pago"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} disabled={due === 0}>Guardar pago</Button>
        </>
      }
    >
      <dl className="pay-modal__facts">
        <div><dt>Total</dt><dd>{formatMoney(r.quote.total, cur)}</dd></div>
        <div><dt>Pagado</dt><dd>{formatMoney(paidAmount(r), cur)}</dd></div>
        <div><dt>Falta</dt><dd><strong>{formatMoney(due, cur)}</strong></dd></div>
      </dl>
      {due === 0 ? (
        <p className="callout">Esta reserva ya está pagada por completo.</p>
      ) : (
        <div className="form">
          <div>
            <Field label={`Monto (${cur})`} required error={errors.amount}>
              <input data-autofocus type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => onAmount(e.target.value)} name="amount" />
            </Field>
            <div className="chips chips--tight" role="group" aria-label="Montos rápidos">
              {quick.map((q) => (
                <button key={q.label} type="button" className={`chip ${n === q.value ? 'is-on' : ''}`} onClick={() => onAmount(String(q.value))}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form__row">
            <Field label="Concepto">
              <select value={concept} onChange={(e) => { setConcept(e.target.value); setConceptTouched(true); }}>
                {Object.entries(PAYMENT_CONCEPTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Método">
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="form__row">
            <Field label="Fecha del pago" required error={errors.date}>
              <input type="date" value={date} max={toISODate(today())} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Referencia" hint="Nº de transferencia o recibo.">
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>
          <Field label="Nota">
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Checkbox checked={verified} onChange={setVerified}>
            Ya confirmé que el dinero está en la cuenta <span className="muted small">(si no, queda «por verificar» y no cuenta como recibido)</span>
          </Checkbox>
        </div>
      )}
    </Modal>
  );
}
