// Pruebas de etapas, plazos de entrega y alertas de Seguimientos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, alertOf, deliveryDueDate, stageOf, trackingSummary } from '../src/lib/tracking.js';

const brand = { id: 'b', deliveryDays: 10 };
const extras = [{ id: 'exp', expressDelivery: true }];
const req = (o = {}) => ({ id: 'r', brandId: 'b', status: 'confirmed', date: '2026-10-20', time: '10:00', quote: { lines: [] }, ...o });

test('etapas', () => {
  assert.equal(stageOf(req({ status: 'pending_review' })), 'request');
  assert.equal(stageOf(req({ status: 'awaiting_payment' })), 'request');
  assert.equal(stageOf(req()), 'booked');
  assert.equal(stageOf(req({ status: 'completed', shotAt: '2026-10-20' })), 'shot');
  assert.equal(stageOf(req({ status: 'completed', shotAt: '2026-10-20', deliveredAt: '2026-10-25' })), 'delivered');
  assert.equal(stageOf(req({ status: 'cancelled' })), null);
});

test('días hábiles: se saltan sábados y domingos', () => {
  assert.equal(addBusinessDays('2026-10-23', 1), '2026-10-26'); // viernes + 1 = lunes
  assert.equal(addBusinessDays('2026-10-20', 10), '2026-11-03'); // martes + 10 hábiles
});

test('plazo de entrega: días hábiles de la marca o 72 h con exprés', () => {
  assert.equal(deliveryDueDate(req({ shotAt: '2026-10-20' }), brand, extras), '2026-11-03');
  assert.equal(deliveryDueDate(req({ shotAt: '2026-10-20', quote: { lines: [{ id: 'exp' }] } }), brand, extras), '2026-10-23');
  assert.equal(deliveryDueDate(req({ shotAt: '2026-10-20' }), { deliveryDays: 5 }, extras), '2026-10-27');
});

test('alertas', () => {
  assert.equal(alertOf(req({ date: '2026-10-25' }), brand, extras, '2026-10-27').kind, 'shoot_unmarked');
  assert.equal(alertOf(req({ date: '2026-10-27' }), brand, extras, '2026-10-27').kind, 'shoot_today');
  assert.equal(alertOf(req({ date: '2026-10-28' }), brand, extras, '2026-10-27').text, 'Sesión mañana');
  const shot = req({ status: 'completed', shotAt: '2026-10-20' }); // vence 2026-11-03
  assert.equal(alertOf(shot, brand, extras, '2026-11-02').kind, 'due_soon');
  assert.equal(alertOf(shot, brand, extras, '2026-10-27').kind, 'editing');
  assert.equal(alertOf(shot, brand, extras, '2026-11-05').kind, 'overdue');
  assert.equal(alertOf({ ...shot, deliveredAt: '2026-11-05' }, brand, extras).text, 'Entregado (con retraso)');
  assert.equal(alertOf({ ...shot, deliveredAt: '2026-11-01' }, brand, extras).text, 'Entregado a tiempo');
});

test('resumen', () => {
  const list = [
    req({ id: 'a', date: '2026-10-29' }), // sesión esta semana
    req({ id: 'b', date: '2026-10-25' }), // sin marcar
    req({ id: 'c', status: 'completed', shotAt: '2026-10-01' }), // vencida
    req({ id: 'd', status: 'completed', shotAt: '2026-10-01', deliveredAt: '2026-10-10' }),
    req({ id: 'e', status: 'pending_review' }),
  ];
  const s = trackingSummary(list, { b: brand }, extras, '2026-10-27');
  assert.equal(s.booked, 2);
  assert.equal(s.sessionsWeek, 1);
  assert.equal(s.unmarked, 1);
  assert.equal(s.shot, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.delivered, 1);
  assert.equal(s.deliveredMonth, 1);
});
