import { formatFileSize } from '../../lib/format.js';
import { formatDateTime } from '../../lib/date.js';
import { PrivateFile } from './PrivateFile.jsx';

/** Vista simulada de un comprobante: el prototipo no almacena archivos reales. */
export function ReceiptPreview({ receipt, compact = false }) {
  if (!receipt) return <p className="muted">El cliente aún no adjuntó comprobante.</p>;
  const isPdf = receipt.type === 'application/pdf';
  if (receipt.path) {
    // Modo real: el archivo está en el almacenamiento privado de Supabase.
    return (
      <figure className={`receipt ${compact ? 'receipt--compact' : ''}`}>
        <PrivateFile file={receipt} ratio="3 / 4" className="receipt__file" />
        <figcaption>
          <strong>{receipt.name}</strong>
          <span className="muted small">
            {formatFileSize(receipt.size)} · {formatDateTime(receipt.uploadedAt)} · toca para abrir
          </span>
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className={`receipt ${compact ? 'receipt--compact' : ''}`}>
      <div className="receipt__doc" role="img" aria-label="Representación simulada del comprobante (no es el archivo real)">
        <span className="receipt__kind">{isPdf ? 'PDF' : 'IMAGEN'}</span>
        <span className="receipt__lines" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <span className="receipt__stamp">Archivo simulado</span>
      </div>
      <figcaption>
        <strong>{receipt.name}</strong>
        <span className="muted small">
          {formatFileSize(receipt.size)} · {formatDateTime(receipt.uploadedAt)}
        </span>
      </figcaption>
    </figure>
  );
}
