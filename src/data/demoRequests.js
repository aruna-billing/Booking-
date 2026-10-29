// DATOS DE DEMOSTRACIÓN — solicitudes de reserva ficticias.
// Personas, correos y teléfonos inventados (dominio .example y números 555).
// Las fechas se generan relativas a hoy para que el prototipo siempre se vea "vivo".

import { plans, extras } from './catalog.js';
import { brands } from './brands.js';
import { addDays, today, toISODate } from '../lib/date.js';
import { computeQuote } from '../lib/pricing.js';

const B = 'morel-estudio';
// shot / delivered = días relativos a hoy en que se hicieron las fotos / se entregaron.
const seeds = [
  // Solicitudes por decidir
  { id: 'req-1048', brandId: B, created: -0.2, status: 'pending_review', payment: 'submitted', first: 'Mariela', last: 'Ventura', planId: 'me-pro', extras: { 'me-x-foto': 2 }, day: 6, time: '10:00', notes: 'Fotos para mi perfil profesional y redes. Me gustaría un fondo claro.', insp: 2 },
  { id: 'req-1047', brandId: B, created: -0.6, status: 'pending_review', payment: 'submitted', first: 'Andrés', last: 'Peralta', planId: 'me-estandar', extras: {}, day: 4, time: '15:00', notes: 'Retrato corporativo para la web de mi empresa.', insp: 1 },
  { id: 'req-1046', brandId: B, created: -1.1, status: 'pending_review', payment: 'submitted', first: 'Luisa', last: 'Almonte', planId: 'me-pro', extras: { 'me-x-30min': 1 }, day: 8, time: '11:00', notes: 'Quiero dos cambios de ropa y un look formal.', insp: 3 },
  { id: 'req-1045', brandId: B, created: -1.8, status: 'awaiting_payment', payment: 'rejected', first: 'Carolina', last: 'Reyes', planId: 'me-estandar', extras: {}, day: 12, time: '09:30', notes: '', insp: 0, rejection: 'El monto del comprobante no coincide con el anticipo requerido.' },
  { id: 'req-1041', brandId: B, created: -3, status: 'awaiting_payment', payment: 'none', first: 'Ricardo', last: 'Méndez', planId: 'me-pro', extras: {}, day: 15, time: '16:00', notes: 'Fotos para casting.', insp: 0 },
  // Reservado (antes de la sesión)
  { id: 'req-1044', brandId: B, created: -4, status: 'confirmed', payment: 'verified', first: 'Gabriela', last: 'Núñez', planId: 'me-pro', extras: { 'me-x-impresa': 2 }, day: 2, time: '10:00', notes: 'Sesión de cumpleaños.', insp: 2 },
  { id: 'req-1043', brandId: B, created: -5, status: 'confirmed', payment: 'verified', first: 'José', last: 'Tavárez', planId: 'me-estandar', extras: { 'me-x-expres': 1 }, day: 3, time: '14:00', notes: 'Necesito las fotos rápido para un evento.', insp: 1 },
  { id: 'req-1042', brandId: B, created: -6, status: 'confirmed', payment: 'verified', first: 'Paola', last: 'Santos', planId: 'me-estandar', extras: {}, day: 0, time: '16:30', notes: '', insp: 0 },
  { id: 'req-1049', brandId: B, created: -9, status: 'confirmed', payment: 'verified', first: 'Jorge', last: 'Liriano', planId: 'me-pro', extras: {}, day: -1, time: '11:00', notes: 'Retratos para LinkedIn.', insp: 0 },
  // Fotos realizadas · en edición
  { id: 'req-1040', brandId: B, created: -14, status: 'completed', payment: 'verified', first: 'Daniela', last: 'Cruz', planId: 'me-estandar', extras: { 'me-x-foto': 1 }, day: -3, time: '09:00', notes: '', insp: 1, shot: -3 },
  { id: 'req-1031', brandId: B, created: -22, status: 'completed', payment: 'verified', balanceUnpaid: true, first: 'Tomás', last: 'Reynoso', planId: 'me-pro', extras: { 'me-x-foto': 2 }, day: -12, time: '10:00', notes: 'Pagará el saldo al recibir las fotos.', insp: 0, shot: -12 },
  { id: 'req-1036', brandId: B, created: -28, status: 'completed', payment: 'verified', first: 'Manuel', last: 'Rosario', planId: 'me-pro', extras: {}, day: -19, time: '16:00', notes: '', insp: 0, shot: -19 },
  // Entregado
  { id: 'req-1038', brandId: B, created: -40, status: 'completed', payment: 'verified', first: 'Natalia', last: 'Guzmán', planId: 'me-pro', extras: { 'me-x-30min': 1 }, day: -30, time: '10:00', notes: '', insp: 0, shot: -30, delivered: -20 },
  { id: 'req-1037', brandId: B, created: -48, status: 'completed', payment: 'verified', first: 'Camila', last: 'Brito', planId: 'me-estandar', extras: { 'me-x-expres': 1 }, day: -35, time: '15:00', notes: '', insp: 0, shot: -35, delivered: -33 },
  { id: 'req-1035', brandId: B, created: -75, status: 'completed', payment: 'verified', first: 'Laura', last: 'Batista', planId: 'me-pro', extras: {}, day: -66, time: '14:00', notes: '', insp: 0, shot: -66, delivered: -54 },
  { id: 'req-1034', brandId: B, created: -95, status: 'completed', payment: 'verified', first: 'Pedro', last: 'Jiménez', planId: 'me-estandar', extras: {}, day: -88, time: '09:00', notes: '', insp: 0, shot: -88, delivered: -77 },
  { id: 'req-1032', brandId: B, created: -125, status: 'completed', payment: 'verified', first: 'Irene', last: 'Castillo', planId: 'me-pro', extras: { 'me-x-impresa': 1 }, day: -118, time: '11:00', notes: '', insp: 0, shot: -118, delivered: -106 },
  // Cancelada
  { id: 'req-1039', brandId: B, created: -16, status: 'cancelled', payment: 'none', first: 'Héctor', last: 'Polanco', planId: 'me-estandar', extras: {}, day: 9, time: '09:00', notes: 'Canceló por viaje.', insp: 0 },
];

