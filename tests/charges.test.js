import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeLine, recomputeQuote, validateCharge } from '../src/lib/charges.js';
import { computeQuote } from '../src/lib/pricing.js';

const plan = { id: 'p', price: 5500, durationMin: 30 };
const foto = { id: 'x-foto', name: 'Foto digital adicional', price: 700, pricing: 'per_unit', maxQty: 10 };
const media = { id: 'x-30', name: '30 minutos', price: 2500, pricing: 'per_unit', maxQty: 2, addsMinutes: 30 };

test('un cargo del catálogo sube total y saldo, no el anticipo', () => {
  const q = computeQuote({ plan, extras: [foto], selection: { 'x-foto': 5 }, depositPercent: 50 }); // 5,500 + 3,500
  assert.equal(q.total, 9000);
  const n = recomputeQuote({ ...q, lines: [...q.lines, chargeLine({ extra: foto, qty: 3 })] });
  assert.equal(n.total, 11100);
  assert.equal(n.deposit, q.deposit);
  assert.equal(n.balance, 11100 - q.deposit);
  assert.equal(n.lines.at(-1).source, 'admin');
});
test('concepto libre y minutos', () => {
  const q = computeQuote({ plan, depositPercent: 50 });
  let n = recomputeQuote({ ...q, lines: [chargeLine({ name: 'Retoque especial', amount: 1000 })] });
  assert.equal(n.total, 6500);
  n = recomputeQuote({ ...n, lines: [...n.lines, chargeLine({ extra: media, qty: 1 })] });
  assert.equal(n.durationMin, 60);
  assert.equal(n.total, 9000);
});
test('con cupón el descuento se mantiene y el cargo va completo', () => {
  const q = computeQuote({ plan, depositPercent: 50, coupon: { code: 'X', type: 'percent', value: 10 } });
  assert.equal(q.total, 4950);
  const n = recomputeQuote({ ...q, lines: [chargeLine({ extra: foto, qty: 1 })] });
  assert.equal(n.discount, 550);
  assert.equal(n.total, 5650);
});
test('quitar el cargo vuelve al total anterior', () => {
  const q = computeQuote({ plan, depositPercent: 50 });
  const withC = recomputeQuote({ ...q, lines: [chargeLine({ name: 'X', amount: 800 })] });
  const back = recomputeQuote({ ...withC, lines: withC.lines.filter((l) => l.source !== 'admin') });
  assert.equal(back.total, q.total);
  assert.equal(back.balance, q.balance);
});
test('validación', () => {
  assert.ok(validateCharge({ mode: 'extra', qty: 1 }).extra);
  assert.ok(validateCharge({ mode: 'extra', extra: foto, qty: 0 }).qty);
  assert.ok(validateCharge({ mode: 'custom', name: '', amount: 5 }).name);
  assert.ok(validateCharge({ mode: 'custom', name: 'X', amount: 0 }).amount);
  assert.deepEqual(validateCharge({ mode: 'custom', name: 'X', amount: 100 }), {});
});
