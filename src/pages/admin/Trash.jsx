import { useEffect, useMemo, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { BrandDot, ConfirmDialog, PageHeader } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, EmptyState, useToast } from '../../components/ui/misc.jsx';
import { formatShortDate } from '../../lib/date.js';
import * as api from '../../services/api.js';

const ORDER = ['request', 'charge', 'coupon', 'brand', 'user', 'media'];
const PLURAL = { request: 'Solicitudes', charge: 'Cargos', coupon: 'Cupones', brand: 'Marcas', user: 'Usuarios', media: 'Imágenes y videos' };
const TONE = { request: 'ink', charge: 'amber', coupon: 'green', brand: 'neutral', user: 'neutral', media: 'neutral' };

const isoDay = (iso) => String(iso ?? '').slice(0, 10);
const daysLeft = (t) => Math.max(0, Math.ceil((new Date(api.trashExpiresAt(t)).getTime() - Date.now()) / 864e5));

function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return formatShortDate(isoDay(iso));
}

/**
 * Papelera: lo borrado en el panel queda aquí 30 días. Se restaura tal como estaba o se
 * elimina para siempre (con sus archivos). Solo administradores.
 */
export function Trash() {
  const db = useDb();
  const toast = useToast();
  const [kind, setKind] = useState('all');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { type: 'purge', item } | { type: 'empty' }
  const items = db.trash ?? [];
  const brandsById = Object.fromEntries(db.brands.map((b) => [b.id, b]));

  useEffect(() => {
    let alive = true;
    api
      .loadTrash()
      .then((n) => n && alive && toast(`Se eliminaron ${n} elemento${n === 1 ? '' : 's'} con más de ${api.TRASH_DAYS} días en la papelera`))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => Object.fromEntries(ORDER.map((k) => [k, items.filter((t) => t.kind === k).length])), [items]);
  const shown = items.filter((t) => kind === 'all' || t.kind === kind).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));

  const restore = async (t) => {
    setBusy(t.id);
    try {
      toast(await api.restoreTrash(t.id), 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy('');
  };

  return (
    <>
      <PageHeader
        title="Papelera"
        description={`Lo que se borra en el panel queda aquí ${api.TRASH_DAYS} días. Puedes restaurarlo tal como estaba o eliminarlo para siempre.`}
        actions={
          items.length > 0 && (
            <Button variant="danger-ghost" onClick={() => setConfirm({ type: 'empty' })} data-testid="trash-empty">
              Vaciar papelera
            </Button>
          )
        }
      />

      {error && <p className="callout callout--red" role="alert">{error}</p>}

      {items.length > 0 && (
        <div className="tabs trash-tabs" role="tablist" aria-label="Filtrar la papelera">
          <button type="button" role="tab" aria-selected={kind === 'all'} className={`tab ${kind === 'all' ? 'is-active' : ''}`} onClick={() => setKind('all')}>
            Todo <span className="tab__count">{items.length}</span>
          </button>
          {ORDER.filter((k) => counts[k]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={`tab ${kind === k ? 'is-active' : ''}`} onClick={() => setKind(k)} data-testid={`trash-tab-${k}`}>
              {PLURAL[k]} <span className="tab__count">{counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {loading && !items.length ? (
        <p className="muted" role="status">Cargando…</p>
      ) : shown.length === 0 ? (
        <EmptyState title="La papelera está vacía.">
          Cuando borres una solicitud, un cargo, un cupón, una marca, un usuario o una imagen, aparecerá aquí durante {api.TRASH_DAYS} días.
        </EmptyState>
      ) : (
        <ul className="trash-list" data-testid="trash-list">
          {shown.map((t) => {
            const left = daysLeft(t);
            const brand = brandsById[t.brandId];
            return (
              <li key={t.id} className="trash-item" data-testid={`trash-item-${t.kind}`}>
                <div className="trash-item__main">
                  <div className="trash-item__top">
                    <Badge tone={TONE[t.kind]}>{api.TRASH_KINDS[t.kind] ?? t.kind}</Badge>
                    <strong className="trash-item__label">{t.label || '—'}</strong>
                  </div>
                  {t.detail && <p className="trash-item__detail small">{t.detail}</p>}
                  <p className="trash-item__meta small muted">
                    {brand && (
                      <>
                        <BrandDot brand={brand} /> {brand.name} ·{' '}
                      </>
                    )}
                    Borrado por {t.deletedBy || 'el equipo'} {ago(t.deletedAt)} ·{' '}
                    <span className={left <= 3 ? 'trash-item__soon' : ''}>
                      {left === 0 ? 'se elimina hoy' : `se elimina en ${left} día${left === 1 ? '' : 's'}`}
                    </span>
                  </p>
                </div>
                <div className="trash-item__actions">
                  <Button size="sm" variant="secondary" loading={busy === t.id} onClick={() => restore(t)} data-testid="trash-restore">
                    Restaurar
                  </Button>
                  <button type="button" className="link-btn small trash-item__purge" onClick={() => setConfirm({ type: 'purge', item: t })} data-testid="trash-purge">
                    Eliminar para siempre
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'empty' ? 'Vaciar papelera' : 'Eliminar para siempre'}
        message={
          confirm?.type === 'empty'
            ? `Se eliminarán para siempre los ${items.length} elemento${items.length === 1 ? '' : 's'} de la papelera, con sus comprobantes y archivos. No se puede deshacer.`
            : confirm
              ? `Se eliminará para siempre «${confirm.item.label}»${confirm.item.kind === 'request' ? ', con sus pagos, notas, comprobantes e imágenes' : confirm.item.kind === 'media' ? ' y su archivo' : ''}. No se puede deshacer.`
              : ''
        }
        confirmLabel={confirm?.type === 'empty' ? 'Vaciar papelera' : 'Eliminar para siempre'}
        danger
        onConfirm={async () => {
          try {
            if (confirm.type === 'empty') {
              await api.emptyTrash();
              toast('Papelera vaciada', 'neutral');
            } else {
              await api.purgeTrash(confirm.item.id);
              toast('Eliminado para siempre', 'neutral');
            }
          } catch (e) {
            toast(e.message, 'red');
          }
        }}
      />
    </>
  );
}
