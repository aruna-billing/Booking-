import { BadgeChip } from '../../components/ui/BadgeChip.jsx';
import { badgeOf } from '../../lib/badges.js';
import { CouponBox } from '../../components/booking/CouponBox.jsx';
import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { OrderSummary } from '../../components/booking/OrderSummary.jsx';
import { StepActions } from '../../components/booking/StepActions.jsx';
import { stepPath } from '../../components/booking/Stepper.jsx';
import { QtyStepper, useToast } from '../../components/ui/misc.jsx';
import { formatDuration, formatMoney } from '../../lib/format.js';
import { navigate } from '../../lib/router.jsx';
import { isEventBrand } from '../../data/brands.js';
import { webText } from '../../lib/webConfig.js';

export function StepExtras({ data }) {
  const { brand, plan, extras, selection, quote, draft, dispatch, db } = data;
  const toast = useToast();
  const set = (extraId, qty) => {
    dispatch({ type: 'setExtra', extraId, qty });
    // Si cambia la duración y ya había un horario elegido, hay que volver a elegirlo.
    const x = extras.find((e) => e.id === extraId);
    if (x?.addsMinutes && draft.time) {
      dispatch({ type: 'setSlot', date: draft.date, time: null });
      toast('Cambió la duración de tu sesión: elige de nuevo el horario.');
    }
  };

  return (
    <BookingShell
      brand={brand}
      step={1}
      eyebrow={`Plan: ${plan.name}`}
      title="Personaliza con extras"
      intro={webText(brand, 'extrasIntro')}
      aside={<OrderSummary brand={brand} plan={plan} quote={quote} date={draft.date} time={draft.time} />}
      footer={
        <StepActions
          backTo={stepPath(brand.id, 'planes')}
          onNext={() => navigate(stepPath(brand.id, 'fecha'))}
          nextLabel={quote.lines.length ? 'Elegir fecha' : 'Continuar sin extras'}
          total={quote.total}
          currency={brand.currency}
        />
      }
    >
      <div className="duration-box" aria-live="polite" data-testid="duration-box">
        <span className="duration-box__label">{isEventBrand(brand) ? 'Cobertura total' : 'Duración de tu sesión'}</span>
        <strong className="duration-box__value" data-testid="duration-total">{formatDuration(quote.durationMin)}</strong>
        <span className="duration-box__calc">
          {formatDuration(quote.baseDurationMin)} del plan
          {quote.extraMinutes > 0 && <> + {formatDuration(quote.extraMinutes)} adicionales</>}
        </span>
      </div>

      {extras.length === 0 ? (
        <p className="muted">Este plan no tiene extras disponibles.</p>
      ) : (
        <ul className="extras" aria-label="Extras disponibles">
          {extras.map((x) => {
            const qty = selection[x.id] ?? 0;
            const on = qty > 0;
            return (
              <li key={x.id} className={`extra ${on ? 'is-on' : ''}`}>
                {x.pricing === 'fixed' ? (
                  <label className="extra__main">
                    <input type="checkbox" checked={on} onChange={(e) => set(x.id, e.target.checked ? 1 : 0)} className="extra__check" />
                    <span className="extra__text">
                      <span className="extra__name">{x.name}{badgeOf(x) && <> <BadgeChip badge={badgeOf(x)} /></>}</span>
                      <span className="extra__desc">{x.description}</span>
                    </span>
                    <span className="extra__price">+ {formatMoney(x.price, brand.currency)}</span>
                  </label>
                ) : (
                  <div className="extra__main">
                    <span className="extra__text">
                      <span className="extra__name" id={`x-${x.id}`}>{x.name}{badgeOf(x) && <> <BadgeChip badge={badgeOf(x)} /></>}</span>
                      <span className="extra__desc">
                        {x.description} · {formatMoney(x.price, brand.currency)}{x.addsMinutes ? ` por cada ${formatDuration(x.addsMinutes)}` : ' c/u'}
                      </span>
                      {x.addsMinutes > 0 && <span className="extra__tag">Suma tiempo a tu sesión</span>}
                    </span>
                    <span className="extra__qty">
                      <QtyStepper value={qty} max={x.maxQty ?? 10} onChange={(v) => set(x.id, v)} label={x.name} />
                      <span className="extra__price">{qty ? `+ ${formatMoney(qty * x.price, brand.currency)}` : ''}</span>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {db.organization.showCouponField !== false && <CouponBox brand={brand} draft={draft} dispatch={dispatch} quote={quote} />}
    </BookingShell>
  );
}
