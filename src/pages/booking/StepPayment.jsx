import { LIVE } from '../../lib/mode.js';
import { useRef, useState } from 'react';
import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { OrderSummary } from '../../components/booking/OrderSummary.jsx';
import { StepActions } from '../../components/booking/StepActions.jsx';
import { stepPath } from '../../components/booking/Stepper.jsx';
import { Checkbox } from '../../components/ui/Field.jsx';
import { FilePicker } from '../../components/ui/FilePicker.jsx';
import { DemoNotice, useToast } from '../../components/ui/misc.jsx';
import { FILE_RULES, validatePayment } from '../../lib/validation.js';
import { formatMoney } from '../../lib/format.js';
import { navigate } from '../../lib/router.jsx';
import { createBookingRequest } from '../../services/api.js';
import { webText } from '../../lib/webConfig.js';

export function StepPayment({ data }) {
  const { brand, plan, quote, draft, dispatch, bankAccounts } = data;
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState(null);
  const errRef = useRef(null);
  const toast = useToast();

  const p = draft.payment;
  const errors = validatePayment(p);
  const show = (k) => (submitted ? errors[k] : undefined);
  const update = (patch) => dispatch({ type: 'updatePayment', patch });

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(LIVE ? 'Copiado al portapapeles' : 'Copiado al portapapeles (dato ficticio)');
    } catch {
      toast('No se pudo copiar automáticamente.');
    }
  };

  const send = async () => {
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length) {
      setTimeout(() => errRef.current?.querySelector('[aria-invalid="true"], .field__error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    setSending(true);
    try {
      const req = await createBookingRequest(draft);
      dispatch({ type: 'submitted', requestId: req.id });
      navigate(stepPath(brand.id, 'gracias'), { replace: true });
    } catch (e) {
      setServerError(e.message);
      setSending(false);
    }
  };

  return (
    <BookingShell
      brand={brand}
      step={4}
      eyebrow="Último paso"
      title="Realiza tu anticipo"
      intro={webText(brand, 'paymentIntro')}
      aside={<OrderSummary brand={brand} plan={plan} quote={quote} date={draft.date} time={draft.time} />}
      footer={
        <StepActions
          backTo={stepPath(brand.id, 'datos')}
          onNext={send}
          loading={sending}
          nextLabel={sending ? 'Enviando…' : 'Enviar solicitud'}
          total={quote.deposit}
          totalLabel="A transferir"
          currency={brand.currency}
          helper={null}
        />
      }
    >
      <div className="amount-due" aria-labelledby="due-label">
        <p id="due-label" className="amount-due__label">
          Importe a transferir · anticipo del {quote.depositPercent} %
        </p>
        <p className="amount-due__value" data-testid="amount-due">
          {formatMoney(quote.deposit, brand.currency)}
        </p>
        <p className="amount-due__note">
          Total de la reserva {formatMoney(quote.total, brand.currency)} · saldo de {formatMoney(quote.balance, brand.currency)} a pagar el día de la sesión.
        </p>
      </div>

      <DemoNotice>Las cuentas mostradas son <strong>ficticias</strong>. No realices ninguna transferencia a estos datos.</DemoNotice>

      <h2 className="section-title">Cuentas para transferencia o depósito</h2>
      {bankAccounts.length === 0 && (
        <p className="callout">Esta marca aún no tiene cuentas para transferencia configuradas. Escríbenos y te las enviamos.</p>
      )}
      <ul className="accounts">
        {bankAccounts.map((a) => (
          <li key={a.id} className="account">
            <p className="account__bank">{a.bank}</p>
            <dl className="account__data">
              <div><dt>Tipo</dt><dd>{a.accountType} · {a.currency}</dd></div>
              <div>
                <dt>Número</dt>
                <dd className="account__number">
                  <span>{a.accountNumber}</span>
                  <button type="button" className="link-btn small" onClick={() => copy(a.accountNumber)} aria-label={`Copiar número de cuenta de ${a.bank}`}>
                    Copiar
                  </button>
                </dd>
              </div>
              <div><dt>Titular</dt><dd>{a.holder}</dd></div>
              <div><dt>Identificación</dt><dd>{a.taxId}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Como referencia o concepto, escribe: <strong>{`${draft.details.firstName} ${draft.details.lastName}`.trim() || 'tu nombre completo'}</strong>.
      </p>

      <div className="payment-proof" ref={errRef}>
        <FilePicker
          label="Comprobante de pago"
          required
          files={p.receipt ? [p.receipt] : []}
          onChange={(files) => update({ receipt: files[0] ?? null })}
          maxFiles={1}
          maxSizeMB={FILE_RULES.receipt.maxSizeMB}
          accept={FILE_RULES.receipt.accept}
          error={show('receipt')}
          hint="Foto o captura de la transferencia"
        />
        <Checkbox checked={p.confirmedPaid} onChange={(v) => update({ confirmedPaid: v })} error={show('confirmedPaid')} name="confirmedPaid" aria-required="true">
          Ya hice mi pago <span className="field__req" aria-hidden="true">*</span>
        </Checkbox>
      </div>

      {serverError && (
        <div className="error-summary" role="alert">
          <p className="error-summary__title">No pudimos enviar la solicitud</p>
          <p>{serverError}</p>
        </div>
      )}
    </BookingShell>
  );
}
