// Material físico: detección por texto, casilla manual y etapa «Impresión».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraIsPhysical, isPhysicalText, needsPrint, physicalItemsOf, physicalSummary, planIsPhysical, printStateOf } from '../src/lib/physical.js';

test('detecta material físico por el texto', () => {
  for (const t of ['Impresión 8x10', 'Canva 16x20', 'Canvas 16×20', 'Foto impresa 8×10', 'Libro fine art 30×30', 'Álbum de 20 páginas', 'Cuadro enmarcado', 'Ampliación', 'Lienzo', 'Foto en acrílico'])
    assert.ok(isPhysicalText(t), t);
  for (const t of ['4 Fotografías | 1 Escenario', '1 CAMBIO DE ROPA', '6 fotos digitales', 'Galería privada', '250+ imágenes editadas', '30 minutos adicionales', 'Entrega exprés (72 h)', 'Segundo fotógrafo'])
    assert.ok(!isPhysicalText(t), t);
});

test('la casilla manda sobre la detección', () => {
  assert.equal(extraIsPhysical({ name: 'Foto impresa 8×10' }), true);
  assert.equal(extraIsPhysical({ name: 'Foto impresa 8×10', physical: false }), false);
  assert.equal(extraIsPhysical({ name: 'Recuerdo especial', physical: true }), true);
  assert.equal(planIsPhysical({ deliverables: ['1 CAMBIO DE ROPA'] }), false);
  assert.equal(planIsPhysical({ deliverables: ['1 CAMBIO DE ROPA', '1 impresión 8x10'] }), true);
  assert.equal(planIsPhysical({ deliverables: ['1 impresión 8x10'], physical: false }), false);
});

const plans = [
  { id: 'basico', deliverables: ['1 CAMBIO DE ROPA', 'Fondo a elegir'] },
  { id: 'premium', deliverables: ['10 fotos', 'Canva 16x20', 'Impresión 8x10'] },
  { id: 'manual', deliverables: ['10 fotos'], physical: true },
];
const extras = [
  { id: 'x-foto', name: 'Foto digital adicional' },
  { id: 'x-imp', name: 'Foto impresa 8×10' },
  { id: 'x-raro', name: 'Recuerdo', physical: true },
];

test('plan básico sin material: no hay etapa «Impresión»', () => {
  const r = { planId: 'basico', quote: { lines: [{ id: 'x-foto', name: 'Foto digital adicional', quantity: 2 }] } };
  assert.equal(needsPrint(r, plans, extras), false);
});

test('plan básico + extra físico: sí hay etapa, con la cantidad', () => {
  const r = { planId: 'basico', quote: { lines: [{ id: 'x-imp', name: 'Foto impresa 8×10', quantity: 3 }] } };
  assert.equal(needsPrint(r, plans, extras), true);
  assert.equal(physicalSummary(physicalItemsOf(r, plans, extras)), 'Foto impresa 8×10 ×3');
});

test('plan con material + extras + cargo aprobado; los propuestos no cuentan', () => {
  const r = {
    planId: 'premium',
    quote: { lines: [{ id: 'x-imp', name: 'Foto impresa 8×10', quantity: 1 }, { id: 'charge-1', extraId: 'x-raro', name: 'Recuerdo', quantity: 1, source: 'admin' }] },
    pendingCharges: [{ id: 'prop-1', extraId: 'x-imp', name: 'Foto impresa 8×10', quantity: 5 }],
  };
  assert.equal(physicalSummary(physicalItemsOf(r, plans, extras)), 'Canva 16x20 · Impresión 8x10 · Foto impresa 8×10 · Recuerdo');
});

test('plan marcado a mano sin líneas físicas y extra borrado del catálogo', () => {
  assert.deepEqual(physicalItemsOf({ planId: 'manual', quote: { lines: [] } }, plans, extras).map((i) => i.name), ['Material incluido en el plan']);
  const r = { planId: 'basico', quote: { lines: [{ id: 'x-viejo', name: 'Canvas 20x30', quantity: 1 }] } };
  assert.equal(needsPrint(r, plans, extras), true);
});

test('estado de la impresión', () => {
  assert.equal(printStateOf({}), 'pending');
  assert.equal(printStateOf({ print: { orderedAt: '2026-11-10' } }), 'ordered');
  assert.equal(printStateOf({ print: { orderedAt: '2026-11-10', readyAt: '2026-11-12' } }), 'ready');
});
