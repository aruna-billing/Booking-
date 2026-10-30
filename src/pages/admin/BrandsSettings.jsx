import { LOGO_SCALE, logoScale } from '../../lib/webConfig.js';
import { LIVE } from '../../lib/mode.js';
import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { Card, PageHeader } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { OrgMark } from '../../components/ui/BrandMark.jsx';
import { ImageUpload } from '../../components/ui/ImageUpload.jsx';
import { Checkbox } from '../../components/ui/Field.jsx';
import { LOGO_TYPES } from '../../lib/images.js';
import { FooterContent, isValidFooterUrl } from '../../components/booking/SiteFooter.jsx';
import { Badge, useToast } from '../../components/ui/misc.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { isEventBrand } from '../../data/brands.js';
import { Link } from '../../lib/router.jsx';
import * as api from '../../services/api.js';

const LOGO_OPTS = { accept: LOGO_TYPES, maxInputMB: 5, maxSide: 800, keepTransparency: true, quality: 0.9 };

const FONTS = [
  { value: "'Libre Baskerville', Georgia, serif", label: 'Libre Baskerville (clásica)' },
  { value: "'Fraunces', Georgia, serif", label: 'Fraunces (cálida)' },
  { value: "'Cormorant Garamond', 'Times New Roman', serif", label: 'Cormorant Garamond (editorial)' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter (sobria)' },
];
const COLORS = [
  ['bg', 'Fondo'],
  ['surface', 'Superficie'],
  ['ink', 'Texto'],
  ['muted', 'Texto secundario'],
  ['accent', 'Acento'],
  ['accentInk', 'Texto sobre acento'],
  ['line', 'Líneas'],
  ['hero', 'Fondo de cabecera'],
  ['heroInk', 'Texto de cabecera'],
];

export function BrandsSettings() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const [adding, setAdding] = useState(false);
  const brands = db.brands.filter((b) => brandFilter === 'all' || b.id === brandFilter);
  return (
    <>
      <PageHeader
        title="Configuración de marcas"
        description="Marca matriz y, debajo, la identidad, moneda, anticipo y logos de cada marca. Los textos e imágenes de la web están en Personalización."
        actions={<Button onClick={() => setAdding(true)} data-testid="add-brand">+ Añadir marca</Button>}
      />
      <OrganizationEditor key={`org-${db.builtOn}`} org={db.organization} brands={db.brands} />
      {brands.map((b) => (
        <BrandEditor key={`${b.id}-${db.builtOn}`} brand={b} db={db} />
      ))}
      {adding && <NewBrandModal brands={db.brands} onClose={() => setAdding(false)} />}
    </>
  );
}

