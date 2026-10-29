import { useId, useRef, useState } from 'react';
import { Button } from './Button.jsx';
import { processImage, dataUrlKB } from '../../lib/images.js';

/**
 * Subida de una imagen desde el ordenador con vista previa.
 * `value` = { src, name, width, height } | null.
 * `background` = color de fondo de la vista previa (p. ej. oscuro para un logo en negativo).
 */
export function ImageUpload({ label, hint, value, onChange, options, background, aspect = '16 / 9', fit = 'cover', testId }) {
  const id = useId();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const img = await processImage(file, options);
      onChange({ src: img.src, name: img.name, width: img.width, height: img.height });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`imgup ${error ? 'imgup--error' : ''}`}>
      <p className="field__label" id={`${id}-label`}>{label}</p>
      <div
        className="imgup__box"
        style={{ aspectRatio: aspect, background: background ?? undefined }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        {value?.src ? (
          <img src={value.src} alt={`Vista previa: ${label}`} style={{ objectFit: fit }} />
        ) : (
          <span className="imgup__empty">Sin imagen · arrastra un archivo aquí</span>
        )}
      </div>
      <div className="imgup__actions">
        <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()} aria-describedby={`${id}-hint ${error ? `${id}-err` : ''}`}>
          {value?.src ? 'Cambiar imagen' : 'Subir desde mi computadora'}
        </Button>
        {value?.src && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Quitar
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          tabIndex={-1}
          accept={options.accept.join(',')}
          aria-labelledby={`${id}-label`}
          data-testid={testId}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="field__hint" id={`${id}-hint`}>
        {hint}
        {value?.src ? ` · ${value.name ?? 'imagen'}${value.width ? ` · ${value.width}×${value.height}px` : ''} · ${dataUrlKB(value.src)} KB` : ''}
      </p>
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          <span aria-hidden="true">!</span> {error}
        </p>
      )}
    </div>
  );
}
