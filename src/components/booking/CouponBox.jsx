import { useState } from 'react';
import { checkCoupon } from '../../services/api.js';
import { formatMoney } from '../../lib/format.js';

/**
 * «¿Tienes un cupón?»: el cliente escribe el código y se comprueba
 * (en el sitio real lo decide el servidor). El descuento se ve en el total.
 */
export function CouponBox({ brand, draft, dispatch, quote }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const applied = draft.coupon;

  const apply = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const coupon = await checkCoupon(code, brand.id, draft.details?.email);
      dispatch({ type: 'setCoupon', coupon });
      setCode('');
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  if (applied) {
    return (
      <div className="coupon-box coupon-box--applied" data-testid="coupon-applied" role="status">
        <span>
          Cupón <strong>{applied.code}</strong> aplicado
          {quote.discount > 0 && <> · −{formatMoney(quote.discount, brand.currency)}</>}
        </span>
        <button type="button" className="link-btn small" onClick={() => dispatch({ type: 'setCoupon', coupon: null })} data-testid="coupon-remove">
          Quitar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="coupon-box">
        <button type="button" className="link-btn" onClick={() => setOpen(true)} aria-expanded="false" data-testid="coupon-open">
          ¿Tienes un cupón de descuento?
        </button>
      </div>
    );
  }

  return (
    <form className="coupon-box coupon-box--open" onSubmit={apply} noValidate>
      <label className="field__label" htmlFor="coupon-input">Cupón de descuento</label>
      <div className="coupon-box__row">
        <input
          id="coupon-input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="Escribe tu código"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          data-testid="coupon-input"
          autoFocus
        />
        <button type="submit" className="btn btn--secondary btn--md" disabled={busy || !code.trim()} aria-busy={busy || undefined} data-testid="coupon-apply">
          <span>{busy ? 'Comprobando…' : 'Aplicar'}</span>
        </button>
      </div>
      {error && (
        <p className="field__error" id="coupon-error" role="alert" data-testid="coupon-error">
          <span aria-hidden="true">!</span> {error}
        </p>
      )}
    </form>
  );
}
