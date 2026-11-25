// Una solicitud restaurada desde la Papelera no vuelve a enviar «Reserva en revisión».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindFor } from '../supabase/functions/booking-emails/index.ts';

test('INSERT de una solicitud restaurada: sin correo', () => {
  assert.equal(kindFor('INSERT', { payload: { status: 'pending_review' } }, null), 'review');
  assert.equal(kindFor('INSERT', { payload: { status: 'pending_review', restoredAt: '2026-11-24T10:00:00Z' } }, null), null);
  assert.equal(kindFor('INSERT', { payload: { status: 'confirmed', restoredAt: '2026-11-24T10:00:00Z' } }, null), null);
});