const fakeFile = (prefix, i, type = 'image/jpeg') => ({
  name: `${prefix}-${String(i + 1).padStart(2, '0')}.${type === 'application/pdf' ? 'pdf' : 'jpg'}`,
  size: 380000 + i * 91000,
  type,
});

export function buildDemoRequests() {
  const base = today();
  return seeds.map((s) => {
    const brand = brands.find((b) => b.id === s.brandId);
    const plan = plans.find((p) => p.id === s.planId);
    const quote = computeQuote({ plan, extras, selection: s.extras, depositPercent: brand.depositPercent });
    const createdAt = new Date(Date.now() + s.created * 86400000).toISOString();
    const hasReceipt = s.payment !== 'none';
    const history = [{ at: createdAt, label: 'Solicitud recibida desde el formulario público', by: 'Sistema (demo)' }];
    if (hasReceipt) history.push({ at: createdAt, label: 'Comprobante adjuntado por el cliente', by: 'Cliente' });
    if (s.payment === 'verified') history.push({ at: createdAt, label: 'Pago verificado', by: 'Admin demo' });
    if (s.payment === 'rejected') history.push({ at: createdAt, label: `Comprobante rechazado: ${s.rejection}`, by: 'Admin demo' });
    if (s.status === 'confirmed' || s.status === 'completed') history.push({ at: createdAt, label: 'Reserva confirmada', by: 'Admin demo' });
    const dayIso = (off) => new Date(Date.now() + off * 86400000).toISOString();
    if (s.shot !== undefined) history.push({ at: dayIso(s.shot), label: 'Fotos realizadas', by: 'Admin demo' });
    if (s.delivered !== undefined) history.push({ at: dayIso(s.delivered), label: 'Fotos entregadas al cliente', by: 'Admin demo' });
    if (s.status === 'cancelled') history.push({ at: createdAt, label: 'Reserva cancelada', by: 'Admin demo' });

    // Pagos registrados (demo). Solo los «verified» cuentan como recibidos.
    const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString();
    const payments = [];
    if (s.payment !== 'none') {
      payments.push({
        id: `${s.id}-p1`,
        amount: quote.deposit,
        method: 'transfer',
        concept: 'deposit',
        date: createdAt.slice(0, 10),
        reference: hasReceipt ? 'Comprobante adjunto' : '',
        status: s.payment === 'verified' ? 'verified' : s.payment === 'rejected' ? 'rejected' : 'pending',
        source: 'client',
        createdAt,
      });
    }
    (s.extraPayments ?? []).forEach((x, i) =>
      payments.push({ id: `${s.id}-x${i}`, amount: x.amount, method: x.method, concept: 'partial', date: iso(s.created + x.daysAfterCreated).slice(0, 10), reference: x.reference, status: 'verified', source: 'admin', createdAt: iso(s.created + x.daysAfterCreated) })
    );
    if (s.status === 'completed' && !s.balanceUnpaid) {
      const paidSoFar = payments.filter((p) => p.status === 'verified').reduce((a, p) => a + p.amount, 0);
      const dueOffset = s.day; // el total se liquida el día de la sesión
      payments.push({ id: `${s.id}-bal`, amount: quote.total - paidSoFar, method: 'cash', concept: 'balance', date: iso(dueOffset).slice(0, 10), reference: '', status: 'verified', source: 'admin', createdAt: iso(dueOffset) });
    }

    return {
      id: s.id,
      payments,
      brandId: s.brandId,
      createdAt,
      status: s.status,
      paymentStatus: s.payment,
      paymentRejectionReason: s.rejection ?? null,
      client: {
        firstName: s.first,
        lastName: s.last,
        email: `${s.first.toLowerCase()}.${s.last.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@correo.example`,
        phone: `+1 809 555 0${s.id.slice(-3)}`,
      },
      notes: s.notes,
      inspirationFiles: Array.from({ length: s.insp }, (_, i) => fakeFile('inspiracion', i)),
      planId: plan.id,
      planName: plan.name,
      currency: brand.currency,
      quote,
      date: toISODate(addDays(base, s.day)),
      time: s.time,
      receipt: hasReceipt
        ? { ...fakeFile('comprobante', 0, s.id.endsWith('7') ? 'application/pdf' : 'image/jpeg'), uploadedAt: createdAt, declaredAmount: quote.deposit }
        : null,
      acceptedTermsVersion: '0.1-demo',
      confirmedAt: ['confirmed', 'completed'].includes(s.status) ? createdAt : null,
      shotAt: s.shot !== undefined ? toISODate(addDays(base, s.shot)) : null,
      deliveredAt: s.delivered !== undefined ? toISODate(addDays(base, s.delivered)) : null,
      galleryUrl: s.delivered !== undefined ? `https://galeria.example/${s.id}` : '',
      history,
      internalNotes: [],
      isDemoSeed: true,
    };
  });
}
