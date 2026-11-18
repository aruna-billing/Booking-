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

// ───────── Cargos propuestos por un asistente ─────────
import { approvedLine, chargeLabel, pendingChargesOf, proposedChargeLine } from '../src/lib/charges.js';

test('un cargo propuesto no cambia la cotización y guarda quién lo propuso', () => {
  const p = proposedChargeLine({ extra: foto, qty: 3, note: '  Pidió 3 más  ', by: 'Laura', at: '2026-11-16T15:00:00.000Z' });
  assert.equal(p.status, 'pending');
  assert.equal(p.total, 2100);
  assert.equal(p.proposedBy, 'Laura');
  assert.equal(p.note, 'Pidió 3 más');
  assert.match(p.id, /^prop-/);
  assert.equal(chargeLabel(p), 'Foto digital adicional × 3');
  const r = { quote: computeQuote({ plan, depositPercent: 50 }), pendingCharges: [p, null] };
  assert.deepEqual(pendingChargesOf(r).map((c) => c.id), [p.id]);
  assert.equal(r.quote.total, 5500);
  assert.deepEqual(pendingChargesOf({}), []);
});

test('al aprobarlo pasa a la cotización como cargo del equipo y suma total y minutos', () => {
  const q = computeQuote({ plan, depositPercent: 50 });
  const p = proposedChargeLine({ extra: media, qty: 1, by: 'Laura', at: '2026-11-16T15:00:00.000Z' });
  const line = approvedLine(p, { by: 'Elian', at: '2026-11-16T16:00:00.000Z' });
  assert.equal(line.source, 'admin');
  assert.equal(line.addedBy, 'Laura');
  assert.equal(line.approvedBy, 'Elian');
  assert.equal(line.status, undefined);
  assert.match(line.id, /^charge-/);
  const n = recomputeQuote({ ...q, lines: [...q.lines, line] });
  assert.equal(n.total, 8000);
  assert.equal(n.durationMin, 60);
  assert.equal(n.deposit, q.deposit);
});

test('concepto libre propuesto: misma validación que un cargo', () => {
  assert.ok(validateCharge({ mode: 'custom', name: '', amount: 0 }).name);
  const p = proposedChargeLine({ name: 'Retoque especial', amount: 1500, by: 'Laura' });
  assert.equal(p.total, 1500);
  assert.equal(p.note, '');
});
