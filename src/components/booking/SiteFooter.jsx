import { LIVE } from '../../lib/mode.js';
import { BrandMark, OrgMark } from '../ui/BrandMark.jsx';
import { Link } from '../../lib/router.jsx';

/** Reemplaza {año} y {marca} en el texto legal. */
export const fillFooterText = (text, name) =>
  (text || '').replaceAll('{año}', String(new Date().getFullYear())).replaceAll('{marca}', name);

/** Solo se aceptan enlaces http(s) y mailto. */
export const isValidFooterUrl = (url) => /^(https?:\/\/[^\s]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test((url || '').trim());

const Icon = {
  instagram: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1112 20a8 8 0 01-4-1.1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>,
  facebook: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14 8h3V4.5h-3a4 4 0 00-4 4V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.8c0-.5.3-.8.5-.8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14 4v10.5a3.5 3.5 0 11-3.5-3.5M14 4c.4 2.4 2 4 4.5 4.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  email: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4 6.5l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>,
  website: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>,
};

/**
 * Contenido del pie de página. Lo usan la portada (sin `brand`), la web de cada marca
 * y la vista previa del panel (`preview` = enlaces inactivos).
 */
export function FooterContent({ org, brand, onOpenTerms, preview = false }) {
  const f = org.footer;
  const name = brand ? brand.name : org.name;
  const social = [];
  if (brand && f.showBrandSocial) {
    if (brand.studio?.instagram) social.push(['instagram', brand.studio.instagram]);
    if (brand.whatsappDisplay) social.push(['whatsapp', brand.whatsappDisplay]);
  }
  if (!brand) {
    Object.entries(f.social).forEach(([k, v]) => v && social.push([k, v]));
  }
  const links = f.links.filter((l) => l.label.trim() && isValidFooterUrl(l.url));
  const linkProps = (url) => (preview ? { href: url, onClick: (e) => e.preventDefault(), tabIndex: -1 } : { href: url, target: url.startsWith('http') ? '_blank' : undefined, rel: 'noopener noreferrer' });

  return (
    <div className="site-footer__inner">
      {brand ? <BrandMark brand={brand} invert /> : <OrgMark org={org} invert size="md" />}
      {social.length > 0 && (
        <ul className="site-footer__social" aria-label="Redes y contacto">
          {social.map(([k, v]) => (
            <li key={k}>{Icon[k]}<span>{v}</span></li>
          ))}
        </ul>
      )}
      {brand && f.showByline && (
        <p className="site-footer__org">
          <span>{f.byline}</span> <OrgMark org={org} invert size="sm" />
        </p>
      )}
      {(links.length > 0 || (brand && f.showTermsLink) || f.showAdminLink) && (
        <ul className="site-footer__links" aria-label="Enlaces">
          {links.map((l) => (
            <li key={l.label + l.url}><a {...linkProps(l.url)}>{l.label}</a></li>
          ))}
          {brand && f.showTermsLink && (
            <li>
              <button type="button" className="link-btn" onClick={preview ? undefined : onOpenTerms} aria-haspopup="dialog" tabIndex={preview ? -1 : undefined}>
                Términos y condiciones
              </button>
            </li>
          )}
          {f.showAdminLink && (
            <li>{preview ? <a href="#" onClick={(e) => e.preventDefault()} tabIndex={-1}>Panel administrativo</a> : <Link to="/admin">{LIVE ? 'Acceso del equipo' : 'Panel administrativo (demo)'}</Link>}</li>
          )}
        </ul>
      )}
      {f.copyright?.trim() && <p className="site-footer__legal" data-testid="footer-copyright">{fillFooterText(f.copyright, name)}</p>}
      {!LIVE && <p className="site-footer__proto">Prototipo · datos de demostración</p>}
    </div>
  );
}
