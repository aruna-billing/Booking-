import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { BrandDot, ConfirmDialog, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge, EmptyState, useToast } from '../../components/ui/misc.jsx';
import { couponLabel, couponUses, normalizeCode, validateCoupon } from '../../lib/coupons.js';
import { formatMoney } from '../../lib/format.js';
import { formatShortDate, toISODate, today } from '../../lib/date.js';
import { Link } from '../../lib/router.jsx';
import * as api from '../../services/api.js';

/** Estado de un cupón para la lista. */
function stateOf(c, uses, todayIso) {
  if (c.active === false) return { tone: 'neutral', text: 'Desactivado' };
  if (c.validFrom && todayIso < c.validFrom) return { tone: 'amber', text: `Desde ${formatShortDate(c.validFrom)}` };
  if (c.validTo && todayIso > c.validTo) return { tone: 'neutral', text: 'Vencido' };
  if (c.maxUses != null && uses >= c.maxUses) return { tone: 'neutral', text: 'Agotado' };
  return { tone: 'green', text: 'Activo' };
}

const vigencia = (c) =>
  c.validFrom && c.validTo
    ? `${formatShortDate(c.validFrom)} – ${formatShortDate(c.validTo)}`
    : c.validFrom
      ? `Desde ${formatShortDate(c.validFrom)}`
      : c.validTo
        ? `Hasta ${formatShortDate(c.validTo)}`
        : 'Sin fecha límite';

