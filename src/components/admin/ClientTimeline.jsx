import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Badge, useToast } from '../ui/misc.jsx';
import { formatShortDate, formatTime, toISODate, today } from '../../lib/date.js';
import { alertOf, confirmedAtOf, deliveryDueDate, isExpress, selectionDays, selectionDueDate, stageOf } from '../../lib/tracking.js';
import * as api from '../../services/api.js';
import { useDb } from '../../store/mockDb.js';
import { WhatsAppModal } from './WhatsAppModal.jsx';

const fmtDate = (iso) => (iso ? formatShortDate(iso.slice(0, 10)) : '');

/**
 * Línea de tiempo del cliente: Solicitud → Reservado → Día de las fotos → Selección → Entrega.
 * Muestra la fecha de cada paso y la siguiente acción.
 */
export function ClientTimeline({ request: r, brand, extras, can }) {
  const toast = useToast();
  const db = useDb();
  const [delivering, setDelivering] = useState(false);
  const [selDialog, setSelDialog] = useState(null); // 'sent' | 'done' | 'whatsapp'
  const [busy, setBusy] = useState(false);
  const stage = stageOf(r);
  const due = deliveryDueDate(r, brand, extras);
  const alert = alertOf(r, brand, extras);
  const idx = ['request', 'booked', 'selecting', 'shot', 'delivered'].indexOf(stage);
  const sel = r.selection;
  const days = isExpress(r, extras) ? 'Entrega exprés (72 h)' : `${brand?.deliveryDays ?? 10} días hábiles`;
  const selPlazo = `${selectionDays(brand)} día${selectionDays(brand) === 1 ? '' : 's'}`;
  const legacyNoSelection = idx >= 3 && !sel; // marcada antes de existir la etapa de selección
  const sessionFuture = r.date > toISODate(today());

  const steps = [
    { key: 'request', label: 'Solicitud', date: fmtDate(r.createdAt), note: 'Recibida' },
    { key: 'booked', label: 'Reservado', date: fmtDate(confirmedAtOf(r)), note: idx === 0 ? 'Pendiente de aceptar' : 'Anticipo verificado' },
    {
      key: 'shot',
      label: 'Día de las fotos',
      date: `${formatShortDate(r.date)} · ${formatTime(r.time)}`,
      note: idx >= 2 ? 'Realizadas' : idx === 1 ? (alert?.kind === 'shoot_unmarked' ? '¿Se realizó?' : 'Programada') : 'Programada',
    },
    {
      key: 'selecting',
      label: 'Selección',
      date: sel?.doneAt ? fmtDate(sel.doneAt) : sel?.sentAt ? `Enviadas ${fmtDate(sel.sentAt)}` : '',
      note: legacyNoSelection
        ? 'Sin selección'
        : sel?.doneAt
          ? sel.count != null ? `${sel.count} foto${sel.count === 1 ? '' : 's'} elegida${sel.count === 1 ? '' : 's'}` : 'Elegidas'
          : stage === 'selecting'
            ? sel?.sentAt ? `Elegir antes del ${formatShortDate(selectionDueDate(r, brand))}` : `Por enviar · ${selPlazo} para elegir`
            : `${selPlazo} para elegir`,
    },
    {
      key: 'delivered',
      label: 'Entrega',
      date: r.deliveredAt ? fmtDate(r.deliveredAt) : idx >= 3 ? `Vence ${formatShortDate(due)}` : 'Tras la selección',
      note: r.deliveredAt ? 'Entregadas' : days,
    },
  ];
  // Pasos completados según la etapa; el siguiente es el «paso actual».
  const doneCount = { request: 1, booked: 2, selecting: 3, shot: 4, delivered: 5 }[stage] ?? 0;
  const stateOf = (i) => (stage === null ? 'off' : i < doneCount ? 'done' : i === doneCount ? 'current' : 'todo');

  const doShot = async () => {
    setBusy(true);
    try {
      await api.markShot(r.id);
      toast('Fotos realizadas: el cliente pasa a selección', 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy(false);
  };
  const undo = async () => {
    try {
      await api.undoTrackingStep(r.id);
      toast('Paso deshecho');
    } catch (e) {
      toast(e.message, 'red');
    }
  };

  return (
    <section className={`ctl ${stage === null ? 'is-cancelled' : ''}`} aria-label="Seguimiento del cliente" data-testid="client-timeline">
      <ol className="ctl__steps">
        {steps.map((s, i) => {
          const st = stateOf(i);
          return (
            <li key={s.key} className={`ctl__step is-${st}`} aria-current={st === 'current' ? 'step' : undefined}>
              <span className="ctl__dot" aria-hidden="true">{st === 'done' ? '✓' : i + 1}</span>
              <span className="ctl__text">
                <span className="ctl__label">{s.label}</span>
                <span className="ctl__date">{s.date || '—'}</span>
                <span className="ctl__note">{s.note}</span>
              </span>
              <span className="visually-hidden">{st === 'done' ? ' (completado)' : st === 'current' ? ' (paso actual)' : ''}</span>
            </li>
          );
        })}
      </ol>

      <div className="ctl__next">
        {stage === null && <p className="small muted">Solicitud cancelada: no tiene seguimiento.</p>}
        {stage === 'request' && <p className="small muted">Acepta la sesión para empezar el seguimiento.</p>}
        {stage === 'booked' && (
          <>
            {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
            {can('tracking.update') && (
              <Button size="sm" onClick={doShot} loading={busy} disabled={sessionFuture} data-testid="mark-shot">
                Marcar fotos realizadas
              </Button>
            )}
            {sessionFuture && can('tracking.update') && <span className="small muted">Disponible desde el día de la sesión.</span>}
          </>
        )}
        {stage === 'selecting' && (
          <>
            {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
            {can('tracking.update') && (
              <>
                <Button size="sm" variant={sel?.sentAt ? 'secondary' : 'primary'} onClick={() => setSelDialog('sent')} data-testid="selection-sent">
                  {sel?.sentAt ? 'Editar envío' : 'Enviar para elegir'}
                </Button>
                <Button size="sm" variant={sel?.sentAt ? 'primary' : 'secondary'} onClick={() => setSelDialog('done')} data-testid="selection-done">
                  Ya eligió sus fotos
                </Button>
              </>
            )}
            {sel?.url && (
              <span className="small ctl__gallery">
                Para elegir: <a href={sel.url} target="_blank" rel="noopener noreferrer">{sel.url.replace(/^https?:\/\//, '')}</a>
              </span>
            )}
          </>
        )}
        {stage === 'shot' && (
          <>
            {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
            {sel?.doneAt && (
              <span className="small muted" data-testid="selection-summary">
                {sel.count != null ? `Eligió ${sel.count} foto${sel.count === 1 ? '' : 's'}` : 'Ya eligió'} el {fmtDate(sel.doneAt)}
                {sel.note ? ` · ${sel.note}` : ''}
              </span>
            )}
            {can('tracking.update') && (
              <Button size="sm" onClick={() => setDelivering(true)} data-testid="mark-delivered">
                Marcar como entregado
              </Button>
            )}
          </>
        )}
        {stage === 'delivered' && (
          <>
            {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
            {r.galleryUrl && (
              <span className="small ctl__gallery">
                Galería: <a href={r.galleryUrl} target="_blank" rel="noopener noreferrer">{r.galleryUrl.replace(/^https?:\/\//, '')}</a>
              </span>
            )}
            {r.deliveryNote && <span className="small muted">{r.deliveryNote}</span>}
          </>
        )}
        {can('requests.manage') && (stage === 'selecting' || stage === 'shot' || stage === 'delivered') && (
          <button type="button" className="link-btn small ctl__undo" onClick={undo} data-testid="undo-step">
            Deshacer último paso
          </button>
        )}
      </div>

      {delivering && <DeliverDialog request={r} onClose={() => setDelivering(false)} />}
      {selDialog === 'sent' && <SelectionSentDialog request={r} onClose={() => setSelDialog(null)} onSaved={() => setSelDialog('whatsapp')} />}
      {selDialog === 'done' && <SelectionDoneDialog request={r} onClose={() => setSelDialog(null)} />}
      {selDialog === 'whatsapp' && (
        <WhatsAppModal
          request={r}
          brand={brand}
          plan={db.plans.find((p) => p.id === r.planId)}
          initialKind="selection"
          canEditTemplates={can('web.manage')}
          onClose={() => setSelDialog(null)}
        />
      )}
    </section>
  );
}

/** Diálogo para registrar la entrega (fecha, enlace de la galería y nota). */
export function DeliverDialog({ request: r, onClose }) {
  const toast = useToast();
  const todayIso = toISODate(today());
  const [date, setDate] = useState(todayIso);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.markDelivered(r.id, { date, galleryUrl: url, note });
      toast(`Fotos de ${r.client.firstName} marcadas como entregadas`, 'green');
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Entregar fotos · ${r.client.firstName} ${r.client.lastName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="deliver-save">Marcar como entregado</Button>
        </>
      }
    >
      <div className="form">
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <Field label="Fecha de entrega" required>
          <input type="date" value={date} min={r.shotAt ?? undefined} max={todayIso} onChange={(e) => setDate(e.target.value)} data-testid="deliver-date" />
        </Field>
        <Field label="Enlace de la galería" hint="Pixieset, Google Drive, Dropbox… Empieza con https://">
          <input type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="deliver-url" />
        </Field>
        <Field label="Nota">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: se enviaron 12 fotos por WhatsApp" />
        </Field>
      </div>
    </Modal>
  );
}

/** Envío de las fotos para elegir: fecha y enlace (opcional). Al guardar se abre el mensaje de WhatsApp. */
export function SelectionSentDialog({ request: r, onClose, onSaved }) {
  const todayIso = toISODate(today());
  const [date, setDate] = useState(r.selection?.sentAt ?? todayIso);
  const [url, setUrl] = useState(r.selection?.url ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.markSelectionSent(r.id, { date, url });
      (onSaved ?? onClose)();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Fotos para elegir · ${r.client.firstName} ${r.client.lastName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="selection-sent-save">Guardar</Button>
        </>
      }
    >
      <div className="form">
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <Field label="Fecha de envío" required>
          <input type="date" value={date} min={r.shotAt ?? undefined} max={todayIso} onChange={(e) => setDate(e.target.value)} data-testid="selection-sent-date" />
        </Field>
        <Field label="Enlace para elegir (opcional)" hint="La galería donde el cliente marca sus favoritas (Pixieset, Google Drive…). Empieza con https://">
          <input type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="selection-url" />
        </Field>
        <p className="muted small">Al guardar se abre el mensaje de WhatsApp «Elegir fotos» para enviárselo, con la fecha límite para elegir.</p>
      </div>
    </Modal>
  );
}

/** El cliente ya eligió: fecha, cuántas fotos y una nota. Pasa a edición. */
export function SelectionDoneDialog({ request: r, onClose }) {
  const toast = useToast();
  const todayIso = toISODate(today());
  const [date, setDate] = useState(todayIso);
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.markSelectionDone(r.id, { date, count, note });
      toast(`${r.client.firstName} ya eligió: pasa a edición`, 'green');
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Selección recibida · ${r.client.firstName} ${r.client.lastName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} data-testid="selection-done-save">Pasar a edición</Button>
        </>
      }
    >
      <div className="form">
        {error && <p className="callout callout--red" role="alert">{error}</p>}
        <Field label="Fecha en que eligió" required hint="Desde este día se cuenta el plazo de entrega.">
          <input type="date" value={date} min={r.shotAt ?? undefined} max={todayIso} onChange={(e) => setDate(e.target.value)} data-testid="selection-done-date" />
        </Field>
        <Field label="Fotos elegidas (opcional)">
          <input type="number" inputMode="numeric" min={0} step={1} value={count} onChange={(e) => setCount(e.target.value)} data-testid="selection-count" />
        </Field>
        <Field label="Nota (opcional)">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pidió 3 fotos extra en blanco y negro" data-testid="selection-note" />
        </Field>
      </div>
    </Modal>
  );
}
