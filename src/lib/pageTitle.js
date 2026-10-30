// Nombre de la pestaña del navegador según la página. Sale de los nombres que se
// configuran en el panel (marca y marca matriz), no está escrito en el código.
const STEP_TITLES = { extras: 'Extras', fecha: 'Fecha', datos: 'Tus datos', pago: 'Pago', gracias: 'Solicitud enviada' };

export function publicTitle(path, db) {
  const org = db.organization?.name || 'Reservas';
  const visible = (db.brands ?? []).filter((b) => b.published !== false);
  const m = /^\/reservar\/([^/]+)(?:\/([^/?]+))?/.exec(path);
  if (m) {
    const brand = db.brands.find((b) => b.id === m[1]);
    const name = brand?.name || org;
    if (!m[2]) return `Reservas · ${name}`;
    return `${STEP_TITLES[m[2]] ?? 'Reserva'} · ${name}`;
  }
  if (path === '/admin/login') return `Acceso del equipo · ${org}`;
  if (visible.length === 1) return `Reservas · ${visible[0].name}`;
  return `Reservas · ${org}`;
}
