// La capa de servicios (servidor simulado) bloquea acciones sin permiso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCurrentUser } from '../src/lib/auth.js';
import { getState } from '../src/store/mockDb.js';
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
  await api.undoTrackingStep('req-1040'); // en edición → reservado
  assert.equal(getState().requests.find((x) => x.id === 'req-1040').status, 'confirmed');
  await assert.rejects(api.saveUser({ ...getState().users[0], active: false }), /al menos un administrador/);
});
