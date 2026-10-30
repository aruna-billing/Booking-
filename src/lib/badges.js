// Etiquetas con emoji para planes y extras («🔥 Más popular», «⭐ Recomendado»…).
// Se guardan en el plan o extra como badge: { emoji, text } (o null = sin etiqueta).

export const BADGE_PRESETS = [
  { emoji: '🔥', text: 'Más popular' },
  { emoji: '⭐', text: 'Recomendado' },
  { emoji: '💎', text: 'Premium' },
  { emoji: '🆕', text: 'Nuevo' },
  { emoji: '💰', text: 'Mejor precio' },
  { emoji: '🎁', text: 'Oferta' },
  { emoji: '⚡', text: 'Entrega rápida' },
  { emoji: '❤️', text: 'Favorito' },
];

export const EMOJIS = ['🔥', '⭐', '💎', '🆕', '💰', '🎁', '⚡', '❤️', '✨', '👑', '📸', '🎉', '🏆', '💯', '👍', '🌟', '⏳', '🎨', '💄', '👗'];
export const BADGE_MAX = 30;

/** Etiqueta a mostrar. Los planes antiguos con «featured» se ven como «🔥 Más popular». */
export function badgeOf(item) {
  if (item?.badge && item.badge.text?.trim()) return { emoji: item.badge.emoji ?? '', text: item.badge.text.trim().slice(0, BADGE_MAX) };
  if (item?.badge === undefined && item?.featured) return BADGE_PRESETS[0];
  return null;
}
