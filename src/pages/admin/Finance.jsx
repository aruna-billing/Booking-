import { useMemo, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, Card, PageHeader } from '../../components/admin/parts.jsx';
import { MonthlyChart } from '../../components/admin/MonthlyChart.jsx';
import { AddPaymentModal } from '../../components/admin/AddPaymentModal.jsx';
import { CollectionBadge, PaidBar } from '../../components/admin/PaymentsPanel.jsx';
import { Badge, DemoNotice, EmptyState, useToast } from '../../components/ui/misc.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Link } from '../../lib/router.jsx';
import { formatShortDate } from '../../lib/date.js';
import { formatMoney } from '../../lib/format.js';
import {
  PAYMENT_CONCEPTS,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUS,
  balanceDue,
  balanceDueDate,
  isOverdue,
  monthlySeries,
  paidAmount,
  periodRange,
  summarize,
} from '../../lib/finance.js';

const PERIODS = [
  { key: 'month', label: 'Este mes' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'year', label: 'Este año' },
  { key: 'all', label: 'Todo' },
];

export function Finance() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const toast = useToast();
  const [period, setPeriod] = useState('month');
  const [paying, setPaying] = useState(null);

  const brands = db.brands.filter((b) => brandFilter === 'all' || b.id === brandFilter);
  // Cada moneda se resume por separado: nunca se suman RD$ y US$.
  const groups = useMemo(() => {
    const byCur = {};
    brands.forEach((b) => {
      (byCur[b.currency] ??= { currency: b.currency, brands: [] }).brands.push(b);
    });
    return Object.values(byCur).map((g) => {
      const ids = g.brands.map((b) => b.id);
      const reqs = db.requests.filter((r) => ids.includes(r.brandId) && r.currency === g.currency);
      return { ...g, requests: reqs };
    });
  }, [brands, db.requests]);

  const range = periodRange(period);
  const periodLabel = PERIODS.find((p) => p.key === period).label.toLowerCase();
  const brandOf = (id) => db.brands.find((b) => b.id === id);

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Lo facturado, lo cobrado y lo que falta por cobrar, separado por moneda."
        actions={
          <label className="period">
            <span className="filters__label">Periodo</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} data-testid="period">
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        }
      />
      <DemoNotice compact>Cifras calculadas sobre reservas y pagos ficticios del prototipo. No hay conexión con bancos ni contabilidad.</DemoNotice>

      {groups.map((g) => {
        const s = summarize(g.requests, range);
        const cur = g.currency;
        const outstanding = g.requests
          .filter((r) => (r.status === 'confirmed' || r.status === 'completed') && balanceDue(r) > 0)
          .sort((a, b) => balanceDueDate(a).localeCompare(balanceDueDate(b)));
        const recentPayments = g.requests
          .flatMap((r) => (r.payments ?? []).map((p) => ({ ...p, request: r })))
          .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
          .slice(0, 8);

        return (
          <section key={cur} className="fin-group" aria-labelledby={`fin-${cur}`}>
            <h2 id={`fin-${cur}`} className="fin-group__title">
              {cur === 'USD' ? 'US$' : 'RD$'} · {g.brands.map((b) => <span key={b.id} className="fin-group__brand"><BrandDot brand={b} withName /></span>)}
            </h2>

            <div className="fin-kpis" data-testid={`kpis-${cur}`}>
              <div className="fin-kpi">
                <p className="fin-kpi__label">Facturado</p>
                <p className="fin-kpi__value" data-testid={`billed-${cur}`}>{formatMoney(s.billed, cur)}</p>
                <p className="fin-kpi__hint">{s.billableCount} reserva{s.billableCount === 1 ? '' : 's'} confirmada{s.billableCount === 1 ? '' : 's'} · {periodLabel}</p>
              </div>
              <div className="fin-kpi">
                <p className="fin-kpi__label">Recibido</p>
                <p className="fin-kpi__value" data-testid={`received-${cur}`}>{formatMoney(s.received, cur)}</p>
                <p className="fin-kpi__hint">{s.paymentsCount} pago{s.paymentsCount === 1 ? '' : 's'} verificado{s.paymentsCount === 1 ? '' : 's'} · {periodLabel}</p>
              </div>
              <div className={`fin-kpi ${s.outstanding ? 'fin-kpi--due' : ''}`}>
                <p className="fin-kpi__label">Falta por cobrar</p>
                <p className="fin-kpi__value" data-testid={`outstanding-${cur}`}>{formatMoney(s.outstanding, cur)}</p>
                <p className="fin-kpi__hint">
                  {s.overdue > 0 ? <span className="warn">{formatMoney(s.overdue, cur)} vencido</span> : 'Nada vencido'}
                </p>
              </div>
              <div className="fin-kpi">
                <p className="fin-kpi__label">Por verificar</p>
                <p className="fin-kpi__value">{formatMoney(s.pendingVerification, cur)}</p>
                <p className="fin-kpi__hint"><Link to="/admin/comprobantes">Revisar comprobantes →</Link></p>
              </div>
              <div className="fin-kpi">
                <p className="fin-kpi__label">Por confirmar</p>
                <p className="fin-kpi__value">{formatMoney(s.pipeline, cur)}</p>
                <p className="fin-kpi__hint">Solicitudes aún no confirmadas</p>
              </div>
            </div>

            <div className="fin-collect">
              <div className="fin-collect__bar" role="img" aria-label={`Cobrado ${s.collectedPct} % de lo facturado`}>
                <span style={{ width: `${s.collectedPct}%` }} />
              </div>
              <p className="small"><strong>{s.collectedPct} %</strong> de lo facturado {periodLabel} ya está cobrado.</p>
            </div>

            <div className="grid-2">
              <Card>
                <MonthlyChart data={monthlySeries(g.requests, 6)} currency={cur} title="Últimos 6 meses" />
              </Card>

              <Card title="Últimos pagos" actions={<span className="muted small">{recentPayments.length} más recientes</span>}>
                {recentPayments.length === 0 ? (
                  <EmptyState title="Sin pagos registrados." />
                ) : (
                  <ul className="fin-payments">
                    {recentPayments.map((p) => {
                      const st = PAYMENT_RECORD_STATUS[p.status];
                      return (
                        <li key={p.id}>
                          <span className="fin-payments__date">{formatShortDate(p.date)}</span>
                          <span className="fin-payments__who">
                            <Link to={`/admin/solicitudes/${p.request.id}`}>{p.request.client.firstName} {p.request.client.lastName}</Link>
                            <span className="muted small">{PAYMENT_CONCEPTS[p.concept]} · {PAYMENT_METHODS[p.method]}</span>
                          </span>
                          <span className={`num fin-payments__amt ${p.status !== 'verified' ? 'is-muted' : ''}`}>{formatMoney(p.amount, cur)}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            <Card title={`Saldos pendientes (${outstanding.length})`} actions={<span className="muted small">Ordenados por vencimiento · todas las fechas</span>}>
              {outstanding.length === 0 ? (
                <EmptyState title="No hay saldos pendientes." />
              ) : (
                <div className="table-scroll">
                  <table className="table fin-table">
                    <thead>
                      <tr>
                        <th scope="col">Cliente</th>
                        <th scope="col">Sesión</th>
                        <th scope="col" className="num">Total</th>
                        <th scope="col" className="num">Pagado</th>
                        <th scope="col" className="num">Falta</th>
                        <th scope="col">Vence</th>
                        <th scope="col"><span className="visually-hidden">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.map((r) => {
                        const overdue = isOverdue(r);
                        return (
                          <tr key={r.id}>
                            <td data-label="Cliente">
                              <span className="cell-client">
                                <BrandDot brand={brandOf(r.brandId)} />
                                <span>
                                  <Link to={`/admin/solicitudes/${r.id}`}><strong>{r.client.firstName} {r.client.lastName}</strong></Link>
                                  <span className="muted small">{r.planName}</span>
                                </span>
                              </span>
                            </td>
                            <td data-label="Sesión">{formatShortDate(r.date)}</td>
                            <td data-label="Total" className="num">{formatMoney(r.quote.total, cur)}</td>
                            <td data-label="Pagado" className="num">
                              {formatMoney(paidAmount(r), cur)}
                              <PaidBar request={r} compact />
                            </td>
                            <td data-label="Falta" className="num"><strong>{formatMoney(balanceDue(r), cur)}</strong></td>
                            <td data-label="Vence">
                              <span className={overdue ? 'warn' : ''}>{formatShortDate(balanceDueDate(r))}</span>
                              <span className="fin-table__status">{overdue ? <Badge tone="red">Vencido</Badge> : <CollectionBadge request={r} />}</span>
                            </td>
                            <td className="cell-action">
                              <Button size="sm" variant="secondary" onClick={() => setPaying(r)} aria-label={`Agregar pago de ${r.client.firstName} ${r.client.lastName}`}>
                                Agregar pago
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        );
      })}

      <p className="muted small">
        Definiciones: <strong>Facturado</strong> = reservas confirmadas o completadas con sesión en el periodo. <strong>Recibido</strong> = pagos verificados con fecha en el periodo.
        <strong> Falta por cobrar</strong> = saldo de esas reservas. El pago total vence el día de la sesión (o del evento).
      </p>

      {paying && (
        <AddPaymentModal
          request={db.requests.find((x) => x.id === paying.id)}
          open
          onClose={() => setPaying(null)}
          onSaved={(n) => toast(`Pago de ${formatMoney(n, paying.currency)} registrado`, 'green')}
        />
      )}
    </>
  );
}
