// Utilidades de fecha. Se trabaja con cadenas locales 'YYYY-MM-DD' para evitar
// desfases de zona horaria (la marca opera en America/Santo_Domingo, UTC-4).

const pad = (n) => String(n).padStart(2, '0');

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISODate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const isSameDay = (a, b) => toISODate(a) === toISODate(b);

/** Matriz de semanas (lunes primero) para un mes dado. Celdas fuera del mes = null. */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
export const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const formatMonthYear = (year, month) =>
  new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));

export const formatLongDate = (iso) =>
  new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    parseISODate(iso)
  );

export const formatShortDate = (iso) =>
  new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseISODate(iso));

export const formatDateTime = (isoDateTime) =>
  new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoDateTime)
  );

/** '14:00' → '2:00 p. m.' */
export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(d);
};
