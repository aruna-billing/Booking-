// DATOS DE DEMOSTRACIÓN — solicitudes de reserva ficticias.
// Personas, correos y teléfonos inventados (dominio .example y números 555). Solo modo demo.
// Las fechas se generan relativas a hoy para que el prototipo siempre se vea "vivo".

import { plans, extras } from './catalog.js';
import { brands } from './brands.js';
import { addDays, today, toISODate } from '../lib/date.js';
import { computeQuote } from '../lib/pricing.js';

const B = 'elian-lopez-photo';
// shot / delivered = días relativos a hoy en que fue la boda / se entregó la galería.
const seeds = [
  // Solicitudes por decidir
  { id: 'req-1048', brandId: B, created: -0.2, status: 'pending_review', payment: 'submitted', first: 'Mariela', last: 'Ventura', planId: 'el-clasica', extras: { 'el-x-segundo': 1, 'el-x-hora': 2 }, day: 96, time: '15:00', notes: 'Boda en una finca en Jarabacoa, unos 120 invitados. Nos gustan las fotos espontáneas.', insp: 3 },
  { id: 'req-1047', brandId: B, created: -0.6, status: 'pending_review', payment: 'submitted', first: 'Andrés', last: 'Peralta', planId: 'el-intima', extras: { 'el-x-preboda': 1 }, day: 70, time: '10:00', notes: 'Boda civil con 20 personas.', insp: 1 },
  { id: 'req-1046', brandId: B, created: -1.1, status: 'pending_review', payment: 'submitted', first: 'Luisa', last: 'Almonte', planId: 'el-editorial', extras: { 'el-x-hora': 1 }, day: 120, time: '16:00', notes: 'Boda en la playa al atardecer.', insp: 2 },
  { id: 'req-1045', brandId: B, created: -1.8, status: 'awaiting_payment', payment: 'rejected', first: 'Carolina', last: 'Reyes', planId: 'el-editorial', extras: {}, day: 140, time: '16:00', notes: '', insp: 0, rejection: 'El monto del comprobante no coincide con el anticipo requerido.' },
  // Reservado (antes de la boda)
  { id: 'req-1044', brandId: B, created: -40, status: 'confirmed', payment: 'verified', first: 'Gabriela', last: 'Núñez', planId: 'el-editorial', extras: { 'el-x-padres': 2 }, day: 5, time: '10:00', notes: 'Boda íntima frente al mar en Samaná.', insp: 4 },
  { id: 'req-1043', brandId: B, created: -60, status: 'confirmed', payment: 'verified', first: 'José', last: 'Tavárez', planId: 'el-clasica', extras: { 'el-x-expres': 1 }, day: 33, time: '15:00', notes: '', insp: 1 },
  { id: 'req-1049', brandId: B, created: -90, status: 'confirmed', payment: 'verified', first: 'Jorge', last: 'Liriano', planId: 'el-clasica', extras: {}, day: -1, time: '16:00', notes: '', insp: 0 },
  // Boda realizada · en edición
  { id: 'req-1040', brandId: B, created: -120, status: 'completed', payment: 'verified', first: 'Daniela', last: 'Cruz', planId: 'el-intima', extras: {}, day: -9, time: '10:00', notes: '', insp: 1, shot: -9 },
  { id: 'req-1036', brandId: B, created: -150, status: 'completed', payment: 'verified', first: 'Manuel', last: 'Rosario', planId: 'el-clasica', extras: { 'el-x-hora': 1 }, day: -50, time: '15:00', notes: '', insp: 0, shot: -50 },
  // Entregado
  { id: 'req-1038', brandId: B, created: -200, status: 'completed', payment: 'verified', first: 'Natalia', last: 'Guzmán', planId: 'el-editorial', extras: {}, day: -60, time: '10:00', notes: '', insp: 0, shot: -60, delivered: -20 },
  { id: 'req-1035', brandId: B, created: -240, status: 'completed', payment: 'verified', first: 'Laura', last: 'Batista', planId: 'el-clasica', extras: {}, day: -110, time: '16:00', notes: '', insp: 0, shot: -110, delivered: -70 },
  // Cancelada
  { id: 'req-1039', brandId: B, created: -16, status: 'cancelled', payment: 'none', first: 'Héctor', last: 'Polanco', planId: 'el-intima', extras: {}, day: 80, time: '10:00', notes: 'Cambiaron de fecha.', insp: 0 },
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
