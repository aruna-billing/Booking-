import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Checkbox } from '../ui/Field.jsx';
import { MonthCalendar } from '../ui/MonthCalendar.jsx';
import { useDb } from '../../store/mockDb.js';
import { DAY_STATUS_LABEL, endTime, getDayAvailability, isSelectable, toMin } from '../../lib/availability.js';
import { formatLongDate, formatTime, parseISODate, today, toISODate } from '../../lib/date.js';
import { isEventBrand } from '../../data/brands.js';
import { emailTemplate } from '../../lib/emails.js';
import { LIVE } from '../../lib/mode.js';
import { loadBusySlots } from '../../services/cloud.js';
import * as api from '../../services/api.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Mover una reserva a otra fecha/hora. Muestra la disponibilidad real de la marca
 * (sin contar esta misma reserva), pero el equipo puede elegir cualquier día futuro:
 * si está cerrado, bloqueado u ocupado, avisa antes de guardar.
 */
export function RescheduleModal({ request: r, brand, onClose, onDone }) {
  const db = useDb();
  const event = isEventBrand(brand);
  const rules = db.rules[brand.id];
  const dur = r.quote?.durationMin ?? rules.defaultDurationMin;
  const [google, setGoogle] = useState([]);
  const [agenda, setAgenda] = useState(LIVE ? 'loading' : 'ready');

  // Con Supabase, también cuentan los eventos ocupados de Google Calendar.
  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    loadBusySlots(brand.id)
      .then((list) => alive && (setGoogle(list.filter((b) => b.source === 'google')), setAgenda('ready')))
      .catch(() => alive && setAgenda('error'));
    return () => {
      alive = false;
    };
  }, [brand.id]);

  const ctx = useMemo(
    () => ({
      brandId: brand.id,
      // Sin las reglas de antelación: el equipo puede mover a cualquier día desde hoy.
      rules: { ...rules, minNoticeDays: 0, maxAdvanceDays: Math.max(rules.maxAdvanceDays ?? 365, 730), simulatedOccupancy: 0 },
      blockedDates: db.blockedDates,
      requests: [
        ...db.requests.filter((x) => x.id !== r.id),
        ...google.map((b, i) => ({ id: `g-${i}`, brandId: brand.id, date: b.date, time: b.time, status: 'confirmed', quote: { durationMin: b.durationMin } })),
      ],
    }),
    [brand.id, rules, db.blockedDates, db.requests, google, r.id]
  );

  const start = parseISODate(r.date && r.date >= toISODate(today()) ? r.date : toISODate(today()));
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [day, setDay] = useState(null);
  const [time, setTime] = useState('');
  const [custom, setCustom] = useState(false);
  const [notify, setNotify] = useState(LIVE && emailTemplate(brand, 'moved').enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const info = day ? getDayAvailability(day, ctx, dur) : null;
  const sameSlot = day === r.date && (time || null) === (r.time || null);

  // Avisos (no impiden guardar).
  const warnings = [];
  if (info && !isSelectable(info.status)) {
    warnings.push(info.status === 'blocked' ? `Ese día está bloqueado${info.reason ? ` (${info.reason})` : ''}.` : `Ese día figura como «${DAY_STATUS_LABEL[info.status] ?? info.status}» para los clientes.`);
  }
  if (info && time && !event) {
    const s = toMin(time);
    const buffer = rules.bufferMin ?? 0;
    const others = ctx.requests.filter((x) => x.brandId === brand.id && x.date === day && x.status !== 'cancelled' && x.time);
    const hit = (x, pad) => s < toMin(x.time) + (x.quote?.durationMin ?? dur) + pad && toMin(x.time) - pad < s + dur;
    const who = (x) => (x.client ? `la reserva de ${x.client.firstName} ${x.client.lastName}` : 'un horario ocupado');
    const clash = others.find((x) => hit(x, 0));
    const near = !clash && buffer > 0 ? others.find((x) => hit(x, buffer)) : null;
    if (clash) warnings.push(`Choca con ${who(clash)} (${formatTime(clash.time)}).`);
    else if (near) warnings.push(`Queda muy pegado a ${who(near)} (${formatTime(near.time)}): normalmente se dejan ${buffer} min entre sesiones.`);
    const listed = info.slots.find((x) => x.time === time);
    if (!clash && !near && listed && !listed.available) warnings.push('Ese horario no está libre en la agenda.');
    if (toMin(time) < toMin(rules.openTime ?? '00:00') || toMin(time) + dur > toMin(rules.closeTime ?? '23:59')) warnings.push('Queda fuera del horario de atención.');
  }

  const changeMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const t = today();
  const canPrev = cursor.y > t.getFullYear() || (cursor.y === t.getFullYear() && cursor.m > t.getMonth());

  const getDay = (iso) => {
    const d = getDayAvailability(iso, ctx, dur);
    const current = iso === r.date;
    return {
      status: current ? 'current' : d.status,
      label: current ? 'Fecha actual de la reserva' : DAY_STATUS_LABEL[d.status],
      disabled: d.status === 'past',
      content: current ? <span className="cal__now" aria-hidden="true">actual</span> : d.status === 'limited' ? <span className="cal__mark" aria-hidden="true" /> : null,
    };
  };

  const pickDay = (iso) => {
    setDay(iso);
    setError(null);
    setCustom(false);
    const slots = getDayAvailability(iso, ctx, dur).slots;
    // Mantener la misma hora si sigue libre ese día.
    if (r.time && slots.some((x) => x.time === r.time && x.available)) setTime(r.time);
    else if (event) setTime(r.time ?? slots[0]?.time ?? '');
    else setTime('');
  };

  const valid = day && (event || TIME_RE.test(time)) && !sameSlot;

  const save = async () => {
    if (!valid) {
      setError(!day ? 'Elige la nueva fecha.' : sameSlot ? 'Es la misma fecha y hora que ya tiene.' : 'Elige una hora.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.rescheduleRequest(r.id, { date: day, time: time || null, notify });
      onDone?.({ notify });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Cambiar fecha"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving} data-testid="move-save">
            {warnings.length ? 'Mover de todas formas' : 'Mover reserva'}
          </Button>
        </>
      }
    >
      <p className="small">
        Ahora: <strong className="cap">{r.date ? formatLongDate(r.date) : 'sin fecha'}</strong>
        {r.time && <> · {formatTime(r.time)} a {formatTime(endTime(r.time, dur))}</>}
      </p>
      {agenda === 'loading' && <p className="muted small" role="status">Consultando la agenda…</p>}
      {agenda === 'error' && <p className="callout small">No se pudo consultar Google Calendar; la disponibilidad muestra solo las reservas del panel.</p>}

      <div className="move-grid">
        <MonthCalendar
          year={cursor.y}
          month={cursor.m}
          onMonthChange={changeMonth}
          getDay={getDay}
          selected={day}
          onSelect={pickDay}
          canPrev={canPrev}
          caption="Elige la nueva fecha"
        />
        <div className="move-side">
          {!day ? (
            <p className="muted">Elige un día en el calendario. Puedes elegir cualquier día desde hoy; si no está disponible, te avisamos.</p>
          ) : (
            <>
              <p className="move-day cap" data-testid="move-day">{formatLongDate(day)}</p>
              {event ? (
                info.slots.length > 1 && (
                  <div className="move-slots" role="radiogroup" aria-label="Hora de inicio">
                    {info.slots.map((s) => (
                      <button key={s.time} type="button" role="radio" aria-checked={time === s.time} className={`move-slot ${time === s.time ? 'is-selected' : ''}`} onClick={() => setTime(s.time)}>
                        {formatTime(s.time)}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <>
                  <p className="field__label">Hora</p>
                  {info.slots.length > 0 && !custom && (
                    <div className="move-slots" role="radiogroup" aria-label="Horarios" data-testid="move-slots">
                      {info.slots.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          role="radio"
                          aria-checked={time === s.time}
                          className={`move-slot ${time === s.time ? 'is-selected' : ''} ${s.available ? '' : 'is-busy'}`}
                          onClick={() => setTime(s.time)}
                          title={s.available ? undefined : 'Ocupado'}
                        >
                          {formatTime(s.time)}
                        </button>
                      ))}
                    </div>
                  )}
                  {custom || info.slots.length === 0 ? (
                    <label className="field">
                      <span className="field__label">Otra hora</span>
                      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} data-testid="move-time" />
                    </label>
                  ) : (
                    <button type="button" className="link-btn small" onClick={() => setCustom(true)}>Escribir otra hora</button>
                  )}
                  {time && TIME_RE.test(time) && <p className="muted small">De {formatTime(time)} a {formatTime(endTime(time, dur))}</p>}
                </>
              )}
            </>
          )}
          {warnings.length > 0 && (
            <div className="move-warn small" role="status" data-testid="move-warning">
              {warnings.map((w) => <p key={w}>{w}</p>)}
              <p>Puedes moverla igualmente.</p>
            </div>
          )}
        </div>
      </div>

      {LIVE && emailTemplate(brand, 'moved').enabled ? (
        <Checkbox checked={notify} onChange={setNotify} name="notify" data-testid="move-notify">
          Avisar al cliente por correo (correo «Cambio de fecha»)
        </Checkbox>
      ) : LIVE ? (
        <p className="muted small">El correo «Cambio de fecha» está desactivado en Personalización → Correos. Después podrás copiar el mensaje de WhatsApp.</p>
      ) : (
        <p className="muted small">Después podrás copiar el mensaje de WhatsApp «Cambio de fecha» para avisar al cliente.</p>
      )}
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}
