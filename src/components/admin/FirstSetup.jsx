import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { buildFirstSetup, setState } from '../../store/mockDb.js';
import { saveConfig } from '../../services/cloud.js';
import { getCloudStatus, setCloudStatus } from '../../store/cloudStatus.js';
import { Link } from '../../lib/router.jsx';

/** Primera vez con un Supabase vacío: crea la configuración inicial de Morel Estudio. */
export function FirstSetup({ canSetup }) {
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
      <p>La base de datos está vacía. Se creará la configuración de partida de <strong>Morel Estudio</strong>:</p>
      <ul>
        <li>La marca, sus colores y textos.</li>
        <li>Los planes Estándar y Pro, y extras de ejemplo (puedes cambiarlos o borrarlos).</li>
        <li>Horario todos los días, domingos incluidos, de 8:00 a. m. a 9:00 p. m., sin pausa (se cambia en Calendario).</li>
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
