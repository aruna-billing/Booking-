// Reglas de agenda de partida (se cambian en el panel → Calendario).
// Bodas: una por día; el cliente elige el día y la hora de inicio.
// En la DEMO (sin Supabase) se añade una ocupación simulada; en el sitio real nunca.

export const availabilityRules = {
  'elian-lopez-photo': {
    mode: 'exclusive_day',
    workingDays: [0, 1, 2, 3, 4, 5, 6], // todos los días, domingos incluidos
    startTimes: ['09:00', '10:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    defaultDurationMin: 480,
    maxBookingsPerDay: 1,
    minNoticeDays: 30,
    maxAdvanceDays: 540,
    simulatedOccupancy: 0.3,
  },
};

export const blockedDateOffsets = {
  'elian-lopez-photo': [{ offset: 45, reason: 'Boda fuera del país' }],
};
