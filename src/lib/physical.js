// Material físico (impresiones, canvas, álbumes, cuadros…). Funciones puras.
//
// Un plan o un extra es «material físico» si:
//   · en Planes y extras se marcó la casilla (physical: true), o
//   · no se tocó la casilla (physical sin definir) y su texto lo indica
//     (impresión, canvas, lienzo, álbum, libro, cuadro, marco, 8x10, 16×20…).
// physical: false lo apaga aunque el texto coincida.
//
// Si la reserva lleva material físico (por el plan o por un extra, también los
// cargos añadidos después), la línea de tiempo muestra la etapa «Impresión»:
//   r.print = { orderedAt, note, readyAt }   (fechas ISO)

const PHYSICAL_RE =
  /impres|imprim|canva(s)?\b|lienzo|[áa]lbum|\blibro|photo\s?book|fotolibro|\bmarco|enmarcad|\bcuadro|ampliaci|acr[íi]lic|retablo|p[óo]ster|f[íi]sic|papel\s+fotogr|postal|\b\d{1,3}\s*[x×]\s*\d{1,3}\b/i;

/** ¿El texto describe material físico? */
export const isPhysicalText = (s) => PHYSICAL_RE.test(String(s ?? ''));

/** Lo que dice el texto del extra (sin mirar la casilla). */
export const extraLooksPhysical = (x) => isPhysicalText(`${x?.name ?? ''} ${x?.description ?? ''}`);

/** ¿El extra es material físico? La casilla manda; si no se tocó, se detecta por el texto. */
export const extraIsPhysical = (x) => (typeof x?.physical === 'boolean' ? x.physical : extraLooksPhysical(x));

/** Líneas de «Incluye» del plan que son material físico (detectadas por el texto). */
export const planPhysicalLines = (plan) => (plan?.deliverables ?? []).map((d) => String(d).trim()).filter((d) => d && isPhysicalText(d));

/** ¿El plan incluye material físico? */
export const planIsPhysical = (plan) => (typeof plan?.physical === 'boolean' ? plan.physical : planPhysicalLines(plan).length > 0);

/** Material del plan que se muestra en el seguimiento. */
export function planPhysicalItems(plan) {
  if (!plan || !planIsPhysical(plan)) return [];
  const lines = planPhysicalLines(plan);
  return lines.length ? lines.map((name) => ({ name, qty: 1, source: 'plan' })) : [{ name: 'Material incluido en el plan', qty: 1, source: 'plan' }];
}

/**
 * Material físico de una reserva: lo del plan + los extras (y cargos aprobados) que lo son.
 * Los cargos propuestos y aún sin aprobar no cuentan.
 * @returns {Array<{ name: string, qty: number, source: 'plan'|'extra' }>}
 */
export function physicalItemsOf(r, plans = [], extras = []) {
  const plan = plans.find((p) => p.id === r?.planId);
  const items = planPhysicalItems(plan);
  (r?.quote?.lines ?? []).forEach((l) => {
    const x = extras.find((e) => e.id === (l.extraId ?? l.id));
    const physical = x ? extraIsPhysical(x) : isPhysicalText(l.name);
    if (!physical) return;
    const qty = Math.max(1, Number(l.quantity) || 1);
    const same = items.find((i) => i.source === 'extra' && i.name === l.name);
    if (same) same.qty += qty;
    else items.push({ name: l.name, qty, source: 'extra' });
  });
  return items;
}

/** ¿La reserva necesita la etapa «Impresión»? */
export const needsPrint = (r, plans = [], extras = []) => physicalItemsOf(r, plans, extras).length > 0;

/** Texto corto: «Foto impresa 8×10 ×2 · Canvas 16×20». */
export const physicalSummary = (items) => items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(' · ');

/** Estado de la impresión: 'pending' (por encargar) | 'ordered' (en impresión) | 'ready' (listo). */
export function printStateOf(r) {
  if (r?.print?.readyAt) return 'ready';
  if (r?.print?.orderedAt) return 'ordered';
  return 'pending';
}
