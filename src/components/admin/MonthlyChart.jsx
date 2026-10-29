import { useState } from 'react';
import { formatMoney } from '../../lib/format.js';

/**
 * Columnas agrupadas por mes: Facturado vs Recibido (misma unidad, un solo eje).
 * Colores validados (CVD ΔE ≥ 24) con el validador del sistema de gráficos.
 * Incluye leyenda, tooltip al pasar/enfocar cada mes y vista de tabla.
 */
const SERIES = [
  { key: 'billed', label: 'Facturado', color: 'var(--chart-billed)' },
  { key: 'received', label: 'Recibido', color: 'var(--chart-received)' },
];

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

const compact = (n, cur) => {
  const p = cur === 'USD' ? 'US$' : 'RD$';
  if (n >= 1000) return `${p} ${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`;
  return `${p} ${n}`;
};

export function MonthlyChart({ data, currency, title }) {
  const [active, setActive] = useState(null);
  const max = niceMax(Math.max(...data.flatMap((d) => [d.billed, d.received])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <figure className="mchart">
      <figcaption className="mchart__head">
        <span className="mchart__title">{title}</span>
        <ul className="mchart__legend" aria-label="Leyenda">
          {SERIES.map((s) => (
            <li key={s.key}><span className="mchart__sw" style={{ background: s.color }} aria-hidden="true" />{s.label}</li>
          ))}
        </ul>
      </figcaption>

      <div className="mchart__plot" aria-hidden="true">
        <div className="mchart__grid">
          {ticks.slice().reverse().map((t) => (
            <div key={t} className="mchart__tick"><span>{compact(t, currency)}</span></div>
          ))}
        </div>
        <div className="mchart__cols">
          {data.map((d, i) => (
            <div
              key={d.key}
              className={`mchart__col ${active === i ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="mchart__bars">
                {SERIES.map((s) => (
                  <span key={s.key} className="mchart__bar" style={{ height: `${(d[s.key] / max) * 100}%`, background: s.color }} />
                ))}
              </div>
              <span className="mchart__label">{d.label}</span>
              {active === i && (
                <div className={`mchart__tip ${i > data.length / 2 ? 'is-left' : ''}`}>
                  <strong>{d.longLabel}</strong>
                  {SERIES.map((s) => (
                    <span key={s.key}><i style={{ background: s.color }} />{s.label}: {formatMoney(d[s.key], currency)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <details className="mchart__table">
        <summary>Ver como tabla</summary>
        <div className="table-scroll">
          <table className="table table--lines">
            <thead><tr><th scope="col">Mes</th>{SERIES.map((s) => <th key={s.key} scope="col" className="num">{s.label}</th>)}</tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}><th scope="row">{d.longLabel}</th>{SERIES.map((s) => <td key={s.key} className="num">{formatMoney(d[s.key], currency)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
