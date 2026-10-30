import { useState } from 'react';
import { Card } from './parts.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge, useToast } from '../ui/misc.jsx';
import { useDb } from '../../store/mockDb.js';
import { useCloudStatus } from '../../store/cloudStatus.js';
import { checkCalendar, syncCalendar } from '../../services/cloud.js';
import { addDays, toISODate, today } from '../../lib/date.js';

/** Estado de la conexión con Google Calendar y sincronización manual. */
export function GoogleCalendarCard() {
  const db = useDb();
  const { calendar: info } = useCloudStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const check = async () => {
    setBusy('check');
    await checkCalendar();
    setBusy(null);
  };

  const syncAll = async () => {
    setBusy('sync');
    const from = toISODate(addDays(today(), -7));
    const ids = db.requests.filter((r) => r.date >= from && ['confirmed', 'completed', 'cancelled'].includes(r.status)).map((r) => r.id);
    try {
      let done = 0;
      for (let i = 0; i < ids.length; i += 50) {
        await syncCalendar(ids.slice(i, i + 50));
        done += ids.slice(i, i + 50).length;
      }
      toast(done ? `Calendario al día: ${done} reserva${done === 1 ? '' : 's'} revisada${done === 1 ? '' : 's'}` : 'No hay reservas que sincronizar', 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy(null);
  };

  const ok = info?.configured && info?.ok;
  return (
    <Card title="Google Calendar" className="gcal-card">
      {!info ? (
        <p className="muted">Comprobando la conexión…</p>
      ) : ok ? (
        <>
          <p>
            <Badge tone="green">Conectado</Badge> Calendario: <strong>{info.calendar}</strong>
          </p>
          <ul className="gcal-card__list small">
            <li>Al confirmar una reserva se crea su evento (nombre, plan y teléfono). Si se cancela, el evento se borra.</li>
            <li>Lo que esté ocupado en ese calendario no se ofrece al cliente. Los eventos marcados como «Disponible» no bloquean.</li>
          </ul>
          <div className="gcal-card__actions">
            <Button size="sm" variant="secondary" onClick={syncAll} loading={busy === 'sync'} data-testid="gcal-sync-all">
              Sincronizar reservas
            </Button>
            <Button size="sm" variant="ghost" onClick={check} loading={busy === 'check'}>Comprobar conexión</Button>
          </div>
        </>
      ) : (
        <>
          <p>
            <Badge tone={info.configured ? 'red' : 'neutral'}>{info.configured ? 'Con errores' : 'No conectado'}</Badge> {info.reason}
          </p>
          {info.serviceAccount && (
            <p className="small">
              Comparte tu calendario con <strong className="gcal-card__email">{info.serviceAccount}</strong> con el permiso «Hacer cambios en eventos».
            </p>
          )}
          <p className="muted small">Los pasos están en <code>docs/GOOGLE-CALENDAR.md</code>. Mientras tanto, el cliente ve como ocupados solo las reservas activas y los días bloqueados.</p>
          <div className="gcal-card__actions">
            <Button size="sm" variant="ghost" onClick={check} loading={busy === 'check'}>Comprobar de nuevo</Button>
          </div>
        </>
      )}
    </Card>
  );
}
