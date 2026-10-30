import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicTitle } from '../src/lib/pageTitle.js';

const db = { organization: { name: 'Aruna One' }, brands: [{ id: 'elian-lopez-photo', name: 'Elian López Photo', published: true }] };

test('la pestaña usa los nombres del panel', () => {
  assert.equal(publicTitle('/', db), 'Reservas · Elian López Photo');
  assert.equal(publicTitle('/reservar/elian-lopez-photo', db), 'Reservas · Elian López Photo');
  assert.equal(publicTitle('/reservar/elian-lopez-photo/pago', db), 'Pago · Elian López Photo');
  assert.equal(publicTitle('/admin/login', db), 'Acceso del equipo · Aruna One');
  const two = { ...db, brands: [...db.brands, { id: 'b', name: 'Otra', published: true }] };
  assert.equal(publicTitle('/', two), 'Reservas · Aruna One');
});
