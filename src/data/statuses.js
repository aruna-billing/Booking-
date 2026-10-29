// Estados de solicitudes y pagos. Se separan deliberadamente: una solicitud puede estar
// «En revisión» con el pago «Por verificar», o «Confirmada» con el pago «Verificado».

export const REQUEST_STATUS = {
  pending_review: { label: 'En revisión', tone: 'amber', description: 'Solicitud recibida. El equipo aún no la confirma.' },
  awaiting_payment: { label: 'Esperando pago', tone: 'neutral', description: 'Se pidió al cliente un comprobante nuevo o pendiente.' },
  confirmed: { label: 'Confirmada', tone: 'green', description: 'Fecha reservada y anticipo verificado.' },
  completed: { label: 'Sesión realizada', tone: 'ink', description: 'Fotos realizadas; ver la entrega en Seguimientos.' },
  cancelled: { label: 'Cancelada', tone: 'red', description: 'La fecha queda libre nuevamente.' },
};

export const PAYMENT_STATUS = {
  none: { label: 'Sin comprobante', tone: 'neutral' },
  submitted: { label: 'Por verificar', tone: 'amber' },
  verified: { label: 'Verificado', tone: 'green' },
  rejected: { label: 'Rechazado', tone: 'red' },
};
