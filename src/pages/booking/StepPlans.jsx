import { BookingShell } from '../../components/booking/BookingShell.jsx';
import { stepPath } from '../../components/booking/Stepper.jsx';
import { SiteImage } from '../../components/ui/SiteImage.jsx';
import { HeroMedia } from '../../components/booking/HeroMedia.jsx';
import { HERO_SIZES, getWeb, planTypeFamilies, planTypeVars, webText } from '../../lib/webConfig.js';
import { ensureFont } from '../../lib/fonts.js';
import { PlanImage } from '../../components/ui/PlanImage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatDuration, formatMoney } from '../../lib/format.js';
import { navigate } from '../../lib/router.jsx';
import { isEventBrand } from '../../data/brands.js';

const GALLERY_TONES = ['sand', 'clay', 'olive', 'ink', 'linen', 'gold', 'noir'];

/**
 * Paso 1 (versión 2): página de estudio.
 * Portada → presentación → galería → «Reserva tu cita» con tarjetas horizontales.
 */
export function StepPlans({ data }) {
  const { brand, plans, draft, dispatch } = data;
  const studio = brand.studio ?? {};
  const web = getWeb(brand);
  planTypeFamilies(web.planType).forEach(ensureFont); // carga solo las fuentes elegidas

  const choose = (planId) => {
    dispatch({ type: 'selectPlan', planId, keepExtras: draft.extras });
    navigate(stepPath(brand.id, 'extras'));
  };
  const toPlans = () => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <BookingShell brand={brand} step={0} bare hideStepper>
      {web.hero.show && (
        <section className="studio-hero" aria-label="Portada">
          <HeroMedia hero={web.hero} tone={brand.heroTone} ratio={HERO_SIZES[web.hero.size]?.ratio ?? '21 / 9'} alt={brand.name} className={`studio-hero__img studio-hero__img--${web.hero.size}`} />
        </section>
      )}

      <h1 id="studio-title" className="visually-hidden">{brand.name}</h1>
      {web.intro.show && (
        <section className="studio-intro" aria-label="Presentación">
          {brand.tagline && <p className="studio-intro__tag">{brand.tagline}</p>}
          {studio.intro && <p className="studio-intro__text">{studio.intro}</p>}
          {studio.cta && <Button onClick={toPlans}>{studio.cta}</Button>}
        </section>
      )}

      {web.gallery.show && web.gallery.items.length > 0 && (
        <section className="studio-gallery" aria-label="Galería">
          <ul className="studio-gallery__strip" tabIndex={0} aria-label="Galería, desliza para ver más" data-testid="public-gallery">
            {web.gallery.items.map((it, i) => (
              <li key={i}>
                <SiteImage
                  imageId={it.imageId}
                  tone={GALLERY_TONES[(i + (isEventBrand(brand) ? 3 : 0)) % GALLERY_TONES.length]}
                  ratio="3 / 4"
                  variant={i}
                  label={`Muestra${it.label ? ` · ${it.label}` : ''}`}
                  alt={it.label || `Foto ${i + 1} de ${brand.name}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="planes" className="studio-plans" aria-labelledby="planes-title" style={planTypeVars(brand, web.planType)} data-testid="plans-section">
        <p className="studio-plans__step">{webText(brand, 'plansEyebrow')}</p>
        <h2 id="planes-title" className="studio-plans__title">{studio.headline}</h2>
        {plans.length === 0 && (
          <p className="studio-plans__empty">Esta marca todavía no tiene planes disponibles. Vuelve pronto.</p>
        )}
        <ul className="hplans">
          {plans.map((p, i) => {
            const selected = draft.planId === p.id;
            return (
              <li key={p.id} className={`hplan ${selected ? 'is-selected' : ''}`}>
                <div className="hplan__media">
                  <PlanImage plan={p} ratio="4 / 5" variant={i} />
                  {p.featured && <span className="plan__flag">Más elegido</span>}
                </div>
                <div className="hplan__body">
                  <h3 className="hplan__name">{p.name}</h3>
                  <p className="hplan__desc">{p.description}</p>
                  <p className="hplan__includes-title">Incluye</p>
                  <ul className="hplan__includes">
                    {p.deliverables.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <hr className="hplan__rule" />
                  <p className="hplan__meta">
                    <span className="visually-hidden">Duración: </span>
                    {formatDuration(p.durationMin)} {isEventBrand(brand) ? 'de cobertura' : 'de sesión'}
                  </p>
                  <p className="hplan__price">{formatMoney(p.price, brand.currency)}</p>
                  <Button onClick={() => choose(p.id)} aria-label={`Reservar ahora ${p.name}, ${formatMoney(p.price, brand.currency)}`}>
                    {selected ? 'Seleccionado · continuar' : 'Reservar ahora'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

    </BookingShell>
  );
}
