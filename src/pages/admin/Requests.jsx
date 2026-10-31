import { useMemo, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, ConfirmDialog, PageHeader } from '../../components/admin/parts.jsx';
import { EmptyState, PaymentStatusBadge, RequestStatusBadge, useToast } from '../../components/ui/misc.jsx';
import { REQUEST_STATUS, PAYMENT_STATUS } from '../../data/statuses.js';
import { Link, navigate, usePath } from '../../lib/router.jsx';
import { formatShortDate, formatTime, formatDateTime } from '../../lib/date.js';
import { formatMoney, shortId } from '../../lib/format.js';
import { balanceDue } from '../../lib/finance.js';
import { waMessage } from '../../lib/whatsapp.js';
import { copyText } from '../../components/admin/WhatsAppModal.jsx';
import * as api from '../../services/api.js';

export function Requests() {
  const db = useDb();
  const { brandFilter, inScope, can } = useAdmin();
  const toast = useToast();
  const [deleting, setDeleting] = useState(null);
  const path = usePath();
  const initialStatus = new URLSearchParams(path.split('?')[1] ?? '').get('estado') ?? 'all';
  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('created');

  const brandOf = (id) => db.brands.find((b) => b.id === id);
  const copyWa = async (r) => {
    const ok = await copyText(waMessage(r, brandOf(r.brandId), db.plans.find((p) => p.id === r.planId)));
    toast(ok ? `Mensaje de ${r.client.firstName} copiado. Pégalo en WhatsApp.` : 'No se pudo copiar. Ábrelo en el detalle.', ok ? 'green' : 'red');
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.requests
      .filter((r) => inScope(r.brandId))
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => payment === 'all' || r.paymentStatus === payment)
      .filter((r) => !term || `${r.client.firstName} ${r.client.lastName} ${r.client.email} ${r.id} ${r.planName}`.toLowerCase().includes(term))
      .sort((a, b) => (sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : (a.date + a.time).localeCompare(b.date + b.time)));
  }, [db.requests, brandFilter, inScope, status, payment, q, sort]);

  return (
    <>
      <PageHeader title="Solicitudes de reserva" description={`${rows.length} solicitud${rows.length === 1 ? '' : 'es'} con los filtros actuales.`} />

      <div className="filters" role="search">
        <label className="filters__search">
          <span className="visually-hidden">Buscar solicitudes</span>
          <input type="search" placeholder="Buscar por nombre, correo, plan o número…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="filters__label">Estado</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label>
          <span className="filters__label">Pago</span>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label>
          <span className="filters__label">Orden</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created">Más recientes</option>
            <option value="date">Fecha de sesión</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No hay solicitudes con estos filtros." />
      ) : (
        <div className="table-wrap">
          <table className="table table--responsive">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Plan</th>
                <th scope="col">Fecha solicitada</th>
                <th scope="col">Total</th>
                <th scope="col">Solicitud</th>
                <th scope="col">Pago</th>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={(e) => !e.target.closest('a, button') && navigate(`/admin/solicitudes/${r.id}`)} className="is-clickable">
                  <td data-label="Cliente">
                    <span className="cell-client">
                      <BrandDot brand={brandOf(r.brandId)} />
                      <span>
                        <strong>{r.client.firstName} {r.client.lastName}</strong>
                        <span className="muted small">{shortId(r.id)} · recibida {formatDateTime(r.createdAt)}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Plan">{r.planName}{r.quote.lines.length > 0 && <span className="muted small"> + {r.quote.lines.length} extra{r.quote.lines.length > 1 ? 's' : ''}</span>}</td>
                  <td data-label="Fecha">{formatShortDate(r.date)} · {formatTime(r.time)}</td>
                  <td data-label="Total" className="num">
                    {formatMoney(r.quote.total, r.currency)}
                    {r.status !== 'cancelled' && balanceDue(r) > 0 && (
                      <span className="muted small cell-due">Falta {formatMoney(balanceDue(r), r.currency)}</span>
                    )}
                    {r.status !== 'cancelled' && balanceDue(r) === 0 && <span className="small cell-due ok">Pagado</span>}
                  </td>
                  <td data-label="Solicitud"><RequestStatusBadge status={r.status} /></td>
                  <td data-label="Pago"><PaymentStatusBadge status={r.paymentStatus} /></td>
                  <td className="cell-action">
                    <span className="row-tools">
                      {r.status !== 'cancelled' && (
                        <button type="button" className="row-tool row-tool--wa" onClick={() => copyWa(r)} title="Copiar mensaje de WhatsApp" aria-label={`Copiar mensaje de WhatsApp para ${r.client.firstName} ${r.client.lastName}`} data-testid="row-wa">
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 9.5c.3 1.8 1.7 3.4 3.6 4.1l1.1-1 1.6.8c-.2 1-1 1.6-2 1.4-2.7-.5-4.9-2.6-5.4-5.3-.2-1 .4-1.8 1.4-2l.8 1.6z" fill="currentColor" /></svg>
                          <span>WhatsApp</span>
                        </button>
                      )}
                      {can('requests.delete') && (
                        <button type="button" className="row-tool row-tool--danger" onClick={() => setDeleting(r)} title="Borrar solicitud" aria-label={`Borrar la solicitud de ${r.client.firstName} ${r.client.lastName}`} data-testid="row-delete">
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      )}
                    </span>
                    <Link to={`/admin/solicitudes/${r.id}`} aria-label={`Ver detalle de ${r.client.firstName} ${r.client.lastName}`}>
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Borrar solicitud"
        message={deleting ? `Se borrará para siempre la solicitud de ${deleting.client.firstName} ${deleting.client.lastName} (${shortId(deleting.id)}), con sus pagos, notas, comprobante e imágenes. No se puede deshacer. Si solo quieres liberar la fecha, ábrela y usa «Cancelar reserva».` : ''}
        confirmLabel="Borrar para siempre"
        danger
        onConfirm={async () => {
          try {
            await api.deleteRequest(deleting.id);
            toast('Solicitud borrada', 'neutral');
          } catch (e) {
            toast(e.message, 'red');
          }
        }}
      />
    </>
  );
}