/** Alta de marca: lo mínimo para crearla; el resto se completa en su tarjeta. */
function NewBrandModal({ brands, onClose }) {
  const toast = useToast();
  const { setBrandFilter } = useAdmin();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('DOP');
  const [deposit, setDeposit] = useState(50);
  const [type, setType] = useState('session');
  const [style, setStyle] = useState(brands[0]?.id ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return setError('Escribe el nombre de la marca.');
    if (brands.some((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase())) return setError('Ya existe una marca con ese nombre.');
    setBusy(true);
    let b;
    try {
      b = await api.createBrand({ name, currency, depositPercent: Number(deposit) || 0, bookingType: type, copyStyleFrom: style });
    } catch (e) {
      setBusy(false);
      return setError(e.message);
    }
    setBusy(false);
    onClose();
    setBrandFilter('all');
    toast(`${b.name} creada. Está oculta hasta que la publiques.`, 'green');
    setTimeout(() => document.getElementById(`brand-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Añadir marca"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={create} loading={busy} data-testid="create-brand">Crear marca</Button>
        </>
      }
    >
      <div className="form">
        <Field label="Nombre de la marca" required error={error}>
          <input data-autofocus value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ej.: Aruna Kids" data-testid="new-brand-name" />
        </Field>
        <fieldset className="fieldset">
          <legend className="field__label">Tipo de agenda</legend>
          <div className="choice-cards">
            <label className={`choice ${type === 'session' ? 'is-on' : ''}`}>
              <input type="radio" name="btype" checked={type === 'session'} onChange={() => setType('session')} />
              <span><strong>Sesiones con horario</strong><span className="muted small">Retratos, familias… Varias sesiones al día según su duración.</span></span>
            </label>
            <label className={`choice ${type === 'event' ? 'is-on' : ''}`}>
              <input type="radio" name="btype" checked={type === 'event'} onChange={() => setType('event')} />
              <span><strong>Un evento por día</strong><span className="muted small">Bodas y eventos. Una reserva por fecha.</span></span>
            </label>
          </div>
        </fieldset>
        <div className="form__row">
          <Field label="Moneda">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="DOP">DOP (RD$)</option><option value="USD">USD (US$)</option></select>
          </Field>
          <Field label="Anticipo (%)">
            <input type="number" min="0" max="100" value={deposit} onChange={(e) => setDeposit(Math.max(0, Math.min(100, Number(e.target.value))))} />
          </Field>
        </div>
        <Field label="Copiar colores y tipografía de" hint="Luego puedes cambiarlos en la tarjeta de la marca.">
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <p className="callout">La marca se crea <strong>oculta</strong>. Para publicarla en la portada necesita al menos un plan activo y una cuenta bancaria activa.</p>
      </div>
    </Modal>
  );
}

function BrandEditor({ brand, db }) {
  const toast = useToast();
  const [b, setB] = useState(brand);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setStudio = (patch) => setB((x) => ({ ...x, studio: { ...x.studio, ...patch } }));
  const activePlans = db.plans.filter((p) => p.brandId === brand.id && p.active).length;
  const activeAccounts = db.bankAccounts.filter((a) => a.brandId === brand.id && a.active).length;
  const canPublish = activePlans > 0 && activeAccounts > 0;
  const published = brand.published !== false;
  const setPublished = async (v) => {
    const saved = await api.saveBrand({ ...brand, published: v });
    setB((x) => ({ ...x, published: v }));
    if (saved === false) return toast(api.SAVE_FAILED, 'red');
    toast(v ? `${brand.name} ya aparece en la portada` : `${brand.name} se ocultó de la portada`, v ? 'green' : 'neutral');
  };
  const set = (patch) => setB((x) => ({ ...x, ...patch }));
  const setTheme = (patch) => setB((x) => ({ ...x, theme: { ...x.theme, ...patch } }));
  const dirty = JSON.stringify(b) !== JSON.stringify(brand);

  return (
    <Card title={brand.name} className="brand-editor" actions={<Link to={`/reservar/${brand.id}`} className="small">Ver flujo público →</Link>}>
      <div className="brand-editor__single" id={`brand-${brand.id}`}>
        <div className={`publish-bar ${published ? 'is-on' : ''}`} data-testid={`publish-${brand.id}`}>
          <Badge tone={published ? 'green' : 'neutral'}>{published ? 'Publicada en la portada' : 'Oculta'}</Badge>
          <span className="publish-bar__info small">
            {activePlans} plan{activePlans === 1 ? '' : 'es'} activo{activePlans === 1 ? '' : 's'} · {activeAccounts} cuenta{activeAccounts === 1 ? '' : 's'} activa{activeAccounts === 1 ? '' : 's'} · {isEventBrand(brand) ? 'Un evento por día' : 'Sesiones con horario'}
          </span>
          {published ? (
            <Button size="sm" variant="secondary" onClick={() => setPublished(false)}>Ocultar de la portada</Button>
          ) : (
            <Button size="sm" onClick={() => setPublished(true)} disabled={!canPublish}>Publicar</Button>
          )}
          {!published && !canPublish && (
            <p className="publish-bar__todo small">
              Para publicarla falta:{' '}
              {activePlans === 0 && <Link to="/admin/catalogo">añadir un plan activo</Link>}
              {activePlans === 0 && activeAccounts === 0 && ' y '}
              {activeAccounts === 0 && <Link to="/admin/cuentas">añadir una cuenta bancaria</Link>}.
            </p>
          )}
        </div>
        <div className="form">
          <div className="form__row">
            <Field label="Nombre" required><input value={b.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Nombre corto"><input value={b.shortName} onChange={(e) => set({ shortName: e.target.value })} /></Field>
          </div>
          <div className="form__row">
            <Field label="Moneda">
              <select value={b.currency} onChange={(e) => set({ currency: e.target.value })}><option value="DOP">DOP (RD$)</option><option value="USD">USD (US$)</option></select>
            </Field>
            <Field label="Anticipo (%)" hint="Porcentaje del total requerido para reservar.">
              <input type="number" min="0" max="100" value={b.depositPercent} onChange={(e) => set({ depositPercent: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </Field>
          </div>
          <div className="form__row">
            <Field label="WhatsApp (visible)" hint={LIVE ? 'Se muestra al cliente.' : 'Dato ficticio en el prototipo.'}><input value={b.whatsappDisplay} onChange={(e) => set({ whatsappDisplay: e.target.value })} /></Field>
            <Field label="Correo de contacto"><input type="email" value={b.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          </div>

          <div className="form__row">
            <Field label="Instagram"><input value={b.studio?.instagram ?? ''} placeholder="@usuario" onChange={(e) => setStudio({ instagram: e.target.value })} /></Field>
            <Field label="Pago del total" hint="Regla para todas las marcas.">
              <input value="El día de la sesión" readOnly aria-readonly="true" className="is-readonly" />
            </Field>
          </div>
          <div className="form__row">
            <Field label="Plazo de entrega (días hábiles)" hint="Desde el día de las fotos. Se usa en Seguimientos para avisar de entregas vencidas.">
              <input type="number" min="1" max="60" value={b.deliveryDays ?? 10} onChange={(e) => set({ deliveryDays: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} data-testid="delivery-days" />
            </Field>
            <span />
          </div>
          <p className="callout small">
            Los textos, imágenes y galería de la web de esta marca se editan en{' '}
            <Link to="/admin/personalizacion">Personalización</Link>.
          </p>

          <fieldset className="fieldset">
            <legend className="field__label">Identidad visual</legend>
            <div className="swatches">
              {COLORS.map(([k, label]) => (
                <label key={k} className="swatch">
                  <input type="color" value={b.theme[k]} onChange={(e) => setTheme({ [k]: e.target.value })} />
                  <span>{label}<span className="muted small"> {b.theme[k]}</span></span>
                </label>
              ))}
            </div>
            <div className="form__row">
              <Field label="Tipografía de títulos">
                <select value={b.theme.fontDisplay} onChange={(e) => setTheme({ fontDisplay: e.target.value })}>
                  {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
              <Field label="Estilo de títulos">
                <select value={b.theme.displayStyle} onChange={(e) => setTheme({ displayStyle: e.target.value })}>
                  <option value="normal">Normal</option>
                  <option value="italic">Cursiva</option>
                </select>
              </Field>
            </div>
            <div className="logo-uploads">
              <ImageUpload
                label="Logo (fondos claros)"
                hint="PNG, SVG o WebP. Ideal con fondo transparente"
                value={b.logo ?? null}
                onChange={(img) => set({ logo: img })}
                options={LOGO_OPTS}
                aspect="3 / 1"
                fit="contain"
                background="#ffffff"
                testId={`logo-${b.id}`}
              />
              <ImageUpload
                label="Logo para fondos oscuros (opcional)"
                hint="Versión clara para cabecera y pie negros"
                value={b.logoOnDark ?? null}
                onChange={(img) => set({ logoOnDark: img })}
                options={LOGO_OPTS}
                aspect="3 / 1"
                fit="contain"
                background="#1c1c1c"
                testId={`logo-dark-${b.id}`}
              />
            </div>
            <LogoSize value={b.logoScale} onChange={(v) => set({ logoScale: v })} testId={`logo-size-${b.id}`} />
            <p className="muted small">Sin logo subido se usa el logotipo tipográfico provisional. Si solo subes la versión para fondos claros, en la franja negra se muestra sobre una placa clara.</p>
          </fieldset>

          <div className="form__actions">
            <Button variant="ghost" disabled={!dirty} onClick={() => setB(brand)}>Descartar</Button>
            <Button
              disabled={!dirty || !b.name.trim()}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const saved = await api.saveBrand(b);
                setBusy(false);
                if (saved === false) toast(api.SAVE_FAILED, 'red');
                else toast(`${b.name} actualizada`, 'green');
              }}
            >
              Guardar cambios
            </Button>
          </div>

          <div className="danger-zone">
            <div>
              <p className="danger-zone__title">Eliminar marca</p>
              <p className="muted small">Borra la marca con sus planes, extras, cuentas y términos. Las marcas con solicitudes no se pueden borrar: se ocultan.</p>
            </div>
            <Button variant="danger-ghost" size="sm" onClick={() => setDeleting(true)} data-testid={`delete-${brand.id}`}>Eliminar marca</Button>
          </div>
        </div>
      </div>
      {deleting && <DeleteBrandDialog brand={brand} db={db} onClose={() => setDeleting(false)} onHide={() => setPublished(false)} />}
    </Card>
  );
}

/** Marca matriz: nombre, logo y pie de página que se muestran en todo el sistema. */
function OrganizationEditor({ org, brands }) {
  const toast = useToast();
  const [o, setO] = useState(org);
  const [busy, setBusy] = useState(false);
  const [previewBrand, setPreviewBrand] = useState(brands[0]?.id ?? '');
  const set = (patch) => setO((x) => ({ ...x, ...patch }));
  const setF = (patch) => setO((x) => ({ ...x, footer: { ...x.footer, ...patch } }));
  const setSocial = (patch) => setF({ social: { ...o.footer.social, ...patch } });
  const setLink = (i, patch) => setF({ links: o.footer.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const dirty = JSON.stringify(o) !== JSON.stringify(org);
  const f = o.footer;
  const linkErrors = f.links.map((l) => (!l.label.trim() && !l.url.trim() ? null : !l.label.trim() ? 'Escribe el texto del enlace.' : !isValidFooterUrl(l.url) ? 'Usa una dirección https://… o mailto:…' : null));
  const invalid = !o.name.trim() || linkErrors.some(Boolean);
  const pBrand = brands.find((x) => x.id === previewBrand);

  return (
    <Card title="Marca matriz" className="brand-editor org-editor" actions={<span className="muted small">Agrupa a {brands.map((x) => x.name).join(' y ')}</span>}>
      <div className="brand-editor__grid">
        <div className="form">
          <div className="form__row">
            <Field label="Nombre" required error={!o.name.trim() ? 'Escribe el nombre.' : undefined}>
              <input value={o.name} onChange={(e) => set({ name: e.target.value })} data-testid="org-name" />
            </Field>
            <Field label="Descripción corta">
              <input value={o.tagline} onChange={(e) => set({ tagline: e.target.value })} />
            </Field>
          </div>
          <div className="logo-uploads">
            <ImageUpload
              label="Logo (fondos claros)"
              hint="PNG, SVG o WebP. Se usa también como icono de la pestaña"
              value={o.logo ?? null}
              onChange={(img) => set({ logo: img })}
              options={LOGO_OPTS}
              aspect="3 / 1"
              fit="contain"
              background="#ffffff"
              testId="logo-org"
            />
            <ImageUpload
              label="Logo para fondos oscuros (opcional)"
              hint="Para la portada, el pie y el panel"
              value={o.logoOnDark ?? null}
              onChange={(img) => set({ logoOnDark: img })}
              options={LOGO_OPTS}
              aspect="3 / 1"
              fit="contain"
              background="#1c1c1c"
              testId="logo-org-dark"
            />
          </div>
          <LogoSize value={o.logoScale} onChange={(v) => set({ logoScale: v })} testId="logo-size-org" />

          <fieldset className="fieldset footer-config" data-testid="footer-config">
            <legend className="footer-config__title">Pie de página</legend>
            <p className="muted small">Se aplica a la portada y a la web de cada marca.</p>

            <div className="footer-config__group">
              <Checkbox checked={f.showByline} onChange={(v) => setF({ showByline: v })}>
                Mostrar la firma de la marca matriz en el pie de cada marca
              </Checkbox>
              {f.showByline && (
                <Field label="Texto de la firma" hint={`Se muestra seguido del logo: «${f.byline || '…'} ${o.name}».`}>
                  <input value={f.byline} onChange={(e) => setF({ byline: e.target.value })} data-testid="footer-byline" />
                </Field>
              )}
            </div>

            <Field label="Texto legal" hint="Usa {año} para el año actual y {marca} para el nombre de cada marca.">
              <input value={f.copyright} onChange={(e) => setF({ copyright: e.target.value })} data-testid="footer-copyright-input" />
            </Field>

            <div className="footer-config__group">
              <p className="field__label">Enlaces</p>
              <ul className="footer-links-edit">
                {f.links.map((l, i) => (
                  <li key={i}>
                    <div className="form__row">
                      <Field label={`Texto del enlace ${i + 1}`} error={linkErrors[i] && !l.label.trim() ? linkErrors[i] : undefined}>
                        <input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                      </Field>
                      <Field label="Dirección" error={linkErrors[i] && l.label.trim() ? linkErrors[i] : undefined}>
                        <input value={l.url} inputMode="url" placeholder="https://…" onChange={(e) => setLink(i, { url: e.target.value })} />
                      </Field>
                    </div>
                    <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar enlace ${i + 1}`} onClick={() => setF({ links: f.links.filter((_, j) => j !== i) })}>✕</button>
                  </li>
                ))}
              </ul>
              {f.links.length < 6 && (
                <Button variant="ghost" size="sm" onClick={() => setF({ links: [...f.links, { label: '', url: '' }] })}>+ Añadir enlace</Button>
              )}
            </div>

            <div className="footer-config__group">
              <p className="field__label">Mostrar en el pie</p>
              <Checkbox checked={f.showBrandSocial} onChange={(v) => setF({ showBrandSocial: v })}>Instagram y WhatsApp de cada marca</Checkbox>
              <Checkbox checked={f.showTermsLink} onChange={(v) => setF({ showTermsLink: v })}>Enlace a términos y condiciones de cada marca</Checkbox>
              <Checkbox checked={f.showAdminLink} onChange={(v) => setF({ showAdminLink: v })}>Enlace al panel administrativo <span className="muted small">(desactívalo al publicar)</span></Checkbox>
            </div>

            <div className="footer-config__group">
              <p className="field__label">Redes de la marca matriz <span className="field__opt">(se muestran en la portada)</span></p>
              <div className="form__row">
                <Field label="Instagram"><input value={f.social.instagram} placeholder="@usuario" onChange={(e) => setSocial({ instagram: e.target.value })} /></Field>
                <Field label="Facebook"><input value={f.social.facebook} placeholder="facebook.com/…" onChange={(e) => setSocial({ facebook: e.target.value })} /></Field>
              </div>
              <div className="form__row">
                <Field label="TikTok"><input value={f.social.tiktok} placeholder="@usuario" onChange={(e) => setSocial({ tiktok: e.target.value })} /></Field>
                <Field label="Correo"><input type="email" value={f.social.email} onChange={(e) => setSocial({ email: e.target.value })} /></Field>
              </div>
              <Field label="Sitio web"><input value={f.social.website} inputMode="url" onChange={(e) => setSocial({ website: e.target.value })} /></Field>
            </div>
          </fieldset>

          <div className="form__actions">
            <Button variant="ghost" disabled={!dirty} onClick={() => setO(org)}>Descartar</Button>
            <Button
              disabled={!dirty || invalid}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const clean = { ...o, name: o.name.trim(), footer: { ...f, links: f.links.filter((l) => l.label.trim() && l.url.trim()) } };
                const saved = await api.saveOrganization(clean);
                setO(clean);
                setBusy(false);
                if (saved === false) toast(api.SAVE_FAILED, 'red');
                else toast('Marca matriz y pie de página actualizados', 'green');
              }}
              data-testid="org-save"
            >
              Guardar marca matriz
            </Button>
          </div>
        </div>

        <div className="org-preview" aria-label="Vista previa">
          <p className="muted small">Logo</p>
          <div className="org-preview__dark"><OrgMark org={o} invert size="lg" withTagline /></div>
          <div className="org-preview__light"><OrgMark org={o} size="lg" withTagline /></div>
          <div className="org-preview__head">
            <p className="muted small">Pie de página</p>
            <label className="org-preview__pick">
              <span className="visually-hidden">Ver pie de</span>
              <select value={previewBrand} onChange={(e) => setPreviewBrand(e.target.value)}>
                {brands.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                <option value="">Portada</option>
              </select>
            </label>
          </div>
          <footer className="site-footer site-footer--preview" aria-label="Vista previa del pie de página" data-testid="footer-preview">
            <FooterContent org={o} brand={pBrand} preview />
          </footer>
        </div>
      </div>
    </Card>
  );
}

