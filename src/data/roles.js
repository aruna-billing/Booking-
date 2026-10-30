// Roles y permisos del panel administrativo.
// Futuro: tabla `staff` (user_id de Supabase Auth, role, brand_ids) + políticas RLS
// que comprueben estos mismos permisos en el servidor.

export const PERMISSIONS = [
  { key: 'dashboard.view', label: 'Ver el dashboard' },
  { key: 'requests.view', label: 'Ver solicitudes y su detalle' },
  { key: 'receipts.view', label: 'Ver comprobantes de pago' },
  { key: 'sessions.decide', label: 'Aceptar o rechazar sesiones' },
  { key: 'tracking.view', label: 'Ver seguimientos (etapas de cada cliente)' },
  { key: 'tracking.update', label: 'Marcar fotos realizadas y entregas' },
  { key: 'requests.manage', label: 'Completar, reabrir o cancelar reservas y escribir notas internas' },
  { key: 'payments.manage', label: 'Verificar, registrar y anular pagos' },
  { key: 'finance.view', label: 'Ver finanzas y cobros' },
  { key: 'calendar.manage', label: 'Gestionar calendario y bloqueos' },
  { key: 'catalog.manage', label: 'Editar planes y extras' },
  { key: 'accounts.manage', label: 'Editar cuentas bancarias' },
  { key: 'web.manage', label: 'Personalizar la web' },
  { key: 'brands.manage', label: 'Configurar marcas y marca matriz' },
  { key: 'terms.manage', label: 'Editar términos y condiciones' },
  { key: 'coupons.manage', label: 'Crear y editar cupones de descuento' },
  { key: 'users.manage', label: 'Gestionar usuarios y roles' },
];

export const ROLES = {
  admin: {
    label: 'Administrador',
    description: 'Acceso completo a todo el panel.',
    permissions: PERMISSIONS.map((p) => p.key),
  },
  assistant: {
    label: 'Asistente',
    description: 'Ve las solicitudes, los comprobantes y los seguimientos de sus marcas; acepta o rechaza sesiones y marca fotos realizadas y entregas.',
    permissions: ['requests.view', 'receipts.view', 'sessions.decide', 'tracking.view', 'tracking.update'],
  },
};
