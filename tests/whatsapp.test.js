import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWa, waKindFor, waMessage, waPhone, waTemplate, waVars } from '../src/lib/whatsapp.js';

const brand = { id: 'b', name: 'Morel Estudio', currency: 'DOP', depositPercent: 50, bookingType: 'session' };
const plan = { id: 'p', name: 'Plan Pro', deliverables: ['10 fotos digitales', 'Sesión en estudio'] };
const req = (over = {}) => ({
  id: 'req-ab12',
  brandId: 'b',
  planId: 'p',
  planName: 'Plan Pro',
  date: '2026-11-14',
  time: '10:00',
  status: 'confirmed',
  currency: 'DOP',
  client: { firstName: 'Ana', lastName: 'Pérez', phone: '809 555 0123' },
  quote: { total: 5500, deposit: 2750, balance: 2750, durationMin: 90, lines: [], discount: 0 },
  payments: [{ status: 'verified', amount: 2750 }, { status: 'pending', amount: 100 }],
  ...over,
});

test('el mensaje confirmado lleva fecha, hora, lo que incluye y los montos', () => {
  const m = waMessage(req(), brand, plan);
  assert.match(m, /Hola Ana/);
  assert.match(m, /14 de noviembre/);
  assert.match(m, /10:00.*a.*11:30/i);
  assert.match(m, /• 10 fotos digitales\n• Sesión en estudio/);
  assert.match(m, /Pagado: RD\$\s?2,750/);
  assert.match(m, /Pendiente: RD\$\s?2,750/);
  assert.match(m, /#AB12/);
  assert.doesNotMatch(m, /Extras/); // sin extras no aparece la línea
  assert.doesNotMatch(m, /\{|\n{3,}/);
});

test('los extras y cargos aparecen cuando existen', () => {
  const m = waMessage(req({ quote: { ...req().quote, lines: [{ name: 'Maquillaje', quantity: 1, total: 1500 }, { name: 'Foto extra', quantity: 3, total: 900 }] } }), brand, plan);
  assert.match(m, /Extras:\n• Maquillaje \(RD\$\s?1,500\)\n• Foto extra × 3/);
});

test('la plantilla de la marca sustituye a la predeterminada; vacía = predeterminada', () => {
  const b = { ...brand, web: { whatsapp: { confirmed: 'Hola {nombre}, debes {pendiente}. {inexistente}' } } };
  assert.equal(waMessage(req(), b, plan), 'Hola Ana, debes RD$ 2,750. {inexistente}'.replace(' ', waVars(req(), b, plan).pendiente.includes(' ') ? ' ' : ' '));
  assert.equal(waTemplate({ ...brand, web: { whatsapp: { confirmed: '   ' } } }, 'confirmed'), waTemplate(brand, 'confirmed'));
});

test('una línea con todos sus datos vacíos se quita', () => {
  assert.equal(renderWa('A\n🕒 Hora: {hora}\nB', { hora: '' }), 'A\nB');
  assert.equal(renderWa('A {x} {y}', { x: '', y: 'hola' }), 'A  hola');
});

test('elige la plantilla según el estado', () => {
  assert.equal(waKindFor(req()), 'confirmed');
  assert.equal(waKindFor(req({ status: 'completed' })), 'confirmed');
  assert.equal(waKindFor(req({ status: 'pending_review' })), 'review');
});

test('número de WhatsApp con código de país', () => {
  assert.equal(waPhone('809 555 0123'), '18095550123');
  assert.equal(waPhone('+1 (829) 555-0123'), '18295550123');
  assert.equal(waPhone('0034 612 345 678'), '34612345678');
  assert.equal(waPhone('123'), '');
});

test('pagado completo: pendiente en cero y sin nota de cuándo pagar', () => {
  const m = waMessage(req({ payments: [{ status: 'verified', amount: 5500 }] }), brand, plan);
  assert.match(m, /Pendiente: RD\$\s?0\n/);
  assert.doesNotMatch(m, /se paga el día/);
  assert.match(waMessage(req(), brand, plan), /Pendiente: RD\$\s?2,750 \(se paga el día de la sesión\)/);
  assert.match(waMessage(req(), { ...brand, bookingType: 'event' }, plan), /se paga el día del evento/);
});

test('mensaje «Cambio de fecha» con la fecha anterior y la nueva', () => {
  const r = req({ date: '2026-11-21', time: '15:00', rescheduledFrom: { date: '2026-11-14', time: '10:00' } });
  const m = waMessage(r, brand, plan, 'moved');
  assert.match(m, /Antes: sábado, 14 de noviembre de 2026 · 10:00/);
  assert.match(m, /Ahora: sábado, 21 de noviembre de 2026 · 3:00/);
  assert.doesNotMatch(m, /\{\w+\}/);
  const ev = waMessage(r, { ...brand, bookingType: 'event' }, plan, 'moved');
  assert.match(ev, /Antes: sábado, 14 de noviembre de 2026\n/);
});

test('«Día de la sesión»: plantilla propia y elegida sola el día de la sesión', async () => {
  const { today, toISODate } = await import('../src/lib/date.js');
  const b = { id: 'b', name: 'Estudio', currency: 'DOP' };
  const req = { id: 'req-1', status: 'confirmed', date: toISODate(today()), time: '10:00', client: { firstName: 'Ana' }, planName: 'Pro', quote: { total: 1000, durationMin: 60 }, payments: [] };
  assert.equal(waKindFor(req), 'reminder');
  assert.equal(waKindFor({ ...req, date: '2099-01-01' }), 'confirmed');
  assert.match(waMessage(req, b, null, 'reminder'), /Llegó el día de tus fotos/);
});
