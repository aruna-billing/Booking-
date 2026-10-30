// Planes y extras de Elian López Photo (precios en USD, enteros).
// Son de partida: se cambian en el panel → Planes y extras.
// `tone` = estilo del marcador de imagen si el plan no tiene foto.

export const plans = [
  {
    id: 'el-intima',
    brandId: 'elian-lopez-photo',
    name: 'Ceremonia Íntima',
    category: 'Boda',
    description: 'Para elopements y bodas civiles pequeñas. Ceremonia, retratos de pareja y familia cercana.',
    durationMin: 240,
    deliverables: ['4 horas de cobertura', '250+ imágenes editadas', 'Galería privada'],
    price: 1200,
    tone: 'linen',
    active: true,
  },
  {
    id: 'el-clasica',
    brandId: 'elian-lopez-photo',
    name: 'Boda Clásica',
    category: 'Boda',
    description: 'Desde los preparativos hasta el primer baile. Narrativa completa del día con mirada editorial.',
    durationMin: 480,
    deliverables: ['8 horas de cobertura', '600+ imágenes editadas', 'Avance en 72 horas'],
    price: 2400,
    tone: 'noir',
    active: true,
    badge: { emoji: '🔥', text: 'Más popular' },
  },
  {
    id: 'el-editorial',
    brandId: 'elian-lopez-photo',
    name: 'Boda Editorial Completa',
    category: 'Boda',
    description: 'Cobertura extendida, sesión preboda y dirección de arte. Para quienes quieren una obra completa.',
    durationMin: 600,
    deliverables: ['10 horas de cobertura', 'Sesión preboda incluida', 'Libro fine art 30×30'],
    price: 3800,
    tone: 'gold',
    active: true,
    badge: { emoji: '💎', text: 'Premium' },
  },
];

// pricing: 'fixed' = se añade una vez · 'per_unit' = se elige cantidad (1..maxQty)
// appliesTo: null = todos los planes, o lista de IDs de plan.
// addsMinutes: minutos de cobertura que suma (por unidad).
export const extras = [
  { id: 'el-x-hora', brandId: 'elian-lopez-photo', name: 'Hora adicional de cobertura', description: 'Se suma a las horas de cobertura del plan.', price: 180, pricing: 'per_unit', maxQty: 4, addsMinutes: 60, appliesTo: null, active: true },
  { id: 'el-x-segundo', brandId: 'elian-lopez-photo', name: 'Segundo fotógrafo', description: 'Dos miradas simultáneas en momentos clave.', price: 450, pricing: 'fixed', appliesTo: null, active: true, badge: { emoji: '⭐', text: 'Recomendado' } },
  { id: 'el-x-preboda', brandId: 'elian-lopez-photo', name: 'Sesión preboda', description: '90 minutos en locación a elección.', price: 550, pricing: 'fixed', appliesTo: ['el-intima', 'el-clasica'], active: true },
  { id: 'el-x-libro', brandId: 'elian-lopez-photo', name: 'Libro fine art 30×30', description: 'Encuadernado en lino, 40 páginas.', price: 650, pricing: 'fixed', appliesTo: ['el-intima', 'el-clasica'], active: true },
  { id: 'el-x-padres', brandId: 'elian-lopez-photo', name: 'Libro para padres 20×20', description: 'Copia reducida del libro principal.', price: 240, pricing: 'per_unit', maxQty: 3, appliesTo: null, active: true },
  { id: 'el-x-expres', brandId: 'elian-lopez-photo', name: 'Entrega exprés', description: 'Galería completa en 72 horas.', price: 350, pricing: 'fixed', expressDelivery: true, appliesTo: null, active: true },
];
