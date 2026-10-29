import { Button } from '../ui/Button.jsx';
import { formatMoney } from '../../lib/format.js';

/**
 * Barra de acciones de cada paso. En móvil queda fija abajo y muestra el total,
 * para que el cliente siempre vea cuánto suma su selección.
 */
export function StepActions({ backTo, onNext, nextLabel = 'Continuar', nextDisabled, loading, total, totalLabel = 'Total', currency, helper }) {
  return (
    <div className="step-actions">
      <div className="step-actions__inner">
        {typeof total === 'number' && (
          <div className="step-actions__total" aria-live="polite">
            <span>{totalLabel}</span>
            <strong data-testid="bar-total">{formatMoney(total, currency)}</strong>
          </div>
        )}
        <div className="step-actions__buttons">
          {backTo && (
            <Button variant="ghost" href={`#${backTo}`}>
              <span aria-hidden="true">←</span> Atrás
            </Button>
          )}
          <Button onClick={onNext} disabled={nextDisabled} loading={loading} data-testid="next">
            {nextLabel}
          </Button>
        </div>
      </div>
      {helper && <p className="step-actions__helper">{helper}</p>}
    </div>
  );
}
