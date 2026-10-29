// Pruebas de horarios según la duración de la sesión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDayAvailability } from '../src/lib/availability.js';
import { availabilityRules } from '../src/data/availabilityRules.js';
import { addDays, today, toISODate } from '../src/lib/date.js';

const rules = { ...availabilityRules['morel-estudio'], simulatedOccupancy: 0 }; // sin ocupación simulada
// Primer día laborable dentro del periodo de reserva
let d = addDays(today(), rules.minNoticeDays);
while (!rules.workingDays.includes(d.getDay())) d = addDays(d, 1);
const iso = toISODate(d);
const ctx = { brandId: 'morel-estudio', rules, blockedDates: [], requests: [] };
const times = (dur) => getDayAvailability(iso, ctx, dur).slots.map((s) => s.time);

test('la sesión completa debe caber antes del cierre (18:00)', () => {
  assert.ok(times(30).includes('17:30'));
  assert.ok(!times(60).includes('17:30'));
  assert.ok(times(90).includes('16:30'));
  assert.ok(!times(90).includes('17:00'));
});

test('no se ofrecen horarios que crucen la pausa 13:00–14:00', () => {
  assert.ok(times(30).includes('12:30'));
  assert.ok(!times(60).includes('12:30'));
  assert.ok(!times(90).includes('12:00'));
  assert.ok(times(60).includes('12:00'));
});

test('una reserva existente bloquea horarios solapados (+15 min de margen)', () => {
  const requests = [{ brandId: 'morel-estudio', date: iso, time: '10:00', status: 'confirmed', quote: { durationMin: 60 } }];
  const slots = getDayAvailability(iso, { ...ctx, requests }, 60).slots;
  const free = (t) => slots.find((s) => s.time === t)?.available;
  assert.equal(free('09:00'), false); // 9:00–10:00 + margen choca con 10:00
  assert.equal(free('10:30'), false);
  assert.equal(free('11:30'), true); // 11:00 + 15 min de margen → 11:30 libre
  assert.equal(free('11:00'), false);
});

test('el final de cada horario refleja la duración', () => {
  const s = getDayAvailability(iso, ctx, 75).slots[0];
  assert.equal(s.time, '09:00');
  assert.equal(s.end, '10:15');
});