/** Confirmación de borrado. Si la marca tiene historial, solo ofrece ocultarla. */
function DeleteBrandDialog({ brand, db, onClose, onHide }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const usage = api.brandUsage(db, brand.id);
  const lastOne = db.brands.length <= 1;
  const blocked = usage.requests > 0 || lastOne;
  const matches = typed.trim() === brand.name.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={blocked ? 'No se puede eliminar esta marca' : `Eliminar ${brand.name}`}
      size="sm"
      footer={
        blocked ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            {!lastOne && brand.published !== false && (
              <Button onClick={() => { onHide(); onClose(); }}>Ocultar de la portada</Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={!matches}
              loading={busy}
              data-testid="confirm-delete"
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteBrand(brand.id);
                  toast(`${brand.name} eliminada`, 'red');
                  onClose();
                } catch (e) {
                  setError(e.message);
                  setBusy(false);
                }
              }}
            >
              Eliminar definitivamente
            </Button>
          </>
        )
      }
    >
      {lastOne ? (
        <p>Debe quedar al menos una marca en el sistema.</p>
      ) : blocked ? (
        <>
          <p>
            <strong>{brand.name}</strong> tiene {usage.requests} solicitud{usage.requests === 1 ? '' : 'es'} y {usage.payments} pago{usage.payments === 1 ? '' : 's'} registrados.
            Borrarla eliminaría ese historial y descuadraría Finanzas.
          </p>
          <p>Puedes <strong>ocultarla</strong>: deja de aparecer en la portada, pero conservas sus reservas y pagos.</p>
        </>
      ) : (
        <>
          <p>Se borrará de forma permanente:</p>
          <ul className="delete-list">
            <li>La marca y su configuración</li>
            <li>{usage.plans} plan{usage.plans === 1 ? '' : 'es'} y {usage.extras} extra{usage.extras === 1 ? '' : 's'}</li>
            <li>{usage.accounts} cuenta{usage.accounts === 1 ? '' : 's'} bancaria{usage.accounts === 1 ? '' : 's'}, sus términos y reglas de agenda</li>
          </ul>
          <Field label={`Escribe «${brand.name}» para confirmar`} error={error}>
            <input data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="delete-confirm-input" />
          </Field>
        </>
      )}
    </Modal>
  );
}

/** Tamaño del logo en la web (porcentaje del tamaño normal). */
function LogoSize({ value, onChange, testId }) {
  const v = Math.round(logoScale(value) * 100);
  return (
    <div className="logo-size">
      <label className="field__label" htmlFor={testId}>Tamaño del logo en la web: <strong>{v} %</strong></label>
      <div className="logo-size__row">
        <input
          id={testId}
          type="range"
          min={LOGO_SCALE.min}
          max={LOGO_SCALE.max}
          step={LOGO_SCALE.step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          data-testid={testId}
        />
        {v !== 100 && <button type="button" className="link-btn small" onClick={() => onChange(100)}>Normal</button>}
      </div>
      <p className="field__hint">Agranda o achica el logo en la cabecera, la portada y el pie. En el celular nunca pasa del ancho de la pantalla.</p>
    </div>
  );
}
