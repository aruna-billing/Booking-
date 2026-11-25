// Antelación mínima en días u horas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDayAvailability, firstSelectableDate } from '../src/lib/availability.js';
import { noticeLabel, noticeCutoff } from '../src/lib/notice.js';
import { validateRules, cleanRules } from '../src/lib/rules.js';
import { addDays, toISODate, today } from '../src/lib/date.js';

const base = { mode: 'timed', workingDays: [0, 1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '21:00', startStepMin: 30, bufferMin: 0, breaks: [], defaultDurationMin: 30, maxBookingsPerDay: 50, minNoticeDays: 0, maxAdvanceDays: 90, simulatedAnchors: [], simulatedOccupancy: 0 };
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const iso0 = toISODate(today());
const iso1 = toISODate(addDays(today(), 1));
const times = (iso, rules, now) => getDayAvailability(iso, { brandId: 'b', rules, now }, 30).slots.map((s) => s.time);

test('días: 1 = desde mañana; 0 = hoy sin horarios ya pasados', () => {
  const r1 = { ...base, minNoticeDays: 1 };
  assert.equal(getDayAvailability(iso0, { brandId: 'b', rules: r1, now: at(10) }, 30).status, 'out_of_range');
  assert.equal(times(iso1, r1, at(10))[0], '08:00');
  const r0 = { ...base, minNoticeDays: 0 };
  assert.equal(times(iso0, r0, at(10, 15))[0], '10:30');
});

test('horas: 3 h a las 10:00 → hoy desde la 1:00 p. m.; mañana completo', () => {
  const r = { ...base, minNoticeUnit: 'hours', minNoticeHours: 3 };
  assert.equal(times(iso0, r, at(10))[0], '13:00');
  assert.equal(times(iso1, r, at(10))[0], '08:00');
  // 20:00 + 3 h = 23:00 → hoy no queda nada; mañana desde las 8:00
  assert.equal(getDayAvailability(iso0, { brandId: 'b', rules: r, now: at(20) }, 30).status, 'out_of_range');
  assert.equal(firstSelectableDate({ brandId: 'b', rules: r, now: at(20) }, 30), iso1);
  // 48 h desde las 10:00 → hoy y mañana no; pasado mañana desde las 10:00
  const r48 = { ...r, minNoticeHours: 48 };
  const iso2 = toISODate(addDays(today(), 2));
  assert.equal(getDayAvailability(iso1, { brandId: 'b', rules: r48, now: at(10) }, 30).status, 'out_of_range');
  assert.equal(times(iso2, r48, at(10))[0], '10:00');
  assert.ok(noticeCutoff(r48, at(10)).getTime() === at(10).getTime() + 48 * 3600e3);
});

test('horas en bodas (día exclusivo): quita las horas de inicio que no cumplen', () => {
  const r = { ...base, mode: 'exclusive_day', startTimes: ['10:00', '15:00'], maxBookingsPerDay: 1, minNoticeUnit: 'hours', minNoticeHours: 2 };
  assert.deepEqual(times(iso0, r, at(12)), ['15:00']);
  assert.equal(getDayAvailability(iso0, { brandId: 'b', rules: r, now: at(14) }, 30).status, 'out_of_range');
});

test('textos y validación', () => {
  assert.equal(noticeLabel({ minNoticeDays: 1 }), '1 día');
  assert.equal(noticeLabel({ minNoticeDays: 30 }), '30 días');
  assert.equal(noticeLabel({ minNoticeUnit: 'hours', minNoticeHours: 1 }), '1 hora');
  assert.equal(noticeLabel({ minNoticeUnit: 'hours', minNoticeHours: 6 }), '6 horas');
  assert.deepEqual(validateRules({ ...base, minNoticeUnit: 'hours', minNoticeHours: 6 }), {});
  assert.ok(validateRules({ ...base, minNoticeUnit: 'hours', minNoticeHours: 721 }).minNotice);
  assert.ok(validateRules({ ...base, minNoticeUnit: 'hours', minNoticeHours: 2.5 }).minNotice);
  assert.ok(validateRules({ ...base, minNoticeDays: 61 }).minNotice);
  assert.ok(validateRules({ ...base, minNoticeUnit: 'hours', minNoticeHours: 720, maxAdvanceDays: 20 }).maxAdvanceDays);
  const c = cleanRules({ ...base, minNoticeUnit: 'hours', minNoticeHours: '4', minNoticeDays: '1' });
  assert.equal(c.minNoticeUnit, 'hours');
  assert.equal(c.minNoticeHours, 4);
});
