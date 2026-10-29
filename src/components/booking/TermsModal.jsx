import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { formatShortDate } from '../../lib/date.js';

export function TermsModal({ open, onClose, onAccept, brand, terms }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Términos y condiciones · ${brand.name}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {onAccept && (
            <Button onClick={onAccept} data-autofocus>
              Acepto los términos
            </Button>
          )}
        </>
      }
    >
      <p className="terms__meta">
        Versión {terms.version} · actualizada el {formatShortDate(terms.updatedAt)} · Texto de ejemplo, pendiente de revisión legal.
      </p>
      <ol className="terms">
        {terms.sections.map((s) => (
          <li key={s.title}>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
