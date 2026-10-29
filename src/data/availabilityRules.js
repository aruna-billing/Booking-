// Reglas de agenda (ejemplo). La disponibilidad que ve el cliente se genera a partir
// de estas reglas + ocupación simulada; NO refleja la agenda real ni Google Calendar.

export const availabilityRules = {
  'morel-estudio': {
    mode: 'timed',
    workingDays: [1, 2, 3, 4, 5, 6], // lunes a sábado (ejemplo)
    openTime: '09:00',
    closeTime: '18:00',
    startStepMin: 30,
    bufferMin: 15,
    breaks: [{ start: '13:00', end: '14:00', label: 'Almuerzo' }],
    defaultDurationMin: 30,
    maxBookingsPerDay: 8,
    minNoticeDays: 1,
    maxAdvanceDays: 90,
    simulatedAnchors: ['09:30', '11:00', '15:00', '16:30'],
    simulatedOccupancy: 0.3,
  },
};

export const blockedDateOffsets = {
  'morel-estudio': [{ offset: 11, reason: 'Producción externa' }],
};
