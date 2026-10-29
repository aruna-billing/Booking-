import { useEffect, useState } from 'react';
import { signedFileUrl } from '../../services/cloud.js';

/** Enlace temporal a un archivo privado (comprobante o inspiración). */
export function useSignedUrl(path) {
  const [state, setState] = useState({ url: null, error: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedFileUrl(path).then(
      (url) => alive && setState({ url, error: null }),
      (e) => alive && setState({ url: null, error: e.message })
    );
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

/** Miniatura de una imagen privada, o un enlace si es PDF. */
export function PrivateFile({ file, ratio = '1 / 1', className = '' }) {
  const { url, error } = useSignedUrl(file.path);
  const isImage = (file.type || '').startsWith('image/') && !/heic|heif/.test(file.type);
  if (error) return <p className="small callout callout--red">{error}</p>;
  if (!url) return <div className={`private-file is-loading ${className}`} style={{ aspectRatio: ratio }} aria-label="Cargando archivo" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`private-file ${className}`} style={{ aspectRatio: ratio }}>
      {isImage ? (
        <img src={url} alt={`Archivo del cliente: ${file.name}`} loading="lazy" />
      ) : (
        <span className="private-file__doc">{file.type === 'application/pdf' ? 'PDF' : 'Archivo'} · abrir</span>
      )}
    </a>
  );
}
