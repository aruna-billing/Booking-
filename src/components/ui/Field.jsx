import { cloneElement, useId } from 'react';

/**
 * Envuelve un control de formulario con etiqueta, ayuda y error accesibles.
 * El hijo recibe id, aria-invalid y aria-describedby automáticamente.
 */
export function Field({ label, hint, error, required, children, className = '', counter }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <div className="field__top">
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="field__req" aria-hidden="true">
              {' '}*
            </span>
          ) : (
            <span className="field__opt"> (opcional)</span>
          )}
        </label>
        {counter}
      </div>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          <span aria-hidden="true">!</span> {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, error, id: idProp, ...rest }) {
  const auto = useId();
  const id = idProp ?? auto;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`check ${error ? 'check--error' : ''}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...rest}
      />
      <label htmlFor={id}>{children}</label>
      {error && (
        <p className="field__error" id={errorId} role="alert">
          <span aria-hidden="true">!</span> {error}
        </p>
      )}
    </div>
  );
}
