// Cargos añadidos por el equipo después de la reserva («+3 fotos», «retoque especial»…).
// Se guardan como líneas más de la cotización (quote.lines) con source: 'admin', y la
// cotización se recalcula: total, saldo y duración. El anticipo no cambia y el
// descuento de un cupón tampoco (el cargo se cobra completo).

/** Recalcula los totales de una cotización a partir de sus líneas. */
export function recomputeQuote(q) {
  const lines = q.lines ?? [];
  const extrasTotal = lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const extraMinutes = lines.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
  const subtotal = (Number(q.planPrice) || 0) + extrasTotal;
  const discount = Math.min(subtotal, Number(q.discount) || 0);
  const total = subtotal - discount;
  const deposit = Number(q.deposit) || 0;
  const base = Number(q.baseDurationMin) || 0;
  return { ...q, lines, extrasTotal, subtotal, discount, total, balance: Math.max(0, total - deposit), extraMinutes, durationMin: base + extraMinutes };
}

/**
 * Línea de cargo a partir de un extra del catálogo o de un concepto libre.
 * @param {{ extra?, qty?, name?, amount?, by?, at? }} input
 */
export function chargeLine({ extra, qty = 1, name, amount, by = 'Equipo', at = new Date().toISOString() }) {
  const id = `charge-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  if (extra) {
    const units = Math.max(1, Math.floor(Number(qty) || 1));
    const unit = Math.round(Number(extra.price) || 0);
    return { id, extraId: extra.id, name: extra.name, unitPrice: unit, quantity: units, total: unit * units, minutes: (Number(extra.addsMinutes) || 0) * units, source: 'admin', addedBy: by, addedAt: at };
  }
  const total = Math.round(Number(amount) || 0);
  return { id, name: String(name ?? '').trim(), unitPrice: total, quantity: 1, total, minutes: 0, source: 'admin', addedBy: by, addedAt: at };
}

/** Validación del formulario «Agregar cargo». */
export function validateCharge({ mode, extra, qty, name, amount }) {
  const e = {};
  if (mode === 'extra') {
    if (!extra) e.extra = 'Elige un extra.';
    if (!(Number.isInteger(Number(qty)) && Number(qty) >= 1 && Number(qty) <= 99)) e.qty = 'Cantidad entre 1 y 99.';
  } else {
    if (!String(name ?? '').trim()) e.name = 'Escribe el concepto.';
    if (!(Math.round(Number(amount)) > 0)) e.amount = 'Escribe un monto mayor que 0.';
  }
  return e;
}

// ───────── Cargos propuestos por un asistente ─────────
// El asistente no toca la cotización: su cargo queda en r.pendingCharges hasta que un
// administrador lo aprueba (pasa a quote.lines) o lo rechaza (se quita y queda en el historial).

/** Cargos que esperan aprobación. */
export const pendingChargesOf = (r) => (r?.pendingCharges ?? []).filter((c) => c && c.id);

/** Línea propuesta: igual que un cargo, más quién la propuso, cuándo y una nota opcional. */
export function proposedChargeLine({ extra, qty, name, amount, note = '', by = 'Equipo', at = new Date().toISOString() }) {
  const line = chargeLine({ extra, qty, name, amount, by, at });
  return { ...line, id: line.id.replace('charge-', 'prop-'), status: 'pending', proposedBy: by, proposedAt: at, note: String(note ?? '').trim().slice(0, 300) };
}

/** Convierte un cargo propuesto en línea de la cotización al aprobarlo. */
export function approvedLine(p, { by = 'Equipo', at = new Date().toISOString() } = {}) {
  const { status: _s, proposedBy, proposedAt, note, ...rest } = p;
  return { ...rest, id: rest.id.replace('prop-', 'charge-'), source: 'admin', addedBy: proposedBy ?? rest.addedBy, addedAt: proposedAt ?? rest.addedAt, approvedBy: by, approvedAt: at, ...(note ? { note } : {}) };
}

/** Texto corto para historial y avisos: «Foto adicional × 3». */
export const chargeLabel = (l) => `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''}`;
