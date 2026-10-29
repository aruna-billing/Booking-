import { useRef, useState } from 'react';
import { BrandMark, brandStyle } from '../ui/BrandMark.jsx';
import { Link, useFocusOnRouteChange, usePath } from '../../lib/router.jsx';
import { useDb } from '../../store/mockDb.js';
import { Stepper } from './Stepper.jsx';
import { TermsModal } from './TermsModal.jsx';
import { FooterContent } from './SiteFooter.jsx';

/**
 * Estructura común (versión 2): franja negra con logotipo y menú, indicador de pasos
 * en franja clara, contenido, y pie negro con redes y términos.
 * `bare` = la página dibuja su propio encabezado (portada del paso 1).
 */
export function BookingShell({ brand, step, eyebrow, title, intro, aside, footer, children, hideStepper = false, bare = false }) {
  const mainRef = useRef(null);
  const path = usePath();
  useFocusOnRouteChange(path, mainRef);

  return (
    <div className={`booking brand--${brand.id}`} style={brandStyle(brand)}>
      <a className="skip-link" href="#contenido" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Saltar al contenido
      </a>
      {brand.published === false && (
        <p className="hidden-banner" role="note">Vista previa: esta marca está oculta y no aparece en la portada.</p>
      )}
      <SiteHeader brand={brand} />
      {!hideStepper && (
        <div className="stepper-band">
          <Stepper brandId={brand.id} current={step} />
        </div>
      )}

      {bare ? (
        <main id="contenido" className="booking__bare" ref={mainRef} tabIndex={-1}>
          {children}
        </main>
      ) : (
        <div className={`booking__body ${aside ? 'has-aside' : ''}`}>
          <main id="contenido" className="booking__main" ref={mainRef} tabIndex={-1} aria-labelledby="step-title">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="booking__title" id="step-title">
              {title}
            </h1>
            {intro && <p className="booking__intro">{intro}</p>}
            {children}
          </main>
          {aside && <aside className="booking__aside" aria-label="Resumen de tu reserva">{aside}</aside>}
        </div>
      )}
      <SiteFooter brand={brand} />
      {footer}
    </div>
  );
}

export function SiteHeader({ brand }) {
  const [open, setOpen] = useState(false);
  const { brands } = useDb();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to={`/reservar/${brand.id}`} className="site-header__logo" aria-label={`${brand.name}: inicio`}>
          <BrandMark brand={brand} invert />
        </Link>
        <button type="button" className="icon-btn site-header__toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((v) => !v)}>
          <span className="visually-hidden">Menú</span>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <nav id="site-nav" className={`site-nav ${open ? 'is-open' : ''}`} aria-label="Principal">
          <Link to={`/reservar/${brand.id}`} className="is-active">{brand.shortName}</Link>
          <Link to={`/reservar/${brand.id}`} onClick={() => setTimeout(() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' }), 60)}>
            Reservar
          </Link>
          {brands.filter((b) => b.published !== false).length > 1 && <Link to="/">Otra marca</Link>}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ brand }) {
  const { terms, organization: org } = useDb();
  const [termsOpen, setTermsOpen] = useState(false);
  return (
    <footer className="site-footer">
      <FooterContent org={org} brand={brand} onOpenTerms={() => setTermsOpen(true)} />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} brand={brand} terms={terms[brand.id]} />
    </footer>
  );
}
