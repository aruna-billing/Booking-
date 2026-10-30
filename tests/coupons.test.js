import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPlanIds, couponStatus, discountFor, findCoupon, normalizeCode, validateCoupon } from '../src/lib/coupons.js';
import { computeQuote } from '../src/lib/pricing.js';

const plan = { id: 'p', price: 8000, durationMin: 60 };
const extras = [{ id: 'x', price: 700, pricing: 'per_unit', maxQty: 10 }];
const c10 = { id: 'c1', code: 'NOVIOS10', type: 'percent', value: 10, brandIds: null, validFrom: '2026-11-01', validTo: '2026-11-30', maxUses: 2, onePerClient: true, active: true };

test('descuento porcentual sobre plan + extras y anticipo con descuento', () => {
  const q = computeQuote({ plan, extras, selection: { x: 2 }, depositPercent: 50, coupon: c10 });
  assert.equal(q.subtotal, 9400);
  assert.equal(q.discount, 940);
  assert.equal(q.total, 8460);
  assert.equal(q.deposit, 4230);
  assert.deepEqual(q.coupon, { code: 'NOVIOS10', type: 'percent', value: 10 });
});
test('descuento fijo no puede dejar el total negativo', () => {
  const q = computeQuote({ plan, depositPercent: 50, coupon: { code: 'X', type: 'fixed', value: 99999 } });
  assert.equal(q.total, 0);
  assert.equal(discountFor({ type: 'fixed', value: 500 }, 8000), 500);
});
test('sin cupón el total no cambia', () => {
  const q = computeQuote({ plan, depositPercent: 50 });
  assert.equal(q.total, 8000);
  assert.equal(q.discount, 0);
  assert.equal(q.coupon, null);
});
test('fechas: antes, dentro y después', () => {
  assert.equal(couponStatus(c10, { today: '2026-10-31' }).ok, false);
  assert.equal(couponStatus(c10, { today: '2026-11-15' }).ok, true);
  assert.equal(couponStatus(c10, { today: '2026-11-30' }).ok, true);
  assert.match(couponStatus(c10, { today: '2026-12-01' }).reason, /expiró/);
});
test('límite de usos: las canceladas no cuentan', () => {
  const used = (status, email) => ({ status, client: { email }, quote: { coupon: { code: 'novios10' } } });
  const today = '2026-11-15';
  assert.equal(couponStatus(c10, { today, requests: [used('confirmed', 'a@x.com')] }).ok, true);
  assert.match(couponStatus(c10, { today, requests: [used('confirmed', 'a@x.com'), used('pending_review', 'b@x.com')] }).reason, /límite/);
  assert.equal(couponStatus(c10, { today, requests: [used('cancelled', 'a@x.com'), used('confirmed', 'b@x.com')] }).ok, true);
});
test('una vez por cliente (por correo)', () => {
  const r = [{ status: 'confirmed', client: { email: 'Ana@Correo.com' }, quote: { coupon: { code: 'NOVIOS10' } } }];
  assert.match(couponStatus({ ...c10, maxUses: null }, { today: '2026-11-15', requests: r, email: 'ana@correo.com ' }).reason, /Ya usaste/);
  assert.equal(couponStatus({ ...c10, maxUses: null }, { today: '2026-11-15', requests: r, email: 'otro@correo.com' }).ok, true);
});
test('marca, inactivo y código sin distinguir mayúsculas', () => {
  assert.match(couponStatus({ ...c10, brandIds: ['otra'] }, { brandId: 'elian-lopez-photo', today: '2026-11-15' }).reason, /marca/);
  assert.equal(couponStatus({ ...c10, active: false }, { today: '2026-11-15' }).ok, false);
  assert.equal(findCoupon([c10], ' novios10 ')?.id, 'c1');
  assert.equal(normalizeCode('ver ano 26'), 'VERANO26');
});
test('validación del formulario', () => {
  assert.deepEqual(validateCoupon(c10, []), {});
  assert.ok(validateCoupon({ ...c10, code: 'a' }).code);
  assert.ok(validateCoupon({ ...c10, value: 150 }).value);
  assert.ok(validateCoupon({ ...c10, validTo: '2026-10-01' }).validTo);
  assert.ok(validateCoupon({ ...c10, maxUses: '1.5' }).maxUses);
  assert.ok(validateCoupon({ ...c10, id: 'c2' }, [c10]).code);
  assert.deepEqual(validateCoupon({ ...c10, maxUses: '' }), {});
});

test('cupón limitado a ciertos planes', () => {
  const c = { code: 'NAV', type: 'percent', value: 10, active: true, planIds: ['p1'] };
  assert.equal(couponStatus(c, { brandId: 'b', planId: 'p1', today: '2026-11-01' }).ok, true);
  assert.match(couponStatus(c, { brandId: 'b', planId: 'p2', today: '2026-11-01' }).reason, /plan elegido/);
  assert.equal(couponStatus({ ...c, planIds: null }, { planId: 'p2', today: '2026-11-01' }).ok, true);
  assert.ok(validateCoupon({ ...c, planIds: [] }).planIds);
  const plans = [{ id: 'p1', brandId: 'a' }, { id: 'p2', brandId: 'b' }];
  assert.deepEqual(cleanPlanIds(['p1', 'p2', 'x'], plans, ['a']), ['p1']);
  assert.equal(cleanPlanIds(null, plans), null);
});
