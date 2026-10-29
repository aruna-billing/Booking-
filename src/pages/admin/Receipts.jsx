import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, ConfirmDialog, PageHeader } from '../../components/admin/parts.jsx';
import { ReceiptPreview } from '../../components/admin/ReceiptPreview.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, PaymentStatusBadge, RequestStatusBadge, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { formatShortDate } from '../../lib/date.js';
import { formatMoney, shortId } from '../../lib/format.js';
import * as api from '../../services/api.js';
import { SESSION_REJECT_PRESETS } from './RequestDetail.jsx';

const TABS = [
  { key: 'submitted', label: 'Por verificar' },
  { key: 'rejected', label: 'Rechazados' },
  { key: 'verified', label: 'Verificados' },
];

export function Receipts() {
  const db = useDb();
  const { inScope, can } = useAdmin();
  const isManager = can('payments.manage');
  const decides = !isManager && can('sessions.decide');
  const [rejectingSession, setRejectingSession] = useState(null);
  const toast = useToast();
  const [tab, setTab] = useState('submitted');
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(null);

  const list = db.requests
    .filter((r) => inScope(r.brandId) && r.receipt)
    .filter((r) => r.paymentStatus === tab)
    .sort((a, b) => b.receipt.uploadedAt.localeCompare(a.receipt.uploadedAt));
  const count = (k) => db.requests.filter((r) => inScope(r.brandId) && r.receipt && r.paymentStatus === k).length;

  return (
    <>
      <PageHeader title="Revisión de comprobantes" description="Compara el importe con el anticipo requerido y verifica en la cuenta bancaria antes de aprobar." />

      <div className="tabs" role="tablist" aria-label="Estado del comprobante">
        {TABS.map((t) => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="tab__count">{count(t.key)}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {list.length === 0 ? (
          <EmptyState title={tab === 'submitted' ? 'No hay comprobantes pendientes.' : 'Nada por aquí.'} />
        ) : (
          <ul className="receipt-list">
            {list.map((r) => {
              const brand = db.brands.find((b) => b.id === r.brandId);
              const match = r.receipt.declaredAmount === r.quote.deposit;
              return (
                <li key={r.id} className="receipt-card">
                  <ReceiptPreview receipt={r.receipt} compact />
                  <div className="receipt-card__info">
                    <p className="receipt-card__name">
                      <BrandDot brand={brand} /> <Link to={`/admin/solicitudes/${r.id}`}>{r.client.firstName} {r.client.lastName}</Link>
                      <span className="muted small"> · {shortId(r.id)}</span>
                    </p>
                    <p className="small">{r.planName} · {formatShortDate(r.date)}</p>
                    <dl className="kv kv--inline">
                      <div><dt>Requerido</dt><dd>{formatMoney(r.quote.deposit, r.currency)}</dd></div>
                      <div><dt>Declarado</dt><dd className={match ? 'ok' : 'warn'}>{formatMoney(r.receipt.declaredAmount, r.currency)} {match ? '✓' : '≠'}</dd></div>
                    </dl>
                    <div className="badge-row">
                      <RequestStatusBadge status={r.status} />
                      <PaymentStatusBadge status={r.paymentStatus} />
                    </div>
                    {r.paymentRejectionReason && tab === 'rejected' && <p className="muted small">Motivo: {r.paymentRejectionReason}</p>}
                  </div>
                  {tab === 'submitted' && decides && ['pending_review', 'awaiting_payment'].includes(r.status) && (
                    <div className="receipt-card__actions">
                      <Button
                        size="sm"
                        loading={busy === r.id}
                        data-testid={`accept-${r.id}`}
                        onClick={async () => {
                          setBusy(r.id);
                          try {
                            await api.acceptSession(r.id);
                            toast(`Sesión de ${r.client.firstName} aceptada`, 'green');
                          } catch (e) {
                            toast(e.message, 'red');
                          }
                          setBusy(null);
                        }}
                      >
                        Aceptar sesión
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejectingSession(r)} data-testid={`reject-${r.id}`}>
                        Rechazar sesión
                      </Button>
                    </div>
                  )}
                  {tab === 'submitted' && isManager && (
                    <div className="receipt-card__actions">
                      <Button
                        size="sm"
                        loading={busy === r.id}
                        onClick={async () => {
                          setBusy(r.id);
                          await api.verifyPayment(r.id, { alsoConfirm: r.status === 'pending_review' || r.status === 'awaiting_payment' });
                          setBusy(null);
                          toast(`Pago de ${r.client.firstName} verificado`, 'green');
                        }}
                      >
                        Verificar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejecting(r)}>
                        Rechazar
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="muted small">
        {decides
          ? 'Aceptar una sesión verifica el comprobante y confirma la reserva. Rechazarla la cancela y libera la fecha.'
          : 'Al verificar un pago de una solicitud en revisión, la reserva se confirma automáticamente (regla del sistema).'}
      </p>

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Rechazar comprobante"
        reasonLabel="Motivo del rechazo"
        reasonRequired
        presets={['El monto no coincide con el anticipo', 'Comprobante ilegible', 'No se encontró el depósito en la cuenta']}
        confirmLabel="Rechazar"
        danger
        onConfirm={(reason) => api.rejectPayment(rejecting.id, reason).then(() => toast('Comprobante rechazado', 'red'))}
      />
      <ConfirmDialog
        open={!!rejectingSession}
        onClose={() => setRejectingSession(null)}
        title="Rechazar sesión"
        message="La solicitud se cancelará y la fecha quedará libre para otros clientes."
        reasonLabel="Motivo del rechazo"
        reasonRequired
        presets={SESSION_REJECT_PRESETS}
        confirmLabel="Rechazar sesión"
        danger
        onConfirm={(reason) => api.rejectSession(rejectingSession.id, reason).then(() => toast('Sesión rechazada', 'red'), (e) => toast(e.message, 'red'))}
      />
    </>
  );
}
