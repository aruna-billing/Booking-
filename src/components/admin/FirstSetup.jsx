import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { buildFirstSetup, setState } from '../../store/mockDb.js';
import { saveConfig } from '../../services/cloud.js';
import { getCloudStatus, setCloudStatus } from '../../store/cloudStatus.js';
import { Link } from '../../lib/router.jsx';

/** Primera vez con un Supabase vacío: crea la configuración inicial (marca, planes, horario…). */
const DAY = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hhmm = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};
function rulesText(r) {
  if (!r) return 'Horario de trabajo editable.';
  const days = r.workingDays.length === 7 ? 'Todos los días, domingos incluidos' : `Días: ${r.workingDays.map((d) => DAY[d]).join(', ')}`;
  if (r.mode === 'exclusive_day') return `${days}; ${r.maxBookingsPerDay === 1 ? 'un evento por día' : `hasta ${r.maxBookingsPerDay} eventos por día`}, con hora de inicio a elegir (${r.startTimes.map(hhmm).join(', ')}).`;
  return `${days}, de ${hhmm(r.openTime)} a ${hhmm(r.closeTime)}${r.breaks?.length ? ', con pausas' : ', sin pausa'}.`;
}

export function FirstSetup({ canSetup }) {
  const preview = buildFirstSetup();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(() => getCloudStatus().justSetUp === true);

  if (!canSetup) {
    return (
      <div className="card setup-card" role="status">
        <h1 className="page-head__title">El sitio aún no está configurado</h1>
        <p className="muted">Un administrador debe entrar al panel y crear la configuración inicial.</p>
      </div>
    );
  }

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const seed = buildFirstSetup();
      setState((s) => ({ ...s, ...seed }));
      setCloudStatus({ justSetUp: true });
      await saveConfig();
      setDone(true);
    } catch (e) {
      setCloudStatus({ justSetUp: false });
      setError(e.message);
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="card setup-card" role="status" data-testid="setup-done">
        <h1 className="page-head__title">Listo: el sitio ya está publicado</h1>
        <p>Antes de recibir reservas, revisa estas secciones:</p>
        <ul>
          <li><Link onClick={() => setCloudStatus({ justSetUp: false })} to="/admin/cuentas">Cuentas bancarias</Link>: añade las cuentas reales donde el cliente transfiere el anticipo.</li>
          <li><Link onClick={() => setCloudStatus({ justSetUp: false })} to="/admin/marcas">Marcas</Link>: WhatsApp, correo, anticipo y logos.</li>
          <li><Link onClick={() => setCloudStatus({ justSetUp: false })} to="/admin/catalogo">Planes y extras</Link>: confirma precios y extras.</li>
          <li><Link onClick={() => setCloudStatus({ justSetUp: false })} to="/admin/terminos">Términos</Link>: reemplaza el texto de ejemplo por el oficial.</li>
          <li><Link onClick={() => setCloudStatus({ justSetUp: false })} to="/admin/calendario">Calendario</Link>: horario de trabajo y días bloqueados.</li>
        </ul>
        <div>
          <Button variant="secondary" onClick={() => setCloudStatus({ justSetUp: false })} data-testid="setup-close">Ir al panel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card setup-card" data-testid="first-setup">
      <h1 className="page-head__title">Configuración inicial</h1>
      <p>La base de datos está vacía. Se creará la configuración de partida de <strong>{preview.brands.map((x) => x.name).join(' y ')}</strong>:</p>
      <ul>
        <li>La marca, sus colores y textos.</li>
        <li>
          Planes: {preview.plans.map((x) => x.name).join(', ')}; y {preview.extras.length} extras de ejemplo (puedes cambiarlos o borrarlos).
        </li>
        <li>{rulesText(Object.values(preview.rules)[0])} Se cambia en Calendario.</li>
        <li>Términos de ejemplo, que debes reemplazar por los oficiales.</li>
      </ul>
      <p className="muted small">No se crean cuentas bancarias ni solicitudes: las cuentas las añades tú después.</p>
      {error && <p className="callout callout--red" role="alert">{error}</p>}
      <div>
        <Button onClick={create} loading={busy} data-testid="first-setup-create">Crear configuración inicial</Button>
      </div>
    </div>
  );
}
