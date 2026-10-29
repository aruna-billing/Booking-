import { useEffect, useRef, useState } from 'react';
import { SiteImage } from '../ui/SiteImage.jsx';
import { getImage, useImageLibrary } from '../../store/imageStore.js';

const useMedia = (query) => {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
};

/**
 * Portada de la marca: imagen o video.
 * Video: sin sonido, en bucle, a pantalla completa del bloque, con botón de pausa.
 *  · Con «reducir movimiento» activado en el sistema no arranca solo.
 *  · Si se pidió, en celulares (≤ 640 px) se muestra la imagen en su lugar (no se descarga el video).
 *  · Imagen de respaldo: la elegida o, si no hay, el fotograma generado al subir el video.
 */
export function HeroMedia({ hero, ratio, tone, alt, className }) {
  useImageLibrary();
  const video = hero.media === 'video' ? getImage(hero.videoId) : null;
  const fallback = getImage(hero.imageId);
  const isPhone = useMedia('(max-width: 640px)');
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  const ref = useRef(null);
  const [playing, setPlaying] = useState(!reduceMotion);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, video?.src]);
  useEffect(() => {
    if (reduceMotion) setPlaying(false);
  }, [reduceMotion]);

  if (!video || (hero.mobileImage && isPhone)) {
    return <SiteImage imageId={hero.imageId} tone={tone} ratio={ratio} label="Imagen de portada de muestra" alt={alt} className={className} />;
  }

  const poster = fallback?.src || video.poster || undefined;
  const pos = `${video.focal?.x ?? 50}% ${video.focal?.y ?? 50}%`;
  const label = video.alt || alt;
  return (
    <div className={`photo photo--real hero-video ${className ?? ''}`} style={{ aspectRatio: ratio }} data-testid="hero-video">
      <video
        ref={ref}
        src={video.src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay={!reduceMotion}
        preload={reduceMotion ? 'metadata' : 'auto'}
        style={{ objectPosition: pos }}
        aria-label={label ? `Video de portada: ${label}` : 'Video de portada'}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className="hero-video__btn"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pausar video de portada' : 'Reproducir video de portada'}
        data-testid="hero-video-toggle"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
        )}
      </button>
    </div>
  );
}
