import { BadgePicker } from '../../components/admin/BadgePicker.jsx';
import { BadgeChip } from '../../components/ui/BadgeChip.jsx';
import { badgeOf } from '../../lib/badges.js';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PhotoPlaceholder, useToast } from '../../components/ui/misc.jsx';
import { PlanImage } from '../../components/ui/PlanImage.jsx';
import { ImageSlot } from '../../components/admin/ImagePicker.jsx';
import { formatDuration, formatMoney } from '../../lib/format.js';
import * as api from '../../services/api.js';

const TONES = ['sand', 'olive', 'clay', 'ink', 'linen', 'noir', 'gold'];

export function Catalog() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState('plans');
  const [editing, setEditing] = useState(null); // { kind, item }

  const brands = db.brands.filter((b) => brandFilter === 'all' || b.id === brandFilter);

  return (
    <>
      <PageHeader title="Planes y extras" description="Los cambios se reflejan al instante en el flujo público." />
      <div className="tabs" role="tablist" aria-label="Tipo de catálogo">
        <button type="button" role="tab" aria-selected={tab === 'plans'} className={`tab ${tab === 'plans' ? 'is-active' : ''}`} onClick={() => setTab('plans')}>Planes</button>
        <button type="button" role="tab" aria-selected={tab === 'extras'} className={`tab ${tab === 'extras' ? 'is-active' : ''}`} onClick={() => setTab('extras')}>Extras</button>
      </div>

      {brands.map((brand) => {
        const plans = db.plans.filter((p) => p.brandId === brand.id);
        const extras = db.extras.filter((e) => e.brandId === brand.id);
        return (
          <section key={brand.id} className="catalog-brand" aria-labelledby={`cb-${brand.id}`}>
            <div className="section-head">
              <h2 id={`cb-${brand.id}`} className="section-title"><BrandDot brand={brand} /> {brand.name} <span className="muted small">· {brand.currency}</span></h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setEditing(
                    tab === 'plans'
                      ? { kind: 'plan', isNew: true, item: { id: `${brand.id.slice(0, 2)}-${Date.now()}`, brandId: brand.id, name: '', category: '', description: '', durationMin: 60, deliverables: [], price: 0, tone: 'sand', active: true } }
                      : { kind: 'extra', isNew: true, item: { id: `${brand.id.slice(0, 2)}-x-${Date.now()}`, brandId: brand.id, name: '', description: '', price: 0, pricing: 'fixed', maxQty: 3, appliesTo: null, active: true } }
                  )
                }
              >
                + {tab === 'plans' ? 'Nuevo plan' : 'Nuevo extra'}
              </Button>
            </div>

            {tab === 'plans' ? (
              <ul className="cat-list">
                {plans.map((p, i) => (
                  <li key={p.id} className={`cat-item ${p.active ? '' : 'is-inactive'}`}>
                    <PlanImage plan={p} ratio="1 / 1" variant={i} label="Muestra" className="cat-item__img" />
                    <div className="cat-item__info">
                      <strong>{p.name}{badgeOf(p) && <> <BadgeChip badge={badgeOf(p)} /></>}</strong>
                      <span className="muted small">{p.category} · {formatDuration(p.durationMin)}</span>
                    </div>
                    <span className="cat-item__price">{formatMoney(p.price, brand.currency)}</span>
                    <Toggle checked={p.active} label={p.active ? 'Visible' : 'Oculto'} onChange={(v) => api.savePlan({ ...p, active: v }).then((ok) => toast(ok === false ? api.SAVE_FAILED : v ? 'Plan visible' : 'Plan oculto', ok === false ? 'red' : undefined))} />
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: 'plan', item: p })} aria-label={`Editar ${p.name}`}>Editar</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="cat-list">
                {extras.map((x) => (
                  <li key={x.id} className={`cat-item cat-item--extra ${x.active ? '' : 'is-inactive'}`}>
                    <div className="cat-item__info">
                      <strong>{x.name}{badgeOf(x) && <> <BadgeChip badge={badgeOf(x)} /></>}</strong>
                      <span className="muted small">
                        {x.pricing === 'per_unit' ? `Por unidad (máx. ${x.maxQty})` : 'Precio fijo'} ·{' '}
                        {x.addsMinutes ? `+${formatDuration(x.addsMinutes)} de sesión${x.pricing === 'per_unit' ? ' c/u' : ''} · ` : ''}
                        {x.expressDelivery ? 'Entrega en 72 h · ' : ''}
                        {x.appliesTo?.length ? `Solo: ${x.appliesTo.map((id) => plans.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}` : 'Todos los planes'}
                      </span>
                    </div>
                    <span className="cat-item__price">{formatMoney(x.price, brand.currency)}</span>
                    <Toggle checked={x.active} label={x.active ? 'Visible' : 'Oculto'} onChange={(v) => api.saveExtra({ ...x, active: v }).then((ok) => toast(ok === false ? api.SAVE_FAILED : v ? 'Extra visible' : 'Extra oculto', ok === false ? 'red' : undefined))} />
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: 'extra', item: x })} aria-label={`Editar ${x.name}`}>Editar</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {editing && (
        <CatalogEditor
          key={editing.item.id}
          editing={editing}
          plans={db.plans.filter((p) => p.brandId === editing.item.brandId)}
          currency={db.brands.find((b) => b.id === editing.item.brandId).currency}
          onClose={() => setEditing(null)}
          onSave={async (item) => {
            const saved = await (editing.kind === 'plan' ? api.savePlan(item) : api.saveExtra(item));
            setEditing(null);
            if (saved === false) toast(api.SAVE_FAILED, 'red');
            else toast('Cambios guardados', 'green');
          }}
        />
      )}
    </>
  );
}

function CatalogEditor({ editing, plans, currency, onClose, onSave }) {
  const [item, setItem] = useState(editing.item);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (patch) => setItem((x) => ({ ...x, ...patch }));
  const isPlan = editing.kind === 'plan';

  const save = async () => {
    const e = {};
    if (!item.name.trim()) e.name = 'El nombre es obligatorio.';
    if (!(Number(item.price) > 0)) e.price = 'Indica un precio mayor que 0.';
    if (isPlan && !(Number(item.durationMin) > 0)) e.durationMin = 'Indica la duración en minutos.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const badge = item.badge && item.badge.text?.trim() ? { emoji: item.badge.emoji ?? '', text: item.badge.text.trim().slice(0, 30) } : item.badge === undefined ? undefined : null;
    await onSave({ ...item, badge, name: item.name.trim(), price: Math.round(Number(item.price)), durationMin: isPlan ? Number(item.durationMin) : undefined, maxQty: Number(item.maxQty) || 1, addsMinutes: isPlan ? undefined : Math.max(0, Number(item.addsMinutes) || 0) });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${editing.isNew ? 'Nuevo' : 'Editar'} ${isPlan ? 'plan' : 'extra'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy}>Guardar</Button>
        </>
      }
    >
      <div className="form">
        <Field label="Nombre" required error={errors.name}>
          <input data-autofocus type="text" value={item.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {isPlan && (
          <Field label="Categoría">
            <input type="text" value={item.category} onChange={(e) => set({ category: e.target.value })} />
          </Field>
        )}
        <Field label="Descripción">
          <textarea rows={3} value={item.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <BadgePicker item={item} kind={isPlan ? 'plan' : 'extra'} onChange={(badge) => set({ badge, featured: false })} />
        <div className="form__row">
          <Field label={`Precio (${currency})`} required error={errors.price}>
            <input type="number" min="0" step="1" inputMode="numeric" value={item.price} onChange={(e) => set({ price: e.target.value })} />
          </Field>
          {isPlan ? (
            <Field label="Duración (minutos)" required error={errors.durationMin}>
              <input type="number" min="15" step="15" value={item.durationMin} onChange={(e) => set({ durationMin: e.target.value })} />
            </Field>
          ) : (
            <Field label="Tipo de precio">
              <select value={item.pricing} onChange={(e) => set({ pricing: e.target.value })}>
                <option value="fixed">Fijo (se añade una vez)</option>
                <option value="per_unit">Por unidad (el cliente elige cantidad)</option>
              </select>
            </Field>
          )}
        </div>
        {!isPlan && (
          <div className="form__row">
            {item.pricing === 'per_unit' ? (
              <Field label="Cantidad máxima">
                <input type="number" min="1" max="20" value={item.maxQty} onChange={(e) => set({ maxQty: e.target.value })} />
              </Field>
            ) : <span />}
            <Field label="Minutos que suma a la sesión" hint={item.pricing === 'per_unit' ? 'Por cada unidad. 0 si no añade tiempo.' : '0 si no añade tiempo.'}>
              <input type="number" min="0" step="15" value={item.addsMinutes ?? 0} onChange={(e) => set({ addsMinutes: e.target.value })} />
            </Field>
          </div>
        )}
        {!isPlan && (
          <label className="check-inline">
            <input type="checkbox" checked={!!item.expressDelivery} onChange={(e) => set({ expressDelivery: e.target.checked })} /> Entrega exprés: acorta la entrega a 72 horas (Seguimientos)
          </label>
        )}
        {isPlan && (
          <>
            <Field label="Incluye" hint="Un elemento por línea.">
              <textarea rows={3} value={item.deliverables.join('\n')} onChange={(e) => set({ deliverables: e.target.value.split('\n').filter((l) => l.trim()) })} />
            </Field>
            <ImageSlot
              label="Imagen del plan"
              hint="Elige de la biblioteca o sube una nueva. Recomendado vertical 4:5. También se gestiona en Personalización."
              imageId={item.imageId ?? null}
              onChange={(id) => set({ imageId: id })}
              brandId={item.brandId}
              ratio="4 / 5"
              testId="plan-image-slot"
            />
            <fieldset className="fieldset">
              <legend className="field__label">Tono del marcador (si no hay imagen)</legend>
              <div className="tone-pick">
                {TONES.map((t, i) => (
                  <label key={t} className={item.tone === t ? 'is-on' : ''}>
                    <input type="radio" name="tone" value={t} checked={item.tone === t} onChange={() => set({ tone: t })} className="visually-hidden" />
                    <PhotoPlaceholder tone={t} ratio="1 / 1" variant={i} label={t} />
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {!isPlan && (
          <fieldset className="fieldset">
            <legend className="field__label">Disponible para</legend>
            <label className="check-inline">
              <input type="checkbox" checked={!item.appliesTo?.length} onChange={(e) => set({ appliesTo: e.target.checked ? null : [] })} /> Todos los planes
            </label>
            {item.appliesTo &&
              plans.map((p) => (
                <label key={p.id} className="check-inline">
                  <input
                    type="checkbox"
                    checked={item.appliesTo.includes(p.id)}
                    onChange={(e) => set({ appliesTo: e.target.checked ? [...item.appliesTo, p.id] : item.appliesTo.filter((x) => x !== p.id) })}
                  />{' '}
                  {p.name}
                </label>
              ))}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
