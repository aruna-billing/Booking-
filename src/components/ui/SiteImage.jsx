import { PhotoPlaceholder } from './misc.jsx';
import { useImageLibrary, getImage } from '../../store/imageStore.js';

/**
 * Imagen de la web tomada de la biblioteca (por id). Respeta el punto de enfoque
 * al recortar. Sin imagen asignada, muestra el marcador de muestra.
 */
export function SiteImage({ imageId, ratio = '4 / 5', tone = 'sand', variant = 0, label = 'Imagen de muestra', alt, className = '' }) {
  useImageLibrary(); // vuelve a dibujar cuando cambia la biblioteca
  const img = getImage(imageId);
  if (img) {
    return (
      <div className={`photo photo--real ${className}`} style={{ aspectRatio: ratio }}>
        <img
          src={img.src}
          alt={img.alt || alt || ''}
          loading="lazy"
          style={{ objectPosition: `${img.focal?.x ?? 50}% ${img.focal?.y ?? 50}%` }}
        />
      </div>
    );
  }
  return <PhotoPlaceholder tone={tone} ratio={ratio} variant={variant} label={label} className={className} />;
}
