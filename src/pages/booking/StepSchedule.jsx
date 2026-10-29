import { useEffect, useMemo, useState } from 'react';
import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { OrderSummary } from '../../components/booking/OrderSummary.jsx';
import { StepActions } from '../../components/booking/StepActions.jsx';
import { stepPath } from '../../components/booking/Stepper.jsx';
import { MonthCalendar } from '../../components/ui/MonthCalendar.jsx';
import { DemoNotice } from '../../components/ui/misc.jsx';
import { DAY_STATUS_LABEL, firstSelectableDate, getDayAvailability, isSelectable } from '../../lib/availability.js';
import { addDays, formatLongDate, formatTime, parseISODate, today } from '../../lib/date.js';
import { formatDuration } from '../../lib/format.js';
import { navigate } from '../../lib/router.jsx';
import { isEventBrand } from '../../data/brands.js';
import { LIVE } from '../../lib/mode.js';
import { loadBusySlots } from '../../services/cloud.js';

/** En modo real, primero se consulta qué horarios ya están ocupados. */
export function StepSchedule({ data }) {
  const [agenda, setAgenda] = useState(LIVE ? 'loading' : 'ready');
  const brandId = data.brand.id;
  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    loadBusySlots(brandId)
      .then(() => alive && setAgenda('ready'))
      .catch(() => alive && setAgenda('error'));
    return () => {
      alive = false;
    };
  }, [brandId]);
  if (agenda === 'loading') {
    return (
      <main className="booking-route-loading" role="status" aria-live="polite">
        <p>Consultando la agenda…</p>
      </main>
    );
  }
  return <ScheduleView data={data} agendaError={agenda === 'error'} />;
}

function ScheduleView({ data, agendaError }) {
  const { brand, plan, quote, draft, dispatch, availabilityCtx } = data;
  const isWedding = isEventBrand(brand);
  const rules = availabilityCtx.rules;

  const initial = useMemo(() => parseISODate(draft.date ?? firstSelectableDate(availabilityCtx, quote.durationMin) ?? '2026-01-01'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [day, setDay] = useState(draft.date);
  const [showError, setShowError] = useState(false);

  const t = today();
  const last = addDays(t, rules.maxAdvanceDays);
  const canPrev = cursor.y > t.getFullYear() || (cursor.y === t.getFullYear() && cursor.m > t.getMonth());
  const canNext = cursor.y < last.getFullYear() || (cursor.y === last.getFullYear() && cursor.m < last.getMonth());

  const dur = quote.durationMin;
  const dayInfo = day ? getDayAvailability(day, availabilityCtx, dur) : null;
  const selectedTime = draft.date === day ? draft.time : null;

  const changeMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const getDay = (iso) => {
    const info = getDayAvailability(iso, availabilityCtx, dur);
    return {
      status: info.status,
      label: DAY_STATUS_LABEL[info.status],
      disabled: !isSelectable(info.status),
      content: info.status === 'limited' ? <span className="cal__mark" aria-hidden="true" /> : null,
    };
  };

  const pickDay = (iso) => {
    setDay(iso);
    setShowError(false);
    if (draft.date !== iso) dispatch({ type: 'setSlot', date: iso, time: null });
  };

  const next = () => {
    if (!draft.date || !draft.time) {
      setShowError(true);
      return;
    }
    navigate(stepPath(brand.id, 'datos'));
  };

  return (
    <BookingShell
      brand={brand}
      step={2}
      eyebrow={`Plan: ${plan.name}`}
      title={isWedding ? 'Fecha de tu boda' : 'Elige fecha y hora'}
      intro={
        isWedding
          ? `Selecciona el día del evento y la hora de inicio. Tu cobertura total es de ${formatDuration(dur)}.`
          : `Tu sesión dura ${formatDuration(dur)}${quote.extraMinutes ? ` (${formatDuration(quote.baseDurationMin)} del plan + ${formatDuration(quote.extraMinutes)} adicionales)` : ''}. Solo se muestran los horarios en los que cabe completa.`
      }
      aside={<OrderSummary brand={brand} plan={plan} quote={quote} date={draft.date} time={draft.time} />}
      footer={
        <StepActions
          backTo={stepPath(brand.id, 'extras')}
          onNext={next}
          nextLabel="Continuar"
          total={quote.total}
          currency={brand.currency}
        />
      }
    >
      <DemoNotice>
        Disponibilidad simulada para el prototipo. No representa la agenda real ni está conectada a Google Calendar.
      </DemoNotice>
      {agendaError && (
        <p className="callout" role="alert">
          No pudimos consultar la agenda en este momento. Puedes elegir un horario: lo confirmaremos al enviar tu solicitud.
        </p>
      )}

      <div className="schedule">
        <div className="schedule__cal">
          <MonthCalendar
            year={cursor.y}
            month={cursor.m}
            onMonthChange={changeMonth}
            canPrev={canPrev}
            canNext={canNext}
            getDay={getDay}
            selected={day}
            onSelect={pickDay}
          />
          <ul className="legend" aria-label="Leyenda del calendario">
            <li><span className="legend__sw legend__sw--available" /> Disponible</li>
            <li><span className="legend__sw legend__sw--limited" /> Pocos horarios</li>
            <li><span className="legend__sw legend__sw--off" /> No disponible</li>
          </ul>
          {isWedding && <p className="muted small">Las bodas se reservan con al menos {rules.minNoticeDays} días de antelación.</p>}
        </div>

        <div className="schedule__slots" aria-live="polite">
          {!day ? (
            <p className="slots__hint">Elige un día en el calendario para ver los horarios.</p>
          ) : (
            <fieldset className="slots">
              <legend className="slots__title">{formatLongDate(day)}</legend>
              {dayInfo && isSelectable(dayInfo.status) ? (
                <div className="slots__grid">
                  {dayInfo.slots.map((s) => (
                    <label key={s.time} className={`slot ${!s.available ? 'is-off' : ''} ${selectedTime === s.time ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="slot"
                        value={s.time}
                        disabled={!s.available}
                        checked={selectedTime === s.time}
                        onChange={() => {
                          dispatch({ type: 'setSlot', date: day, time: s.time });
                          setShowError(false);
                        }}
                      />
                      <span>{formatTime(s.time)}</span>
                      <span className="slot__end">hasta {formatTime(s.end)}</span>
                      {!s.available && <span className="slot__off">Ocupado</span>}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted">Este día ya no tiene horarios. Elige otra fecha.</p>
              )}
            </fieldset>
          )}
          {showError && (
            <p className="field__error" role="alert">
              <span aria-hidden="true">!</span> {day ? 'Selecciona un horario para continuar.' : 'Selecciona una fecha y un horario para continuar.'}
            </p>
          )}
          <p className="muted small">
            La fecha queda <strong>solicitada</strong>, no reservada, hasta que el equipo confirme tu pago.
          </p>
        </div>
      </div>
    </BookingShell>
  );
}
