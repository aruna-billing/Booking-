// Validación del formulario de datos (paso 4) y del pago (paso 5).
// Devuelve un objeto { campo: mensaje }; vacío = válido.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateDetails(d) {
  const errors = {};
  if (!d.firstName?.trim()) errors.firstName = 'Escribe tu nombre.';
  if (!d.lastName?.trim()) errors.lastName = 'Escribe tu apellido.';
  if (!d.email?.trim()) errors.email = 'Escribe tu correo electrónico.';
  else if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Revisa el formato del correo (ej. nombre@correo.com).';
  const digits = (d.phone || '').replace(/\D/g, '');
  if (!digits) errors.phone = 'Escribe un teléfono con WhatsApp.';
  else if (digits.length < 10 || digits.length > 15) errors.phone = 'El teléfono debe tener entre 10 y 15 dígitos.';
  if ((d.notes || '').length > 1500) errors.notes = 'Las notas no pueden superar 1500 caracteres.';
  if (!d.acceptedTerms) errors.acceptedTerms = 'Debes aceptar los términos y condiciones para continuar.';
  return errors;
}

export function validatePayment(p) {
  const errors = {};
  if (!p.receipt) errors.receipt = 'Adjunta el comprobante de tu transferencia o depósito.';
  else if (p.receipt.status === 'uploading') errors.receipt = 'Espera a que termine de subir el comprobante.';
  else if (p.receipt.status === 'error') errors.receipt = 'El comprobante no se pudo subir. Quítalo y vuelve a adjuntarlo.';
  if (!p.confirmedPaid) errors.confirmedPaid = 'Marca la casilla «Ya hice mi pago» para continuar.';
  return errors;
}

export const FILE_RULES = {
  inspiration: { maxFiles: 6, maxSizeMB: 10, accept: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] },
  receipt: { maxFiles: 1, maxSizeMB: 10, accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
};
