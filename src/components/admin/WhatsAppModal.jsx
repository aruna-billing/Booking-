import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { WA_KINDS, waKindFor, waLink, waMessage, waPhone } from '../../lib/whatsapp.js';

/** Copia el texto al portapapeles (con respaldo para navegadores sin permiso). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/**
 * Mensaje de WhatsApp de una solicitud: se rellena con la plantilla de la marca,
 * se puede retocar antes de copiarlo y abrir WhatsApp con el texto ya escrito.
 */
export function WhatsAppModal({ request: r, brand, plan, onClose, canEditTemplates }) {
  const toast = useToast();
  const [kind, setKind] = useState(waKindFor(r));
  const [text, setText] = useState(() => waMessage(r, brand, plan, waKindFor(r)));
  const phone = waPhone(r.client.phone);

  const pick = (k) => {
    setKind(k);
    setText(waMessage(r, brand, plan, k));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Mensaje de WhatsApp"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {phone && (
            <Button variant="secondary" href={waLink(r.client.phone, text)} target="_blank" rel="noopener noreferrer" data-testid="wa-open">
              Abrir en WhatsApp
            </Button>
          )}
          <Button
            data-autofocus
            data-testid="wa-copy"
            onClick={async () => {
              const ok = await copyText(text);
              toast(ok ? 'Mensaje copiado. Pégalo en WhatsApp.' : 'No se pudo copiar; selecciona el texto y cópialo.', ok ? 'green' : 'red');
            }}
          >
            Copiar mensaje
          </Button>
        </>
      }
    >
      <div className="seg" role="radiogroup" aria-label="Qué mensaje">
        {WA_KINDS.map((k) => (
          <label key={k.key} className={`seg__opt ${kind === k.key ? 'is-on' : ''}`}>
            <input type="radio" name="wa-kind" checked={kind === k.key} onChange={() => pick(k.key)} data-testid={`wa-kind-${k.key}`} />
            {k.label}
          </label>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Puedes retocarlo antes de copiarlo</span>
        <textarea className="wa-edit" rows={14} value={text} onChange={(e) => setText(e.target.value)} data-testid="wa-text" />
      </label>
      <p className="muted small">
        Para: {r.client.phone || 'sin teléfono'}
        {r.client.phone && !phone && ' (revisa el número: no parece completo)'}
        {canEditTemplates && (
          <>
            {' · '}
            <Link to="/admin/personalizacion">Cambiar la plantilla</Link> en Personalización → {brand.name} → Mensajes de WhatsApp.
          </>
        )}
      </p>
    </Modal>
  );
}
