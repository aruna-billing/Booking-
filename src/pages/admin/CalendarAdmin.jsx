import { RulesEditor } from '../../components/admin/RulesEditor.jsx';
import { LIVE } from '../../lib/mode.js';
import { GoogleCalendarCard } from '../../components/admin/GoogleCalendarCard.jsx';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, Card, PageHeader } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { DemoNotice, RequestStatusBadge, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { DAY_STATUS_LABEL, endTime, getDayAvailability } from '../../lib/availability.js';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, formatLongDate, formatMonthYear, formatTime, today, toISODate } from '../../lib/date.js';
import { canSeeBrand } from '../../lib/auth.js';
import * as api from '../../services/api.js';

const MAX_IN_CELL = 3;
const evClass = (r) => `gcal-ev gcal-ev--${r.status === 'confirmed' ? 'confirmed' : r.status === 'completed' ? 'completed' : 'pending'}`;
const timeOf = (r) => (r.time ? formatTime(r.time) : 'Todo el día');
// «10:00 a. m.» → «10:00 am» para que quepa en la casilla.
const shortTime = (t) => formatTime(t).replace(/\s*a\.\s*m\./i, ' am').replace(/\s*p\.\s*m\./i, ' pm');

/** Semanas visibles del mes (lunes a domingo), con los días de los meses vecinos. */
function monthGrid(y, m) {
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
  const daysIn = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((((first.getDay() + 6) % 7) + daysIn) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function CalendarAdmin() {
  const db = useDb();
  const { brandFilter, user, can } = useAdmin();
  const toast = useToast();
  const canManage = can('calendar.manage');
  const myBrands = db.brands.filter((b) => canSeeBrand(user, b.id));
  const [brandId, setBrandId] = useState('all');
  const wanted = brandFilter !== 'all' ? brandFilter : brandId;
  const activeBrand = wanted === 'all' || myBrands.some((b) => b.id === wanted) ? wanted : 'all';
  const single = activeBrand !== 'all' ? db.brands.find((b) => b.id === activeBrand) : myBrands.length === 1 ? myBrands[0] : null;
  const showBrand = !single;
  const t = today();
  const todayIso = toISODate(t);
  const [cursor, setCursor] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [day, setDay] = useState(todayIso);
  // En el celular la cuadrícula del mes es pequeña: empieza en la vista de lista.
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches ? 'agenda' : 'month'));
  const [reason, setReason] = useState('');

  const brandOf = (id) => db.brands.find((b) => b.id === id);
  const inView = (brandIdOf) => (single ? brandIdOf === single.id : myBrands.some((b) => b.id === brandIdOf));

  // Reservas (sin canceladas) agrupadas por día.
  const byDay = {};
  {
    const map = byDay;
    db.requests
      .filter((r) => r.status !== 'cancelled' && r.date && inView(r.brandId))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      .forEach((r) => (map[r.date] ||= []).push(r));
  }
  const blocksOn = (iso) => db.blockedDates.filter((b) => b.date === iso && inView(b.brandId));

  const changeMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
    setDay(todayIso);
  };
  const selectDay = (date) => {
    setDay(toISODate(date));
    if (date.getMonth() !== cursor.m) setCursor({ y: date.getFullYear(), m: date.getMonth() });
  };

  const cells = monthGrid(cursor.y, cursor.m);
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
  const agendaDays = Object.keys(byDay).filter((iso) => iso.startsWith(monthPrefix)).sort();
  const monthCount = agendaDays.reduce((n, iso) => n + byDay[iso].length, 0);

  const dayReqs = byDay[day] ?? [];
  const block = single ? db.blockedDates.find((b) => b.brandId === single.id && b.date === day) : null;
  const info = single ? getDayAvailability(day, { brandId: single.id, rules: db.rules[single.id], blockedDates: db.blockedDates, requests: db.requests }) : null;

  return (
    <>
      <PageHeader
        title="Calendario"
        description={canManage ? 'Reservas de cada día, bloqueos manuales y horarios de cada marca.' : 'Reservas de cada día de tus marcas (solo lectura).'}
      />
      {canManage &&
        (LIVE ? (
          <GoogleCalendarCard />
        ) : (
          <DemoNotice compact>
            Sin conexión con Google Calendar. La ocupación que ve el cliente combina estas reservas, los bloqueos y una ocupación simulada.
          </DemoNotice>
        ))}

      {brandFilter === 'all' && myBrands.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Marca">
          {[{ id: 'all', name: 'Todas las marcas' }, ...myBrands].map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={activeBrand === b.id} className={`tab ${activeBrand === b.id ? 'is-active' : ''}`} onClick={() => setBrandId(b.id)} data-testid={`cal-brand-${b.id}`}>
              {b.theme && <BrandDot brand={b} />} {b.name}
            </button>
          ))}
        </div>
      )}

      <Card className="gcal">
        <div className="gcal__bar">
          <Button variant="secondary" size="sm" onClick={goToday}>Hoy</Button>
          <span className="gcal__nav">
            <button type="button" className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Mes anterior" data-testid="cal-prev">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="icon-btn" onClick={() => changeMonth(1)} aria-label="Mes siguiente" data-testid="cal-next">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </span>
          <h2 className="gcal__title" aria-live="polite">{formatMonthYear(cursor.y, cursor.m)}</h2>
          <span className="muted small gcal__count">{monthCount} reserva{monthCount === 1 ? '' : 's'}</span>
          <span className="spacer" />
          <div className="seg" role="radiogroup" aria-label="Vista">
            {[['month', 'Mes'], ['agenda', 'Lista']].map(([k, label]) => (
              <label key={k} className={`seg__opt ${view === k ? 'is-on' : ''}`}>
                <input type="radio" name="cal-view" checked={view === k} onChange={() => setView(k)} data-testid={`cal-view-${k}`} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {view === 'month' ? (
          <div className="gcal__grid" role="grid" aria-label={`Reservas de ${formatMonthYear(cursor.y, cursor.m)}`}>
            {WEEKDAYS_SHORT.map((d, i) => (
              <span key={d} className="gcal__dow" role="columnheader" title={WEEKDAYS_LONG[i]}>{d}</span>
            ))}
            {cells.map((date) => {
              const iso = toISODate(date);
              const evs = byDay[iso] ?? [];
              const blocks = blocksOn(iso);
              const out = date.getMonth() !== cursor.m;
              const extra = evs.length - MAX_IN_CELL;
              return (
                <div
                  key={iso}
                  role="gridcell"
                  className={`gcal__cell ${out ? 'is-out' : ''} ${iso === todayIso ? 'is-today' : ''} ${iso === day ? 'is-selected' : ''} ${iso < todayIso ? 'is-past' : ''} ${blocks.length ? 'is-blocked' : ''}`}
                  onClick={(e) => !e.target.closest('a') && selectDay(date)}
                  data-iso={iso}
                >
                  <button
                    type="button"
                    className="gcal__num"
                    onClick={() => selectDay(date)}
                    aria-label={`${formatLongDate(iso)}: ${evs.length} reserva${evs.length === 1 ? '' : 's'}${blocks.length ? ', bloqueado' : ''}`}
                    aria-pressed={iso === day}
                  >
                    {date.getDate()}
                  </button>
                  {blocks.length > 0 && (
                    <span className="gcal-block" title={blocks.map((b) => b.reason).join(' · ')}>
                      Bloqueado{showBrand && blocks.length === 1 ? ` · ${brandOf(blocks[0].brandId)?.name ?? ''}` : ''}
                    </span>
                  )}
                  {evs.slice(0, extra > 0 ? MAX_IN_CELL - 1 : MAX_IN_CELL).map((r) => (
                    <Link key={r.id} to={`/admin/solicitudes/${r.id}`} className={evClass(r)} title={`${timeOf(r)} · ${r.client.firstName} ${r.client.lastName} · ${r.planName}`} data-testid="cal-event">
                      <span className="gcal-ev__top">
                        {showBrand && <BrandDot brand={brandOf(r.brandId)} />}
                        {r.client.firstName} {r.client.lastName}
                      </span>
                      <span className="gcal-ev__plan">
                        {r.time && <b>{shortTime(r.time)}</b>}
                        {r.time && ' · '}
                        {r.planName}
                      </span>
                    </Link>
                  ))}
                  {extra > 0 && (
                    <button type="button" className="gcal__more" onClick={() => selectDay(date)}>
                      +{extra + 1} más
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : agendaDays.length === 0 ? (
          <p className="muted gcal__empty">No hay reservas este mes.</p>
        ) : (
          <ol className="gcal-agenda" data-testid="cal-agenda">
            {agendaDays.map((iso) => (
              <li key={iso} className={iso === todayIso ? 'is-today' : ''}>
                <span className="gcal-agenda__date">
                  <strong>{Number(iso.slice(8))}</strong>
                  <span className="cap">{formatLongDate(iso).split(',')[0]}</span>
                </span>
                <ul>
                  {byDay[iso].map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/solicitudes/${r.id}`} className="gcal-agenda__ev">
                        <i className={`gcal-swatch gcal-swatch--${r.status === 'confirmed' ? 'confirmed' : r.status === 'completed' ? 'completed' : 'pending'}`} aria-hidden="true" />
                        <span className="gcal-agenda__time">{r.time ? `${shortTime(r.time)} – ${shortTime(endTime(r.time, r.quote.durationMin ?? 60))}` : 'Todo el día'}</span>
                        <span className="gcal-agenda__who">
                          <strong>{r.client.firstName} {r.client.lastName}</strong>
                          <span className="muted small">{r.planName}{showBrand ? ` · ${brandOf(r.brandId)?.name ?? ''}` : ''}</span>
                        </span>
                        <RequestStatusBadge status={r.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <ul className="legend">
          <li><i className="gcal-swatch gcal-swatch--confirmed" /> Confirmada</li>
          <li><i className="gcal-swatch gcal-swatch--pending" /> Pendiente</li>
          <li><i className="gcal-swatch gcal-swatch--completed" /> Completada</li>
          <li><i className="gcal-swatch gcal-swatch--blocked" /> Bloqueado</li>
        </ul>
      </Card>

      <div className="cal-admin">
        <Card title={<span className="cap">{formatLongDate(day)}</span>}>
          {info && (
            <p className="small muted">
              Lo que ve el cliente: <strong>{block ? 'No disponible (bloqueado)' : DAY_STATUS_LABEL[info.status]}</strong>
            </p>
          )}
          {dayReqs.length === 0 ? (
            <p className="muted">Sin reservas este día.</p>
          ) : (
            <ul className="day-list" data-testid="day-list">
              {dayReqs.map((r) => (
                <li key={r.id}>
                  <span className="day-list__time">
                    {timeOf(r)}
                    {r.time && <span className="muted small">a {formatTime(endTime(r.time, r.quote.durationMin ?? 60))}</span>}
                  </span>
                  <Link to={`/admin/solicitudes/${r.id}`}>{r.client.firstName} {r.client.lastName}</Link>
                  <span className="muted small">{r.planName}{showBrand ? ` · ${brandOf(r.brandId)?.name ?? ''}` : ''}</span>
                  <RequestStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
          {!single && blocksOn(day).map((b) => (
            <p key={b.brandId} className="small muted">Bloqueado en {brandOf(b.brandId)?.name}: {b.reason}</p>
          ))}

          {canManage && single && (
            <div className="block-box">
              {block ? (
                <>
                  <p className="small">Bloqueado: <strong>{block.reason}</strong></p>
                  <Button variant="secondary" size="sm" onClick={() => api.toggleBlockedDate(single.id, day).then((ok) => toast(ok === false ? api.SAVE_FAILED : 'Día desbloqueado', ok === false ? 'red' : undefined))}>
                    Desbloquear día
                  </Button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    api.toggleBlockedDate(single.id, day, reason.trim() || 'Bloqueado manualmente').then((ok) => {
                      setReason('');
                      toast(ok === false ? api.SAVE_FAILED : 'Día bloqueado para nuevas solicitudes', ok === false ? 'red' : undefined);
                    });
                  }}
                >
                  <Field label="Motivo del bloqueo" hint="No se muestra al cliente.">
                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: viaje, evento personal" />
                  </Field>
                  <Button variant="secondary" size="sm" type="submit">Bloquear este día</Button>
                </form>
              )}
            </div>
          )}
          {canManage && !single && <p className="muted small">Para bloquear días o cambiar horarios, elige una marca arriba.</p>}
        </Card>

        {canManage && single && <RulesEditor key={`${single.id}-${JSON.stringify(db.rules[single.id])}`} brand={single} rules={db.rules[single.id]} />}
      </div>
    </>
  );
}
