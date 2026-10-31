import { AddChargeModal } from '../../components/admin/AddChargeModal.jsx';
import { PrivateFile } from '../../components/admin/PrivateFile.jsx';
import { LIVE } from '../../lib/mode.js';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { BrandDot, Card, ConfirmDialog, PageHeader } from '../../components/admin/parts.jsx';
import { ReceiptPreview } from '../../components/admin/ReceiptPreview.jsx';
import { PaymentsPanel } from '../../components/admin/PaymentsPanel.jsx';
import { AddPaymentModal } from '../../components/admin/AddPaymentModal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { EmptyState, PaymentStatusBadge, RequestStatusBadge, PhotoPlaceholder, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { formatDateTime, formatLongDate, formatShortDate, formatTime } from '../../lib/date.js';
import { formatDuration, formatFileSize, formatMoney, shortId } from '../../lib/format.js';
import { endTime } from '../../lib/availability.js';
import * as api from '../../services/api.js';
import { useAdmin, NoAccess } from '../../components/admin/AdminLayout.jsx';
import { canSeeBrand } from '../../lib/auth.js';
import { ClientTimeline } from '../../components/admin/ClientTimeline.jsx';

const REJECT_PRESETS = ['El monto no coincide con el anticipo', 'Comprobante ilegible', 'No se encontró el depósito en la cuenta'];
export const SESSION_REJECT_PRESETS = ['Fecha no disponible', 'Comprobante no válido', 'El monto no coincide con el anticipo', 'Datos incompletos'];
const PENDING = ['pending_review', 'awaiting_payment'];

