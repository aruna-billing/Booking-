# Elian López Photo · Booking

Sistema de reservas de bodas y seguimiento de clientes para **Elian López Photo** (marca matriz: **Aruna One**), conectado a **Supabase**.

- **Con Supabase** (archivo `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`): sitio real. Las reservas, la configuración, los comprobantes y las imágenes se guardan en Supabase, y el panel pide inicio de sesión.
- **Sin esas variables**: funciona como demo con datos de ejemplo guardados en el navegador. Sirve para probar cambios sin tocar la base de datos.

👉 **Pasos para ponerlo en marcha: [`docs/INSTALACION-SUPABASE.md`](docs/INSTALACION-SUPABASE.md)**

> **Google Calendar** se conecta aparte, siguiendo [`docs/GOOGLE-CALENDAR.md`](docs/GOOGLE-CALENDAR.md). Los **correos al cliente** (reserva en revisión y confirmada) se activan con [`docs/CORREOS.md`](docs/CORREOS.md). WhatsApp **no** está conectado. El cliente paga por transferencia y adjunta el comprobante; no hay pagos con tarjeta.

## Iniciar en local

Requisitos: Node.js 20.19 o superior.

```bash
npm install
npm run dev        # http://localhost:5173 (usa el .env: se conecta a tu Supabase)
npm test           # pruebas unitarias
npm run build      # sitio estático en dist/
```

## Seguimientos (lo nuevo)

**Etapas:** Solicitud → **Reservado** → **Fotos realizadas** (en edición) → **Entregado**

- **Línea de tiempo** arriba del detalle de cada solicitud:
  - Muestra la fecha de cada paso: recibida, reservada, día de las fotos y entrega (o fecha límite).
  - Incluye el botón de la siguiente acción.
  - El administrador puede deshacer el último paso.
- **Sección «Seguimientos»** en el menú:
  - **Resumen:** sesiones de la semana, en edición, entregas vencidas, sesiones sin marcar y entregadas en el mes.
  - **Tablero** con tres columnas (en celular, pestañas) y **vista de lista**.
  - **Filtros:** búsqueda y «Solo lo urgente». La columna Entregado muestra los últimos 30 días, con opción de ver todas.
  - **Acciones:**
    - «Fotos realizadas»: disponible desde el día de la sesión.
    - «Marcar entregado»: pide fecha y enlace de la galería; el enlace debe empezar con `https://`.
- **Plazo de entrega:** se cuenta en días hábiles desde el día de las fotos (10 por defecto; se cambia en Marcas). Con un extra marcado como «Entrega exprés», el plazo es de 72 horas.
- **Alertas:**
  - Entregas vencidas o próximas.
  - Sesiones pasadas sin marcar («¿Se realizó?»).
  - Aviso en el menú (número rojo), en el dashboard y en cada tarjeta.
- **Rol Asistente:** ve Seguimientos y puede marcar fotos realizadas y entregas. No puede deshacer pasos.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `#/` | Portada (con una sola marca publicada, lleva directo a sus planes) |
| `#/reservar/elian-lopez-photo` | Reserva en 6 pasos |
| `#/admin` | Dashboard |
| `#/admin/seguimientos` | **Seguimientos** |
| `#/admin/solicitudes` · `/:id` | Solicitudes y detalle con línea de tiempo |
| `#/admin/comprobantes` · `/finanzas` · `/calendario` · `/catalogo` · `/cuentas` · `/personalizacion` · `/marcas` · `/terminos` · `/usuarios` | Resto del panel |

Para probar el rol Asistente usa **«Ver como»** en la barra superior del panel.

## Antes de usarlo con clientes

1. En **Términos**, reemplaza el texto de ejemplo por los términos oficiales.
2. En **Planes y extras**, confirma los extras y sus precios (son de ejemplo).
3. En **Marcas**, ajusta el anticipo, el plazo de entrega y el WhatsApp; sube los logos.
4. En **Personalización**, sube las fotos de portada, galería y planes.
5. Conecta el backend (ver `docs/INTEGRACION.md`).

Documentación: `docs/DECISIONES.md`, `docs/INTEGRACION.md` y `docs/LIMITACIONES.md`.
