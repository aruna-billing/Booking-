// Planes y extras de Morel Estudio.
// Los dos planes vienen de la página pública de Morel Estudio.
// Los EXTRAS son de ejemplo (nombres y precios a confirmar en «Planes y extras»).
// Precios en pesos dominicanos (enteros). `tone` = estilo del marcador de imagen.

export const plans = [
  {
    id: 'me-estandar',
    brandId: 'morel-estudio',
    name: 'Plan Estándar',
    category: 'Estudio',
    description: 'El cliente debe llegar listo con el vestuario. No incluye vestidor.',
    durationMin: 30,
    deliverables: ['6 fotos digitales', 'Sesión en estudio', 'Llegar con el vestuario listo'],
    price: 5500,
    tone: 'linen',
    active: true,
  },
  {
    id: 'me-pro',
    brandId: 'morel-estudio',
    name: 'Plan Pro',
    category: 'Estudio',
    description: 'Más tiempo y más fotos, con cambio de vestuario.',
    durationMin: 60,
    deliverables: ['10 fotos digitales', '1–2 cambios de ropa', 'Sesión en estudio'],
    price: 8000,
    tone: 'ink',
    active: true,
    featured: true,
  },
];

// pricing: 'fixed' = se añade una vez · 'per_unit' = se elige cantidad (1..maxQty)
// addsMinutes: minutos que suma a la sesión (por unidad).
// expressDelivery: acorta el plazo de entrega a 72 horas (Seguimientos).
export const extras = [
  { id: 'me-x-foto', brandId: 'morel-estudio', name: 'Foto digital adicional', description: 'Elige más fotos de tu sesión.', price: 700, pricing: 'per_unit', maxQty: 10, appliesTo: null, active: true },
  { id: 'me-x-30min', brandId: 'morel-estudio', name: '30 minutos adicionales de sesión', description: 'Se suman al tiempo de tu plan.', price: 2500, pricing: 'per_unit', maxQty: 2, addsMinutes: 30, appliesTo: null, active: true },
  { id: 'me-x-expres', brandId: 'morel-estudio', name: 'Entrega exprés (72 h)', description: 'Tus fotos listas en tres días.', price: 1500, pricing: 'fixed', expressDelivery: true, appliesTo: null, active: true },
  { id: 'me-x-impresa', brandId: 'morel-estudio', name: 'Foto impresa 8×10', description: 'Impresión en papel fotográfico.', price: 500, pricing: 'per_unit', maxQty: 5, appliesTo: null, active: true },
];
