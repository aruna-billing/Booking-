// Pruebas de roles y permisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, PERMISSIONS } from '../src/data/roles.js';
import { can, canSeeBrand, resolveUser, visibleBrands } from '../src/lib/auth.js';

const admin = { id: 'a', role: 'admin', brandIds: null, active: true };
const asis = { id: 'b', role: 'assistant', brandIds: ['elian'], active: true };

test('el administrador tiene todos los permisos', () => {
  PERMISSIONS.forEach((p) => assert.equal(can(admin, p.key), true, p.key));
});

test('la asistente ve solicitudes, comprobantes y seguimientos; decide sesiones y marca etapas', () => {
  assert.deepEqual([...ROLES.assistant.permissions].sort(), ['receipts.view', 'requests.view', 'sessions.decide', 'tracking.update', 'tracking.view']);
  for (const p of ['dashboard.view', 'finance.view', 'payments.manage', 'requests.manage', 'catalog.manage', 'web.manage', 'brands.manage', 'users.manage']) {
    assert.equal(can(asis, p), false, p);
  }
});

test('un usuario desactivado no tiene permisos', () => {
  assert.equal(can({ ...admin, active: false }, 'requests.view'), false);
});

test('alcance por marca', () => {
  const brands = [{ id: 'aruna' }, { id: 'elian' }];
  assert.equal(canSeeBrand(admin, 'aruna'), true);
  assert.equal(canSeeBrand(asis, 'aruna'), false);
  assert.equal(canSeeBrand(asis, 'elian'), true);
  assert.deepEqual(visibleBrands(asis, brands).map((b) => b.id), ['elian']);
});

test('si el usuario elegido no existe o está inactivo, se usa un administrador activo', () => {
  const users = [{ ...asis, active: false }, admin];
  assert.equal(resolveUser(users, 'b').id, 'a');
  assert.equal(resolveUser(users, 'zzz').id, 'a');
});
