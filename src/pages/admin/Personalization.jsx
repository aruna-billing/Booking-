import { useEffect, useRef, useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { BrandDot, Card, ConfirmDialog, PageHeader, Toggle } from '../../components/admin/parts.jsx';
import { ImagePicker, ImageSlot, MediaThumb } from '../../components/admin/ImagePicker.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge, DemoNotice, EmptyState, useToast } from '../../components/ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { HERO_SIZES, MAX_GALLERY, TEXT_FIELDS, getOrgWeb, getWeb, imageUsage, planTypeVars } from '../../lib/webConfig.js';
import { FONT_OPTIONS, TITLE_SIZES, WEIGHTS, ensureAllFonts, fontOption } from '../../lib/fonts.js';
import { brandStyle } from '../../components/ui/BrandMark.jsx';
import { formatDuration, formatFileSize, formatMoney } from '../../lib/format.js';
import { uploadToLibrary, MEDIA_OPTS, ACCEPT } from '../../lib/mediaUpload.js';
import { VIDEO_LIMITS, formatSeconds } from '../../lib/videos.js';
import { removeImage, updateImage, useImageLibrary } from '../../store/imageStore.js';
import * as api from '../../services/api.js';

/**
 * Personalización de la web de reservas:
 *  · Portada general (selección de marca)
 *  · Página de cada marca (portada, presentación, galería, planes, tarjeta, textos)
 *  · Biblioteca de imágenes
 */
export function Personalization() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const [tab, setTab] = useState(brandFilter !== 'all' ? brandFilter : 'general');
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  // Si la marca de la pestaña ya no existe, vuelve a la portada general.
  useEffect(() => {
    if (!['general', 'library'].includes(tab) && !db.brands.some((b) => b.id === tab)) setTab('general');
  }, [tab, db.brands]);

  const go = (t) => {
    if (t === tab) return;
    if (dirty) setPendingTab(t);
    else setTab(t);
  };
  const brand = db.brands.find((b) => b.id === tab);
  const tabs = [{ id: 'general', label: 'Portada general' }, ...db.brands.map((b) => ({ id: b.id, label: b.name, brand: b })), { id: 'library', label: 'Biblioteca de imágenes' }];

  return (
    <>
      <PageHeader title="Personalización" description="Textos, imágenes y secciones de la web de reservas." />
      <div className="tabs" role="tablist" aria-label="Qué personalizar">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => go(t.id)} data-testid={`ptab-${t.id}`}>
            {t.brand && <BrandDot brand={t.brand} />} {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'general' && <GeneralEditor key="general" org={db.organization} brands={db.brands} onDirty={setDirty} />}
        {brand && <BrandWebEditor key={brand.id} brand={brand} plans={db.plans.filter((p) => p.brandId === brand.id)} onDirty={setDirty} />}
        {tab === 'library' && <Library />}
      </div>

      <ConfirmDialog
        open={!!pendingTab}
        onClose={() => setPendingTab(null)}
        title="Cambios sin guardar"
        message="Si cambias de pestaña se perderán los cambios que no has guardado."
        confirmLabel="Salir sin guardar"
        danger
        onConfirm={async () => {
          setDirty(false);
          setTab(pendingTab);
        }}
      />
    </>
  );
}

