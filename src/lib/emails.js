// Correos automáticos al cliente: textos por defecto, variables y armado del mensaje.
// La función de Supabase «booking-emails» usa las mismas reglas (ver su index.ts);
// esta copia sirve para la vista previa del panel.
//
// Se guardan en brand.web.emails = { review: { enabled, subject, body }, confirmed: {...} }.
// Asunto o mensaje vacíos = el texto por defecto.

import { isEventBrand } from '../data/brands.js';
import { formatMoney } from './format.js';
import { formatLongDate, formatTime } from './date.js';

export const EMAIL_KINDS = [
  { key: 'review', label: 'Reserva en revisión', when: 'Se envía al cliente en cuanto envía su solicitud.' },
  { key: 'confirmed', label: 'Reserva confirmada', when: 'Se envía cuando el equipo acepta la sesión o verifica el pago y confirma.' },
];

export const EMAIL_VARS = [
  ['nombre', 'Nombre del cliente'],
  ['apellido', 'Apellido'],
  ['marca', 'Nombre de la marca'],
  ['plan', 'Plan elegido'],
  ['fecha', 'Fecha (ej.: sábado, 14 de noviembre de 2026)'],
  ['hora', 'Hora de inicio'],
  ['total', 'Total de la reserva'],
  ['anticipo', 'Anticipo'],
  ['saldo', 'Saldo pendiente'],
  ['solicitud', 'Número de solicitud'],
  ['whatsapp', 'WhatsApp de la marca'],
];

export function defaultEmail(kind, brand) {
  const ev = isEventBrand(brand);
  const what = ev ? 'tu fecha' : 'tu sesión';
  if (kind === 'confirmed') {
    return {
      subject: '¡Tu reserva está confirmada! · {marca}',
      body: `Hola {nombre}:

¡Buenas noticias! Verificamos tu pago y ${what} quedó confirmada.

· Plan: {plan}
· Fecha: {fecha}, a las {hora}
· Saldo pendiente: {saldo} (se paga el día ${ev ? 'del evento' : 'de la sesión'})

Si necesitas cambiar algo, responde a este correo o escríbenos por WhatsApp: {whatsapp}.

¡Nos vemos pronto!
{marca}`,
    };
  }
  return {
    subject: 'Recibimos tu solicitud · {marca}',
    body: `Hola {nombre}:

¡Gracias por tu interés! Recibimos tu solicitud y tu comprobante de pago. Tu reserva está en revisión: en cuanto verifiquemos el pago te confirmaremos ${what}.

· Plan: {plan}
· Fecha solicitada: {fecha}, a las {hora}
· Total: {total} · Anticipo enviado: {anticipo}
· Número de solicitud: {solicitud}

Te contactaremos mediante WhatsApp. Si tienes alguna duda, responde a este correo.

{marca}`,
  };
}

/** Plantilla efectiva (lo guardado o, si está vacío, lo predeterminado). */
export function emailTemplate(brand, kind) {
  const saved = brand.web?.emails?.[kind] ?? {};
  const def = defaultEmail(kind, brand);
  return {
    enabled: saved.enabled !== false,
    subject: saved.subject?.trim() ? saved.subject : def.subject,
    body: saved.body?.trim() ? saved.body : def.body,
  };
}

/** Valores de las variables para una solicitud. */
export function emailVars(r, brand) {
  const cur = r.currency || brand.currency;
  return {
    nombre: r.client?.firstName ?? '',
    apellido: r.client?.lastName ?? '',
    marca: brand.name,
    plan: r.planName ?? '',
    fecha: r.date ? formatLongDate(r.date) : '',
    hora: r.time ? formatTime(r.time) : '',
    total: formatMoney(r.quote?.total ?? 0, cur),
    anticipo: formatMoney(r.quote?.deposit ?? 0, cur),
    saldo: formatMoney(r.quote?.balance ?? 0, cur),
    solicitud: String(r.id ?? '').replace(/^req-/, ''),
    whatsapp: brand.whatsappDisplay || '—',
  };
}

