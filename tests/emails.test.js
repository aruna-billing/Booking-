import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultEmail, emailFooter, emailLogo, emailTemplate, emailVars, fillTemplate } from '../src/lib/emails.js';

const brand = { id: 'b', name: 'Estudio', currency: 'DOP', depositPercent: 50, whatsappDisplay: '809-555-0100', bookingType: 'session' };
const r = { id: 'req-1007', client: { firstName: 'Ana', lastName: 'Pérez' }, planName: 'Plan Pro', date: '2026-11-14', time: '15:30', currency: 'DOP', quote: { total: 8000, deposit: 4000, balance: 4000 } };

test('variables con formato', () => {
  const v = emailVars(r, brand);
  assert.equal(v.nombre, 'Ana');
  assert.equal(v.total, 'RD$ 8,000');
  assert.equal(v.solicitud, '1007');
  assert.match(v.fecha, /sábado, 14 de noviembre de 2026/);
  assert.match(v.hora, /3:30/);
});
test('plantillas por defecto y personalizadas', () => {
  assert.equal(emailTemplate(brand, 'review').subject, 'Recibimos tu solicitud · {marca}');
  const custom = { ...brand, web: { emails: { review: { subject: 'Hola {nombre}', body: '' } } } };
  assert.equal(emailTemplate(custom, 'review').subject, 'Hola {nombre}');
  assert.equal(emailTemplate(custom, 'review').body, defaultEmail('review', brand).body);
  assert.equal(emailTemplate({ ...brand, web: { emails: { confirmed: { enabled: false } } } }, 'confirmed').enabled, false);
});
test('fillTemplate reemplaza y deja las desconocidas', () => {
  assert.equal(fillTemplate('Hola {nombre}, {plan} {otra}', emailVars(r, brand)), 'Hola Ana, Plan Pro {otra}');
});
test('textos de bodas', () => {
  assert.match(defaultEmail('confirmed', { ...brand, bookingType: 'event' }).body, /tu fecha quedó confirmada/);
});

test('pie del correo: contacto, versión aceptada y términos según el ajuste', () => {
  const terms = { version: '1.2', sections: [{ title: 'Entrega', body: '10 días' }, { title: '', body: '' }] };
  const b = { name: 'Estudio', whatsappDisplay: '809-555-0100', email: 'hola@x.com', web: {} };
  let f = emailFooter(b, 'review', terms, { acceptedTermsVersion: '1.1' });
  assert.deepEqual(f.contact, ['Estudio', 'WhatsApp 809-555-0100', 'hola@x.com']);
  assert.match(f.accepted, /versión 1\.1/);
  assert.equal(f.terms, null);
  f = emailFooter(b, 'confirmed', terms, {});
  assert.equal(f.terms.sections.length, 1);
  assert.match(f.terms.title, /versión 1\.2/);
  assert.ok(emailFooter({ ...b, web: { emails: { footer: { terms: 'both' } } } }, 'review', terms).terms);
  assert.equal(emailFooter({ ...b, web: { emails: { footer: { terms: 'none' } } } }, 'confirmed', terms).terms, null);
  assert.equal(emailFooter({ ...b, web: { emails: { footer: { enabled: false } } } }, 'confirmed', terms), null);
  assert.equal(emailFooter(b, 'confirmed', null).accepted, '');
});

test('logo del correo: solo https y no SVG', () => {
  assert.equal(emailLogo({ logo: { src: 'https://x/a.png' } }), 'https://x/a.png');
  assert.equal(emailLogo({ logo: { src: 'https://x/a.svg' } }), '');
  assert.equal(emailLogo({ logo: { src: 'data:image/png;base64,AA' } }), '');
  assert.equal(emailLogo({}), '');
});
