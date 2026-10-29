import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, Card, PageHeader, StatCard } from '../../components/admin/parts.jsx';
import { Badge, PaymentStatusBadge, RequestStatusBadge, DemoNotice, EmptyState } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { formatDateTime, formatShortDate, formatTime, today, toISODate, addDays } from '../../lib/date.js';
import { formatMoney } from '../../lib/format.js';
import { balanceDue } from '../../lib/finance.js';
import { alertOf, trackingSummary } from '../../lib/tracking.js';

export function Dashboard() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const reqs = db.requests.filter((r) => brandFilter === 'all' || r.brandId === brandFilter);
  const brandOf = (id) => db.brands.find((b) => b.id === id);
  const t = toISODate(today());
  const in30 = toISODate(addDays(today(), 30));

  const pending = reqs.filter((r) => r.status === 'pending_review');
  const toVerify = reqs.filter((r) => r.paymentStatus === 'submitted');
  const upcoming = reqs
    .filter((r) => r.status === 'confirmed' && r.date >= t)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const next30 = upcoming.filter((r) => r.date <= in30);

  // Saldo pendiente de reservas confirmadas/completadas, separado por moneda.
  const dueByCurrency = reqs
    .filter((r) => (r.status === 'confirmed' || r.status === 'completed') && balanceDue(r) > 0)
    .reduce((acc, r) => ({ ...acc, [r.currency]: (acc[r.currency] ?? 0) + balanceDue(r) }), {});

  const brandsById = Object.fromEntries(db.brands.map((b) => [b.id, b]));
  const track = trackingSummary(reqs, brandsById, db.extras);
  const urgent = reqs
    .map((r) => ({ r, a: alertOf(r, brandsById[r.brandId], db.extras) }))
    .filter((x) => ['overdue', 'shoot_unmarked', 'due_soon', 'shoot_today'].includes(x.a?.kind))
    .sort((x, y) => ['overdue', 'shoot_unmarked', 'shoot_today', 'due_soon'].indexOf(x.a.kind) - ['overdue', 'shoot_unmarked', 'shoot_today', 'due_soon'].indexOf(y.a.kind));
  const recent = reqs
    .flatMap((r) => r.history.map((h) => ({ ...h, request: r })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return (
    <>
      <PageHeader title="Dashboard" description="Resumen de la actividad de reservas." />
      <DemoNotice compact>Cifras calculadas sobre datos ficticios del prototipo.</DemoNotice>

      <div className="stats">
        <StatCard label="Solicitudes en revisión" value={pending.length} hint={<Link to="/admin/solicitudes?estado=pending_review">Revisar →</Link>} tone={pending.length ? 'amber' : undefined} />
        <StatCard label="Comprobantes por verificar" value={toVerify.length} hint={<Link to="/admin/comprobantes">Ir a comprobantes →</Link>} tone={toVerify.length ? 'amber' : undefined} />
        <StatCard label="Sesiones confirmadas (30 días)" value={next30.length} hint={<Link to="/admin/calendario">Ver calendario →</Link>} />
        <StatCard
          label="Falta por cobrar"
          value={Object.keys(dueByCurrency).length ? Object.entries(dueByCurrency).map(([c, v]) => <span key={c} className="stat__multi">{formatMoney(v, c)}</span>) : '—'}
          hint={<Link to="/admin/finanzas">Ver finanzas →</Link>}
        />
      </div>

      <div className="grid-2">
        <Card title="Próximas sesiones confirmadas" actions={<Link to="/admin/calendario" className="small">Calendario</Link>}>
          {upcoming.length === 0 ? (
            <EmptyState title="No hay sesiones confirmadas próximas." />
          ) : (
            <ul className="agenda">
              {upcoming.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/solicitudes/${r.id}`} className="agenda__item">
                    <span className="agenda__date">
                      <strong>{formatShortDate(r.date)}</strong>
                      <span>{formatTime(r.time)}</span>
                    </span>
                    <span className="agenda__info">
                      <span className="agenda__name">
                        <BrandDot brand={brandOf(r.brandId)} /> {r.client.firstName} {r.client.lastName}
                      </span>
                      <span className="muted small">{r.planName}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Necesitan atención" actions={<Link to="/admin/solicitudes" className="small">Todas</Link>}>
          {pending.length === 0 && toVerify.length === 0 ? (
            <EmptyState title="Todo al día." />
          ) : (
            <ul className="attention">
              {[...new Set([...pending, ...toVerify])].slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/solicitudes/${r.id}`} className="attention__item">
                    <span>
                      <BrandDot brand={brandOf(r.brandId)} /> <strong>{r.client.firstName} {r.client.lastName}</strong>
                      <span className="muted small"> · {r.planName} · {formatShortDate(r.date)}</span>
                    </span>
                    <span className="attention__badges">
                      <RequestStatusBadge status={r.status} />
                      <PaymentStatusBadge status={r.paymentStatus} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Seguimientos" actions={<Link to="/admin/seguimientos" className="small">Abrir seguimientos</Link>}>
        <div className="dash-track">
          <div><span className="muted small">Sesiones esta semana</span><strong>{track.sessionsWeek}</strong></div>
          <div><span className="muted small">En edición</span><strong>{track.shot}</strong></div>
          <div className={track.overdue ? 'is-red' : ''}><span className="muted small">Entregas vencidas</span><strong>{track.overdue}</strong></div>
          <div className={track.unmarked ? 'is-amber' : ''}><span className="muted small">Sesiones sin marcar</span><strong>{track.unmarked}</strong></div>
        </div>
        {urgent.length > 0 && (
          <ul className="attention">
            {urgent.slice(0, 4).map(({ r, a }) => (
              <li key={r.id}>
                <Link to={`/admin/solicitudes/${r.id}`} className="attention__item">
                  <span><strong>{r.client.firstName} {r.client.lastName}</strong><span className="muted small"> · {r.planName}</span></span>
                  <Badge tone={a.tone}>{a.text}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Actividad reciente">
        <ol className="timeline timeline--compact">
          {recent.map((h, i) => (
            <li key={i}>
              <span className="timeline__when">{formatDateTime(h.at)}</span>
              <span>
                <Link to={`/admin/solicitudes/${h.request.id}`}>{h.request.client.firstName} {h.request.client.lastName}</Link> — {h.label}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
