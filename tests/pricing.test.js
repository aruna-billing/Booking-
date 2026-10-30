// Pruebas del cálculo de precios y duración (datos de Elian López Photo, USD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeQuote, extraAppliesToPlan } from '../src/lib/pricing.js';
import { plans, extras } from '../src/data/catalog.js';

const intima = plans.find((p) => p.id === 'el-intima'); // US$ 1,200 · 4 h
const clasica = plans.find((p) => p.id === 'el-clasica'); // US$ 2,400 · 8 h

test('planes de Elian López Photo', () => {
  assert.equal(intima.price, 1200);
  assert.equal(intima.durationMin, 240);
  assert.equal(clasica.price, 2400);
  assert.equal(clasica.durationMin, 480);
});

test('solo plan, sin extras (anticipo 30 %)', () => {
  const q = computeQuote({ plan: clasica, extras, selection: {}, depositPercent: 30 });
  assert.equal(q.total, 2400);
  assert.equal(q.deposit, 720);
  assert.equal(q.balance, 1680);
});

test('extras por unidad y fijos', () => {
  // 2 horas extra (180) + segundo fotógrafo (450) = 810
  const q = computeQuote({ plan: clasica, extras, selection: { 'el-x-hora': 2, 'el-x-segundo': 1 }, depositPercent: 30 });
  assert.equal(q.extrasTotal, 810);
  assert.equal(q.total, 3210);
  assert.equal(q.deposit, 963);
  assert.equal(q.durationMin, 600); // 8 h + 2 h
});

test('un extra fijo nunca cuenta más de una vez y la cantidad se limita a maxQty', () => {
  assert.equal(computeQuote({ plan: clasica, extras, selection: { 'el-x-segundo': 4 } }).extrasTotal, 450);
  const q = computeQuote({ plan: clasica, extras, selection: { 'el-x-hora': 99 } });
  assert.equal(q.lines[0].quantity, 4);
});

test('ignora extras desconocidos y cantidades 0 o negativas', () => {
  const q = computeQuote({ plan: intima, extras, selection: { nope: 3, 'el-x-libro': 0, 'el-x-hora': -2 } });
  assert.equal(q.total, 1200);
});

test('extras limitados a ciertos planes', () => {
  const preboda = extras.find((x) => x.id === 'el-x-preboda');
  assert.equal(extraAppliesToPlan(preboda, 'el-clasica'), true);
  assert.equal(extraAppliesToPlan(preboda, 'el-editorial'), false);
});
