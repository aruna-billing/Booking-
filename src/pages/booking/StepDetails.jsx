import { useRef, useState } from 'react';
import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { OrderSummary } from '../../components/booking/OrderSummary.jsx';
import { StepActions } from '../../components/booking/StepActions.jsx';
import { stepPath } from '../../components/booking/Stepper.jsx';
import { TermsModal } from '../../components/booking/TermsModal.jsx';
import { Field, Checkbox } from '../../components/ui/Field.jsx';
import { FilePicker } from '../../components/ui/FilePicker.jsx';
import { FILE_RULES, validateDetails } from '../../lib/validation.js';
import { navigate } from '../../lib/router.jsx';
import { webText } from '../../lib/webConfig.js';
import { asksInspiration } from '../../lib/pricing.js';

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'phone', 'notes', 'acceptedTerms'];
const NOTES_MAX = 1500;

export function StepDetails({ data }) {
  const { brand, plan, quote, draft, dispatch, terms } = data;
  const d = draft.details;
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const formRef = useRef(null);
  const summaryRef = useRef(null);

  const errors = validateDetails(d);
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const update = (patch) => dispatch({ type: 'updateDetails', patch });
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const errorCount = Object.keys(errors).length;

  const next = () => {
    setSubmitted(true);
    if (errorCount) {
      // Lleva el foco al resumen de errores para lectores de pantalla y teclado.
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    navigate(stepPath(brand.id, 'pago'));
  };

  const focusField = (k) => {
    const el = formRef.current?.querySelector(`[name="${k}"]`);
    el?.focus();
  };

  return (
    <BookingShell
      brand={brand}
      step={3}
      eyebrow="Casi listo"
      title="Cuéntanos sobre ti"
      intro={webText(brand, 'detailsIntro')}
      aside={<OrderSummary brand={brand} plan={plan} quote={quote} date={draft.date} time={draft.time} title="Resumen de tu selección" />}
      footer={<StepActions backTo={stepPath(brand.id, 'fecha')} onNext={next} nextLabel="Continuar al pago" total={quote.total} currency={brand.currency} />}
    >
      {submitted && errorCount > 0 && (
        <div className="error-summary" ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="err-title">
          <p id="err-title" className="error-summary__title">
            Revisa {errorCount === 1 ? '1 campo' : `${errorCount} campos`} antes de continuar
          </p>
          <ul>
            {FIELD_ORDER.filter((k) => errors[k]).map((k) => (
              <li key={k}>
                <button type="button" className="link-btn" onClick={() => focusField(k)}>
                  {errors[k]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form ref={formRef} className="form" noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="form__row">
          <Field label="Nombre" required error={show('firstName')}>
            <input name="firstName" type="text" autoComplete="given-name" value={d.firstName} onChange={(e) => update({ firstName: e.target.value })} onBlur={blur('firstName')} />
          </Field>
          <Field label="Apellido" required error={show('lastName')}>
            <input name="lastName" type="text" autoComplete="family-name" value={d.lastName} onChange={(e) => update({ lastName: e.target.value })} onBlur={blur('lastName')} />
          </Field>
        </div>
        <div className="form__row">
          <Field label="Correo electrónico" required error={show('email')}>
            <input name="email" type="email" inputMode="email" autoComplete="email" value={d.email} onChange={(e) => update({ email: e.target.value })} onBlur={blur('email')} />
          </Field>
          <Field label="Teléfono (WhatsApp)" required error={show('phone')} hint="Incluye el código de área. Ej.: 809 555 0123">
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={d.phone} onChange={(e) => update({ phone: e.target.value })} onBlur={blur('phone')} />
          </Field>
        </div>

        {asksInspiration(brand) && (
        <FilePicker
          label="Imágenes de inspiración"
          hint="Referencias de estilo, vestuario o locación"
          files={d.inspirationFiles}
          onChange={(files) => update({ inspirationFiles: files })}
          maxFiles={FILE_RULES.inspiration.maxFiles}
          maxSizeMB={FILE_RULES.inspiration.maxSizeMB}
          accept={FILE_RULES.inspiration.accept}
        />
        )}

        <Field
          label="Comparte notas sobre ti y tus preferencias"
          error={show('notes')}
          hint={webText(brand, 'notesHint')}
          counter={
            <span className={`counter ${d.notes.length > NOTES_MAX ? 'is-over' : ''}`} aria-live="polite">
              {d.notes.length}/{NOTES_MAX}
            </span>
          }
        >
          <textarea name="notes" rows={7} value={d.notes} onChange={(e) => update({ notes: e.target.value })} onBlur={blur('notes')} />
        </Field>

        <div className="terms-accept">
          <Checkbox
            name="acceptedTerms"
            checked={d.acceptedTerms}
            onChange={(v) => {
              update({ acceptedTerms: v });
              setTouched((t) => ({ ...t, acceptedTerms: true }));
            }}
            error={show('acceptedTerms')}
            aria-required="true"
          >
            He leído y acepto los{' '}
            <button
              type="button"
              className="link-btn"
              onClick={(e) => {
                e.preventDefault();
                setTermsOpen(true);
              }}
              aria-haspopup="dialog"
            >
              términos y condiciones
            </button>{' '}
            de {brand.name}. <span className="field__req" aria-hidden="true">*</span>
          </Checkbox>
        </div>
        <p className="muted small">Los campos marcados con * son obligatorios.</p>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          update({ acceptedTerms: true });
          setTermsOpen(false);
        }}
        brand={brand}
        terms={terms}
      />
    </BookingShell>
  );
}
