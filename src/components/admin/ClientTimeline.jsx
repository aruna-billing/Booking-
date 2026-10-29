import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Badge, useToast } from '../ui/misc.jsx';
import { formatShortDate, formatTime, toISODate, today } from '../../lib/date.js';
import { alertOf, confirmedAtOf, deliveryDueDate, isExpress, stageOf } from '../../lib/tracking.js';
import * as api from '../../services/api.js';

const fmtDate = (iso) => (iso ? formatShortDate(iso.slice(0, 10)) : '');

/**
 * Línea de tiempo del cliente: Solicitud → Reservado → Día de las fotos → Entrega.
 * Muestra la fecha de cada paso y la siguiente acción.
 */
export function ClientTimeline({ request: r, brand, extras, can }) {
  const toast = useToast();
  const [delivering, setDelivering] = useState(false);
  const [busy, setBusy] = useState(false);
  const stage = stageOf(r);
  const due = deliveryDueDate(r, brand, extras);
  const alert = alertOf(r, brand, extras);
  const idx = ['request', 'booked', 'shot', 'delivered'].indexOf(stage);
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
      key: 'delivered',
      label: 'Entrega',
      date: r.deliveredAt ? fmtDate(r.deliveredAt) : `Vence ${formatShortDate(due)}`,
      note: r.deliveredAt ? 'Entregadas' : isExpress(r, extras) ? 'Entrega exprés (72 h)' : `${brand?.deliveryDays ?? 10} días hábiles`,
    },
  ];
  // Pasos completados según la etapa; el siguiente es el «paso actual».
  const doneCount = { request: 1, booked: 2, shot: 3, delivered: 4 }[stage] ?? 0;
  const stateOf = (i) => (stage === null ? 'off' : i < doneCount ? 'done' : i === doneCount ? 'current' : 'todo');

  const doShot = async () => {
    setBusy(true);
    try {
      await api.markShot(r.id);
      toast('Fotos realizadas: el cliente pasa a edición', 'green');
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
        {stage === 'shot' && (
          <>
            {alert && <Badge tone={alert.tone}>{alert.text}</Badge>}
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
        {can('requests.manage') && (stage === 'shot' || stage === 'delivered') && (
          <button type="button" className="link-btn small ctl__undo" onClick={undo} data-testid="undo-step">
            Deshacer último paso
          </button>
        )}
      </div>

      {delivering && <DeliverDialog request={r} onClose={() => setDelivering(false)} />}
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
