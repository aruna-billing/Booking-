import { formatMoney, formatDuration } from '../../lib/format.js';
import { formatLongDate, formatTime } from '../../lib/date.js';
import { endTime } from '../../lib/availability.js';

/** Resumen de selección. Se usa en la columna lateral, en el paso 4 y en el paso 5. */
export function OrderSummary({ brand, plan, quote, date, time, title = 'Tu reserva', showDeposit = true, compact = false }) {
  const cur = brand.currency;
  return (
    <section className={`summary ${compact ? 'summary--compact' : ''}`} aria-labelledby="summary-title">
      <h2 className="summary__title" id="summary-title">
        {title}
      </h2>
      {!plan ? (
        <p className="summary__empty">Aún no has elegido un plan.</p>
      ) : (
        <>
          <dl className="summary__list">
            <div className="summary__row summary__row--plan">
              <dt>
                {plan.name}
                <span className="summary__sub">{formatDuration(quote.baseDurationMin ?? plan.durationMin)}</span>
              </dt>
              <dd>{formatMoney(quote.planPrice, cur)}</dd>
            </div>
            {quote.lines.map((l) => (
              <div className="summary__row" key={l.id}>
                <dt>
                  {l.name}
                  {l.quantity > 1 && <span className="summary__sub">{l.quantity} × {formatMoney(l.unitPrice, cur)}</span>}
                </dt>
                <dd>{formatMoney(l.total, cur)}</dd>
              </div>
            ))}
            {quote.discount > 0 && (
              <div className="summary__row summary__row--discount" data-testid="summary-discount">
                <dt>
                  Descuento
                  {quote.coupon && <span className="summary__sub">Cupón {quote.coupon.code}{quote.coupon.type === 'percent' ? ` · ${quote.coupon.value} %` : ''}</span>}
                </dt>
                <dd>−{formatMoney(quote.discount, cur)}</dd>
              </div>
            )}
            {quote.durationMin > 0 && (
              <div className="summary__row summary__row--duration">
                <dt>
                  Duración total
                  {quote.extraMinutes > 0 && (
                    <span className="summary__sub">
                      {formatDuration(quote.baseDurationMin)} + {formatDuration(quote.extraMinutes)} adicionales
                    </span>
                  )}
                </dt>
                <dd data-testid="summary-duration">{formatDuration(quote.durationMin)}</dd>
              </div>
            )}
            {date && (
              <div className="summary__row summary__row--date">
                <dt>Fecha solicitada</dt>
                <dd>
                  <span className="summary__date">{formatLongDate(date)}</span>
                  {time && (
                    <span className="summary__sub">
                      {formatTime(time)} – {formatTime(endTime(time, quote.durationMin))}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          <div className="summary__total">
            <span>Total</span>
            <strong data-testid="summary-total">{formatMoney(quote.total, cur)}</strong>
          </div>
          {showDeposit && (
            <div className="summary__deposit">
              <div>
                <span>Anticipo para reservar ({quote.depositPercent} %)</span>
                <strong data-testid="summary-deposit">{formatMoney(quote.deposit, cur)}</strong>
              </div>
              <div className="summary__balance">
                <span>Saldo · se paga el día de la sesión</span>
                <span>{formatMoney(quote.balance, cur)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
