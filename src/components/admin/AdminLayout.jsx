import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useFocusOnRouteChange, usePath } from '../../lib/router.jsx';
import { useDb, resetDemoData } from '../../store/mockDb.js';
import { useToast } from '../ui/misc.jsx';
import { ConfirmDialog } from './parts.jsx';
import { OrgMark } from '../ui/BrandMark.jsx';
import { clearImages } from '../../store/imageStore.js';
import { can, canSeeBrand, setCurrentUser, useCurrentUser, visibleBrands } from '../../lib/auth.js';
import { ROLES } from '../../data/roles.js';
import { initials } from '../../lib/format.js';
import { navigate } from '../../lib/router.jsx';
import { alertOf } from '../../lib/tracking.js';
import { LIVE } from '../../lib/mode.js';
import { getCloudStatus, setCloudStatus, useCloudStatus } from '../../store/cloudStatus.js';
import { retrySave } from '../../services/cloud.js';
import { signOut } from '../../services/session.js';
import { FirstSetup } from './FirstSetup.jsx';

const AdminCtx = createContext({ brandFilter: 'all', setBrandFilter: () => {}, user: null, can: () => false, inScope: () => true });
/** brandFilter + usuario activo. `inScope(brandId)` = la marca pasa el filtro y el usuario puede verla. */
export const useAdmin = () => useContext(AdminCtx);

