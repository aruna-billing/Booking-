// Validación de las reglas de agenda que se editan en Calendario. Función pura.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Devuelve { campo: mensaje }; vacío = válido. */
export function validateRules(r) {
  const e = {};
  if (!r.workingDays?.length) e.workingDays = 'Elige al menos un día de trabajo.';
  if (r.mode === 'exclusive_day') {
    if (!r.startTimes?.length || r.startTimes.some((t) => !HHMM.test(t))) e.startTimes = 'Escribe al menos una hora de inicio válida (ej.: 10:00).';
  } else {
    if (!HHMM.test(r.openTime ?? '')) e.openTime = 'Hora no válida.';
    if (!HHMM.test(r.closeTime ?? '')) e.closeTime = 'Hora no válida.';
    if (!e.openTime && !e.closeTime && toMin(r.closeTime) - toMin(r.openTime) < 15) e.closeTime = 'El cierre debe ser después de la apertura.';
    (r.breaks ?? []).forEach((b, i) => {
      if (!HHMM.test(b.start ?? '') || !HHMM.test(b.end ?? '') || toMin(b.end) <= toMin(b.start)) e[`break${i}`] = 'La pausa debe terminar después de empezar.';
      else if (!e.openTime && !e.closeTime && (toMin(b.start) < toMin(r.openTime) || toMin(b.end) > toMin(r.closeTime))) e[`break${i}`] = 'La pausa debe estar dentro del horario.';
    });
    if (![15, 20, 30, 45, 60].includes(Number(r.startStepMin))) e.startStepMin = 'Elige un intervalo.';
    if (!(Number(r.bufferMin) >= 0 && Number(r.bufferMin) <= 180)) e.bufferMin = 'Entre 0 y 180 minutos.';
  }
  if (!(Number(r.maxBookingsPerDay) >= 1 && Number(r.maxBookingsPerDay) <= 50)) e.maxBookingsPerDay = 'Entre 1 y 50.';
  const hours = r.minNoticeUnit === 'hours';
  if (hours) {
    if (!(Number.isInteger(Number(r.minNoticeHours)) && Number(r.minNoticeHours) >= 0 && Number(r.minNoticeHours) <= 720)) e.minNotice = 'Entre 0 y 720 horas (30 días).';
  } else if (!(Number.isInteger(Number(r.minNoticeDays)) && Number(r.minNoticeDays) >= 0 && Number(r.minNoticeDays) <= 60)) e.minNotice = 'Entre 0 y 60 días.';
  const noticeDays = hours ? Number(r.minNoticeHours) / 24 : Number(r.minNoticeDays);
  if (!(Number(r.maxAdvanceDays) >= 7 && Number(r.maxAdvanceDays) <= 730)) e.maxAdvanceDays = 'Entre 7 y 730 días (2 años).';
  else if (!e.minNotice && Number(r.maxAdvanceDays) <= noticeDays) e.maxAdvanceDays = 'Debe ser mayor que la antelación mínima.';
  return e;
}

/** Normaliza números y ordena días y pausas antes de guardar. */
export function cleanRules(r) {
  const out = {
    ...r,
    workingDays: [...new Set(r.workingDays.map(Number))].sort((a, b) => a - b),
    maxBookingsPerDay: Number(r.maxBookingsPerDay),
    minNoticeUnit: r.minNoticeUnit === 'hours' ? 'hours' : 'days',
    minNoticeDays: Number(r.minNoticeDays) || 0,
    minNoticeHours: Number(r.minNoticeHours) || 0,
    maxAdvanceDays: Number(r.maxAdvanceDays),
  };
  if (r.mode !== 'exclusive_day') {
    out.startStepMin = Number(r.startStepMin);
    out.bufferMin = Number(r.bufferMin);
    out.breaks = (r.breaks ?? []).map((b) => ({ start: b.start, end: b.end, label: (b.label ?? '').trim() || 'Pausa' })).sort((a, b) => a.start.localeCompare(b.start));
  }
  return out;
}
