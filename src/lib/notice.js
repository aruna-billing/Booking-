// Antelación mínima para reservar: en días o en horas (reglas de agenda de cada marca).
//
//  · minNoticeUnit 'days' (o sin definir) → minNoticeDays: desde qué día se puede reservar
//    (0 = hoy, 1 = desde mañana…).
//  · minNoticeUnit 'hours'                → minNoticeHours: el horario tiene que empezar al
//    menos esas horas después de ahora (3 = no se reserva con menos de 3 horas).
// Hoy nunca se ofrecen horarios que ya pasaron.

export const noticeUnit = (rules) => (rules?.minNoticeUnit === 'hours' ? 'hours' : 'days');
export const noticeDays = (rules) => Math.max(0, Math.round(Number(rules?.minNoticeDays) || 0));
export const noticeHours = (rules) => Math.max(0, Math.round(Number(rules?.minNoticeHours) || 0));

/** Primer momento en que puede empezar una sesión (Date), según la antelación. */
export function noticeCutoff(rules, now = new Date()) {
  if (noticeUnit(rules) === 'hours') return new Date(now.getTime() + noticeHours(rules) * 3600e3);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + noticeDays(rules));
  return noticeDays(rules) === 0 ? now : d;
}

/** Primer día (a medianoche) en que hay algo reservable. */
export function firstNoticeDate(rules, now = new Date()) {
  const c = noticeCutoff(rules, now);
  return new Date(c.getFullYear(), c.getMonth(), c.getDate());
}

/** Antelación en días (para comparar con «Reservable hasta»). */
export const noticeInDays = (rules) => (noticeUnit(rules) === 'hours' ? noticeHours(rules) / 24 : noticeDays(rules));

/** «3 días», «1 día», «5 horas», «1 hora». */
export function noticeLabel(rules) {
  if (noticeUnit(rules) === 'hours') {
    const h = noticeHours(rules);
    return `${h} hora${h === 1 ? '' : 's'}`;
  }
  const d = noticeDays(rules);
  return `${d} día${d === 1 ? '' : 's'}`;
}
