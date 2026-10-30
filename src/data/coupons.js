// DATOS DE DEMOSTRACIÓN — cupones de ejemplo (solo en el modo demo).
// En el sitio con Supabase se empieza sin cupones y se crean en el panel → Cupones.
export const demoCoupons = [
  { id: 'cp-bienvenida', code: 'NOVIOS10', description: 'Parejas que reservan con un año de antelación', type: 'percent', value: 10, brandIds: null, validFrom: '', validTo: '', maxUses: 20, onePerClient: true, active: true },
  { id: 'cp-feria', code: 'FERIA200', description: 'Feria de bodas', type: 'fixed', value: 200, brandIds: null, validFrom: '2026-12-01', validTo: '2026-12-31', maxUses: 10, onePerClient: false, active: true },
];
