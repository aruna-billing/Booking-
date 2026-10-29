// Pruebas de cálculos financieros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceDue, balanceDueDate, collectionStatus, isOverdue, monthlySeries, paidAmount, summarize, suggestConcept } from '../src/lib/finance.js';

const req = (o = {}) => ({
  id: 'r', brandId: 'aruna-visuals', status: 'confirmed', currency: 'DOP', date: '2026-10-20',
  quote: { total: 10000, deposit: 5000, depositPercent: 50 },
  payments: [], ...o,
});
const pay = (amount, status = 'verified', date = '2026-10-10') => ({ id: Math.random().toString(), amount, status, date, createdAt: date });

test('pagado solo cuenta pagos verificados', () => {
  const r = req({ payments: [pay(5000), pay(2000, 'pending'), pay(1000, 'void'), pay(800, 'rejected')] });
  assert.equal(paidAmount(r), 5000);
  assert.equal(balanceDue(r), 5000);
});

test('estado de cobro', () => {
  assert.equal(collectionStatus(req()), 'unpaid');
  assert.equal(collectionStatus(req({ payments: [pay(5000)] })), 'deposit');
  assert.equal(collectionStatus(req({ payments: [pay(5000), pay(1000)] })), 'partial');
  assert.equal(collectionStatus(req({ payments: [pay(10000)] })), 'paid');
  assert.equal(collectionStatus(req({ status: 'cancelled', payments: [pay(5000)] })), 'cancelled');
  assert.equal(balanceDue(req({ status: 'cancelled' })), 0);
});

test('vencimiento: el total vence el día de la sesión, también en bodas', () => {
  assert.equal(isOverdue(req({ date: '2026-10-20' }), '2026-10-21'), true);
  assert.equal(isOverdue(req({ date: '2026-10-20' }), '2026-10-20'), false);
  const boda = req({ brandId: 'elian-lopez-photo', date: '2026-11-10' });
  assert.equal(balanceDueDate(boda), '2026-11-10');
  assert.equal(isOverdue(boda, '2026-11-10'), false);
  assert.equal(isOverdue(boda, '2026-11-11'), true);
  // datos antiguos con días de antelación guardados ya no cambian la regla
  assert.equal(balanceDueDate(req({ balanceDueDaysBefore: 15, date: '2026-11-10' })), '2026-11-10');
});

test('resumen: facturado, recibido, falta, por verificar y por confirmar', () => {
  const list = [
    req({ id: 'a', payments: [pay(5000)] }), // confirmada, falta 5000
    req({ id: 'b', status: 'completed', payments: [pay(5000), pay(5000, 'verified', '2026-10-20')] }), // pagada
    req({ id: 'c', status: 'pending_review', payments: [pay(5000, 'pending')] }), // por confirmar / por verificar
    req({ id: 'd', status: 'cancelled', payments: [pay(5000)] }), // anticipo retenido: cuenta como recibido
  ];
  const s = summarize(list, { from: null, to: null }, '2026-10-01');
  assert.equal(s.billed, 20000);
  assert.equal(s.received, 20000);
  assert.equal(s.outstanding, 5000);
  assert.equal(s.overdue, 0);
  assert.equal(s.pendingVerification, 5000);
  assert.equal(s.pipeline, 10000);
  assert.equal(s.collectedPct, 75);
});

test('el periodo filtra facturado por fecha de sesión y recibido por fecha de pago', () => {
  const list = [req({ date: '2026-09-15', payments: [pay(5000, 'verified', '2026-08-30')] })];
  const sep = summarize(list, { from: '2026-09-01', to: '2026-09-30' });
  assert.equal(sep.billed, 10000);
  assert.equal(sep.received, 0);
  const aug = summarize(list, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(aug.received, 5000);
});

test('serie mensual', () => {
  const list = [req({ date: '2026-10-05', payments: [pay(5000, 'verified', '2026-09-28')] })];
  const m = monthlySeries(list, 2, new Date(2026, 9, 26));
  assert.deepEqual(m.map((x) => [x.key, x.billed, x.received]), [['2026-09', 0, 5000], ['2026-10', 10000, 0]]);
});

test('concepto sugerido', () => {
  assert.equal(suggestConcept(req(), 5000), 'deposit');
  assert.equal(suggestConcept(req({ payments: [pay(5000)] }), 5000), 'balance');
  assert.equal(suggestConcept(req({ payments: [pay(5000)] }), 2000), 'partial');
});
