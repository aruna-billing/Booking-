const CURRENCY_LABEL = { DOP: 'RD$', USD: 'US$' };

/** Formatea un importe entero con el prefijo de moneda de la marca: RD$ 9,800 · US$ 2,400 */
export function formatMoney(amount, currency = 'DOP') {
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount || 0);
  return `${CURRENCY_LABEL[currency] ?? currency} ${n}`;
}

export const formatDuration = (min) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const initials = (first = '', last = '') => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

export const shortId = (id) => id.replace(/^req-/, '').toUpperCase();
