// Logotipos. Si la marca tiene un logo subido (Configuración de marcas) se usa ese;
// si no, un logotipo tipográfico provisional.
//   · `invert` = se dibuja sobre fondo oscuro → usa `logoOnDark` si existe.

/** Logo subido, eligiendo la variante según el fondo. */
function UploadedLogo({ logo, logoOnDark, invert, name, className }) {
  const src = (invert && logoOnDark?.src) || logo?.src || logoOnDark?.src;
  // Si solo hay logo para fondo claro y estamos sobre fondo oscuro, se muestra sobre una placa clara.
  const needsPlate = invert && !logoOnDark?.src;
  return (
    <span className={`logo-img ${className} ${needsPlate ? 'logo-img--plate' : ''}`}>
      <img src={src} alt={name} />
    </span>
  );
}

export function BrandMark({ brand, size = 'md', invert = false }) {
  if (brand.logo?.src || brand.logoOnDark?.src) {
    return <UploadedLogo logo={brand.logo} logoOnDark={brand.logoOnDark} invert={invert} name={brand.name} className={`brandmark brandmark--${size}`} />;
  }
  if (brand.id === 'elian-lopez-photo') {
    return (
      <span className={`brandmark brandmark--elian brandmark--${size} ${invert ? 'is-invert' : ''}`} aria-label={brand.name}>
        <span className="brandmark__main" aria-hidden="true">
          Elian López
        </span>
        <span className="brandmark__sub" aria-hidden="true">
          Photo · Weddings
        </span>
      </span>
    );
  }
  if (brand.id !== 'aruna-visuals') {
    // Marca nueva sin logo: nombre en la tipografía de títulos de la marca.
    return (
      <span className={`brandmark brandmark--generic brandmark--${size} ${invert ? 'is-invert' : ''}`} aria-label={brand.name}>
        <span className="brandmark__main" aria-hidden="true" style={{ fontFamily: brand.theme.fontDisplay, fontStyle: brand.theme.displayStyle }}>
          {brand.name}
        </span>
      </span>
    );
  }
  return (
    <span className={`brandmark brandmark--aruna brandmark--${size} ${invert ? 'is-invert' : ''}`} aria-label={brand.name}>
      <svg viewBox="0 0 24 24" className="brandmark__glyph" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 16.5L12 6.5l5 10M9 12.6h6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="brandmark__main" aria-hidden="true">
        aruna<em>visuals</em>
      </span>
    </span>
  );
}

/** Logo de la marca matriz (Aruna One). */
export function OrgMark({ org, size = 'md', invert = false, withTagline = false }) {
  if (org.logo?.src || org.logoOnDark?.src) {
    return <UploadedLogo logo={org.logo} logoOnDark={org.logoOnDark} invert={invert} name={org.name} className={`orgmark orgmark--${size}`} />;
  }
  return (
    <span className={`orgmark orgmark--${size} orgmark--text ${invert ? 'is-invert' : ''}`} aria-label={org.name}>
      <span className="orgmark__name" aria-hidden="true">{org.name}</span>
      {withTagline && org.tagline && <span className="orgmark__tag" aria-hidden="true">{org.tagline}</span>}
    </span>
  );
}

/** Aplica la identidad de una marca como variables CSS al subárbol. */
export function brandStyle(brand) {
  const t = brand.theme;
  return {
    '--bg': t.bg,
    '--surface': t.surface,
    '--ink': t.ink,
    '--muted': t.muted,
    '--accent': t.accent,
    '--accent-ink': t.accentInk,
    '--line': t.line,
    '--hero': t.hero,
    '--hero-ink': t.heroInk,
    '--font-display': t.fontDisplay,
    '--display-style': t.displayStyle,
  };
}
