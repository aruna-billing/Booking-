import { LIVE } from '../../lib/mode.js';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { BrandDot, Card, ConfirmDialog, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge, DemoNotice, useToast } from '../../components/ui/misc.jsx';
import { PERMISSIONS, ROLES } from '../../data/roles.js';
import { initials } from '../../lib/format.js';
import * as api from '../../services/api.js';

export function Users() {
  const db = useDb();
  const { user: me } = useAdmin();
  const [editing, setEditing] = useState(null);
  const brandName = (id) => db.brands.find((b) => b.id === id);

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Quién entra al panel y qué puede hacer."
        actions={
          <Button onClick={() => setEditing({ isNew: true, user: { id: `u-${Date.now().toString(36)}`, name: '', email: '', role: 'assistant', brandIds: null, active: true } })} data-testid="add-user">
            + Añadir usuario
          </Button>
        }
      />
      <DemoNotice
        compact
        live={<>Para añadir a alguien, primero crea su cuenta en Supabase → <strong>Authentication → Users → Add user</strong> (correo y contraseña). Luego añádela aquí con el mismo correo y elige su rol.</>}
      >
        Prototipo sin inicio de sesión: los usuarios se crean al instante y puedes probar cada rol con «Ver como» en la barra superior. En producción se enviará una invitación por correo.
      </DemoNotice>

      <div className="table-wrap">
        <table className="table users-table">
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Marcas</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'is-inactive'} data-testid={`user-${u.id}`}>
                <td data-label="Usuario">
                  <span className="cell-user">
                    <span className="userbox__avatar userbox__avatar--light" aria-hidden="true">{initials(...u.name.split(' '))}</span>
                    <span>
                      <strong>{u.name}</strong>
                      {u.id === me?.id && <span className="muted small"> (tú)</span>}
                      <span className="muted small cell-user__email">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td data-label="Rol"><Badge tone={u.role === 'admin' ? 'ink' : 'neutral'}>{ROLES[u.role]?.label}</Badge></td>
                <td data-label="Marcas">
                  {u.brandIds ? (
                    <span className="cell-brands">{u.brandIds.map((id) => brandName(id)).filter(Boolean).map((b) => <BrandDot key={b.id} brand={b} withName />)}</span>
                  ) : (
                    <span className="muted">Todas</span>
                  )}
                </td>
                <td data-label="Estado">{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="neutral">Desactivado</Badge>}</td>
                <td className="cell-action">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ user: u })} aria-label={`Editar ${u.name}`}>Editar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card title="Qué puede hacer cada rol">
        <div className="table-scroll">
          <table className="table perm-table">
            <thead>
              <tr>
                <th scope="col">Permiso</th>
                {Object.entries(ROLES).map(([k, r]) => <th key={k} scope="col" className="perm-table__role">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.label}</th>
                  {Object.entries(ROLES).map(([k, r]) => {
                    const yes = r.permissions.includes(p.key);
                    return (
                      <td key={k} className={`perm-table__cell ${yes ? 'is-yes' : ''}`}>
                        <span aria-hidden="true">{yes ? '✓' : '—'}</span>
                        <span className="visually-hidden">{yes ? 'Sí' : 'No'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Los asistentes solo ven las solicitudes y comprobantes de las marcas que tengan asignadas.</p>
      </Card>

      {editing && <UserEditor key={editing.user.id} editing={editing} me={me} brands={db.brands} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserEditor({ editing, me, brands, onClose }) {
  const toast = useToast();
  const [u, setU] = useState(editing.user);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch) => {
    setU((x) => ({ ...x, ...patch }));
    setError(null);
  };
  const isMe = u.id === me?.id;
  const allBrands = !u.brandIds;

  const save = async () => {
    setBusy(true);
    try {
      await api.saveUser(u);
      toast(editing.isNew ? `${u.name.trim()} añadido` : 'Usuario actualizado', 'green');
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing.isNew ? 'Añadir usuario' : `Editar · ${editing.user.name}`}
      footer={
        <>
          {!editing.isNew && !isMe && (
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)} data-testid="user-delete">Eliminar</Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="user-save">{editing.isNew ? 'Añadir' : 'Guardar'}</Button>
        </>
      }
    >
      <div className="form">
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <div className="form__row">
          <Field label="Nombre" required>
            <input data-autofocus value={u.name} onChange={(e) => set({ name: e.target.value })} data-testid="user-name" />
          </Field>
          <Field label="Correo" required>
            <input type="email" value={u.email} onChange={(e) => set({ email: e.target.value })} disabled={LIVE && !editing.isNew} data-testid="user-email" />
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="field__label">Rol</legend>
          <div className="choice-cards">
            {Object.entries(ROLES).map(([k, r]) => (
              <label key={k} className={`choice ${u.role === k ? 'is-on' : ''}`}>
                <input type="radio" name="role" checked={u.role === k} onChange={() => set({ role: k, brandIds: k === 'admin' ? null : u.brandIds })} disabled={isMe} data-testid={`role-${k}`} />
                <span><strong>{r.label}</strong><span className="muted small">{r.description}</span></span>
              </label>
            ))}
          </div>
          {isMe && <p className="muted small">No puedes cambiar tu propio rol.</p>}
        </fieldset>

        {u.role === 'assistant' && (
          <fieldset className="fieldset">
            <legend className="field__label">Marcas que atiende</legend>
            <label className="check-inline">
              <input type="checkbox" checked={allBrands} onChange={(e) => set({ brandIds: e.target.checked ? null : [] })} data-testid="brands-all" /> Todas las marcas
            </label>
            {!allBrands &&
              brands.map((b) => (
                <label key={b.id} className="check-inline">
                  <input
                    type="checkbox"
                    checked={u.brandIds.includes(b.id)}
                    onChange={(e) => set({ brandIds: e.target.checked ? [...u.brandIds, b.id] : u.brandIds.filter((x) => x !== b.id) })}
                    data-testid={`brand-${b.id}`}
                  />{' '}
                  {b.name}
                </label>
              ))}
          </fieldset>
        )}

        {!isMe && <Toggle checked={u.active} onChange={(v) => set({ active: v })} label={u.active ? 'Activo: puede entrar al panel' : 'Desactivado: no puede entrar'} />}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar usuario"
        message={`${editing.user.name} dejará de tener acceso al panel. Su nombre seguirá apareciendo en el historial de las solicitudes que gestionó.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={async () => {
          try {
            await api.deleteUser(editing.user.id);
            toast('Usuario eliminado', 'red');
            onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      />
    </Modal>
  );
}
