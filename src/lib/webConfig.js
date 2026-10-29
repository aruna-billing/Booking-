// Personalización de la web de reservas: valores por defecto y lectura segura.
// Toda marca (también las nuevas o las guardadas antes de existir esta sección)
// pasa por getWeb(), que completa lo que falte.

import { isEventBrand } from '../data/brands.js';
import { TITLE_SIZES, fontStack, nearestWeight } from './fonts.js';

export const MAX_GALLERY = 8;

/** Textos del recorrido que se pueden personalizar por marca. */
export const TEXT_FIELDS = [
  { key: 'plansEyebrow', label: 'Texto sobre el titular de planes', step: 'Paso 1', def: () => 'Paso 1 de 6 · Elige tu plan' },
  { key: 'extrasIntro', label: 'Introducción de extras', step: 'Paso 2', def: () => 'Todos son opcionales. El total se actualiza al momento.' },
  { key: 'detailsIntro', label: 'Introducción del formulario', step: 'Paso 4', def: () => 'Usaremos estos datos solo para coordinar tu reserva.' },
  {
    key: 'notesHint',
    label: 'Ayuda del campo de notas',
    step: 'Paso 4',
    def: (b) =>
      isEventBrand(b)
        ? 'Lugar de la ceremonia, número de invitados, estilo que les gusta…'
        : 'Quiénes participan, estilo que te gusta, ocasión, cualquier cosa que debamos saber…',
  },
  {
    key: 'paymentIntro',
    label: 'Instrucciones de pago',
    step: 'Paso 5',
    multiline: true,
    def: () => 'Haz una transferencia o depósito por el importe indicado y adjunta el comprobante. No aceptamos pagos con tarjeta en este momento.',
  },
  {
    key: 'thanksMessage',
    label: 'Mensaje final',
    step: 'Paso 6',
    multiline: true,
    def: () => '¡Gracias por tu interés! Tu reserva está en revisión. Te contactaremos mediante WhatsApp.',
  },
];

export function getWeb(brand) {
  const w = brand.web ?? {};
  const defaultItems = (brand.studio?.gallery ?? ['Muestra', 'Muestra', 'Muestra', 'Muestra', 'Muestra']).map((label) => ({ imageId: null, label }));
  return {
    // media: 'image' | 'video'. Con video, imageId es la imagen de respaldo (opcional).
    hero: { media: 'image', imageId: null, videoId: null, mobileImage: false, show: true, size: 'normal', ...(w.hero ?? {}) },
    intro: { show: true, ...(w.intro ?? {}) },
    gallery: { show: w.gallery?.show ?? true, items: w.gallery?.items ?? defaultItems },
    cardImageId: w.cardImageId ?? null,
    texts: { ...(w.texts ?? {}) },
    // Tipografía de la sección de planes. family = null → la de la marca.
    planType: {
      titleFamily: null,
      titleItalic: null, // null = el estilo de títulos de la marca
      titleWeight: 400,
      titleSize: 'm',
      bodyFamily: null,
      headlineFamily: null,
      headlineUppercase: true,
      ...(w.planType ?? {}),
    },
  };
}

/** Variables CSS para la sección de planes según la tipografía elegida. */
export function planTypeVars(brand, planType) {
  const t = planType ?? getWeb(brand).planType;
  const vars = {};
  if (t.titleFamily) vars['--plan-title-font'] = fontStack(t.titleFamily);
  vars['--plan-title-style'] = t.titleItalic === null || t.titleItalic === undefined ? brand.theme?.displayStyle ?? 'normal' : t.titleItalic ? 'italic' : 'normal';
  vars['--plan-title-weight'] = String(nearestWeight(t.titleFamily, t.titleWeight ?? 400));
  vars['--plan-title-size'] = `${(TITLE_SIZES[t.titleSize] ?? TITLE_SIZES.m).rem}rem`;
  if (t.bodyFamily) vars['--plan-body-font'] = fontStack(t.bodyFamily);
  if (t.headlineFamily) vars['--plans-headline-font'] = fontStack(t.headlineFamily);
  vars['--plans-headline-transform'] = t.headlineUppercase === false ? 'none' : 'uppercase';
  return vars;
}

/** Fuentes usadas en la sección de planes (para cargarlas). */
export const planTypeFamilies = (t) => [t.titleFamily, t.bodyFamily, t.headlineFamily].filter(Boolean);

/** Texto personalizado o, si está vacío, el predeterminado. */
export function webText(brand, key) {
  const f = TEXT_FIELDS.find((x) => x.key === key);
  const v = brand.web?.texts?.[key];
  return v && v.trim() ? v : f.def(brand);
}

export const HERO_SIZES = {
  compact: { label: 'Baja', ratio: '3 / 1' },
  normal: { label: 'Normal', ratio: '21 / 9' },
  tall: { label: 'Alta', ratio: '16 / 9' },
};

/** Portada general (selección de marca). */
export function getOrgWeb(org) {
  return {
    title: 'Reservas',
    lead: 'Elige el estudio con el que quieres reservar.',
    showTagline: true,
    ...(org.web ?? {}),
  };
}

/** Dónde se usa una imagen (para avisar antes de borrarla). */
export function imageUsage(db, imageId) {
  const uses = [];
  db.brands.forEach((b) => {
    const w = getWeb(b);
    if (w.hero.imageId === imageId) uses.push(`${w.hero.media === 'video' ? 'Imagen de respaldo de la portada' : 'Portada'} · ${b.name}`);
    if (w.hero.videoId === imageId) uses.push(`Video de portada · ${b.name}`);
    if (w.cardImageId === imageId) uses.push(`Tarjeta en la portada general · ${b.name}`);
    w.gallery.items.forEach((it, i) => it.imageId === imageId && uses.push(`Galería (foto ${i + 1}) · ${b.name}`));
  });
  db.plans.forEach((p) => p.imageId === imageId && uses.push(`Plan «${p.name}»`));
  return uses;
}
