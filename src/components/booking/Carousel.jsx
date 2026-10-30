import { useEffect, useRef, useState } from 'react';
import { SiteImage } from '../ui/SiteImage.jsx';

const TONES = ['sand', 'clay', 'olive', 'ink', 'linen', 'gold', 'noir'];

/**
 * Carrusel horizontal de fotos (galería, paletas de colores…).
 * En celular se desliza con el dedo; en computadora además tiene flechas.
 */
export function Carousel({ items, label, title, brandName, toneOffset = 0, testId, ratio = '3 / 4' }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [items.length]);

  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };
  const overflow = !(edges.start && edges.end);

  return (
    <section className="studio-gallery" aria-label={title || label}>
      {title && <h2 className="studio-gallery__title">{title}</h2>}
      <div className="carousel">
        <ul ref={ref} className="studio-gallery__strip" tabIndex={0} aria-label={`${title || label}, desliza para ver más`} data-testid={testId}>
          {items.map((it, i) => (
            <li key={i}>
              <SiteImage
                imageId={it.imageId}
                tone={TONES[(i + toneOffset) % TONES.length]}
                ratio={ratio}
                variant={i}
                label={`Muestra${it.label ? ` · ${it.label}` : ''}`}
                alt={it.label || `${title || label} · foto ${i + 1} de ${brandName}`}
              />
            </li>
          ))}
        </ul>
        {overflow && (
          <>
            <button type="button" className="carousel__btn carousel__btn--prev" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Fotos anteriores">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="carousel__btn carousel__btn--next" onClick={() => scroll(1)} disabled={edges.end} aria-label="Fotos siguientes">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** Preguntas frecuentes (acordeón). */
export function Faq({ title, items }) {
  return (
    <section className="studio-faq" aria-labelledby="faq-title" data-testid="public-faq">
      <h2 id="faq-title" className="studio-section__title">{title || 'Preguntas frecuentes'}</h2>
      <div className="faq">
        {items.map((it, i) => (
          <details key={i} className="faq__item">
            <summary className="faq__q">
              <span>{it.q}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="faq__icon"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <div className="faq__a">{it.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Avisos (información importante para el cliente). */
export function Notices({ title, items }) {
  return (
    <section className="studio-notices" aria-labelledby="notices-title" data-testid="public-notices">
      <h2 id="notices-title" className="studio-section__title">{title || 'Avisos'}</h2>
      <ul className="notices">
        {items.map((it, i) => (
          <li key={i} className="notice">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="notice__icon"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M12 8v5M12 16.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <div>
              {it.title && <p className="notice__title">{it.title}</p>}
              {it.text && <p className="notice__text">{it.text}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
