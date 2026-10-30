// DATOS DE DEMOSTRACIÓN — cupones de ejemplo (solo en el modo demo).
// En el sitio con Supabase se empieza sin cupones y se crean en el panel → Cupones.
export const demoCoupons = [
  { id: 'cp-bienvenida', code: 'BIENVENIDA10', description: 'Primera sesión', type: 'percent', value: 10, brandIds: null, validFrom: '', validTo: '', maxUses: 50, onePerClient: true, active: true },
  { id: 'cp-navidad', code: 'NAVIDAD500', description: 'Campaña de diciembre', type: 'fixed', value: 500, brandIds: null, validFrom: '2026-12-01', validTo: '2026-12-31', maxUses: 20, onePerClient: false, active: true },
];
