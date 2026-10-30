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

// Atajos en el panel; se puede escribir o pegar cualquier otro emoji.
export const EMOJIS = ['🔥', '⭐', '💎', '🆕', '💰', '🎁', '⚡', '❤️', '✨', '👑', '📸', '🎉', '🏆', '💯', '👍', '🌟', '⏳', '🎨', '💄', '👗', '🎄', '🎅', '❄️', '💍', '👰', '🤵', '👶', '🍼', '🎓', '🌸', '🌴', '☀️', '💐', '🥂', '💖', '🎈', '📅', '⌛', '🚨', '🙌'];
export const EMOJI_MAX = 16; // caracteres: alcanza para 1 a 3 emojis (los compuestos ocupan más)

/** Deja el emoji (o emojis) escrito, sin espacios y con un largo máximo. */
export const cleanEmoji = (v) => {
  const parts = [...String(v ?? '').replace(/\s+/g, '')];
  let out = '';
  for (const ch of parts) {
    if ((out + ch).length > EMOJI_MAX) break;
    out += ch;
  }
  return out;
};
export const BADGE_MAX = 30;

/** Etiqueta a mostrar. Los planes antiguos con «featured» se ven como «🔥 Más popular». */
export function badgeOf(item) {
  if (item?.badge && item.badge.text?.trim()) return { emoji: cleanEmoji(item.badge.emoji), text: item.badge.text.trim().slice(0, BADGE_MAX) };
  if (item?.badge === undefined && item?.featured) return BADGE_PRESETS[0];
  return null;
}
