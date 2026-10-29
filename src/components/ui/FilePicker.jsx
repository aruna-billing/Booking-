import { useId, useRef, useState } from 'react';
import { formatFileSize } from '../../lib/format.js';
import { LIVE } from '../../lib/mode.js';
import { uploadClientFile } from '../../services/cloud.js';

/**
 * Selector de archivos.
 * · Demo: los archivos solo se leen en el navegador (vista previa local); no se suben.
 * · Modo real: cada archivo se sube al elegirlo a un almacenamiento privado de Supabase
 *   (solo el equipo puede verlo). Cada archivo lleva `status` ('uploading' | 'ready' |
 *   'error') y, al terminar, `path`.
 */
export function FilePicker({ label, hint, files, onChange, maxFiles = 1, maxSizeMB = 10, accept = [], error, required }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  // Referencias a lo último recibido: las subidas terminan después de varios renders.
  const filesRef = useRef(files);
  filesRef.current = files;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const patchFile = (id, patch) => onChangeRef.current(filesRef.current.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  function startUpload(entry, file) {
    uploadClientFile(file)
      .then((path) => patchFile(entry.id, { status: 'ready', path }))
      .catch((e) => {
        patchFile(entry.id, { status: 'error' });
        setLocalError(`«${entry.name}» no se pudo subir: ${e.message}`);
      });
  }
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  function addFiles(list) {
    setLocalError(null);
    const incoming = [...list];
    const accepted = [];
    for (const f of incoming) {
      if (accept.length && !accept.includes(f.type)) {
        setLocalError(`«${f.name}» no es un formato permitido.`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setLocalError(`«${f.name}» supera ${maxSizeMB} MB.`);
        continue;
      }
      accepted.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        ...(LIVE ? { status: 'uploading' } : {}),
        file: f,
      });
    }
    const next = (maxFiles === 1 ? accepted.slice(0, 1) : [...files, ...accepted].slice(0, maxFiles)).map(({ file: _f, ...rest }) => rest);
    if (maxFiles > 1 && files.length + accepted.length > maxFiles) setLocalError(`Máximo ${maxFiles} archivos.`);
    if (!accepted.length) return;
    onChange(next);
    filesRef.current = next;
    if (LIVE) accepted.filter((a) => next.some((n) => n.id === a.id)).forEach((a) => startUpload(a, a.file));
  }

  function remove(id) {
    const f = files.find((x) => x.id === id);
    if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
    onChange(files.filter((x) => x.id !== id));
  }

  const shownError = error || localError;
  const full = files.length >= maxFiles && maxFiles > 1;
  const acceptLabel = accept
    .map((t) => t.split('/')[1].toUpperCase().replace('JPEG', 'JPG'))
    .join(', ');

  return (
    <div className={`filepicker ${shownError ? 'filepicker--error' : ''}`}>
      <p className="field__label" id={`${inputId}-label`}>
        {label}
        {required ? <span className="field__req" aria-hidden="true"> *</span> : <span className="field__opt"> (opcional)</span>}
      </p>
      {!(maxFiles === 1 && files.length === 1) && !full && (
        <div
          className={`dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="dropzone__icon">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="dropzone__text">
            Arrastra {maxFiles > 1 ? 'tus imágenes' : 'el archivo'} aquí o{' '}
            <button type="button" className="link-btn" onClick={() => inputRef.current?.click()} aria-describedby={`${hintId} ${shownError ? errorId : ''}`}>
              elige desde tu dispositivo
            </button>
          </p>
          <p className="dropzone__meta" id={hintId}>
            {acceptLabel} · hasta {maxSizeMB} MB{maxFiles > 1 ? ` · máx. ${maxFiles} archivos` : ''}
            {hint ? ` · ${hint}` : ''}
          </p>
          <input
            ref={inputRef}
            type="file"
            className="visually-hidden"
            tabIndex={-1}
            aria-labelledby={`${inputId}-label`}
            accept={accept.join(',')}
            multiple={maxFiles > 1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            data-testid={`file-${label}`}
          />
        </div>
      )}

      {files.length > 0 && (
        <ul className={`filelist ${maxFiles > 1 ? 'filelist--grid' : ''}`} aria-label="Archivos seleccionados">
          {files.map((f) => (
            <li key={f.id} className="filelist__item">
              {f.previewUrl ? (
                <img src={f.previewUrl} alt={`Vista previa local de ${f.name}`} className="filelist__thumb" />
              ) : (
                <span className="filelist__thumb filelist__thumb--doc" aria-hidden="true">
                  {f.type === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
              )}
              <span className="filelist__info">
                <span className="filelist__name">{f.name}</span>
                <span className="filelist__size" data-testid="file-status">
                  {formatFileSize(f.size)} ·{' '}
                  {!LIVE
                    ? 'solo en tu dispositivo'
                    : f.status === 'uploading'
                      ? 'subiendo…'
                      : f.status === 'error'
                        ? 'no se pudo subir · quítalo y vuelve a intentarlo'
                        : f.path
                          ? 'subido'
                          : 'vuelve a adjuntarlo'}
                </span>
              </span>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => remove(f.id)} aria-label={`Quitar ${f.name}`}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {shownError && (
        <p className="field__error" id={errorId} role="alert">
          <span aria-hidden="true">!</span> {shownError}
        </p>
      )}
      <p className="demo-note">
        {LIVE ? 'Tus archivos se guardan de forma privada: solo el equipo del estudio puede verlos.' : 'Prototipo: los archivos no se suben a ningún servidor.'}
      </p>
    </div>
  );
}
