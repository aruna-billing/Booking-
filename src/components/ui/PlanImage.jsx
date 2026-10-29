import { SiteImage } from './SiteImage.jsx';

/** Imagen del plan: la elegida en la biblioteca o, si no hay, el marcador de muestra. */
export function PlanImage({ plan, ratio = '4 / 5', variant = 0, label, className = '' }) {
  return (
    <SiteImage
      imageId={plan.imageId}
      ratio={ratio}
      tone={plan.tone}
      variant={variant}
      label={label ?? `Muestra · ${plan.category}`}
      alt={plan.name}
      className={className}
    />
  );
}