/** Barra fija inferior con Guardar / Descartar cuando hay cambios. */
function SaveBar({ dirty, busy, onSave, onDiscard, viewHref, invalid }) {
  return (
    <div className={`savebar ${dirty ? 'is-dirty' : ''}`} role="region" aria-label="Guardar cambios">
      <span className="savebar__status" aria-live="polite">{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
      {viewHref && <Link to={viewHref} className="small">Ver en la web →</Link>}
      <span className="spacer" />
      <Button variant="ghost" size="sm" disabled={!dirty} onClick={onDiscard}>Descartar</Button>
      <Button size="sm" disabled={!dirty || invalid} loading={busy} onClick={onSave} data-testid="web-save">Guardar cambios</Button>
    </div>
  );
}

// ───────────────────────── Portada general ─────────────────────────

function GeneralEditor({ org, brands, onDirty }) {
  const toast = useToast();
  const initial = getOrgWeb(org);
  const [w, setW] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(w) !== JSON.stringify(initial);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const set = (patch) => setW((x) => ({ ...x, ...patch }));

  return (
    <>
      <Card title="Página de selección de marca">
        <p className="muted small">Es la primera página de la web: muestra el logo de la marca matriz y una tarjeta por cada marca publicada.</p>
        <div className="form">
          <Field label="Título" required error={!w.title.trim() ? 'Escribe un título.' : undefined}>
            <input value={w.title} onChange={(e) => set({ title: e.target.value })} data-testid="org-web-title" />
          </Field>
          <Field label="Texto bajo el título">
            <input value={w.lead} onChange={(e) => set({ lead: e.target.value })} />
          </Field>
          <Toggle checked={w.showTagline} onChange={(v) => set({ showTagline: v })} label={`Mostrar la descripción de la marca matriz («${org.tagline || '—'}»)`} />
        </div>
      </Card>
      <Card title="Tarjetas de las marcas">
        <p className="muted small">La imagen y la descripción de cada tarjeta se editan en la pestaña de cada marca, sección «Tarjeta en la portada general».</p>
        <ul className="pz-brandlist">
          {brands.map((b) => (
            <li key={b.id}><BrandDot brand={b} withName /> {b.published === false ? <Badge tone="neutral">Oculta</Badge> : <Badge tone="green">Publicada</Badge>}</li>
          ))}
        </ul>
      </Card>
      <SaveBar
        dirty={dirty}
        busy={busy}
        invalid={!w.title.trim()}
        viewHref="/"
        onDiscard={() => setW(initial)}
        onSave={async () => {
          setBusy(true);
          const saved = await api.saveOrgWeb(w);
          setBusy(false);
          if (saved === false) toast(api.SAVE_FAILED, 'red');
          else toast('Portada general actualizada', 'green');
        }}
      />
    </>
  );
}

// ───────────────────────── Página de una marca ─────────────────────────

function buildDraft(brand, plans) {
  return {
    tagline: brand.tagline ?? '',
    description: brand.description ?? '',
    studio: { headline: brand.studio?.headline ?? '', intro: brand.studio?.intro ?? '', cta: brand.studio?.cta ?? '' },
    web: getWeb(brand),
    planImages: Object.fromEntries(plans.map((p) => [p.id, p.imageId ?? null])),
  };
}

function BrandWebEditor({ brand, plans, onDirty }) {
  const toast = useToast();
  const initial = buildDraft(brand, plans);
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const dragFrom = useRef(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const setWeb = (patch) => setD((x) => ({ ...x, web: { ...x.web, ...patch } }));
  const setHero = (patch) => setD((x) => ({ ...x, web: { ...x.web, hero: { ...x.web.hero, ...patch } } }));
  const setStudio = (patch) => setD((x) => ({ ...x, studio: { ...x.studio, ...patch } }));
  const setText = (key, v) => setD((x) => ({ ...x, web: { ...x.web, texts: { ...x.web.texts, [key]: v } } }));
  const items = d.web.gallery.items;
  const setItems = (next) => setWeb({ gallery: { ...d.web.gallery, items: next } });
  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setItems(next);
  };

  return (
    <div className="pz">
      <DemoNotice compact live="Las imágenes y videos se suben a Supabase Storage y los ve cualquier visitante del sitio.">Las imágenes y videos se guardan en este navegador (biblioteca local del prototipo). En producción se subirán a Supabase Storage.</DemoNotice>

      {/* 1. Portada */}
      <Card title="1 · Portada" actions={<Toggle checked={d.web.hero.show} onChange={(v) => setHero({ show: v })} label={d.web.hero.show ? 'Visible' : 'Oculta'} />}>
        <div className={`pz-row ${d.web.hero.show ? '' : 'is-off'}`}>
          <div className="pz-hero-media">
            <fieldset className="fieldset">
              <legend className="field__label">Tipo de portada</legend>
              <div className="seg" role="radiogroup">
                {[['image', 'Imagen'], ['video', 'Video']].map(([k, label]) => (
                  <label key={k} className={`seg__opt ${d.web.hero.media === k ? 'is-on' : ''}`}>
                    <input type="radio" name={`hero-media-${brand.id}`} checked={d.web.hero.media === k} onChange={() => setHero({ media: k })} data-testid={`hero-media-${k}`} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {d.web.hero.media === 'video' ? (
              <>
                <ImageSlot
                  kind="video"
                  label="Video de portada"
                  hint="MP4 o WebM, hasta 50 MB y 60 s. Se reproduce sin sonido y en bucle. Recomendado: horizontal 1920×1080, 10–20 s, sin audio."
                  imageId={d.web.hero.videoId}
                  onChange={(id) => setHero({ videoId: id })}
                  brandId={brand.id}
                  ratio={HERO_SIZES[d.web.hero.size]?.ratio ?? '21 / 9'}
                  emptyText="Se muestra la imagen de respaldo"
                  testId="slot-hero-video"
                />
                <ImageSlot
                  compact
                  label="Imagen de respaldo (opcional)"
                  hint="Se ve mientras carga el video y para quien tiene activado «reducir movimiento». Si no eliges una, se usa un fotograma del video."
                  imageId={d.web.hero.imageId}
                  onChange={(id) => setHero({ imageId: id })}
                  brandId={brand.id}
                  ratio="16 / 9"
                  emptyText="Se usa un fotograma del video"
                  testId="slot-hero"
                />
                <Toggle
                  checked={d.web.hero.mobileImage}
                  onChange={(v) => setHero({ mobileImage: v })}
                  label="En celulares, mostrar la imagen en lugar del video (ahorra datos)"
                />
              </>
            ) : (
              <ImageSlot
                label="Imagen de portada"
                hint="Horizontal, al menos 2000 px de ancho. En el celular se recorta según el punto de enfoque."
                imageId={d.web.hero.imageId}
                onChange={(id) => setHero({ imageId: id })}
                brandId={brand.id}
                ratio={HERO_SIZES[d.web.hero.size]?.ratio ?? '21 / 9'}
                testId="slot-hero"
              />
            )}
          </div>
          <fieldset className="fieldset">
            <legend className="field__label">Altura</legend>
            <div className="seg" role="radiogroup">
              {Object.entries(HERO_SIZES).map(([k, v]) => (
                <label key={k} className={`seg__opt ${d.web.hero.size === k ? 'is-on' : ''}`}>
                  <input type="radio" name={`hero-${brand.id}`} checked={d.web.hero.size === k} onChange={() => setHero({ size: k })} />
                  {v.label} <span className="muted small">{v.ratio.replace(/ /g, '')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      {/* 2. Presentación */}
      <Card title="2 · Presentación" actions={<Toggle checked={d.web.intro.show} onChange={(v) => setWeb({ intro: { ...d.web.intro, show: v } })} label={d.web.intro.show ? 'Visible' : 'Oculta'} />}>
        <div className={`form ${d.web.intro.show ? '' : 'is-off'}`}>
          <Field label="Frase principal (lema)">
            <input value={d.tagline} onChange={(e) => setD((x) => ({ ...x, tagline: e.target.value }))} data-testid="pz-tagline" />
          </Field>
          <Field label="Texto de presentación">
            <textarea rows={3} value={d.studio.intro} onChange={(e) => setStudio({ intro: e.target.value })} />
          </Field>
          <Field label="Texto del botón" hint="Lleva a la sección de planes.">
            <input value={d.studio.cta} onChange={(e) => setStudio({ cta: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* 3. Galería */}
      <Card
        title={`3 · Galería (${items.length}/${MAX_GALLERY})`}
        actions={<Toggle checked={d.web.gallery.show} onChange={(v) => setWeb({ gallery: { ...d.web.gallery, show: v } })} label={d.web.gallery.show ? 'Visible' : 'Oculta'} />}
      >
        <p className="muted small">Arrastra las fotos o usa las flechas para cambiar el orden. La etiqueta solo se ve sobre los marcadores sin foto.</p>
        <ol className={`pz-gallery ${d.web.gallery.show ? '' : 'is-off'}`} data-testid="pz-gallery">
          {items.map((it, i) => (
            <li
              key={i}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { move(dragFrom.current, i); dragFrom.current = null; }}
              className="pz-gallery__item"
            >
              <span className="pz-gallery__num" aria-hidden="true">{i + 1}</span>
              <ImageSlot compact imageId={it.imageId} onChange={(id) => setItems(items.map((x, j) => (j === i ? { ...x, imageId: id } : x)))} brandId={brand.id} ratio="3 / 4" />
              <Field label={`Etiqueta foto ${i + 1}`}>
                <input value={it.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </Field>
              <div className="pz-gallery__tools">
                <button type="button" className="icon-btn icon-btn--sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Mover foto ${i + 1} antes`}>←</button>
                <button type="button" className="icon-btn icon-btn--sm" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={`Mover foto ${i + 1} después`}>→</button>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Quitar foto ${i + 1} de la galería`}>✕</button>
              </div>
            </li>
          ))}
        </ol>
        {items.length < MAX_GALLERY && (
          <Button variant="secondary" size="sm" onClick={() => setAddingPhoto(true)} data-testid="pz-gallery-add">+ Añadir foto a la galería</Button>
        )}
        {addingPhoto && (
          <ImagePicker open onClose={() => setAddingPhoto(false)} brandId={brand.id} title="Añadir foto a la galería" onPick={(id) => setItems([...items, { imageId: id, label: '' }])} />
        )}
      </Card>

      {/* 4. Planes */}
      <Card title="4 · Sección de planes">
        <div className="form">
          <div className="form__row">
            <Field label="Texto sobre el titular">
              <input value={d.web.texts.plansEyebrow ?? ''} placeholder={TEXT_FIELDS[0].def(brand)} onChange={(e) => setText('plansEyebrow', e.target.value)} />
            </Field>
            <Field label="Titular">
              <input value={d.studio.headline} onChange={(e) => setStudio({ headline: e.target.value })} data-testid="pz-headline" />
            </Field>
          </div>
        </div>
        {plans.length === 0 ? (
          <EmptyState title="Esta marca aún no tiene planes." action={<Link to="/admin/catalogo">Crear un plan →</Link>} />
        ) : (
          <ul className="pz-plans">
            {plans.map((p) => (
              <li key={p.id}>
                <ImageSlot
                  compact
                  label={p.name}
                  imageId={d.planImages[p.id]}
                  onChange={(id) => setD((x) => ({ ...x, planImages: { ...x.planImages, [p.id]: id } }))}
                  brandId={brand.id}
                  ratio="4 / 5"
                  testId={`slot-plan-${p.id}`}
                />
                {!p.active && <Badge tone="neutral">Plan oculto</Badge>}
              </li>
            ))}
          </ul>
        )}
        <PlanTypeEditor
          brand={brand}
          plan={plans.find((p) => p.active) ?? plans[0]}
          headline={d.studio.headline}
          eyebrow={d.web.texts.plansEyebrow}
          value={d.web.planType}
          onChange={(patch) => setWeb({ planType: { ...d.web.planType, ...patch } })}
        />
      </Card>

      {/* 5. Tarjeta en la portada general */}
      <Card title="5 · Tarjeta en la portada general">
        <div className="pz-row">
          <ImageSlot label="Imagen de la tarjeta" imageId={d.web.cardImageId} onChange={(id) => setWeb({ cardImageId: id })} brandId={brand.id} ratio="16 / 10" testId="slot-card" />
          <Field label="Descripción de la tarjeta">
            <textarea rows={4} value={d.description} onChange={(e) => setD((x) => ({ ...x, description: e.target.value }))} />
          </Field>
        </div>
      </Card>

      {/* 6. Textos */}
      <Card title="6 · Textos del recorrido de reserva">
        <p className="muted small">Si dejas un campo vacío se usa el texto predeterminado (se ve en gris).</p>
        <div className="form">
          {TEXT_FIELDS.filter((f) => f.key !== 'plansEyebrow').map((f) => {
            const v = d.web.texts[f.key] ?? '';
            const Input = f.multiline ? 'textarea' : 'input';
            return (
              <Field
                key={f.key}
                label={`${f.step} · ${f.label}`}
                counter={v ? <button type="button" className="link-btn small" onClick={() => setText(f.key, '')}>Restaurar</button> : null}
              >
                <Input rows={f.multiline ? 3 : undefined} value={v} placeholder={f.def(brand)} onChange={(e) => setText(f.key, e.target.value)} data-testid={`text-${f.key}`} />
              </Field>
            );
          })}
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        busy={busy}
        viewHref={`/reservar/${brand.id}`}
        onDiscard={() => setD(initial)}
        onSave={async () => {
          setBusy(true);
          const texts = Object.fromEntries(Object.entries(d.web.texts).filter(([, v]) => v && v.trim()));
          const saved = await api.saveBrandWeb(brand.id, { tagline: d.tagline, studio: d.studio, web: { ...d.web, texts }, description: d.description }, d.planImages);
          setBusy(false);
          if (saved === false) toast(api.SAVE_FAILED, 'red');
          else toast(`Web de ${brand.name} actualizada`, 'green');
        }}
      />
    </div>
  );
}

// ───────────────────────── Biblioteca ─────────────────────────

function Library() {
  const db = useDb();
  const toast = useToast();
  const { list, persistent, ready } = useImageLibrary();
  const [filter, setFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [detail, setDetail] = useState(null);
  const inputRef = useRef(null);

  const shown = list
    .filter((x) => filter === 'all' || (filter === 'none' ? !x.brandId : x.brandId === filter))
    .filter((x) => kindFilter === 'all' || (x.kind ?? 'image') === kindFilter)
    .filter((x) => !q.trim() || `${x.name} ${x.alt}`.toLowerCase().includes(q.trim().toLowerCase()));
  const totalBytes = list.reduce((a, x) => a + (x.bytes || 0), 0);

  const upload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    const { added, errors: errs } = await uploadToLibrary(files, { brandId: ['all', 'none'].includes(filter) ? null : filter, kind: 'all' });
    setBusy(false);
    setErrors(errs);
    if (added.length) toast(`${added.length} archivo${added.length === 1 ? '' : 's'} añadido${added.length === 1 ? '' : 's'}`, 'green');
  };

  return (
    <div className="pz">
      {!persistent && ready && (
        <p className="callout callout--red">Este navegador no permite guardar la biblioteca: las imágenes se perderán al recargar.</p>
      )}
      <Card>
        <div
          className="lib-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        >
          <Button loading={busy} onClick={() => inputRef.current?.click()} data-testid="lib-upload-btn">Subir imágenes o videos</Button>
          <p className="muted small">
            o arrástralos aquí · Imágenes JPG, PNG o WebP hasta {MEDIA_OPTS.maxInputMB} MB · Videos MP4 o WebM hasta {VIDEO_LIMITS.maxMB} MB y {VIDEO_LIMITS.maxSeconds} s
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT.all.join(',')}
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Subir imágenes o videos"
            data-testid="lib-upload"
            onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
          />
        </div>
        {errors.length > 0 && <div className="callout callout--red" role="alert">{errors.map((e) => <p key={e}>{e}</p>)}</div>}
      </Card>

      <div className="filters lib-filters">
        <label className="filters__search">
          <span className="visually-hidden">Buscar imágenes</span>
          <input type="search" placeholder="Buscar por nombre o descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="filters__label">Tipo</span>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} data-testid="lib-kind">
            <option value="all">Todo</option>
            <option value="image">Imágenes</option>
            <option value="video">Videos</option>
          </select>
        </label>
        <label>
          <span className="filters__label">Marca</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todas</option>
            {db.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="none">Sin marca</option>
          </select>
        </label>
        <p className="muted small lib-total">
          {list.filter((x) => x.kind !== 'video').length} imágenes · {list.filter((x) => x.kind === 'video').length} videos · {formatFileSize(totalBytes)}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={list.length ? 'Nada coincide con el filtro.' : 'La biblioteca está vacía.'}>
          {list.length ? null : 'Sube fotos y videos para usarlos en la portada, la galería, los planes y las tarjetas.'}
        </EmptyState>
      ) : (
        <ul className="lib-grid" data-testid="lib-grid">
          {shown.map((img) => {
            const uses = imageUsage(db, img.id);
            const b = db.brands.find((x) => x.id === img.brandId);
            return (
              <li key={img.id}>
                <button type="button" className="lib-item" onClick={() => setDetail(img.id)} aria-label={`Editar ${img.name}`}>
                  <span className="lib-item__img"><MediaThumb rec={img} /></span>
                  <span className="lib-item__meta">
                    <span className="lib-item__name">{img.alt || img.name}</span>
                    <span className="muted small">{b ? b.shortName : 'Sin marca'} · {uses.length ? `En uso (${uses.length})` : 'Sin usar'}</span>
                    {!img.alt && <span className="lib-item__warn small">Falta descripción</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail && <ImageDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Detalle de imagen: descripción, marca, punto de enfoque y borrado seguro. */
function ImageDetail({ id, onClose }) {
  const db = useDb();
  const toast = useToast();
  const { list } = useImageLibrary();
  const img = list.find((x) => x.id === id);
  const [alt, setAlt] = useState(img?.alt ?? '');
  const [brandId, setBrandId] = useState(img?.brandId ?? '');
  const [focal, setFocal] = useState(img?.focal ?? { x: 50, y: 50 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!img) return null;
  const uses = imageUsage(db, id);
  const isVid = img.kind === 'video';
  const still = isVid ? img.poster : img.src;

  const pickFocal = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFocal({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };
  const nudge = (e) => {
    const step = 5;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    setFocal((f) => ({ x: Math.min(100, Math.max(0, f.x + map[e.key][0])), y: Math.min(100, Math.max(0, f.y + map[e.key][1])) }));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isVid ? 'Video' : 'Imagen'}
      size="lg"
      footer={
        <>
          <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)} data-testid="img-delete">Eliminar</Button>
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            data-testid="img-save"
            onClick={async () => {
              try {
                await updateImage(id, { alt: alt.trim(), brandId: brandId || null, focal });
                toast(isVid ? 'Video actualizado' : 'Imagen actualizada', 'green');
                onClose();
              } catch (e) {
                toast(e.message, 'red');
              }
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="imgdetail">
        <div>
          <p className="field__label">Punto de enfoque</p>
          <div
            className="focal"
            onClick={pickFocal}
            onKeyDown={nudge}
            tabIndex={0}
            role="slider"
            aria-label="Punto de enfoque"
            aria-valuetext={`${focal.x} % horizontal, ${focal.y} % vertical`}
            data-testid="focal"
          >
            {still ? <img src={still} alt="" /> : <span className="focal__noposter">Sin fotograma</span>}
            <span className="focal__dot" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} aria-hidden="true" />
          </div>
          <p className="field__hint">Haz clic en lo más importante (por ejemplo, el rostro), o usa las flechas del teclado. Así se recorta en cada formato:</p>
          <div className="focal-previews" aria-hidden="true">
            {['21 / 9', '4 / 5', '1 / 1'].map((r) => (
              <span key={r} style={{ aspectRatio: r }}>{still && <img src={still} alt="" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />}<i>{r.replace(/ /g, '')}</i></span>
            ))}
          </div>
          {isVid && (
            <div className="vid-preview">
              <p className="field__label">Vista previa</p>
              <video src={img.src} poster={img.poster || undefined} controls muted playsInline preload="metadata" data-testid="video-preview" />
            </div>
          )}
        </div>
        <div className="form">
          <Field label="Descripción (texto alternativo)" hint={isVid ? 'Describe el video en una frase. Ej.: «Pareja caminando en la playa al atardecer».' : 'Describe la foto para personas que usan lectores de pantalla. Ej.: «Familia de cinco en la playa al atardecer».'}>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} data-testid="img-alt" />
          </Field>
          <Field label="Marca">
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Sin marca</option>
              {db.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <dl className="kv kv--small">
            <div><dt>Archivo</dt><dd>{img.name}</dd></div>
            <div><dt>Tamaño</dt><dd>{img.width}×{img.height}px · {formatFileSize(img.bytes || 0)}</dd></div>
            {isVid && <div><dt>Duración</dt><dd>{formatSeconds(img.duration)}</dd></div>}
          </dl>
          <div>
            <p className="field__label">Dónde se usa</p>
            {uses.length ? <ul className="uses">{uses.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="muted small">No se usa en la web.</p>}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={isVid ? 'Eliminar video' : 'Eliminar imagen'}
        message={uses.length ? `Esta imagen se usa en ${uses.length} lugar${uses.length === 1 ? '' : 'es'} (${uses.join('; ')}). Esos espacios volverán a mostrar el marcador.` : `${isVid ? 'El video' : 'La imagen'} se borrará de la biblioteca.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={async () => {
          try {
            await api.clearImageReferences(id);
            await removeImage(id);
            toast(isVid ? 'Video eliminado' : 'Imagen eliminada', 'red');
            onClose();
          } catch (e) {
            toast(e.message, 'red');
          }
        }}
      />
    </Modal>
  );
}

// ───────────────────────── Tipografía de los planes ─────────────────────────

function FontSelect({ label, value, onChange, defaultLabel, testId }) {
  return (
    <Field label={label}>
      <select className="font-select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} data-testid={testId}>
        <option value="">{defaultLabel}</option>
        {FONT_OPTIONS.map((f) => (
          <option key={f.family} value={f.family} style={{ fontFamily: `'${f.family}'` }}>
            {f.family} · {f.category}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Tipografía de la sección de planes con vista previa en vivo. */
function PlanTypeEditor({ brand, plan, headline, eyebrow, value: t, onChange }) {
  useEffect(() => ensureAllFonts(), []); // para ver cada fuente en la vista previa
  const brandFont = (brand.theme.fontDisplay.match(/'([^']+)'/) ?? [])[1] ?? 'la de la marca';
  const titleOpt = fontOption(t.titleFamily);
  const italicAllowed = t.titleFamily ? titleOpt?.italic !== false : true;
  const isDefault = !t.titleFamily && !t.bodyFamily && !t.headlineFamily && t.titleItalic == null && (t.titleWeight ?? 400) === 400 && (t.titleSize ?? 'm') === 'm' && t.headlineUppercase !== false;

  return (
    <div className="type-editor" data-testid="type-editor">
      <div className="form">
        <div className="type-editor__head">
          <p className="type-editor__title">Tipografía de los planes</p>
          <p className="muted small">Si dejas «Como la marca», se usa la tipografía definida en Marcas.</p>
        </div>

        <div className="type-editor__group">
          <p className="type-editor__group-title">Nombre del plan</p>
          <FontSelect label="Fuente" value={t.titleFamily} onChange={(v) => onChange({ titleFamily: v })} defaultLabel={`Como la marca (${brandFont})`} testId="type-title-font" />
          <div className="form__row">
            <Field label="Grosor">
              <select value={t.titleWeight ?? 400} onChange={(e) => onChange({ titleWeight: Number(e.target.value) })} data-testid="type-title-weight">
                {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </Field>
            <Field label="Tamaño">
              <select value={t.titleSize ?? 'm'} onChange={(e) => onChange({ titleSize: e.target.value })} data-testid="type-title-size">
                {Object.entries(TITLE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Estilo">
            <select
              value={t.titleItalic == null ? '' : t.titleItalic ? 'italic' : 'normal'}
              onChange={(e) => onChange({ titleItalic: e.target.value === '' ? null : e.target.value === 'italic' })}
              data-testid="type-title-style"
            >
              <option value="">Como la marca ({brand.theme.displayStyle === 'italic' ? 'cursiva' : 'normal'})</option>
              <option value="normal">Normal</option>
              {italicAllowed && <option value="italic">Cursiva</option>}
            </select>
          </Field>
        </div>

        <div className="type-editor__group">
          <p className="type-editor__group-title">Texto, lista y precio</p>
          <FontSelect label="Fuente" value={t.bodyFamily} onChange={(v) => onChange({ bodyFamily: v })} defaultLabel="Como la web (Inter)" testId="type-body-font" />
        </div>

        <div className="type-editor__group">
          <p className="type-editor__group-title">Titular de la sección</p>
          <FontSelect label="Fuente" value={t.headlineFamily} onChange={(v) => onChange({ headlineFamily: v })} defaultLabel="Como la web (Archivo)" testId="type-headline-font" />
          <Toggle checked={t.headlineUppercase !== false} onChange={(v) => onChange({ headlineUppercase: v })} label="En mayúsculas" />
        </div>

        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ titleFamily: null, titleItalic: null, titleWeight: 400, titleSize: 'm', bodyFamily: null, headlineFamily: null, headlineUppercase: true })}
          >
            Restaurar tipografía de la marca
          </Button>
        )}
      </div>

      <div className="type-preview" aria-label="Vista previa de la tipografía">
        <p className="muted small">Vista previa</p>
        <div className="type-preview__frame" style={{ ...brandStyle(brand), ...planTypeVars(brand, t) }} data-testid="type-preview">
          <p className="studio-plans__step">{eyebrow || 'Paso 1 de 6 · Elige tu plan'}</p>
          <p className="studio-plans__title">{headline || 'Reserva tu cita'}</p>
          {plan ? (
            <div className="hplan">
              <div className="hplan__body">
                <p className="hplan__name" data-testid="type-preview-name">{plan.name}</p>
                <p className="hplan__desc">{plan.description}</p>
                <p className="hplan__includes-title">Incluye</p>
                <ul className="hplan__includes">
                  {plan.deliverables.slice(0, 3).map((x) => <li key={x}>{x}</li>)}
                </ul>
                <hr className="hplan__rule" />
                <p className="hplan__meta">{formatDuration(plan.durationMin)} de sesión</p>
                <p className="hplan__price">{formatMoney(plan.price, brand.currency)}</p>
                <span className="btn btn--primary btn--sm" aria-hidden="true">Reservar ahora</span>
              </div>
            </div>
          ) : (
            <p className="muted small">Crea un plan para ver la vista previa.</p>
          )}
        </div>
      </div>
    </div>
  );
}
