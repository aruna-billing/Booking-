import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availabilityText, planAvailability, planBookingError, planUses, planVisible, sessionDateAllowed, validateLimit } from '../src/lib/planLimits.js';

const plan = (limit) => ({ id: 'p', limit: { enabled: true, ...limit } });

test('plan sin límite: siempre abierto', () => {
  assert.deepEqual(planAvailability({ id: 'p' }, { today: '2026-11-01', used: 99 }), { open: true, reason: null, remaining: null, limit: null });
  assert.equal(planAvailability({ id: 'p', limit: { enabled: false, maxBookings: 1 } }, { today: '2026-11-01', used: 5 }).open, true);
});

test('cupos: quedan, agotado y texto con {n}', () => {
  const p = plan({ maxBookings: 3, remainingText: '🔥 ¡Solo {n} cupos!' });
  let av = planAvailability(p, { today: '2026-11-01', used: 1 });
  assert.equal(av.remaining, 2);
  assert.equal(availabilityText(av), '🔥 ¡Solo 2 cupos!');
  av = planAvailability(p, { today: '2026-11-01', used: 3 });
  assert.equal(av.open, false);
  assert.equal(av.reason, 'soldout');
  assert.equal(availabilityText(av), 'Agotado');
  assert.equal(availabilityText(planAvailability(plan({ maxBookings: 3, soldOutText: 'Sin cupos 😢' }), { today: '2026-11-01', used: 4 })), 'Sin cupos 😢');
  assert.equal(availabilityText(planAvailability(plan({ maxBookings: 3, showRemaining: false }), { today: '2026-11-01', used: 1 })), '');
});

test('fechas de venta y de sesión', () => {
  assert.equal(planAvailability(plan({ saleFrom: '2026-12-01' }), { today: '2026-11-01' }).reason, 'soon');
  assert.equal(planAvailability(plan({ saleTo: '2026-10-31' }), { today: '2026-11-01' }).reason, 'ended');
  assert.equal(planAvailability(plan({ saleTo: '2026-11-01' }), { today: '2026-11-01' }).open, true);
  assert.equal(planAvailability(plan({ sessionTo: '2026-10-31' }), { today: '2026-11-01' }).reason, 'ended');
  const p = plan({ sessionFrom: '2026-12-01', sessionTo: '2026-12-20' });
  assert.equal(sessionDateAllowed(p, '2026-11-30'), false);
  assert.equal(sessionDateAllowed(p, '2026-12-20'), true);
  assert.match(planBookingError(p, { today: '2026-11-01', used: 0, date: '2026-12-21' }), /fecha no está disponible/);
  assert.equal(planBookingError(p, { today: '2026-11-01', used: 0, date: '2026-12-05' }), null);
});

test('ocultar al cerrar y contar usos sin canceladas', () => {
  const closed = planAvailability(plan({ maxBookings: 1, whenClosed: 'hide' }), { today: '2026-11-01', used: 1 });
  assert.equal(planVisible(closed), false);
  assert.equal(planVisible(planAvailability(plan({ maxBookings: 1 }), { today: '2026-11-01', used: 1 })), true);
  assert.equal(planUses('p', [{ planId: 'p', status: 'confirmed' }, { planId: 'p', status: 'cancelled' }, { planId: 'q', status: 'confirmed' }]), 1);
});

test('validación del formulario', () => {
  assert.deepEqual(validateLimit({ enabled: false, maxBookings: -3 }), {});
  const e = validateLimit({ enabled: true, maxBookings: '2.5', saleFrom: '2026-12-02', saleTo: '2026-12-01', sessionFrom: '2026-12-10', sessionTo: '2026-12-09' });
  assert.ok(e.maxBookings && e.saleTo && e.sessionTo);
  assert.deepEqual(validateLimit({ enabled: true, maxBookings: '' }), {});
});
