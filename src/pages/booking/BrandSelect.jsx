import { useDb } from '../../store/mockDb.js';
import { Link } from '../../lib/router.jsx';
import { BrandMark, OrgMark, brandStyle } from '../../components/ui/BrandMark.jsx';
import { SiteImage } from '../../components/ui/SiteImage.jsx';
import { getOrgWeb, getWeb } from '../../lib/webConfig.js';
import { FooterContent } from '../../components/booking/SiteFooter.jsx';

/** Portada del prototipo: elegir con qué marca reservar. */
/** ¿Color oscuro? (para elegir la variante del logo en la tarjeta) */
const isDark = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

export function BrandSelect() {
  const { brands, organization: org } = useDb();
  const visible = brands.filter((b) => b.published !== false);
  const ow = getOrgWeb(org);
  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__org">
          <OrgMark org={org} invert size="xl" />
        </div>
        <h1 className="landing__title" data-testid="landing-title">{ow.title}</h1>
        <p className="landing__lead">{ow.showTagline && org.tagline ? `${org.tagline}. ` : ''}{ow.lead}</p>
      </header>

      <main className="landing__brands">
        {visible.length === 0 && <p className="landing__empty">No hay marcas publicadas por ahora.</p>}
        {visible.map((b, i) => (
          <Link key={b.id} to={`/reservar/${b.id}`} className={`brandcard brand--${b.id} ${isDark(b.theme.hero) ? 'brandcard--dark' : ''}`} style={brandStyle(b)}>
            <SiteImage imageId={getWeb(b).cardImageId} tone={b.heroTone} ratio="16 / 10" variant={i} label="Imagen de portada de muestra" alt={b.name} />
            <div className="brandcard__body">
              <BrandMark brand={b} size="lg" invert={b.theme.hero && isDark(b.theme.hero)} />
              <p className="brandcard__tagline">{b.tagline}</p>
              <p className="brandcard__desc">{b.description}</p>
              <span className="brandcard__cta">
                Reservar con {b.shortName} <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        ))}
      </main>

      <footer className="site-footer landing__site-footer">
        <FooterContent org={org} />
      </footer>
    </div>
  );
}
