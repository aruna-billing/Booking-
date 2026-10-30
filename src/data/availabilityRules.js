// Reglas de agenda (ejemplo). La disponibilidad que ve el cliente se genera a partir
// de estas reglas + ocupación simulada; NO refleja la agenda real ni Google Calendar.

export const availabilityRules = {
  'morel-estudio': {
    mode: 'timed',
    workingDays: [0, 1, 2, 3, 4, 5, 6], // todos los días, domingos incluidos (se cambia en Calendario)
    openTime: '08:00',
    closeTime: '21:00',
    startStepMin: 30,
    bufferMin: 15,
    breaks: [], // sin pausa de almuerzo; se pueden añadir pausas en Calendario
    defaultDurationMin: 30,
    maxBookingsPerDay: 12,
    minNoticeDays: 1,
    maxAdvanceDays: 90,
    simulatedAnchors: ['09:30', '11:00', '15:00', '16:30'],
    simulatedOccupancy: 0.3,
  },
};

export const blockedDateOffsets = {
  'morel-estudio': [{ offset: 11, reason: 'Producción externa' }],
};
