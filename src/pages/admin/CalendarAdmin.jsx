import { RulesEditor } from '../../components/admin/RulesEditor.jsx';
import { LIVE } from '../../lib/mode.js';
import { GoogleCalendarCard } from '../../components/admin/GoogleCalendarCard.jsx';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { Card, PageHeader } from '../../components/admin/parts.jsx';
import { MonthCalendar } from '../../components/ui/MonthCalendar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { DemoNotice, RequestStatusBadge, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { DAY_STATUS_LABEL, endTime, getDayAvailability } from '../../lib/availability.js';
import { formatDuration } from '../../lib/format.js';
import { WEEKDAYS_LONG, formatLongDate, formatTime, today, toISODate } from '../../lib/date.js';
import * as api from '../../services/api.js';

export function CalendarAdmin() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const toast = useToast();
  const [brandId, setBrandId] = useState(brandFilter !== 'all' ? brandFilter : db.brands[0].id);
  const wanted = brandFilter !== 'all' ? brandFilter : brandId;
  const activeBrand = db.brands.some((b) => b.id === wanted) ? wanted : db.brands[0].id;
  const t = today();
  const [cursor, setCursor] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [day, setDay] = useState(toISODate(t));
  const [reason, setReason] = useState('');

  const rules = db.rules[activeBrand];
  const ctx = { brandId: activeBrand, rules, blockedDates: db.blockedDates, requests: db.requests };
  const reqsOn = (iso) => db.requests.filter((r) => r.brandId === activeBrand && r.date === iso && r.status !== 'cancelled');

  const getDay = (iso) => {
    const info = getDayAvailability(iso, ctx);
    const reqs = reqsOn(iso);
    const confirmed = reqs.filter((r) => r.status === 'confirmed' || r.status === 'completed').length;
    const pending = reqs.length - confirmed;
    const blocked = db.blockedDates.some((b) => b.brandId === activeBrand && b.date === iso);
    return {
      status: blocked ? 'blocked' : info.status === 'past' ? 'past' : info.status === 'closed' ? 'closed' : 'admin',
      label: `${blocked ? 'Bloqueado' : DAY_STATUS_LABEL[info.status]}. ${confirmed} confirmadas, ${pending} pendientes.`,
      disabled: false,
      content: (
        <span className="cal__dots" aria-hidden="true">
          {Array.from({ length: confirmed }).map((_, i) => <i key={`c${i}`} className="dot dot--green" />)}
          {Array.from({ length: pending }).map((_, i) => <i key={`p${i}`} className="dot dot--amber" />)}
          {blocked && <i className="dot dot--blocked" />}
        </span>
      ),
    };
  };

  const changeMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const dayReqs = reqsOn(day).sort((a, b) => a.time.localeCompare(b.time));
  const block = db.blockedDates.find((b) => b.brandId === activeBrand && b.date === day);
  const info = getDayAvailability(day, ctx);
  const brand = db.brands.find((b) => b.id === activeBrand);

  return (
    <>
      <PageHeader title="Calendario y disponibilidad" description="Reservas por día, bloqueos manuales y reglas de agenda de cada marca." />
      {LIVE ? (
        <GoogleCalendarCard />
      ) : (
        <DemoNotice compact>
          Sin conexión con Google Calendar. La ocupación que ve el cliente combina estas reservas, los bloqueos y una ocupación simulada.
        </DemoNotice>
      )}

      {brandFilter === 'all' && (
        <div className="tabs" role="tablist" aria-label="Marca">
          {db.brands.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={activeBrand === b.id} className={`tab ${activeBrand === b.id ? 'is-active' : ''}`} onClick={() => setBrandId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="cal-admin">
        <Card className="cal-admin__cal">
          <MonthCalendar year={cursor.y} month={cursor.m} onMonthChange={changeMonth} getDay={getDay} selected={day} onSelect={setDay} />
          <ul className="legend">
            <li><i className="dot dot--green" /> Confirmada</li>
            <li><i className="dot dot--amber" /> Pendiente</li>
            <li><i className="dot dot--blocked" /> Bloqueado</li>
          </ul>
        </Card>

        <div className="cal-admin__side">
          <Card title={formatLongDate(day)}>
            <p className="small muted">Vista del cliente: <strong>{block ? 'No disponible (bloqueado)' : DAY_STATUS_LABEL[info.status]}</strong></p>
            {dayReqs.length === 0 ? (
              <p className="muted">Sin reservas este día.</p>
            ) : (
              <ul className="day-list">
                {dayReqs.map((r) => (
                  <li key={r.id}>
                    <span className="day-list__time">
                      {formatTime(r.time)}
                      <span className="muted small">a {formatTime(endTime(r.time, r.quote.durationMin ?? 60))}</span>
                    </span>
                    <Link to={`/admin/solicitudes/${r.id}`}>{r.client.firstName} {r.client.lastName}</Link>
                    <span className="muted small">{r.planName}</span>
                    <RequestStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}

            <div className="block-box">
              {block ? (
                <>
                  <p className="small">Bloqueado: <strong>{block.reason}</strong></p>
                  <Button variant="secondary" size="sm" onClick={() => api.toggleBlockedDate(activeBrand, day).then((ok) => toast(ok === false ? api.SAVE_FAILED : 'Día desbloqueado', ok === false ? 'red' : undefined))}>
                    Desbloquear día
                  </Button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    api.toggleBlockedDate(activeBrand, day, reason.trim() || 'Bloqueado manualmente').then((ok) => {
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
          </Card>

          <RulesEditor key={`${activeBrand}-${JSON.stringify(rules)}`} brand={brand} rules={rules} />
        </div>
      </div>
    </>
  );
}
