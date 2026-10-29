import { LIVE } from '../../lib/mode.js';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { DemoNotice, useToast } from '../../components/ui/misc.jsx';
import * as api from '../../services/api.js';

export function BankAccounts() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const brands = db.brands.filter((b) => brandFilter === 'all' || b.id === brandFilter);

  return (
    <>
      <PageHeader title="Cuentas bancarias" description="Cuentas que ve el cliente en el paso de pago. Solo se muestran las activas de cada marca." />
      <DemoNotice live="Las cuentas activas se muestran al cliente en el paso de pago. Las inactivas solo las ve el equipo.">
        Todas las cuentas son <strong>ficticias</strong>. No introduzcas datos bancarios reales en el prototipo: en producción se gestionarán en Supabase con acceso restringido.
      </DemoNotice>

      {brands.map((brand) => (
        <section key={brand.id} className="catalog-brand">
          <div className="section-head">
            <h2 className="section-title"><BrandDot brand={brand} /> {brand.name}</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing({ isNew: true, item: { id: `ba-${Date.now()}`, brandId: brand.id, bank: '', accountType: 'Cuenta corriente', accountNumber: '', holder: '', taxId: '', currency: brand.currency, active: true } })}
            >
              + Nueva cuenta
            </Button>
          </div>
          <ul className="accounts accounts--admin">
            {db.bankAccounts.filter((a) => a.brandId === brand.id).map((a) => (
              <li key={a.id} className={`account ${a.active ? '' : 'is-inactive'}`}>
                <p className="account__bank">{a.bank}</p>
                <dl className="account__data">
                  <div><dt>Tipo</dt><dd>{a.accountType} · {a.currency}</dd></div>
                  <div><dt>Número</dt><dd>{a.accountNumber}</dd></div>
                  <div><dt>Titular</dt><dd>{a.holder}</dd></div>
                  <div><dt>Identificación</dt><dd>{a.taxId}</dd></div>
                </dl>
                <div className="account__actions">
                  <Toggle checked={a.active} label={a.active ? 'Visible al cliente' : 'Oculta'} onChange={(v) => api.saveBankAccount({ ...a, active: v }).then(() => toast(v ? 'Cuenta activada' : 'Cuenta ocultada'))} />
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ item: a })}>Editar</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <AccountEditor key={editing.item.id} editing={editing} onClose={() => setEditing(null)} onSave={async (a) => { const saved = await api.saveBankAccount(a); setEditing(null); if (saved === false) toast(api.SAVE_FAILED, 'red'); else toast('Cuenta guardada', 'green'); }} />}
    </>
  );
}

function AccountEditor({ editing, onClose, onSave }) {
  const [a, setA] = useState(editing.item);
  const [errors, setErrors] = useState({});
  const set = (patch) => setA((x) => ({ ...x, ...patch }));
  const save = () => {
    const e = {};
    if (!a.bank.trim()) e.bank = 'Indica el banco.';
    if (!a.accountNumber.trim()) e.accountNumber = 'Indica el número de cuenta.';
    if (!a.holder.trim()) e.holder = 'Indica el titular.';
    setErrors(e);
    if (Object.keys(e).length) return;
    // Salvaguarda del prototipo: en la demo toda cuenta queda marcada como ficticia.
    const num = LIVE || /ficticia/i.test(a.accountNumber) ? a.accountNumber.trim() : `${a.accountNumber} (FICTICIA)`;
    onSave({ ...a, accountNumber: num });
  };
  return (
    <Modal open onClose={onClose} title={editing.isNew ? (LIVE ? 'Nueva cuenta' : 'Nueva cuenta (ficticia)') : 'Editar cuenta'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
      <p className="callout">{LIVE ? 'El cliente verá estos datos en el paso de pago. Revísalos con cuidado.' : 'Usa solo datos inventados. El prototipo añade «(FICTICIA)» al número automáticamente.'}</p>
      <div className="form">
        <Field label="Banco" required error={errors.bank}><input data-autofocus value={a.bank} onChange={(e) => set({ bank: e.target.value })} /></Field>
        <div className="form__row">
          <Field label="Tipo de cuenta"><input value={a.accountType} onChange={(e) => set({ accountType: e.target.value })} /></Field>
          <Field label="Moneda">
            <select value={a.currency} onChange={(e) => set({ currency: e.target.value })}><option>DOP</option><option>USD</option></select>
          </Field>
        </div>
        <Field label="Número de cuenta" required error={errors.accountNumber}><input value={a.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} /></Field>
        <Field label="Titular" required error={errors.holder}><input value={a.holder} onChange={(e) => set({ holder: e.target.value })} /></Field>
        <Field label="RNC / Cédula"><input value={a.taxId} onChange={(e) => set({ taxId: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
