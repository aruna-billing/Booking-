import { useMemo, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, PageHeader } from '../../components/admin/parts.jsx';
import { EmptyState, PaymentStatusBadge, RequestStatusBadge } from '../../components/ui/misc.jsx';
import { REQUEST_STATUS, PAYMENT_STATUS } from '../../data/statuses.js';
import { Link, navigate, usePath } from '../../lib/router.jsx';
import { formatShortDate, formatTime, formatDateTime } from '../../lib/date.js';
import { formatMoney, shortId } from '../../lib/format.js';
import { balanceDue } from '../../lib/finance.js';

export function Requests() {
  const db = useDb();
  const { brandFilter, inScope } = useAdmin();
  const path = usePath();
  const initialStatus = new URLSearchParams(path.split('?')[1] ?? '').get('estado') ?? 'all';
  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('created');

  const brandOf = (id) => db.brands.find((b) => b.id === id);

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
                <tr key={r.id} onClick={(e) => e.target.tagName !== 'A' && navigate(`/admin/solicitudes/${r.id}`)} className="is-clickable">
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
    </>
  );
}
