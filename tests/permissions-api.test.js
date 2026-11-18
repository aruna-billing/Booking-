// La capa de servicios (servidor simulado) bloquea acciones sin permiso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCurrentUser } from '../src/lib/auth.js';
import { getState, setState } from '../src/store/mockDb.js';
import * as api from '../src/services/api.js';

test('asistente: no puede registrar pagos, editar marcas, gestionar usuarios ni deshacer etapas', async () => {
  setCurrentUser('u-asist');
  await assert.rejects(api.addPayment('req-1043', { amount: 100, status: 'verified' }), /permiso/);
  await assert.rejects(api.saveBrand(getState().brands[0]), /permiso/);
  await assert.rejects(api.saveUser({ ...getState().users[1], role: 'admin' }), /permiso/);
  await assert.rejects(api.undoTrackingStep('req-1040'), /permiso/);
});

test('asistente: acepta y rechaza sesiones pendientes', async () => {
  setCurrentUser('u-asist');
  await api.acceptSession('req-1048');
  const r = getState().requests.find((x) => x.id === 'req-1048');
  assert.equal(r.status, 'confirmed');
  assert.ok(r.confirmedAt);
  assert.equal(r.history.at(-1).by, 'Laura Gómez');
  await assert.rejects(api.acceptSession('req-1048'), /ya no está pendiente/);
  await api.rejectSession('req-1046', 'Fecha no disponible');
  assert.equal(getState().requests.find((x) => x.id === 'req-1046').status, 'cancelled');
  await assert.rejects(api.acceptSession('req-1045'), /comprobante/); // comprobante rechazado
});

test('seguimiento: fotos realizadas solo desde el día de la sesión', async () => {
  setCurrentUser('u-asist');
  await assert.rejects(api.markShot('req-1044'), /todavía no ha llegado/); // sesión en 2 días
  await api.markShot('req-1049'); // sesión de ayer, sin marcar
  const r = getState().requests.find((x) => x.id === 'req-1049');
  assert.equal(r.status, 'completed');
  assert.equal(r.shotAt, r.date);
});

test('seguimiento: entrega con validaciones', async () => {
  setCurrentUser('u-asist');
  await assert.rejects(api.markDelivered('req-1044', {}), /Primero marca/);
  await assert.rejects(api.markDelivered('req-1040', {}), /ya eligió/); // falta la selección
  await api.markSelectionSent('req-1040', { url: 'https://galeria.example/elegir' });
  await api.markSelectionDone('req-1040', { count: '12' });
  await assert.rejects(api.markDelivered('req-1040', { galleryUrl: 'galeria sin protocolo' }), /https/);
  await assert.rejects(api.markDelivered('req-1040', { date: '2999-01-01' }), /futura/);
  await api.markDelivered('req-1040', { galleryUrl: 'https://galeria.example/daniela', note: '12 fotos' });
  const r = getState().requests.find((x) => x.id === 'req-1040');
  assert.ok(r.deliveredAt);
  assert.equal(r.galleryUrl, 'https://galeria.example/daniela');
});

test('administrador: deshace etapas y siempre queda uno activo', async () => {
  setCurrentUser('u-admin');
  await api.undoTrackingStep('req-1040'); // entregado → en edición
  assert.equal(getState().requests.find((x) => x.id === 'req-1040').deliveredAt, null);
  await api.undoTrackingStep('req-1040'); // en edición → selección
  assert.equal(getState().requests.find((x) => x.id === 'req-1040').selection.doneAt ?? null, null);
  await api.undoTrackingStep('req-1040'); // selección → reservado
  assert.equal(getState().requests.find((x) => x.id === 'req-1040').status, 'confirmed');
  await assert.rejects(api.saveUser({ ...getState().users[0], active: false }), /al menos un administrador/);
});

