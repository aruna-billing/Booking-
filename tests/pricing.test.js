// Pruebas del cálculo de precios y duración (datos de Morel Estudio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQuote, extraAppliesToPlan } from '../src/lib/pricing.js';
import { plans, extras } from '../src/data/catalog.js';

const estandar = plans.find((p) => p.id === 'me-estandar'); // RD$ 5,500 · 30 min
const pro = plans.find((p) => p.id === 'me-pro'); // RD$ 8,000 · 60 min

test('planes de Morel Estudio', () => {
  assert.equal(estandar.price, 5500);
  assert.equal(estandar.durationMin, 30);
  assert.equal(pro.price, 8000);
  assert.equal(pro.durationMin, 60);
});

test('solo plan, sin extras', () => {
  const q = computeQuote({ plan: estandar, extras, selection: {}, depositPercent: 50 });
  assert.equal(q.total, 5500);
  assert.equal(q.deposit, 2750);
  assert.equal(q.balance, 2750);
});

test('extras por unidad y fijos', () => {
  // 3 fotos (700) + exprés (1,500) = 3,600
  const q = computeQuote({ plan: pro, extras, selection: { 'me-x-foto': 3, 'me-x-expres': 1 }, depositPercent: 50 });
  assert.equal(q.extrasTotal, 3600);
  assert.equal(q.total, 11600);
  assert.equal(q.deposit, 5800);
});

test('un extra fijo nunca cuenta más de una vez y la cantidad se limita a maxQty', () => {
  assert.equal(computeQuote({ plan: pro, extras, selection: { 'me-x-expres': 4 } }).extrasTotal, 1500);
  const q = computeQuote({ plan: pro, extras, selection: { 'me-x-foto': 99 } });
  assert.equal(q.lines[0].quantity, 10);
});

test('ignora extras desconocidos y cantidades 0 o negativas', () => {
  const q = computeQuote({ plan: estandar, extras, selection: { nope: 3, 'me-x-impresa': 0, 'me-x-foto': -2 } });
  assert.equal(q.total, 5500);
});

test('los minutos extra se suman a la duración del plan', () => {
  const q = computeQuote({ plan: estandar, extras, selection: { 'me-x-30min': 2 }, depositPercent: 50 });
  assert.equal(q.durationMin, 90);
  assert.equal(q.total, 5500 + 5000);
});

test('sin plan el total es 0 y los extras aplican a todos los planes', () => {
  assert.equal(computeQuote({ plan: null, extras }).total, 0);
  extras.forEach((x) => assert.equal(extraAppliesToPlan(x, 'me-estandar'), true));
});
