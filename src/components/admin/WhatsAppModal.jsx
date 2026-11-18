import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/misc.jsx';
import { Link } from '../../lib/router.jsx';
import { can, getCurrentUser } from '../../lib/auth.js';
import * as api from '../../services/api.js';
import { WA_KINDS, WA_LINK_VAR, waKindFor, waLink, waMessage, waPhone } from '../../lib/whatsapp.js';

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

const isUrl = (v) => /^https?:\/\/\S+\.\S+/i.test(v);

/**
 * Mensaje de WhatsApp de una solicitud: se rellena con la plantilla de la marca,
 * se puede retocar antes de copiarlo y abrir WhatsApp con el texto ya escrito.
 */
export function WhatsAppModal({ request: r, brand, plan, onClose, canEditTemplates, initialKind }) {
  const toast = useToast();
  const firstKind = initialKind ?? waKindFor(r);
  const savedLink = (k) => (k === 'delivered' ? r.galleryUrl : k === 'selection' ? r.selection?.url : '') ?? '';
  const [kind, setKind] = useState(firstKind);
  const [link, setLink] = useState(() => savedLink(firstKind));
  const [text, setText] = useState(() => waMessage(r, brand, plan, firstKind));
  const phone = waPhone(r.client.phone);
  const linkVar = WA_LINK_VAR[kind];

  const render = (k, l) => waMessage(r, brand, plan, k, WA_LINK_VAR[k] ? { [WA_LINK_VAR[k]]: l.trim() } : {});

  const pick = (k) => {
    const l = savedLink(k);
    setKind(k);
    setLink(l);
    setText(render(k, l));
  };

  // Al pegar o cambiar el enlace, se pone en el mensaje. Si ya retocaste el texto,
  // se cambia solo el enlace anterior para no perder tus cambios.
  const changeLink = (next) => {
    const prev = link.trim();
    const clean = next.trim();
    setLink(next);
    setText((t) => {
      if (t === render(kind, prev)) return render(kind, clean); // sin retoques: se rehace con el enlace
      if (isUrl(prev) && t.includes(prev)) {
        // Si se borra el enlace, se quita también su línea «👉 …».
        const out = clean ? t.split(prev).join(clean) : t.split(`👉 ${prev}`).join('').split(prev).join('');
        return out.replace(/\n{3,}/g, '\n\n').trim();
      }
      if (isUrl(clean) && !t.includes(clean)) return `${t}\n\n👉 ${clean}`;
      return t;
    });
  };

  // El enlace pegado en «Fotos entregadas» se guarda en la reserva (se ve en Seguimientos).
  const keepLink = () => {
    const l = link.trim();
    if (kind !== 'delivered' || !r.deliveredAt || !isUrl(l) || l === (r.galleryUrl ?? '') || !can(getCurrentUser(), 'tracking.update')) return;
    api.saveGalleryUrl(r.id, l).catch(() => {});
  };

  const paste = async () => {
    try {
      const v = (await navigator.clipboard.readText()).trim();
      if (!v) throw new Error('vacío');
      changeLink(v);
      toast('Enlace pegado en el mensaje', 'green');
    } catch {
      toast('No se pudo leer el portapapeles. Pega el enlace en el campo (Ctrl+V o mantén presionado → Pegar).', 'red');
    }
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
            <Button variant="secondary" href={waLink(r.client.phone, text)} target="_blank" rel="noopener noreferrer" onClick={keepLink} data-testid="wa-open">
              Abrir en WhatsApp
            </Button>
          )}
          <Button
            data-autofocus
            data-testid="wa-copy"
            onClick={async () => {
              keepLink();
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
        {WA_KINDS.filter((k) => (k.key !== 'moved' || r.rescheduledFrom) && (k.key !== 'selection' || (r.status === 'completed' && r.selection)) && (k.key !== 'delivered' || r.status === 'completed')).map((k) => (
          <label key={k.key} className={`seg__opt ${kind === k.key ? 'is-on' : ''}`}>
            <input type="radio" name="wa-kind" checked={kind === k.key} onChange={() => pick(k.key)} data-testid={`wa-kind-${k.key}`} />
            {k.label}
          </label>
        ))}
      </div>
      {linkVar && (
        <div className="field wa-link" data-testid="wa-link-field">
          <label className="field__label" htmlFor="wa-link">{kind === 'delivered' ? 'Enlace de la galería' : 'Enlace para elegir'}</label>
          <div className="wa-link__row">
            <input
              id="wa-link"
              type="url"
              inputMode="url"
              placeholder="Pega aquí el enlace (Pixieset, Google Drive…)"
              value={link}
              onChange={(e) => changeLink(e.target.value)}
              data-testid="wa-link"
            />
            <Button size="sm" variant="secondary" onClick={paste} data-testid="wa-link-paste">Pegar</Button>
          </div>
          <p className="field__hint">Copia el enlace de la galería y pégalo aquí: aparece solo en el mensaje.</p>
          {link.trim() && !/^https?:\/\//i.test(link.trim()) && <p className="field__hint wa-link__warn">Revisa el enlace: debería empezar con https://</p>}
        </div>
      )}
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
