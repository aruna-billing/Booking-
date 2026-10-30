import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRules, validateRules } from '../src/lib/rules.js';
import { availabilityRules } from '../src/data/availabilityRules.js';

const base = { mode: 'timed', workingDays: [1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '21:00', startStepMin: 30, bufferMin: 15, breaks: [], defaultDurationMin: 30, maxBookingsPerDay: 12, minNoticeDays: 1, maxAdvanceDays: 90 };

test('las reglas por defecto son válidas', () => {
  assert.deepEqual(validateRules(base), {});
  assert.deepEqual(validateRules(availabilityRules['elian-lopez-photo']), {});
});
test('bodas: hace falta al menos una hora de inicio', () => {
  assert.ok(validateRules({ ...availabilityRules['elian-lopez-photo'], startTimes: [] }).startTimes);
});
test('se puede trabajar hasta la noche y los domingos', () => {
  assert.deepEqual(validateRules({ ...base, workingDays: [0], openTime: '07:00', closeTime: '23:30' }), {});
});
test('el cierre debe ser después de la apertura', () => {
  assert.ok(validateRules({ ...base, openTime: '18:00', closeTime: '09:00' }).closeTime);
});
test('hace falta al menos un día', () => {
  assert.ok(validateRules({ ...base, workingDays: [] }).workingDays);
});
test('las pausas deben estar dentro del horario', () => {
  assert.ok(validateRules({ ...base, breaks: [{ start: '07:00', end: '07:30' }] }).break0);
  assert.ok(validateRules({ ...base, breaks: [{ start: '14:00', end: '13:00' }] }).break0);
  assert.deepEqual(validateRules({ ...base, breaks: [{ start: '13:00', end: '14:00' }] }), {});
});
test('cleanRules ordena días y convierte números', () => {
  const r = cleanRules({ ...base, workingDays: ['6', 0, '3', 0], maxBookingsPerDay: '4', breaks: [{ start: '15:00', end: '15:30', label: '' }, { start: '12:00', end: '12:30', label: 'Almuerzo' }] });
  assert.deepEqual(r.workingDays, [0, 3, 6]);
  assert.equal(r.maxBookingsPerDay, 4);
  assert.deepEqual(r.breaks.map((b) => b.start), ['12:00', '15:00']);
  assert.equal(r.breaks[1].label, 'Pausa');
});
