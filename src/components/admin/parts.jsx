import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="page-head">
      <div>
        {back}
        <h1 className="page-head__title">{title}</h1>
        {description && <p className="page-head__desc">{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  );
}

export function BrandDot({ brand, withName = false }) {
  if (!brand) return null;
  return (
    <span className="brand-dot">
      <span className="brand-dot__sw" style={{ background: brand.theme.hero, borderColor: brand.theme.accent }} aria-hidden="true" />
      {withName ? brand.name : <span className="visually-hidden">{brand.name}</span>}
    </span>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <header className="card__head">
          {title && <h2 className="card__title">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}

/** Diálogo de confirmación con motivo opcional/obligatorio. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger, reasonLabel, reasonRequired, presets = [] }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setReason('');
    setError(null);
    setBusy(false);
    onClose();
  };
  const submit = async () => {
    if (reasonRequired && !reason.trim()) {
      setError('Indica un motivo.');
      return;
    }
    setBusy(true);
    await onConfirm(reason.trim());
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Volver
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={busy} data-autofocus={!reasonLabel || undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p>{message}</p>}
      {reasonLabel && (
        <>
          {presets.length > 0 && (
            <div className="chips" role="group" aria-label="Motivos frecuentes">
              {presets.map((p) => (
                <button key={p} type="button" className={`chip ${reason === p ? 'is-on' : ''}`} onClick={() => { setReason(p); setError(null); }}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <Field label={reasonLabel} required={reasonRequired} error={error}>
            <textarea rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} data-autofocus />
          </Field>
        </>
      )}
    </Modal>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__label">{label}</span>
    </label>
  );
}
