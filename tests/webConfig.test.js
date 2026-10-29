// Pruebas de la configuración de la web (valores por defecto y textos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeb, webText, imageUsage } from '../src/lib/webConfig.js';

const brand = { id: 'b', bookingType: 'session', studio: { gallery: ['A', 'B'] } };

test('getWeb completa valores por defecto', () => {
  const w = getWeb(brand);
  assert.equal(w.hero.show, true);
  assert.equal(w.hero.size, 'normal');
  assert.deepEqual(w.gallery.items, [{ imageId: null, label: 'A' }, { imageId: null, label: 'B' }]);
  assert.equal(w.gallery.show, true);
});

test('getWeb respeta lo guardado, incluidas secciones ocultas', () => {
  const w = getWeb({ ...brand, web: { hero: { show: false }, intro: { show: false }, gallery: { show: false, items: [] } } });
  assert.equal(w.hero.show, false);
  assert.equal(w.hero.size, 'normal');
  assert.equal(w.intro.show, false);
  assert.equal(w.gallery.show, false);
  assert.deepEqual(w.gallery.items, []);
});

test('webText usa el texto propio o el predeterminado', () => {
  assert.match(webText(brand, 'thanksMessage'), /^¡Gracias por tu interés! Tu reserva está en revisión\. Te contactaremos mediante WhatsApp\.$/);
  assert.equal(webText({ ...brand, web: { texts: { thanksMessage: 'Hola' } } }, 'thanksMessage'), 'Hola');
  assert.match(webText({ ...brand, web: { texts: { thanksMessage: '   ' } } }, 'thanksMessage'), /Gracias por tu interés/);
  assert.match(webText({ ...brand, bookingType: 'event' }, 'notesHint'), /ceremonia/);
});

test('imageUsage encuentra todos los usos', () => {
  const db = {
    brands: [{ ...brand, name: 'Marca', web: { hero: { imageId: 'x' }, cardImageId: 'x', gallery: { items: [{ imageId: 'y' }, { imageId: 'x' }] } } }],
    plans: [{ name: 'Plan 1', imageId: 'x' }],
  };
  assert.deepEqual(imageUsage(db, 'x'), ['Portada · Marca', 'Tarjeta en la portada general · Marca', 'Galería (foto 2) · Marca', 'Plan «Plan 1»']);
  assert.deepEqual(imageUsage(db, 'z'), []);
});

import { planTypeVars } from '../src/lib/webConfig.js';

test('tipografía de planes: por defecto hereda la de la marca', () => {
  const v = planTypeVars({ ...brand, theme: { displayStyle: 'italic' } });
  assert.equal(v['--plan-title-font'], undefined);
  assert.equal(v['--plan-title-style'], 'italic');
  assert.equal(v['--plan-title-weight'], '400');
  assert.equal(v['--plan-title-size'], '1.75rem');
  assert.equal(v['--plans-headline-transform'], 'uppercase');
});

test('tipografía de planes: valores elegidos y peso más cercano disponible', () => {
  const v = planTypeVars(
    { ...brand, theme: { displayStyle: 'italic' } },
    { titleFamily: 'DM Serif Display', titleItalic: false, titleWeight: 700, titleSize: 'l', bodyFamily: 'Montserrat', headlineFamily: 'Bodoni Moda', headlineUppercase: false }
  );
  assert.match(v['--plan-title-font'], /^'DM Serif Display', /);
  assert.equal(v['--plan-title-style'], 'normal');
  assert.equal(v['--plan-title-weight'], '400'); // DM Serif Display solo tiene 400
  assert.equal(v['--plan-title-size'], '2.125rem');
  assert.match(v['--plan-body-font'], /^'Montserrat'/);
  assert.match(v['--plans-headline-font'], /^'Bodoni Moda'/);
  assert.equal(v['--plans-headline-transform'], 'none');
});
