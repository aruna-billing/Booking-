// Papelera: lo borrado va a la papelera y se restaura o elimina (modo demo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCurrentUser } from '../src/lib/auth.js';
import { getState, setState } from '../src/store/mockDb.js';
import * as api from '../src/services/api.js';

const trash = () => getState().trash ?? [];
const req = (id) => getState().requests.find((r) => r.id === id);

test('solo administradores ven y usan la papelera', async () => {
  setCurrentUser('u-asist');
  await assert.rejects(api.loadTrash(), /permiso/);
  await assert.rejects(api.deleteRequest('req-1043'), /permiso/);
  await assert.rejects(api.restoreTrash('x'), /permiso/);
});

test('solicitud: a la papelera y de vuelta, tal como estaba', async () => {
  setCurrentUser('u-admin');
  const before = structuredClone(req('req-1043'));
  await api.deleteRequest('req-1043');
  assert.equal(req('req-1043'), undefined);
  const t = trash().find((x) => x.kind === 'request' && x.itemId === 'req-1043');
  assert.ok(t);
  assert.equal(t.deletedBy, 'Administración');
  assert.match(t.detail, /#1043/);
  assert.equal(t.label, `${before.client.firstName} ${before.client.lastName}`);
  assert.equal(await api.restoreTrash(t.id), 'Solicitud restaurada');
  const r = req('req-1043');
  assert.equal(r.status, before.status);
  assert.deepEqual(r.payments, before.payments);
  assert.equal(r.history.at(-1).label, 'Restaurada desde la papelera');
  assert.equal(trash().some((x) => x.id === t.id), false);
});

test('cargo quitado: a la papelera y restaurado con el total recalculado', async () => {
  setCurrentUser('u-admin');
  const id = getState().requests.find((r) => r.status === 'confirmed').id;
  const line = await api.addCharge(id, { mode: 'custom', name: 'Retoque extra', amount: 700, qty: 1 });
  const total = req(id).quote.total;
  await api.removeCharge(id, line.id);
  assert.equal(req(id).quote.total, total - 700);
  const t = trash().find((x) => x.kind === 'charge' && x.itemId === line.id);
  assert.ok(t && /Retoque extra/.test(t.label));
  await api.restoreTrash(t.id);
  assert.equal(req(id).quote.total, total);
  assert.match(req(id).history.at(-1).label, /Cargo restaurado desde la papelera/);
});

test('cupón, marca y usuario', async () => {
  setCurrentUser('u-admin');
  // Cupón sin usar
  const c = { id: 'cp-trash', code: 'BORRAME', description: '', type: 'percent', value: 5, brandIds: null, planIds: null, validFrom: '', validTo: '', maxUses: '', onePerClient: false, active: true };
  await api.saveCoupon(c);
  await api.deleteCoupon('cp-trash');
  assert.equal(getState().coupons.some((x) => x.id === 'cp-trash'), false);
  let t = trash().find((x) => x.kind === 'coupon');
  assert.equal(t.label, 'BORRAME');
  // Un cupón nuevo con el mismo código impide restaurar
  await api.saveCoupon({ ...c, id: 'cp-otro' });
  await assert.rejects(api.restoreTrash(t.id), /Ya existe otro cupón con el código/);
  await api.deleteCoupon('cp-otro');
  await api.restoreTrash(t.id);
  assert.ok(getState().coupons.some((x) => x.id === 'cp-trash'));

  // Marca sin solicitudes (con su plan y reglas)
  const b = await api.createBrand({ name: 'Marca Temporal', currency: 'DOP', depositPercent: 50, bookingType: 'session' });
  const plans = getState().plans.filter((p) => p.brandId === b.id).length;
  await api.deleteBrand(b.id);
  assert.equal(getState().brands.some((x) => x.id === b.id), false);
  t = trash().find((x) => x.kind === 'brand' && x.itemId === b.id);
  await api.restoreTrash(t.id);
  assert.ok(getState().brands.some((x) => x.id === b.id));
  assert.equal(getState().plans.filter((p) => p.brandId === b.id).length, plans);
  assert.ok(getState().rules[b.id]);

  // Usuario
  await api.deleteUser('u-asist');
  assert.equal(getState().users.some((u) => u.id === 'u-asist'), false);
  t = trash().find((x) => x.kind === 'user');
  assert.match(t.detail, /Asistente/);
  await api.restoreTrash(t.id);
  assert.ok(getState().users.some((u) => u.id === 'u-asist'));
});

test('eliminar para siempre, vaciar y caducar a los 30 días', async () => {
  setCurrentUser('u-admin');
  await api.deleteRequest('req-1044');
  const t = trash().find((x) => x.itemId === 'req-1044');
  await api.purgeTrash(t.id);
  assert.equal(trash().some((x) => x.id === t.id), false);
  await assert.rejects(api.restoreTrash(t.id), /Ya no está en la papelera/);
  // Caducados
  await api.deleteRequest('req-1045');
  const old = new Date(Date.now() - 31 * 864e5).toISOString();
  setState((s) => ({ ...s, trash: s.trash.map((x) => (x.itemId === 'req-1045' ? { ...x, deletedAt: old } : x)) }));
  assert.equal(await api.loadTrash(), 1);
  assert.equal(trash().some((x) => x.itemId === 'req-1045'), false);
  // Vaciar
  await api.deleteRequest('req-1046');
  await api.deleteRequest('req-1047');
  await api.emptyTrash();
  assert.equal(trash().length, 0);
});
