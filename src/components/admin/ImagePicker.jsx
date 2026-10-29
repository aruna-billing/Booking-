import { useId, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { useImageLibrary } from '../../store/imageStore.js';
import { uploadToLibrary, ACCEPT } from '../../lib/mediaUpload.js';
import { formatSeconds } from '../../lib/videos.js';
import { useDb } from '../../store/mockDb.js';

/** Selector de imágenes de la biblioteca, con subida directa. */
export function ImagePicker({ open, onClose, onPick, brandId = null, currentId = null, title = 'Elegir imagen', kind = 'image' }) {
  const isVid = kind === 'video';
  const { list } = useImageLibrary();
  const { brands } = useDb();
  // Por defecto: imágenes de esta marca y las que no tienen marca asignada.
  const [filter, setFilter] = useState(brandId ? 'brand+none' : 'all');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef(null);
  const id = useId();

  const ofKind = list.filter((x) => (x.kind ?? 'image') === kind);
  const shown = ofKind.filter((x) =>
    filter === 'all' ? true : filter === 'brand+none' ? !x.brandId || x.brandId === brandId : filter === 'none' ? !x.brandId : x.brandId === filter
  );

  const upload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    const { added, errors: errs } = await uploadToLibrary(files, { brandId, kind });
    setBusy(false);
    setErrors(errs);
    // Si se subió una sola, se elige directamente.
    if (added.length === 1 && errs.length === 0) {
      onPick(added[0].id);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Cancelar</Button>}
    >
      <div className="picker__bar">
        <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()} data-testid="picker-upload-btn">
          Subir desde mi computadora
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT[kind].join(',')}
          className="visually-hidden"
          tabIndex={-1}
          aria-labelledby={`${id}-up`}
          data-testid="picker-upload"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = '';
          }}
        />
        <span id={`${id}-up`} className="visually-hidden">{isVid ? 'Subir videos' : 'Subir imágenes'}</span>
        <label className="picker__filter">
          <span className="visually-hidden">Mostrar</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {brandId && <option value="brand+none">Esta marca y sin marca</option>}
            <option value="all">Todas las imágenes</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="none">Sin marca</option>
          </select>
        </label>
      </div>
      {errors.length > 0 && (
        <div className="callout callout--red" role="alert">{errors.map((e) => <p key={e}>{e}</p>)}</div>
      )}
      {shown.length === 0 ? (
        <div
          className="picker__empty"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        >
          <p>No hay {isVid ? 'videos' : 'imágenes'} {filter === 'all' ? 'en la biblioteca' : 'en este filtro'}.</p>
          <p className="muted small">
            {isVid ? 'Sube uno desde tu computadora o arrástralo aquí. MP4 o WebM, hasta 50 MB y 60 segundos.' : 'Sube una desde tu computadora o arrástrala aquí. JPG, PNG o WebP hasta 15 MB.'}
          </p>
        </div>
      ) : (
        <ul className="picker__grid" aria-label={isVid ? 'Videos de la biblioteca' : 'Imágenes de la biblioteca'}>
          {shown.map((img) => (
            <li key={img.id}>
              <button
                type="button"
                className={`picker__item ${img.id === currentId ? 'is-current' : ''}`}
                aria-pressed={img.id === currentId}
                onClick={() => { onPick(img.id); onClose(); }}
              >
                <MediaThumb rec={img} />
                <span className="picker__name">{img.alt || img.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Espacio de imagen editable: miniatura + elegir / quitar. */
export function ImageSlot({ label, hint, imageId, onChange, brandId, ratio = '16 / 9', testId, compact = false, kind = 'image', emptyText }) {
  const [open, setOpen] = useState(false);
  const { list } = useImageLibrary();
  const img = list.find((x) => x.id === imageId);
  const noun = kind === 'video' ? 'video' : 'imagen';
  return (
    <div className={`slot-edit ${compact ? 'slot-edit--compact' : ''}`} data-testid={testId}>
      {label && <p className="field__label">{label}</p>}
      <button type="button" className="slot-edit__thumb" style={{ aspectRatio: ratio }} onClick={() => setOpen(true)} aria-label={`${img ? 'Cambiar' : 'Elegir'} ${noun}${label ? `: ${label}` : ''}`}>
        {img ? (
          <MediaThumb rec={img} />
        ) : (
          <span className="slot-edit__empty">Sin {noun}<br /><span className="small">{emptyText ?? 'Se muestra el marcador'}</span></span>
        )}
      </button>
      <div className="slot-edit__actions">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{img ? 'Cambiar' : `Elegir ${noun}`}</Button>
        {img && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Quitar</Button>}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
      {open && <ImagePicker open kind={kind} onClose={() => setOpen(false)} onPick={onChange} brandId={brandId} currentId={imageId} title={label ? `Elegir ${noun} · ${label}` : `Elegir ${noun}`} />}
    </div>
  );
}

/** Miniatura de imagen o de video (fotograma + duración). */
export function MediaThumb({ rec }) {
  const style = { objectPosition: `${rec.focal?.x ?? 50}% ${rec.focal?.y ?? 50}%` };
  if (rec.kind === 'video') {
    return (
      <span className="media-thumb">
        {rec.poster ? <img src={rec.poster} alt="" style={style} /> : <span className="media-thumb__noposter" />}
        <span className="media-thumb__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
          {formatSeconds(rec.duration)}
        </span>
      </span>
    );
  }
  return <img src={rec.src} alt="" style={style} />;
}