test('asistente: propone cargos; solo un administrador los aprueba o rechaza', async () => {
  setCurrentUser('u-asist');
  const id = getState().requests.find((x) => x.status === 'confirmed').id;
  const before = getState().requests.find((x) => x.id === id).quote.total;
  await assert.rejects(api.addCharge(id, { mode: 'custom', name: 'Retoque', amount: 1000 }), /permiso/);
  const p = await api.proposeCharge(id, { mode: 'custom', name: 'Retoque', amount: 1000, note: 'Lo pidió en la sesión' });
  let r = getState().requests.find((x) => x.id === id);
  assert.equal(r.quote.total, before);
  assert.equal(r.pendingCharges.length, 1);
  assert.match(r.history.at(-1).label, /pendiente de aprobación/);
  await assert.rejects(api.approveCharge(id, p.id), /permiso/);
  await assert.rejects(api.rejectCharge(id, p.id), /permiso/);
  const p2 = await api.proposeCharge(id, { mode: 'custom', name: 'Álbum', amount: 3000 });
  await api.withdrawCharge(id, p2.id);
  setCurrentUser('u-admin');
  await api.approveCharge(id, p.id);
  r = getState().requests.find((x) => x.id === id);
  assert.equal(r.quote.total, before + 1000);
  assert.equal(r.pendingCharges.length, 0);
  assert.equal(r.quote.lines.at(-1).addedBy, 'Laura Gómez');
  await assert.rejects(api.approveCharge(id, p.id), /ya no está pendiente/);
  setCurrentUser('u-asist');
  const p3 = await api.proposeCharge(id, { mode: 'custom', name: 'Marco', amount: 500 });
  setCurrentUser('u-admin');
  await api.rejectCharge(id, p3.id, 'Ya estaba incluido');
  r = getState().requests.find((x) => x.id === id);
  assert.equal(r.quote.total, before + 1000);
  assert.match(r.history.at(-1).label, /rechazado.*Ya estaba incluido/);
});

test('impresión: solo con material físico, tras la selección; bloquea la entrega hasta que esté listo', async () => {
  setCurrentUser('u-asist');
  // req-1036: en edición (boda clásica), sin material físico
  await assert.rejects(api.markPrintOrdered('req-1036', {}), /no lleva material/);
  // Se le añade una foto impresa (como si la hubiera elegido de extra)
  setState((s) => ({
    ...s,
    requests: s.requests.map((r) =>
      r.id === 'req-1036' ? { ...r, quote: { ...r.quote, lines: [...r.quote.lines, { id: 'el-x-padres', name: 'Libro para padres 20×20', unitPrice: 240, quantity: 2, total: 1000, minutes: 0 }] } } : r
    ),
  }));
  await assert.rejects(api.markDelivered('req-1036', {}), /material físico/);
  await assert.rejects(api.markPrintOrdered('req-1036', { date: '2999-01-01' }), /futura/);
  await api.markPrintOrdered('req-1036', { note: 'Laboratorio X, pedido 22' });
  let r = getState().requests.find((x) => x.id === 'req-1036');
  assert.ok(r.print.orderedAt);
  assert.equal(r.print.note, 'Laboratorio X, pedido 22');
  assert.match(r.history.at(-1).label, /enviado a imprimir/);
  await api.markPrintReady('req-1036', {});
  r = getState().requests.find((x) => x.id === 'req-1036');
  assert.ok(r.print.readyAt);
  await api.markDelivered('req-1036', { galleryUrl: 'https://galeria.example/manuel' });
  // Deshacer: entrega → listo → enviado a imprimir
  setCurrentUser('u-admin');
  await api.undoTrackingStep('req-1036');
  await api.undoTrackingStep('req-1036');
  r = getState().requests.find((x) => x.id === 'req-1036');
  assert.equal(r.deliveredAt, null);
  assert.equal(r.print.readyAt, null);
  assert.ok(r.print.orderedAt);
  await api.undoTrackingStep('req-1036');
  r = getState().requests.find((x) => x.id === 'req-1036');
  assert.equal(r.print, null);
  assert.equal(r.status, 'completed'); // sigue en edición
});

test('enlace de la galería: se puede guardar después de entregar', async () => {
  setCurrentUser('u-asist');
  const id = getState().requests.find((x) => x.deliveredAt).id;
  await assert.rejects(api.saveGalleryUrl(id, 'galeria sin protocolo'), /https/);
  await api.saveGalleryUrl(id, 'https://estudio.pixieset.com/cliente/');
  assert.equal(getState().requests.find((x) => x.id === id).galleryUrl, 'https://estudio.pixieset.com/cliente/');
  assert.match(getState().requests.find((x) => x.id === id).history.at(-1).label, /Enlace de la galería guardado/);
  await assert.rejects(api.saveGalleryUrl('req-1044', 'https://x.example/y'), /aún no está entregada/);
});
