// Cálculos financieros. Funciones puras: en producción se replicarán como vistas
// o funciones SQL en Supabase (ver docs/INTEGRACION.md).
//
// Definiciones (las mismas que muestra la pantalla de Finanzas):
//  · Facturado        = total de reservas confirmadas o completadas.
//  · Recibido         = pagos VERIFICADOS (anticipos, abonos y saldos).
//  · Falta por cobrar = facturado − recibido de esas reservas. Vence el día de la sesión.
//  · Por verificar    = pagos que el cliente reportó y aún no se revisan.
//  · Por confirmar    = total de solicitudes en revisión o esperando pago (aún no facturado).

import { toISODate, today } from './date.js';

export const PAYMENT_METHODS = {
  transfer: 'Transferencia',
  deposit: 'Depósito bancario',
  cash: 'Efectivo',
  other: 'Otro',
};

export const PAYMENT_CONCEPTS = {
  deposit: 'Anticipo',
  full: 'Pago total',
  partial: 'Abono',
  balance: 'Saldo final',
  other: 'Otro',
};

export const PAYMENT_RECORD_STATUS = {
  verified: { label: 'Recibido', tone: 'green' },
  pending: { label: 'Por verificar', tone: 'amber' },
  rejected: { label: 'Rechazado', tone: 'red' },
  void: { label: 'Anulado', tone: 'neutral' },
};

export const COLLECTION_STATUS = {
  unpaid: { label: 'Sin pagos', tone: 'neutral' },
  partial: { label: 'Pago parcial', tone: 'amber' },
  deposit: { label: 'Anticipo pagado', tone: 'amber' },
  paid: { label: 'Pagado completo', tone: 'green' },
  cancelled: { label: 'No aplica', tone: 'neutral' },
};

const BILLABLE = ['confirmed', 'completed'];
const PIPELINE = ['pending_review', 'awaiting_payment'];

const sum = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
const payments = (r) => r.payments ?? [];

export const paidAmount = (r) => sum(payments(r).filter((p) => p.status === 'verified'), (p) => p.amount);
export const pendingAmount = (r) => sum(payments(r).filter((p) => p.status === 'pending'), (p) => p.amount);
export const balanceDue = (r) => (r.status === 'cancelled' ? 0 : Math.max(0, r.quote.total - paidAmount(r)));

export function collectionStatus(r) {
  if (r.status === 'cancelled') return 'cancelled';
  const paid = paidAmount(r);
  if (paid >= r.quote.total) return 'paid';
  if (paid === 0) return 'unpaid';
  if (paid === r.quote.deposit) return 'deposit';
  return 'partial';
}

/** Fecha límite del pago total: el día de la sesión (o del evento), para todas las marcas. */
export const balanceDueDate = (r) => r.date;

export const isOverdue = (r, ref = toISODate(today())) => balanceDue(r) > 0 && BILLABLE.includes(r.status) && balanceDueDate(r) < ref;

/** Rango de fechas ISO [from, to] para un periodo con nombre. `null` = sin límite. */
export function periodRange(period, ref = today()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const iso = (d) => toISODate(d);
  switch (period) {
    case 'month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case '3m':
      return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    default:
      return { from: null, to: null };
  }
}

const inRange = (d, { from, to }) => (!from || d >= from) && (!to || d <= to);

/** Resumen de un conjunto de solicitudes de UNA moneda. */
export function summarize(requests, range = { from: null, to: null }, ref = toISODate(today())) {
  const billable = requests.filter((r) => BILLABLE.includes(r.status) && inRange(r.date, range));
  const billed = sum(billable, (r) => r.quote.total);
  const receivedPayments = requests.flatMap((r) => payments(r).filter((p) => p.status === 'verified' && inRange(p.date, range)));
  const received = sum(receivedPayments, (p) => p.amount);
  const collectedOnBilled = sum(billable, paidAmount);
  const outstanding = sum(billable, balanceDue);
  const overdue = sum(billable.filter((r) => isOverdue(r, ref)), balanceDue);
  const pendingVerification = sum(requests.filter((r) => r.status !== 'cancelled'), pendingAmount);
  const pipeline = sum(requests.filter((r) => PIPELINE.includes(r.status) && inRange(r.date, range)), (r) => r.quote.total);
  return {
    billed,
    received,
    outstanding,
    overdue,
    pendingVerification,
    pipeline,
    collectedPct: billed ? Math.round((collectedOnBilled / billed) * 100) : 0,
    billableCount: billable.length,
    paymentsCount: receivedPayments.length,
  };
}

/** Serie mensual (últimos `n` meses, incluido el actual): facturado por fecha de sesión, recibido por fecha de pago. */
export function monthlySeries(requests, n = 6, ref = today()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0);
    const range = { from: toISODate(start), to: toISODate(end) };
    const billed = sum(requests.filter((r) => BILLABLE.includes(r.status) && inRange(r.date, range)), (r) => r.quote.total);
    const received = sum(
      requests.flatMap((r) => payments(r).filter((p) => p.status === 'verified' && inRange(p.date, range))),
      (p) => p.amount
    );
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    out.push({
      key: range.from.slice(0, 7),
      label: cap(new Intl.DateTimeFormat('es-DO', { month: 'short' }).format(start).replace('.', '')),
      longLabel: cap(new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' }).format(start)),
      billed,
      received,
    });
  }
  return out;
}

/** Concepto sugerido para un nuevo pago. */
export function suggestConcept(r, amount) {
  const paid = paidAmount(r);
  if (paid === 0 && amount >= r.quote.total) return 'full';
  if (paid === 0 && amount <= r.quote.deposit) return 'deposit';
  if (paid + amount >= r.quote.total) return 'balance';
  return 'partial';
}
