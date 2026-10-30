import { useMemo, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { DeliverDialog } from '../../components/admin/ClientTimeline.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, EmptyState, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { formatShortDate, formatTime, toISODate, today } from '../../lib/date.js';
import { STAGES, alertOf, daysFrom, deliveryDueDate, stageOf, trackingSummary } from '../../lib/tracking.js';
import { shortId } from '../../lib/format.js';
import * as api from '../../services/api.js';

const URGENT = ['overdue', 'due_soon', 'shoot_unmarked', 'shoot_today'];

/** Seguimientos: dónde va cada cliente desde que reserva hasta la entrega. */
export function Tracking() {
  const db = useDb();
  const { inScope, can } = useAdmin();
  const toast = useToast();
  const [view, setView] = useState(() => {
    try {
      return sessionStorage.getItem('booking-tracking-view') || 'board';
    } catch {
      return 'board';
    }
  });
  const [mobileCol, setMobileCol] = useState('booked');
  const [q, setQ] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [allDelivered, setAllDelivered] = useState(false);
  const [delivering, setDelivering] = useState(null);
  const [busy, setBusy] = useState(null);

  const brandsById = useMemo(() => Object.fromEntries(db.brands.map((b) => [b.id, b])), [db.brands]);
  const showBrand = db.brands.length > 1;
  const ref = toISODate(today());

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.requests
      .filter((r) => inScope(r.brandId))
      .map((r) => ({ r, stage: stageOf(r), alert: alertOf(r, brandsById[r.brandId], db.extras, ref), due: deliveryDueDate(r, brandsById[r.brandId], db.extras) }))
      .filter((x) => x.stage && x.stage !== 'request')
      .filter((x) => !term || `${x.r.client.firstName} ${x.r.client.lastName} ${x.r.planName} ${x.r.id}`.toLowerCase().includes(term))
      .filter((x) => !onlyAlerts || URGENT.includes(x.alert?.kind));
  }, [db.requests, db.extras, brandsById, inScope, q, onlyAlerts, ref]);

  const summary = trackingSummary(
    db.requests.filter((r) => inScope(r.brandId)),
    brandsById,
    db.extras,
    ref
  );

  const byStage = (key) => {
    let list = items.filter((x) => x.stage === key);
    if (key === 'booked') list.sort((a, b) => (a.r.date + a.r.time).localeCompare(b.r.date + b.r.time));
    if (key === 'shot') list.sort((a, b) => a.due.localeCompare(b.due));
    if (key === 'delivered') {
      list.sort((a, b) => b.r.deliveredAt.localeCompare(a.r.deliveredAt));
      if (!allDelivered && !q.trim()) list = list.filter((x) => daysFrom(x.r.deliveredAt, ref) >= -30);
    }
    return list;
  };

  const shot = async (r) => {
    setBusy(r.id);
    try {
      await api.markShot(r.id);
      toast(`Fotos de ${r.client.firstName} realizadas: pasa a edición`, 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy(null);
  };

  const setViewSaved = (v) => {
    setView(v);
    try {
      sessionStorage.setItem('booking-tracking-view', v);
    } catch {
      /* ignorar */
    }
  };

  // Función (no componente) para no remontar las tarjetas y conservar el foco.
  const renderCard = (x) => {
    const { r, alert } = x;
    const b = brandsById[r.brandId];
    const future = r.date > ref;
    return (
      <li key={r.id} className={`tcard tcard--${alert?.tone ?? 'neutral'}`} data-testid={`tcard-${r.id}`}>
        <div className="tcard__head">
          <Link to={`/admin/solicitudes/${r.id}`} className="tcard__name">
            {r.client.firstName} {r.client.lastName}
          </Link>
          <span className="muted small">{shortId(r.id)}</span>
        </div>
        <p className="tcard__meta small">
          {showBrand && <><BrandDot brand={b} /> </>}
          {r.planName} · {formatShortDate(r.date)} · {formatTime(r.time)}
        </p>
        {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
        {x.stage === 'shot' && <p className="tcard__due small">Vence {formatShortDate(x.due)}</p>}
        {x.stage === 'delivered' && (
          <p className="tcard__due small">
            Entregado {formatShortDate(r.deliveredAt)}
            {r.galleryUrl && (
              <>
                {' · '}
                <a href={r.galleryUrl} target="_blank" rel="noopener noreferrer">Galería</a>
              </>
            )}
          </p>
        )}
        {can('tracking.update') && x.stage === 'booked' && (
          <Button size="sm" variant="secondary" disabled={future} loading={busy === r.id} onClick={() => shot(r)} aria-label={`Marcar fotos realizadas de ${r.client.firstName} ${r.client.lastName}`}>
            Fotos realizadas
          </Button>
        )}
        {can('tracking.update') && x.stage === 'shot' && (
          <Button size="sm" onClick={() => setDelivering(r)} aria-label={`Marcar entrega de ${r.client.firstName} ${r.client.lastName}`}>
            Marcar entregado
          </Button>
        )}
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Seguimientos" description="En qué paso va cada cliente: reservado, día de las fotos y entrega." />

      <div className="tsum" data-testid="tracking-summary">
        <div className="tsum__item"><span>Sesiones esta semana</span><strong>{summary.sessionsWeek}</strong></div>
        <div className="tsum__item"><span>En edición</span><strong>{summary.shot}</strong></div>
        <div className={`tsum__item ${summary.overdue ? 'is-red' : ''}`}><span>Entregas vencidas</span><strong data-testid="sum-overdue">{summary.overdue}</strong></div>
        <div className={`tsum__item ${summary.unmarked ? 'is-amber' : ''}`}><span>Sesiones sin marcar</span><strong data-testid="sum-unmarked">{summary.unmarked}</strong></div>
        <div className="tsum__item"><span>Entregadas este mes</span><strong>{summary.deliveredMonth}</strong></div>
      </div>

      <div className="ttools">
        <label className="ttools__search">
          <span className="visually-hidden">Buscar cliente</span>
          <input type="search" placeholder="Buscar cliente o plan…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="tracking-search" />
        </label>
        <Toggle checked={onlyAlerts} onChange={setOnlyAlerts} label="Solo lo urgente" />
        <div className="seg ttools__view" role="radiogroup" aria-label="Vista">
          {[['board', 'Tablero'], ['list', 'Lista']].map(([k, label]) => (
            <label key={k} className={`seg__opt ${view === k ? 'is-on' : ''}`}>
              <input type="radio" name="tview" checked={view === k} onChange={() => setViewSaved(k)} data-testid={`view-${k}`} /> {label}
            </label>
          ))}
        </div>
      </div>

      {view === 'board' ? (
        <>
          <div className="tboard__tabs" role="tablist" aria-label="Etapa">
            {STAGES.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={mobileCol === s.key} className={`tab ${mobileCol === s.key ? 'is-active' : ''}`} onClick={() => setMobileCol(s.key)}>
                {s.label} <span className="tab__count">{byStage(s.key).length}</span>
              </button>
            ))}
          </div>
          <div className="tboard" data-testid="tracking-board">
            {STAGES.map((s) => {
              const list = byStage(s.key);
              return (
                <section key={s.key} className={`tcol ${mobileCol === s.key ? 'is-mobile-active' : ''}`} aria-labelledby={`tcol-${s.key}`} data-testid={`col-${s.key}`}>
                  <header className="tcol__head">
                    <h2 id={`tcol-${s.key}`} className="tcol__title">
                      {s.label} <span className="tcol__count">{list.length}</span>
                    </h2>
                    <p className="tcol__hint small">{s.hint}</p>
                    {s.key === 'delivered' && (
                      <button type="button" className="link-btn small" onClick={() => setAllDelivered((v) => !v)}>
                        {allDelivered ? 'Ver solo últimos 30 días' : 'Ver todas las entregas'}
                      </button>
                    )}
                  </header>
                  {list.length === 0 ? (
                    <p className="tcol__empty small muted">Nada por aquí.</p>
                  ) : (
                    <ul className="tcol__list">{list.map(renderCard)}</ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : items.length === 0 ? (
        <EmptyState title="No hay clientes con estos filtros." />
      ) : (
        <div className="table-wrap">
          <table className="table table--responsive tlist" data-testid="tracking-list">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Etapa</th>
                <th scope="col">Sesión</th>
                <th scope="col">Entrega</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...items]
                .sort((a, b) => (URGENT.includes(b.alert?.kind) ? 1 : 0) - (URGENT.includes(a.alert?.kind) ? 1 : 0) || a.r.date.localeCompare(b.r.date))
                .map((x) => (
                  <tr key={x.r.id}>
                    <td data-label="Cliente">
                      <Link to={`/admin/solicitudes/${x.r.id}`}><strong>{x.r.client.firstName} {x.r.client.lastName}</strong></Link>
                      <span className="muted small"> · {x.r.planName}</span>
                    </td>
                    <td data-label="Etapa">{STAGES.find((s) => s.key === x.stage)?.label}</td>
                    <td data-label="Sesión">{formatShortDate(x.r.date)} · {formatTime(x.r.time)}</td>
                    <td data-label="Entrega">{x.r.deliveredAt ? `Entregado ${formatShortDate(x.r.deliveredAt)}` : `Vence ${formatShortDate(x.due)}`}</td>
                    <td data-label="Estado">{x.alert && <Badge tone={x.alert.tone}>{x.alert.text}</Badge>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small">
        El plazo de entrega se cuenta en días hábiles desde el día de las fotos (se configura en Marcas). Con el extra de entrega exprés, el plazo es de 72 horas.
      </p>

      {delivering && <DeliverDialog request={db.requests.find((x) => x.id === delivering.id)} onClose={() => setDelivering(null)} />}
    </>
  );
}
