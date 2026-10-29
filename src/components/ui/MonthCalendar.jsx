import { useRef } from 'react';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, formatMonthYear, monthMatrix, toISODate } from '../../lib/date.js';

/**
 * Calendario mensual reutilizable (público y administración).
 * `getDay(iso)` → { status, label, disabled, content }
 * Navegación con flechas del teclado entre días habilitados.
 */
export function MonthCalendar({ year, month, onMonthChange, getDay, selected, onSelect, canPrev = true, canNext = true, caption }) {
  const weeks = monthMatrix(year, month);
  const gridRef = useRef(null);

  const move = (fromIso, delta) => {
    const buttons = [...gridRef.current.querySelectorAll('button[data-iso]:not([disabled])')];
    const idx = buttons.findIndex((b) => b.dataset.iso === fromIso);
    const target = buttons[idx + delta] ?? null;
    target?.focus();
  };

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="icon-btn" onClick={() => onMonthChange(-1)} disabled={!canPrev} aria-label="Mes anterior">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <h3 className="cal__title" aria-live="polite">
          {formatMonthYear(year, month)}
        </h3>
        <button type="button" className="icon-btn" onClick={() => onMonthChange(1)} disabled={!canNext} aria-label="Mes siguiente">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      {caption}
      <div className="cal__grid" ref={gridRef} role="group" aria-label={`Días de ${formatMonthYear(year, month)}`}>
        {WEEKDAYS_SHORT.map((d, i) => (
          <span key={d} className="cal__dow" aria-hidden="true" title={WEEKDAYS_LONG[i]}>
            {d}
          </span>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <span key={`e${i}`} className="cal__cell cal__cell--empty" aria-hidden="true" />;
          const iso = toISODate(date);
          const info = getDay(iso);
          const isSel = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              className={`cal__cell cal__cell--${info.status} ${isSel ? 'is-selected' : ''}`}
              disabled={info.disabled}
              aria-pressed={onSelect ? isSel : undefined}
              aria-label={`${new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}. ${info.label}`}
              onClick={() => onSelect?.(iso)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  move(iso, e.key === 'ArrowRight' ? 1 : -1);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const d = new Date(date);
                  d.setDate(d.getDate() + (e.key === 'ArrowDown' ? 7 : -7));
                  gridRef.current.querySelector(`button[data-iso="${toISODate(d)}"]:not([disabled])`)?.focus();
                }
              }}
            >
              <span className="cal__num">{date.getDate()}</span>
              {info.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
