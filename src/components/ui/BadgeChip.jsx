/** Etiqueta con emoji («🔥 Más popular»). El emoji es decorativo para lectores de pantalla. */
export function BadgeChip({ badge, className = 'tag-chip' }) {
  if (!badge) return null;
  return (
    <span className={className} data-testid="badge-chip">
      {badge.emoji && <span className="tag-chip__emoji" aria-hidden="true">{badge.emoji} </span>}
      {badge.text}
    </span>
  );
}
