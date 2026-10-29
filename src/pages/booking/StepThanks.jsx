import { LIVE } from '../../lib/mode.js';
import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { OrderSummary } from '../../components/booking/OrderSummary.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DemoNotice } from '../../components/ui/misc.jsx';
import { navigate } from '../../lib/router.jsx';
import { shortId } from '../../lib/format.js';
import { webText } from '../../lib/webConfig.js';

export function StepThanks({ data }) {
  const { brand, draft, dispatch, db } = data;
  const request = db.requests.find((r) => r.id === draft.submittedRequestId);
  const plan = request ? db.plans.find((p) => p.id === request.planId) : null;

  return (
    <BookingShell brand={brand} step={5} title="Solicitud enviada" eyebrow={request ? `Solicitud ${shortId(request.id)}` : undefined}>
      <div className="thanks">
        <div className="thanks__seal" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="56" height="56">
            <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M15 24.5l6 6 12-13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="thanks__message" data-testid="thanks-message">
          {webText(brand, 'thanksMessage')}
        </p>

        {request && (
          <div className="thanks__summary">
            <OrderSummary brand={brand} plan={plan ?? { name: request.planName, durationMin: 0 }} quote={request.quote} date={request.date} time={request.time} title="Lo que solicitaste" />
          </div>
        )}

        <DemoNotice>
          Prototipo: no se envió ningún mensaje de WhatsApp ni correo, y la solicitud solo existe en este navegador.
        </DemoNotice>

        <div className="thanks__actions">
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: 'reset', brandId: brand.id });
              navigate(`/reservar/${brand.id}`);
            }}
          >
            Hacer otra reserva
          </Button>
          {request && !LIVE && (
            <Button variant="ghost" href={`#/admin/solicitudes/${request.id}`}>
              Ver en el panel (demo) →
            </Button>
          )}
        </div>
      </div>
    </BookingShell>
  );
}
