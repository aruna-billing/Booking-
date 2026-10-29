// Tipografías disponibles para personalizar la web (Google Fonts).
// Se cargan bajo demanda: solo se descarga la fuente que realmente se usa.

export const FONT_OPTIONS = [
  { family: 'Fraunces', category: 'Serif cálida', fallback: 'Georgia, serif', italic: true },
  { family: 'Cormorant Garamond', category: 'Serif editorial', fallback: "'Times New Roman', serif", italic: true },
  { family: 'Playfair Display', category: 'Serif de alto contraste', fallback: 'Georgia, serif', italic: true },
  { family: 'DM Serif Display', category: 'Serif para títulos', fallback: 'Georgia, serif', italic: true, weights: [400] },
  { family: 'Libre Baskerville', category: 'Serif clásica', fallback: 'Georgia, serif', italic: true, weights: [400, 700] },
  { family: 'Lora', category: 'Serif suave', fallback: 'Georgia, serif', italic: true },
  { family: 'Bodoni Moda', category: 'Serif de moda', fallback: 'Didot, serif', italic: true },
  { family: 'Archivo', category: 'Sans gruesa', fallback: "'Arial Black', Arial, sans-serif", italic: true },
  { family: 'Inter', category: 'Sans neutra', fallback: 'system-ui, sans-serif', italic: false },
  { family: 'Montserrat', category: 'Sans geométrica', fallback: 'Arial, sans-serif', italic: true },
  { family: 'Jost', category: 'Sans moderna', fallback: 'Arial, sans-serif', italic: true },
  { family: 'Manrope', category: 'Sans redondeada', fallback: 'Arial, sans-serif', italic: false },
  { family: 'Poppins', category: 'Sans amable', fallback: 'Arial, sans-serif', italic: true },
];

export const WEIGHTS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Media' },
  { value: 600, label: 'Seminegrita' },
  { value: 700, label: 'Negrita' },
];

export const TITLE_SIZES = {
  s: { label: 'Pequeño', rem: 1.375 },
  m: { label: 'Normal', rem: 1.75 },
  l: { label: 'Grande', rem: 2.125 },
};

export const fontOption = (family) => FONT_OPTIONS.find((f) => f.family === family) ?? null;

/** Valor CSS `font-family` con su respaldo. `null` = usar la de la marca. */
export const fontStack = (family) => {
  const f = fontOption(family);
  return f ? `'${f.family}', ${f.fallback}` : null;
};

/** Peso disponible más cercano (algunas fuentes solo tienen 400). */
export const nearestWeight = (family, weight) => {
  const ws = fontOption(family)?.weights;
  if (!ws) return weight;
  return ws.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
};

const loaded = new Set(['Fraunces', 'Cormorant Garamond', 'Archivo', 'Inter', 'Libre Baskerville']); // ya están en index.html

/** Inserta el <link> de Google Fonts de una familia si aún no se cargó. */
export function ensureFont(family) {
  const f = fontOption(family);
  if (!f || loaded.has(f.family) || typeof document === 'undefined') return;
  loaded.add(f.family);
  const ws = f.weights ?? [400, 500, 600, 700];
  const axes = f.italic ? `ital,wght@${ws.map((w) => `0,${w}`).join(';')};${ws.map((w) => `1,${w}`).join(';')}` : `wght@${ws.join(';')}`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:${axes}&display=swap`;
  link.dataset.font = f.family;
  document.head.appendChild(link);
}

/** Carga todas las fuentes (para que el selector del panel muestre cada opción con su letra). */
export const ensureAllFonts = () => FONT_OPTIONS.forEach((f) => ensureFont(f.family));
