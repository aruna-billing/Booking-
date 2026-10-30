// Pruebas de disponibilidad: modo con horario (sesiones) y modo de día completo (bodas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDayAvailability } from '../src/lib/availability.js';
import { availabilityRules } from '../src/data/availabilityRules.js';
import { addDays, today, toISODate } from '../src/lib/date.js';

// ── Bodas (reglas de Elian López Photo) ──
const wedding = { ...availabilityRules['elian-lopez-photo'], simulatedOccupancy: 0 };
let w = addDays(today(), wedding.minNoticeDays);
const wIso = toISODate(w);
const wctx = { brandId: 'elian-lopez-photo', rules: wedding, blockedDates: [], requests: [] };

test('bodas: todos los días, domingos incluidos', () => {
  assert.deepEqual(wedding.workingDays, [0, 1, 2, 3, 4, 5, 6]);
});
test('bodas: antes de la antelación mínima no se puede reservar', () => {
  assert.equal(getDayAvailability(toISODate(addDays(today(), 5)), wctx).status, 'out_of_range');
});
test('bodas: se ofrecen las horas de inicio configuradas', () => {
  const d = getDayAvailability(wIso, wctx, 480);
  assert.equal(d.status, 'available');
  assert.deepEqual(d.slots.map((s) => s.time), wedding.startTimes);
});
test('bodas: una boda ocupa el día completo', () => {
  const requests = [{ brandId: 'elian-lopez-photo', date: wIso, time: '15:00', status: 'confirmed', quote: { durationMin: 480 } }];
  assert.equal(getDayAvailability(wIso, { ...wctx, requests }, 480).status, 'full');
  const cancelled = [{ ...requests[0], status: 'cancelled' }];
  assert.equal(getDayAvailability(wIso, { ...wctx, requests: cancelled }, 480).status, 'available');
});

// ── Sesiones con horario (si se cambia la marca a modo sesión) ──
const rules = { mode: 'timed', workingDays: [0, 1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '21:00', startStepMin: 30, bufferMin: 15, breaks: [], defaultDurationMin: 30, maxBookingsPerDay: 12, minNoticeDays: 1, maxAdvanceDays: 90 };
const iso = toISODate(addDays(today(), 1));
const ctx = { brandId: 'b', rules, blockedDates: [], requests: [] };
const times = (dur) => getDayAvailability(iso, ctx, dur).slots.map((s) => s.time);

test('sesiones: la sesión completa debe caber antes del cierre', () => {
  assert.ok(times(30).includes('20:30'));
  assert.ok(!times(60).includes('20:30'));
});
test('sesiones: con una pausa, no se ofrecen horarios que la crucen', () => {
  const withBreak = { ...ctx, rules: { ...rules, breaks: [{ start: '13:00', end: '14:00', label: 'Almuerzo' }] } };
  const t = getDayAvailability(iso, withBreak, 60).slots.map((s) => s.time);
  assert.ok(t.includes('12:00'));
  assert.ok(!t.includes('12:30'));
});
test('sesiones: una reserva bloquea horarios solapados (+15 min de margen)', () => {
  const requests = [{ brandId: 'b', date: iso, time: '10:00', status: 'confirmed', quote: { durationMin: 60 } }];
  const slots = getDayAvailability(iso, { ...ctx, requests }, 60).slots;
  const free = (t) => slots.find((s) => s.time === t)?.available;
  assert.equal(free('09:00'), false);
  assert.equal(free('11:00'), false);
  assert.equal(free('11:30'), true);
  assert.equal(free('08:00'), true);
});