const NAV = [
  { perm: 'dashboard.view', to: '/admin', label: 'Dashboard', icon: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-9h6V4h-6z' },
  { perm: 'requests.view', to: '/admin/solicitudes', label: 'Solicitudes', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', badge: 'pending' },
  { perm: 'receipts.view', to: '/admin/comprobantes', label: 'Comprobantes', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13l2 2 4-4', badge: 'receipts' },
  { perm: 'tracking.view', to: '/admin/seguimientos', label: 'Seguimientos', icon: 'M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10M5.5 4.5v15', badge: 'tracking' },
  { perm: 'finance.view', to: '/admin/finanzas', label: 'Finanzas', icon: 'M3 6h18v12H3zM3 10h18M7 15h4M16 15h1' },
  { perm: 'calendar.manage', to: '/admin/calendario', label: 'Calendario', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { perm: 'catalog.manage', to: '/admin/catalogo', label: 'Planes y extras', icon: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4' },
  { perm: 'coupons.manage', to: '/admin/cupones', label: 'Cupones', icon: 'M3 9V6a1 1 0 011-1h16a1 1 0 011 1v3a3 3 0 000 6v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a3 3 0 000-6zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01' },
  { perm: 'accounts.manage', to: '/admin/cuentas', label: 'Cuentas bancarias', icon: 'M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18' },
  { perm: 'web.manage', to: '/admin/personalizacion', label: 'Personalización', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1 1 0 100-.1' },
  { perm: 'brands.manage', to: '/admin/marcas', label: 'Marcas', icon: 'M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.3-1-1.4-1-2.6 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-8-9-8zM7.5 12a1 1 0 100-.1M10 7.5a1 1 0 100-.1M15 7.5a1 1 0 100-.1' },
  { perm: 'terms.manage', to: '/admin/terminos', label: 'Términos', icon: 'M7 3h10v18H7zM10 7h4M10 11h4M10 15h2' },
  { perm: 'users.manage', to: '/admin/usuarios', label: 'Usuarios y roles', icon: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14a5.5 5.5 0 013.5 6' },
];

export function AdminLayout({ title, perm, children }) {
  const db = useDb();
  const user = useCurrentUser();
  const userCan = (p) => can(user, p);
  const myBrands = visibleBrands(user, db.brands);
  const path = usePath();
  const [brandFilter, setBrandFilter] = useState(() => {
    try {
      return sessionStorage.getItem('morel-admin-brand') || 'all';
    } catch {
      return 'all';
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const mainRef = useRef(null);
  const toast = useToast();
  const cloud = useCloudStatus();
  useFocusOnRouteChange(path, mainRef);

  useEffect(() => {
    try {
      sessionStorage.setItem('morel-admin-brand', brandFilter);
    } catch {
      /* ignorar */
    }
  }, [brandFilter]);
  useEffect(() => setMenuOpen(false), [path]);
  // La lista de pendientes tras la configuración inicial se cierra al cambiar de sección.
  useEffect(() => {
    if (getCloudStatus().justSetUp) setCloudStatus({ justSetUp: false });
  }, [path]);
  // Si la marca filtrada se eliminó o el usuario no puede verla, vuelve a «Todas».
  useEffect(() => {
    if (brandFilter !== 'all' && !myBrands.some((b) => b.id === brandFilter)) setBrandFilter('all');
  }, [brandFilter, myBrands]);
  // El inicio del panel para quien no ve el dashboard es Solicitudes.
  const allowed = !perm || userCan(perm);
  useEffect(() => {
    if (!allowed && path === '/admin' && userCan('requests.view')) navigate('/admin/solicitudes', { replace: true });
  }, [allowed, path, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = `${title} · ${db.organization.name} Booking${LIVE ? '' : ' (demo)'}`;
  }, [title, db.organization.name]);

  const inScope = (brandId) => canSeeBrand(user, brandId) && (brandFilter === 'all' || brandId === brandFilter);
  const inBrand = (r) => inScope(r.brandId);
  const counts = {
    pending: db.requests.filter((r) => inBrand(r) && r.status === 'pending_review').length,
    receipts: db.requests.filter((r) => inBrand(r) && r.paymentStatus === 'submitted').length,
    // Seguimientos que necesitan atención: entregas vencidas y sesiones pasadas sin marcar.
    tracking: db.requests.filter((r) => {
      if (!inBrand(r)) return false;
      const k = alertOf(r, db.brands.find((b) => b.id === r.brandId), db.extras)?.kind;
      return k === 'overdue' || k === 'shoot_unmarked';
    }).length,
  };
  const isActive = (to) => (to === '/admin' ? path === '/admin' : path.startsWith(to));

  return (
    <AdminCtx.Provider value={{ brandFilter, setBrandFilter, user, can: userCan, inScope }}>
      <div className={`admin ${menuOpen ? 'menu-open' : ''}`}>
        <a className="skip-link" href="#admin-main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
          Saltar al contenido
        </a>
        <aside className="admin__side" id="admin-nav" aria-label="Navegación del panel">
          <div className="admin__logo">
            <OrgMark org={db.organization} invert size="md" />
            <small>{LIVE ? 'Booking · panel' : 'Booking · panel demo'}</small>
          </div>
          <nav>
            <ul className="admin__nav">
              {NAV.filter((n) => userCan(n.perm)).map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className={isActive(n.to) ? 'is-active' : ''} aria-current={isActive(n.to) ? 'page' : undefined}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{n.label}</span>
                    {n.badge && counts[n.badge] > 0 && (
                      <span className="admin__count" aria-label={`${counts[n.badge]} ${n.badge === 'tracking' ? 'requieren atención' : 'pendientes'}`}>
                        {counts[n.badge]}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="admin__side-foot">
            <Link to="/">← Ver sitio público</Link>
            {!LIVE && userCan('users.manage') && (
              <button type="button" className="link-btn small" onClick={() => setResetOpen(true)}>
                Restablecer datos demo
              </button>
            )}
          </div>
        </aside>
        <div className="admin__scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

        <div className="admin__wrap">
          <header className="admin__top">
            <button type="button" className="icon-btn admin__menu" aria-expanded={menuOpen} aria-controls="admin-nav" onClick={() => setMenuOpen((v) => !v)}>
              <span className="visually-hidden">Menú</span>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <label className="brand-filter">
              <span className="visually-hidden">Filtrar por marca</span>
              <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} data-testid="brand-filter">
                <option value="all">{user?.brandIds ? 'Todas mis marcas' : 'Todas las marcas'}</option>
                {myBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.published === false ? ' (oculta)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="userbox">
              <span className="userbox__avatar" aria-hidden="true">{initials(...(user?.name ?? '?').split(' '))}</span>
              <span className="userbox__who">
                <strong>{user?.name}</strong>
                <span className="small">{ROLES[user?.role]?.label}</span>
              </span>
              {LIVE ? (
                <button
                  type="button"
                  className="link-btn small userbox__logout"
                  onClick={async () => {
                    await signOut();
                    navigate('/admin/login', { replace: true });
                  }}
                  data-testid="logout"
                >
                  Cerrar sesión
                </button>
              ) : (
                <label className="userbox__switch">
                  <span className="userbox__label">Ver como <span className="userbox__demo">demo</span></span>
                  <select value={user?.id} onChange={(e) => setCurrentUser(e.target.value)} data-testid="view-as">
                    {db.users.filter((u) => u.active).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {ROLES[u.role]?.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </header>
          <main id="admin-main" className="admin__main" ref={mainRef} tabIndex={-1}>
            {LIVE && cloud.saveError && (
              <div className="admin-banner" role="alert" data-testid="save-error">
                <span>
                  <strong>{cloud.saveErrorKind === 'calendar' ? 'El cambio se guardó, pero no llegó a Google Calendar.' : 'No se guardó el último cambio.'}</strong>{' '}
                  {cloud.saveErrorKind === 'calendar' ? cloud.saveError.replace(/^Google Calendar: /, '') : cloud.saveError}
                </span>
                {cloud.saveErrorKind === 'config' || cloud.saveErrorKind === 'calendar' ? (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => retrySave().catch(() => {})}>
                    <span>Reintentar</span>
                  </button>
                ) : cloud.saveErrorKind === 'load' ? (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => window.location.reload()}>
                    <span>Recargar</span>
                  </button>
                ) : null}
              </div>
            )}
            {LIVE && (cloud.staff === 'loading' || cloud.staff === 'idle') ? (
              <p className="muted" role="status">Cargando datos…</p>
            ) : LIVE && (cloud.phase === 'empty' || cloud.justSetUp) ? (
              <FirstSetup canSetup={userCan('brands.manage')} />
            ) : allowed ? (
              children
            ) : (
              <NoAccess user={user} />
            )}
          </main>
          <ConfirmDialog
            open={resetOpen}
            onClose={() => setResetOpen(false)}
            title="Restablecer datos demo"
            message="Se perderán las solicitudes, los cambios y las imágenes subidas en este navegador."
            confirmLabel="Restablecer"
            danger
            onConfirm={async () => {
              resetDemoData();
              await clearImages();
              toast('Datos de demostración restablecidos');
            }}
          />
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

/** Pantalla para secciones a las que el rol no tiene acceso. */
export function NoAccess({ user, message }) {
  return (
    <div className="noaccess" role="alert" data-testid="no-access">
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <h1 className="noaccess__title">No tienes acceso a esta sección</h1>
      <p className="muted">{message ?? `Tu rol (${ROLES[user?.role]?.label ?? '—'}) no incluye esta parte del panel. Si la necesitas, pídesela a un administrador.`}</p>
      {can(user, 'requests.view') && <Link to="/admin/solicitudes" className="btn btn--secondary btn--sm">Ir a solicitudes</Link>}
    </div>
  );
}