export function RequestDetail({ id }) {
  const db = useDb();
  const toast = useToast();
  const { user, can } = useAdmin();
  const r = db.requests.find((x) => x.id === id);
  const [dialog, setDialog] = useState(null); // 'reject' | 'cancel' | 'whatsapp' | 'payment' | 'charge'
  const [removingCharge, setRemovingCharge] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  if (!r) {
    return <EmptyState title="Solicitud no encontrada." action={<Link to="/admin/solicitudes">Volver a solicitudes</Link>} />;
  }
  if (!canSeeBrand(user, r.brandId)) {
    return <NoAccess user={user} message="Esta solicitud pertenece a una marca que no tienes asignada." />;
  }
  const brand = db.brands.find((b) => b.id === r.brandId);
  const cur = r.currency;
  const isManager = can('payments.manage'); // administrador
  const decidesSessions = !isManager && can('sessions.decide'); // asistente
  const hasReceipt = r.paymentStatus === 'submitted' || r.paymentStatus === 'verified';
  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      await fn();
      toast(msg, 'green');
    } catch (e) {
      toast(e.message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const waText = `Hola ${r.client.firstName}, te escribe ${brand.name}. Recibimos tu solicitud ${shortId(r.id)} para ${r.planName} el ${formatLongDate(r.date)} a las ${formatTime(r.time)}. ${
    r.status === 'confirmed' ? '¡Tu reserva está confirmada!' : 'La estamos revisando y te confirmaremos pronto.'
  }`;

  return (
    <>
      <PageHeader
        back={<Link to="/admin/solicitudes" className="back-link">← Solicitudes</Link>}
        title={`${r.client.firstName} ${r.client.lastName}`}
        description={
          <span className="detail-meta">
            <BrandDot brand={brand} withName /> · {shortId(r.id)} · recibida {formatDateTime(r.createdAt)}
          </span>
        }
        actions={
          <div className="badge-row">
            <RequestStatusBadge status={r.status} />
            <PaymentStatusBadge status={r.paymentStatus} />
          </div>
        }
      />

      {/* Acciones principales según el estado */}
      {can('tracking.view') && <ClientTimeline request={r} brand={brand} extras={db.extras} can={can} />}

      <div className="action-bar" role="group" aria-label="Acciones sobre la solicitud">
        {decidesSessions && (
          PENDING.includes(r.status) ? (
            <>
              <Button
                loading={busy === 'accept'}
                disabled={!hasReceipt}
                onClick={() => run('accept', () => api.acceptSession(r.id), 'Sesión aceptada y reserva confirmada')}
                data-testid="accept-session"
              >
                Aceptar sesión
              </Button>
              <Button variant="danger-ghost" onClick={() => setDialog('rejectSession')} data-testid="reject-session">Rechazar sesión</Button>
            </>
          ) : (
            <p className="small muted action-bar__note">
              {r.status === 'cancelled' ? 'Esta solicitud fue rechazada o cancelada.' : 'Sesión aceptada. Su avance se marca en el seguimiento de arriba.'}
            </p>
          )
        )}
        {isManager && r.paymentStatus === 'submitted' && r.status !== 'cancelled' && (
          <>
            <Button loading={busy === 'verify'} onClick={() => run('verify', () => api.verifyPayment(r.id, { alsoConfirm: true }), 'Pago verificado y reserva confirmada')}>
              Verificar pago y confirmar
            </Button>
            <Button variant="secondary" onClick={() => setDialog('reject')}>Rechazar comprobante</Button>
          </>
        )}
        {isManager && r.status === 'pending_review' && r.paymentStatus === 'verified' && (
          <Button loading={busy === 'confirm'} onClick={() => run('confirm', () => api.confirmRequest(r.id), 'Reserva confirmada')}>Confirmar reserva</Button>
        )}
        {can('requests.manage') && (r.status === 'cancelled' || r.status === 'awaiting_payment') && (
          <Button variant="secondary" loading={busy === 'reopen'} onClick={() => run('reopen', () => api.reopenRequest(r.id), 'Solicitud reabierta')}>
            Reabrir para revisión
          </Button>
        )}
        {can('payments.manage') && r.status !== 'cancelled' && (
          <Button variant="secondary" onClick={() => setDialog('payment')}>Agregar pago</Button>
        )}
        {can('requests.manage') && <Button variant="ghost" onClick={() => setDialog('whatsapp')}>Preparar mensaje de WhatsApp</Button>}
        {can('requests.manage') && r.status !== 'cancelled' && r.status !== 'completed' && (
          <Button variant="danger-ghost" onClick={() => setDialog('cancel')}>Cancelar reserva</Button>
        )}
      </div>
      {decidesSessions && PENDING.includes(r.status) && !hasReceipt && (
        <p className="muted small">Para aceptar la sesión, el cliente debe enviar un comprobante de pago.</p>
      )}
      {isManager && r.status === 'pending_review' && r.paymentStatus !== 'verified' && r.paymentStatus !== 'submitted' && (
        <p className="muted small">Para confirmar, primero debe existir un comprobante verificado.</p>
      )}

      <div className="detail-grid">
        <div className="detail-col">
          <Card title="Reserva">
            <dl className="kv">
              <div><dt>Plan</dt><dd>{r.planName}</dd></div>
              <div><dt>Fecha solicitada</dt><dd className="cap">{formatLongDate(r.date)}</dd></div>
              <div><dt>Horario</dt><dd>{formatTime(r.time)} – {formatTime(endTime(r.time, r.quote.durationMin ?? 60))}</dd></div>
              <div>
                <dt>Duración</dt>
                <dd>
                  {formatDuration(r.quote.durationMin ?? 60)}
                  {r.quote.extraMinutes > 0 && <span className="muted small"> ({formatDuration(r.quote.baseDurationMin)} del plan + {formatDuration(r.quote.extraMinutes)} adicionales)</span>}
                </dd>
              </div>
              <div><dt>Términos aceptados</dt><dd>Versión {r.acceptedTermsVersion}</dd></div>
            </dl>
            <table className="table table--lines">
              <caption className="visually-hidden">Desglose de precio</caption>
              <tbody>
                <tr><th scope="row">{r.planName}</th><td className="num">{formatMoney(r.quote.planPrice, cur)}</td></tr>
                {r.quote.lines.map((l) => (
                  <tr key={l.id} className={l.source === 'admin' ? 'is-charge' : undefined} data-testid={l.source === 'admin' ? 'charge-line' : undefined}>
                    <th scope="row">
                      {l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ''}
                      {l.source === 'admin' && (
                        <span className="line-note">
                          Añadido por {l.addedBy} · {formatShortDate(String(l.addedAt).slice(0, 10))}
                          {can('payments.manage') && r.status !== 'cancelled' && (
                            <button type="button" className="link-btn small" onClick={() => setRemovingCharge(l)} data-testid="charge-remove">Quitar</button>
                          )}
                        </span>
                      )}
                    </th>
                    <td className="num">{formatMoney(l.total, cur)}</td>
                  </tr>
                ))}
                {r.quote.discount > 0 && (
                  <tr className="is-discount"><th scope="row">Descuento · cupón {r.quote.coupon?.code}{r.quote.coupon?.type === 'percent' ? ` (${r.quote.coupon.value} %)` : ''}</th><td className="num">−{formatMoney(r.quote.discount, cur)}</td></tr>
                )}
                <tr className="is-total"><th scope="row">Total</th><td className="num">{formatMoney(r.quote.total, cur)}</td></tr>
                {r.quote.payMode === 'full' ? (
                  <tr data-testid="quote-full"><th scope="row">El cliente eligió pagar el total</th><td className="num">{formatMoney(r.quote.deposit, cur)}</td></tr>
                ) : (
                  <>
                    <tr><th scope="row">Anticipo requerido ({r.quote.depositPercent} %)</th><td className="num">{formatMoney(r.quote.deposit, cur)}</td></tr>
                    <tr><th scope="row">Saldo después del anticipo</th><td className="num">{formatMoney(r.quote.balance, cur)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </Card>

          <Card title="Notas del cliente">
            {r.notes ? <p className="client-notes">{r.notes}</p> : <p className="muted">Sin notas.</p>}
          </Card>

          {(r.inspirationFiles?.length > 0 || brand?.askInspiration !== false) && (
          <Card title={`Imágenes de inspiración (${r.inspirationFiles.length})`}>
            {r.inspirationFiles.length === 0 ? (
              <p className="muted">El cliente no adjuntó imágenes.</p>
            ) : (
              <>
                <ul className="insp-grid">
                  {r.inspirationFiles.map((f, i) => (
                    <li key={f.name + i}>
                      {f.path ? (
                        <PrivateFile file={f} />
                      ) : (
                        <PhotoPlaceholder tone={['sand', 'olive', 'clay', 'linen', 'gold', 'warm'][i % 6]} ratio="1 / 1" variant={i} label="Archivo simulado" />
                      )}
                      <span className="small">{f.name}</span>
                      <span className="muted small">{formatFileSize(f.size)}</span>
                    </li>
                  ))}
                </ul>
                {!LIVE && <p className="muted small">Prototipo: solo se guardan nombres y tamaños; las imágenes no se suben.</p>}
              </>
            )}
          </Card>
          )}
        </div>

        <div className="detail-col">
          <Card title="Cliente">
            <dl className="kv">
              <div><dt>Nombre</dt><dd>{r.client.firstName} {r.client.lastName}</dd></div>
              <div><dt>Correo</dt><dd><a href={`mailto:${r.client.email}`}>{r.client.email}</a></dd></div>
              <div><dt>Teléfono</dt><dd>{r.client.phone}</dd></div>
            </dl>
          </Card>

          {can('finance.view') && (
            <Card title="Cobros y pagos">
              <PaymentsPanel request={r} onAdd={() => setDialog('payment')} onCharge={can('payments.manage') ? () => setDialog('charge') : undefined} toast={toast} />
            </Card>
          )}

          <Card title="Comprobante del cliente">
            <div className="pay-head">
              <PaymentStatusBadge status={r.paymentStatus} />
              {r.receipt && (
                <span className={`small ${r.receipt.declaredAmount === r.quote.deposit ? 'ok' : 'warn'}`}>
                  Declarado {formatMoney(r.receipt.declaredAmount, cur)} / requerido {formatMoney(r.quote.deposit, cur)}
                </span>
              )}
            </div>
            {r.paymentRejectionReason && r.paymentStatus === 'rejected' && (
              <p className="callout callout--red">Motivo del rechazo: {r.paymentRejectionReason}</p>
            )}
            <ReceiptPreview receipt={r.receipt} />
          </Card>

          <Card title="Historial">
            <ol className="timeline">
              {[...r.history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="timeline__when">{formatDateTime(h.at)} · {h.by}</span>
                  <span>{h.label}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Notas internas">
            {r.internalNotes.length > 0 && (
              <ul className="notes">
                {r.internalNotes.map((n, i) => (
                  <li key={i}><p>{n.text}</p><span className="muted small">{formatDateTime(n.at)} · {n.by}</span></li>
                ))}
              </ul>
            )}
            {r.internalNotes.length === 0 && !can('requests.manage') && <p className="muted small">Sin notas internas.</p>}
            {can('requests.manage') && (
            <form
              className="note-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                await api.addInternalNote(r.id, note.trim());
                setNote('');
                toast('Nota guardada (solo en este navegador)');
              }}
            >
              <Field label="Nueva nota interna" hint="Solo visible para el equipo.">
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button variant="secondary" size="sm" type="submit" disabled={!note.trim()}>Guardar nota</Button>
            </form>
            )}
          </Card>
        </div>
      </div>

      {dialog === 'charge' && (
        <AddChargeModal
          request={r}
          onClose={() => setDialog(null)}
          onSaved={(l) => toast(`Cargo añadido: ${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''} (${formatMoney(l.total, r.currency)})`, 'green')}
        />
      )}
      <ConfirmDialog
        open={!!removingCharge}
        onClose={() => setRemovingCharge(null)}
        title="Quitar cargo"
        message={removingCharge ? `Se quitará «${removingCharge.name}» (${formatMoney(removingCharge.total, r.currency)}) del total. Queda anotado en el historial.` : ''}
        confirmLabel="Quitar cargo"
        danger
        onConfirm={async () => {
          try {
            await api.removeCharge(r.id, removingCharge.id);
            toast('Cargo quitado', 'neutral');
          } catch (e) {
            toast(e.message, 'red');
          }
        }}
      />
      {dialog === 'payment' && (
        <AddPaymentModal
          request={r}
          open
          onClose={() => setDialog(null)}
          onSaved={(n) => toast(`Pago de ${formatMoney(n, r.currency)} registrado`, 'green')}
        />
      )}
      <ConfirmDialog
        open={dialog === 'rejectSession'}
        onClose={() => setDialog(null)}
        title="Rechazar sesión"
        message="La solicitud se cancelará y la fecha quedará libre para otros clientes. El motivo queda en el historial."
        reasonLabel="Motivo del rechazo"
        reasonRequired
        presets={SESSION_REJECT_PRESETS}
        confirmLabel="Rechazar sesión"
        danger
        onConfirm={(reason) => api.rejectSession(r.id, reason).then(() => toast('Sesión rechazada', 'red'), (e) => toast(e.message, 'red'))}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Rechazar comprobante"
        message="La solicitud pasará a «Esperando pago». En producción se notificaría al cliente."
        reasonLabel="Motivo del rechazo"
        reasonRequired
        presets={REJECT_PRESETS}
        confirmLabel="Rechazar"
        danger
        onConfirm={(reason) => api.rejectPayment(r.id, reason).then(() => toast('Comprobante rechazado', 'red'))}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancelar reserva"
        message="La fecha quedará libre en el calendario. Esta acción puede revertirse reabriendo la solicitud."
        reasonLabel="Motivo (opcional)"
        confirmLabel="Cancelar reserva"
        danger
        onConfirm={(reason) => api.cancelRequest(r.id, reason).then(() => toast('Reserva cancelada', 'red'))}
      />
      <Modal
        open={dialog === 'whatsapp'}
        onClose={() => setDialog(null)}
        title="Mensaje de WhatsApp (borrador)"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cerrar</Button>
            <Button
              data-autofocus
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(waText);
                  toast('Texto copiado');
                } catch {
                  toast('No se pudo copiar; selecciona el texto manualmente.');
                }
              }}
            >
              Copiar texto
            </Button>
          </>
        }
      >
        <p className="callout">WhatsApp no está conectado. Este borrador no se envía: cópialo y pégalo manualmente.</p>
        <p className="wa-bubble">{waText}</p>
        <p className="muted small">Para: {r.client.phone} {LIVE ? '' : '(dato ficticio)'}</p>
      </Modal>
    </>
  );
}