/** Reemplaza {variable} por su valor (las desconocidas quedan como están). */
export const fillTemplate = (text, vars) => String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** Solicitud de ejemplo para la vista previa y el correo de prueba. */
export function sampleRequest(brand, plan) {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const price = plan?.price ?? 5000;
  const deposit = Math.round((price * (brand.depositPercent ?? 50)) / 100);
  return {
    id: 'req-1234',
    client: { firstName: 'Ana', lastName: 'Pérez', email: 'ana@correo.com', phone: '' },
    planName: plan?.name ?? 'Plan',
    date: iso,
    time: isEventBrand(brand) ? '15:00' : '10:00',
    currency: brand.currency,
    quote: { total: price, deposit, balance: price - deposit },
  };
}

// ───────────────────────── Pie del correo: contacto y términos ─────────────────────────
// Se guarda en brand.web.emails.footer = { enabled, terms: 'confirmed' | 'both' | 'none' }.
// La función «booking-emails» repite estas mismas reglas.

export const TERMS_MODES = [
  ['confirmed', 'Completos solo en «Reserva confirmada»'],
  ['both', 'Completos en los dos correos'],
  ['none', 'Solo la línea con la versión aceptada'],
];

export function footerSettings(brand) {
  const f = brand?.web?.emails?.footer ?? {};
  return { enabled: f.enabled !== false, terms: TERMS_MODES.some(([k]) => k === f.terms) ? f.terms : 'confirmed' };
}

// Cabecera: brand.web.emails.header = { logoWidth (px), align: 'left' | 'center' }.
export const LOGO_WIDTH = { min: 60, max: 320, step: 10, def: 160 };

export function headerSettings(brand) {
  const h = brand?.web?.emails?.header ?? {};
  const w = Math.round(Number(h.logoWidth));
  return {
    logoWidth: Number.isFinite(w) && w > 0 ? Math.min(LOGO_WIDTH.max, Math.max(LOGO_WIDTH.min, w)) : LOGO_WIDTH.def,
    align: h.align === 'center' ? 'center' : 'left',
  };
}

/** Logo elegido para correos: el propio de correos (Personalización) o, si no hay, el de Marcas. */
export const emailLogoSource = (brand) => brand?.web?.emails?.logo?.src ? brand.web.emails.logo : brand?.logo ?? null;

/** Logo apto para correo: Gmail y Outlook no muestran SVG ni imágenes incrustadas. */
export function emailLogo(brand) {
  const pick = (img) => {
    const src = typeof img?.src === 'string' ? img.src : '';
    if (!src.startsWith('https://')) return '';
    if (/\.svg(\?|#|$)/i.test(src) || /svg/i.test(img.type ?? '')) return '';
    return src;
  };
  return pick(brand?.web?.emails?.logo) || pick(brand?.logo);
}

/** Contenido del pie: contacto, línea de aceptación y, según el ajuste, los términos completos. */
export function emailFooter(brand, kind, terms, r = {}) {
  const s = footerSettings(brand);
  if (!s.enabled) return null;
  const contact = [brand.name, brand.whatsappDisplay ? `WhatsApp ${brand.whatsappDisplay}` : '', brand.email || ''].filter(Boolean);
  const sections = (terms?.sections ?? []).filter((x) => String(x.title ?? '').trim() || String(x.body ?? '').trim());
  const version = r.acceptedTermsVersion || terms?.version || '';
  const accepted = sections.length ? `Al enviar tu solicitud aceptaste los términos y condiciones${version ? ` (versión ${version})` : ''}.` : '';
  const full = sections.length > 0 && (s.terms === 'both' || (s.terms === 'confirmed' && kind === 'confirmed'));
  return {
    contact,
    accepted,
    terms: full ? { title: `Términos y condiciones${terms.version ? ` · versión ${terms.version}` : ''}`, sections } : null,
  };
}
