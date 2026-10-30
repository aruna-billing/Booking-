import { Component, useEffect } from 'react';
import { publicTitle } from './lib/pageTitle.js';
import { matchPath, usePath, Link, navigate } from './lib/router.jsx';
import { useDb } from './store/mockDb.js';
import { BookingProvider } from './store/BookingContext.jsx';
import { ToastProvider } from './components/ui/misc.jsx';
import { BrandSelect } from './pages/booking/BrandSelect.jsx';
import { BookingRoute } from './pages/booking/BookingRoute.jsx';
import { AdminLayout } from './components/admin/AdminLayout.jsx';
import { Dashboard } from './pages/admin/Dashboard.jsx';
import { Requests } from './pages/admin/Requests.jsx';
import { RequestDetail } from './pages/admin/RequestDetail.jsx';
import { CalendarAdmin } from './pages/admin/CalendarAdmin.jsx';
import { Catalog } from './pages/admin/Catalog.jsx';
import { BankAccounts } from './pages/admin/BankAccounts.jsx';
import { Receipts } from './pages/admin/Receipts.jsx';
import { BrandsSettings } from './pages/admin/BrandsSettings.jsx';
import { TermsAdmin } from './pages/admin/TermsAdmin.jsx';
import { Finance } from './pages/admin/Finance.jsx';
import { Personalization } from './pages/admin/Personalization.jsx';
import { Users } from './pages/admin/Users.jsx';
import { Tracking } from './pages/admin/Tracking.jsx';
import { Coupons } from './pages/admin/Coupons.jsx';
import { AdminLogin } from './pages/admin/Login.jsx';
import { LIVE } from './lib/mode.js';
import { useAuthState } from './lib/auth.js';
import { useCloudStatus } from './store/cloudStatus.js';
import { loadPublicConfig } from './services/cloud.js';

const STEP_SLUGS = { extras: 'extras', fecha: 'fecha', datos: 'datos', pago: 'pago', gracias: 'gracias' };

const ADMIN_ROUTES = [
  { perm: 'dashboard.view', pattern: '/admin', title: 'Dashboard', render: () => <Dashboard /> },
  { perm: 'requests.view', pattern: '/admin/solicitudes', title: 'Solicitudes', render: () => <Requests /> },
  { perm: 'requests.view', pattern: '/admin/solicitudes/:id', title: 'Detalle de solicitud', render: (p) => <RequestDetail key={p.id} id={p.id} /> },
  { perm: 'tracking.view', pattern: '/admin/seguimientos', title: 'Seguimientos', render: () => <Tracking /> },
  { perm: 'receipts.view', pattern: '/admin/comprobantes', title: 'Comprobantes', render: () => <Receipts /> },
  { perm: 'finance.view', pattern: '/admin/finanzas', title: 'Finanzas', render: () => <Finance /> },
  { perm: 'calendar.manage', pattern: '/admin/calendario', title: 'Calendario', render: () => <CalendarAdmin /> },
  { perm: 'catalog.manage', pattern: '/admin/catalogo', title: 'Planes y extras', render: () => <Catalog /> },
  { perm: 'coupons.manage', pattern: '/admin/cupones', title: 'Cupones', render: () => <Coupons /> },
  { perm: 'accounts.manage', pattern: '/admin/cuentas', title: 'Cuentas bancarias', render: () => <BankAccounts /> },
  { perm: 'web.manage', pattern: '/admin/personalizacion', title: 'Personalización', render: () => <Personalization /> },
  { perm: 'brands.manage', pattern: '/admin/marcas', title: 'Marcas', render: () => <BrandsSettings /> },
  { perm: 'users.manage', pattern: '/admin/usuarios', title: 'Usuarios y roles', render: () => <Users /> },
  { perm: 'terms.manage', pattern: '/admin/terminos', title: 'Términos', render: () => <TermsAdmin /> },
];

function Router() {
  const path = usePath().split('?')[0];
  const db = useDb();
  // Pestaña del navegador (el panel pone la suya en AdminLayout).
  useEffect(() => {
    if (path === '/admin' || (path.startsWith('/admin/') && path !== '/admin/login')) return;
    document.title = publicTitle(path, db);
  }, [path, db.organization, db.brands]); // eslint-disable-line react-hooks/exhaustive-deps
  const auth = useAuthState();
  const cloud = useCloudStatus();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');

  if (LIVE && isAdmin) {
    if (!auth.ready) return <Loading text="Comprobando tu sesión…" />;
    if (!auth.user || path === '/admin/login') {
      if (auth.user) return <Redirect to="/admin" />;
      return <AdminLogin next={path} />;
    }
  } else if (LIVE) {
    // Sitio público: esperar la configuración de Supabase (sin mostrar datos de ejemplo).
    if (cloud.phase === 'idle' || cloud.phase === 'loading') return <Loading text="Cargando…" />;
    if (cloud.phase === 'error') {
      return (
        <main className="booking-route-loading" role="alert">
          <div>
            <h1>No pudimos cargar el sitio</h1>
            <p>{cloud.error}</p>
            <button type="button" className="btn btn--primary btn--md" onClick={() => loadPublicConfig()}>
              Reintentar
            </button>
          </div>
        </main>
      );
    }
  }

  if (path === '/' || path === '') return <BrandSelect />;

  let p = matchPath('/reservar/:brand', path);
  if (p) return <BookingRoute brandId={p.brand} stepKey="planes" />;
  p = matchPath('/reservar/:brand/:step', path);
  if (p && STEP_SLUGS[p.step]) return <BookingRoute brandId={p.brand} stepKey={p.step} />;

  for (const r of ADMIN_ROUTES) {
    const params = matchPath(r.pattern, path);
    if (params) return <AdminLayout title={r.title} perm={r.perm}>{r.render(params)}</AdminLayout>;
  }

  return (
    <div className="notfound">
      <h1>Página no encontrada</h1>
      <Link to="/">Volver al inicio</Link>
    </div>
  );
}

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function Loading({ text }) {
  return (
    <main className="booking-route-loading" role="status" aria-live="polite">
      <p>{text}</p>
    </main>
  );
}

/**
 * Si una pantalla falla, muestra un aviso con salida en vez de dejar la página en blanco.
 * Se reinicia al cambiar de ruta.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.onHash = () => this.state.error && this.setState({ error: null });
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Error en la pantalla:', error, info?.componentStack);
  }
  componentDidMount() {
    window.addEventListener('hashchange', this.onHash);
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHash);
  }
  restart = () => {
    try {
      sessionStorage.removeItem('elian-booking-draft-v1');
    } catch {
      /* ignorar */
    }
    window.location.hash = '#/';
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="booking-route-loading" role="alert">
        <div>
          <h1>Algo no cargó bien</h1>
          <p>Vuelve a empezar; si estabas reservando, tu solicitud todavía no se envió.</p>
          <button type="button" className="btn btn--primary btn--md" onClick={this.restart}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }
}

/** El logo de la marca matriz se usa como icono de la pestaña del navegador. */
function OrgFavicon() {
  const { organization: org } = useDb();
  const src = org.logo?.src || org.logoOnDark?.src;
  useEffect(() => {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (!link.dataset.default) link.dataset.default = link.getAttribute('href') || '';
    link.href = src || link.dataset.default;
    if (src) link.removeAttribute('type');
  }, [src]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <BookingProvider>
        <OrgFavicon />
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </BookingProvider>
    </ToastProvider>
  );
}