export function Coupons() {
  const db = useDb();
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const todayIso = toISODate(today());
  const coupons = db.coupons ?? [];
  const currency = db.brands[0]?.currency ?? 'DOP';
  const money = (v) => formatMoney(v, currency);

  const blank = () => ({
    id: `cp-${Date.now().toString(36)}`,
    code: '',
    description: '',
    type: 'percent',
    value: 10,
    brandIds: null,
    planIds: null,
    validFrom: todayIso,
    validTo: '',
    maxUses: '',
    onePerClient: true,
    active: true,
  });

  return (
    <>
      <PageHeader
        title="Cupones de descuento"
        description="El cliente escribe el código al reservar. El descuento se aplica al total (plan + extras) y el anticipo se calcula ya con descuento."
        actions={<Button onClick={() => setEditing({ isNew: true, item: blank() })} data-testid="coupon-add">+ Nuevo cupón</Button>}
      />

      <div className="coupon-field-toggle">
        <Toggle
          checked={db.organization.showCouponField !== false}
          onChange={async (v) => {
            const ok = await api.setCouponFieldVisible(v);
            toast(ok === false ? api.SAVE_FAILED : v ? 'El campo de cupón se muestra en la web' : 'El campo de cupón se ocultó de la web', ok === false ? 'red' : undefined);
          }}
          label="Mostrar «¿Tienes un cupón de descuento?» en la web"
        />
      </div>

      {coupons.length === 0 ? (
        <EmptyState title="Todavía no hay cupones." action={<Button variant="secondary" onClick={() => setEditing({ isNew: true, item: blank() })}>Crear el primero</Button>} />
      ) : (
        <div className="table-wrap">
          <table className="table table--responsive" data-testid="coupons-table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descuento</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Usos</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const uses = couponUses(c, db.requests).length;
                const st = stateOf(c, uses, todayIso);
                return (
                  <tr key={c.id} data-testid={`coupon-${c.code}`}>
                    <td data-label="Código">
                      <strong className="coupon-code">{c.code}</strong>
                      {c.description && <span className="muted small"> · {c.description}</span>}
                      {c.brandIds?.length ? (
                        <span className="cell-brands">{c.brandIds.map((id) => db.brands.find((b) => b.id === id)).filter(Boolean).map((b) => <BrandDot key={b.id} brand={b} withName />)}</span>
                      ) : null}
                      {c.planIds?.length ? (
                        <span className="muted small cell-plans" data-testid="coupon-plans"> · Solo: {c.planIds.map((id) => db.plans.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</span>
                      ) : null}
                    </td>
                    <td data-label="Descuento">{couponLabel(c, money)}</td>
                    <td data-label="Vigencia">{vigencia(c)}</td>
                    <td data-label="Usos">
                      {uses}
                      {c.maxUses != null ? ` de ${c.maxUses}` : ' · sin límite'}
                      {c.onePerClient && <span className="muted small"> · 1 por cliente</span>}
                    </td>
                    <td data-label="Estado"><Badge tone={st.tone}>{st.text}</Badge></td>
                    <td className="cell-action">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ item: c })} aria-label={`Editar cupón ${c.code}`}>Editar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Un uso es una reserva enviada con el cupón. Si la reserva se cancela, el uso se libera. «1 por cliente» se comprueba con el correo electrónico.
      </p>

      {editing && (
        <CouponEditor
          key={editing.item.id}
          editing={editing}
          coupons={coupons}
          brands={db.brands}
          plans={db.plans}
          uses={couponUses(editing.item, db.requests)}
          money={money}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function CouponEditor({ editing, coupons, brands, plans, uses, money, onClose }) {
  const toast = useToast();
  const [c, setC] = useState(() => ({ ...editing.item, maxUses: editing.item.maxUses ?? '' }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch) => setC((x) => ({ ...x, ...patch }));
  // Al quitar una marca se quitan también sus planes de la lista.
  const setBrands = (brandIds) => setC((x) => ({ ...x, brandIds, planIds: x.planIds ? x.planIds.filter((id) => !brandIds || brandIds.includes(plans.find((p) => p.id === id)?.brandId)) : null }));
  const planBrands = brands.filter((b) => !c.brandIds || c.brandIds.includes(b.id));
  const allPlans = !c.planIds;
  const errors = validateCoupon(c, coupons);
  const err = (k) => (tried ? errors[k] : undefined);
  const allBrands = !c.brandIds;
  const example = 10000;
  const exampleDiscount = c.type === 'percent' ? Math.round((example * Math.min(100, Number(c.value) || 0)) / 100) : Math.min(example, Number(c.value) || 0);

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await api.saveCoupon(c);
      if (ok === false) {
        toast(api.SAVE_FAILED, 'red');
        setBusy(false);
        return;
      }
      toast(editing.isNew ? `Cupón ${normalizeCode(c.code)} creado` : 'Cupón actualizado', 'green');
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
      title={editing.isNew ? 'Nuevo cupón' : `Cupón ${editing.item.code}`}
      footer={
        <>
          {!editing.isNew && (
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)} disabled={uses.length > 0} title={uses.length ? 'Ya se usó: desactívalo en lugar de borrarlo' : undefined} data-testid="coupon-delete">
              Eliminar
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="coupon-save">{editing.isNew ? 'Crear cupón' : 'Guardar'}</Button>
        </>
      }
    >
      <div className="form">
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <div className="form__row">
          <Field label="Código" required error={err('code')} hint="Lo que escribe el cliente. Sin espacios; no distingue mayúsculas.">
            <input data-autofocus value={c.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, '') })} placeholder="VERANO10" autoCapitalize="characters" data-testid="coupon-code" />
          </Field>
          <Field label="Nota interna" hint="Solo la ve el equipo.">
            <input value={c.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ej.: campaña de Instagram" />
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="field__label">Descuento</legend>
          <div className="coupon-value">
            <div className="seg" role="radiogroup" aria-label="Tipo de descuento">
              {[['percent', 'Porcentaje'], ['fixed', 'Monto fijo']].map(([k, label]) => (
                <label key={k} className={`seg__opt ${c.type === k ? 'is-on' : ''}`}>
                  <input type="radio" name="coupon-type" checked={c.type === k} onChange={() => set({ type: k })} data-testid={`coupon-type-${k}`} /> {label}
                </label>
              ))}
            </div>
            <Field label={c.type === 'percent' ? 'Porcentaje' : 'Monto'} required error={err('value')}>
              <input type="number" min={1} max={c.type === 'percent' ? 100 : undefined} value={c.value} onChange={(e) => set({ value: e.target.value })} data-testid="coupon-value" />
            </Field>
          </div>
          <p className="muted small">Ejemplo: en una reserva de {money(example)} el cliente paga {money(example - exampleDiscount)} ({money(exampleDiscount)} de descuento).</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field__label">Fechas en que se puede usar</legend>
          <div className="form__row">
            <Field label="Desde" hint="Vacío = desde ya.">
              <input type="date" value={c.validFrom} onChange={(e) => set({ validFrom: e.target.value })} data-testid="coupon-from" />
            </Field>
            <Field label="Hasta (incluido)" hint="Vacío = sin fecha final." error={err('validTo')}>
              <input type="date" value={c.validTo} min={c.validFrom || undefined} onChange={(e) => set({ validTo: e.target.value })} data-testid="coupon-to" />
            </Field>
          </div>
          <p className="muted small">Cuenta la fecha en que el cliente envía la reserva, no la fecha de la sesión.</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field__label">Límite de usos</legend>
          <div className="form__row">
            <Field label="Cantidad máxima de reservas" hint="Vacío = sin límite." error={err('maxUses')}>
              <input type="number" min={1} step={1} value={c.maxUses} onChange={(e) => set({ maxUses: e.target.value })} placeholder="Sin límite" data-testid="coupon-max" />
            </Field>
            <Toggle checked={c.onePerClient} onChange={(v) => set({ onePerClient: v })} label="Solo una vez por cliente (mismo correo)" />
          </div>
          {!editing.isNew && <p className="muted small">Usado {uses.length} {uses.length === 1 ? 'vez' : 'veces'}{uses.length > 0 && <>: {uses.slice(0, 5).map((r, i) => <span key={r.id}>{i ? ', ' : ' '}<Link to={`/admin/solicitudes/${r.id}`}>{r.client.firstName} {r.client.lastName}</Link></span>)}{uses.length > 5 ? '…' : ''}</>}.</p>}
        </fieldset>

        {brands.length > 1 && (
          <fieldset className="fieldset">
            <legend className="field__label">Marcas</legend>
            <label className="check-inline">
              <input type="checkbox" checked={allBrands} onChange={(e) => setBrands(e.target.checked ? null : [])} data-testid="coupon-all-brands" /> Todas las marcas
            </label>
            {!allBrands &&
              brands.map((b) => (
                <label key={b.id} className="check-inline">
                  <input type="checkbox" checked={c.brandIds.includes(b.id)} onChange={(e) => setBrands(e.target.checked ? [...c.brandIds, b.id] : c.brandIds.filter((x) => x !== b.id))} data-testid={`coupon-brand-${b.id}`} /> {b.name}
                </label>
              ))}
            {err('brandIds') && <p className="field__error" role="alert">{err('brandIds')}</p>}
          </fieldset>
        )}

        <fieldset className="fieldset" data-testid="coupon-plans-field">
          <legend className="field__label">Planes</legend>
          <label className="check-inline">
            <input type="checkbox" checked={allPlans} onChange={(e) => set({ planIds: e.target.checked ? null : [] })} data-testid="coupon-all-plans" />{' '}
            {brands.length > 1 && c.brandIds ? 'Todos los planes de las marcas elegidas' : 'Todos los planes'}
          </label>
          {!allPlans && (
            <div className="coupon-plan-list">
              {planBrands.map((b) => {
                const list = plans.filter((p) => p.brandId === b.id);
                if (!list.length) return null;
                return (
                  <div key={b.id} className="coupon-plan-group">
                    {planBrands.length > 1 && <p className="muted small coupon-plan-group__title">{b.name}</p>}
                    {list.map((p) => (
                      <label key={p.id} className="check-inline">
                        <input type="checkbox" checked={c.planIds.includes(p.id)} onChange={(e) => set({ planIds: e.target.checked ? [...c.planIds, p.id] : c.planIds.filter((x) => x !== p.id) })} data-testid={`coupon-plan-${p.id}`} />{' '}
                        {p.name}{p.active === false && <span className="muted small"> (inactivo)</span>}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {err('planIds') && <p className="field__error" role="alert">{err('planIds')}</p>}
          <p className="muted small">El descuento se aplica al total (plan + extras) solo si el cliente elige uno de estos planes.</p>
        </fieldset>

        <Toggle checked={c.active} onChange={(v) => set({ active: v })} label={c.active ? 'Activo: se puede usar' : 'Desactivado: nadie puede usarlo'} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar cupón"
        message={`El cupón ${editing.item.code} dejará de existir.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={async () => {
          try {
            const ok = await api.deleteCoupon(editing.item.id);
            toast(ok === false ? api.SAVE_FAILED : 'Cupón eliminado', ok === false ? 'red' : 'neutral');
            onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      />
    </Modal>
  );
}
