// Reservas que ocupan agenda para calcular la disponibilidad.
// En modo real el público no puede leer las solicitudes: solo recibe los horarios
// ocupados (fecha, hora y duración) desde get_busy_slots. Aquí se combinan ambos.
export function agendaRequests(state, brandId) {
  const busy = (state.busy?.[brandId] ?? []).map((b) => ({
    id: `busy-${b.date}-${b.time}`,
    brandId,
    date: b.date,
    time: b.time,
    status: 'confirmed',
    quote: { durationMin: b.durationMin },
  }));
  return busy.length ? [...state.requests, ...busy] : state.requests;
}
