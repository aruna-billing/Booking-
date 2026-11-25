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

**Etapas:** Solicitud → **Reservado** → **Selección** (el cliente elige sus fotos) → **En edición** → **Entregado**

- **Línea de tiempo** arriba del detalle de cada solicitud:
  - Muestra la fecha de cada paso: recibida, reservada, día de las fotos, selección y entrega (o fecha límite).
  - Incluye el botón de la siguiente acción.
  - El administrador puede deshacer el último paso.
- **Sección «Seguimientos»** en el menú:
  - **Resumen:** sesiones de la semana, eligiendo fotos, en edición, entregas vencidas, sesiones sin marcar y entregadas en el mes.
  - **Tablero** con cuatro columnas (en celular, pestañas) y **vista de lista**.
  - **Filtros:** búsqueda y «Solo lo urgente». La columna Entregado muestra los últimos 30 días, con opción de ver todas.
  - **Acciones:**
    - «Fotos realizadas»: disponible desde el día de la sesión. El cliente pasa a **Selección**.
    - «Enviada para elegir»: fecha y enlace de la galería para elegir (opcional). Al guardar se abre el mensaje de WhatsApp «Elegir fotos».
    - «Ya eligió»: fecha, cuántas fotos eligió y una nota. El cliente pasa a **En edición**.
    - «Marcar entregado»: pide fecha y enlace de la galería; el enlace debe empezar con `https://`.
- **Plazo de entrega:** se cuenta en días hábiles desde el día en que el cliente eligió sus fotos (o desde el día de las fotos en sesiones marcadas antes de existir la etapa de selección) (10 por defecto; se cambia en Marcas). Con un extra marcado como «Entrega exprés», el plazo es de 72 horas.
- **Alertas:**
  - Entregas vencidas o próximas.
  - Sesiones pasadas sin marcar («¿Se realizó?»).
  - Fotos sin enviar para elegir, y clientes con el plazo para elegir vencido.
- **Plazo para elegir las fotos:** 1 día por defecto, contado desde que se le envían. Se cambia en Marcas («Plazo para elegir las fotos»). Sale en el seguimiento («Elegir antes del…») y en el mensaje de WhatsApp «Elegir fotos» (`{plazo_seleccion}`).
  - Aviso en el menú (número rojo), en el dashboard y en cada tarjeta.
- **Rol Asistente:** ve Seguimientos y puede marcar fotos realizadas, la selección y las entregas. No puede deshacer pasos.

## Material físico: etapa «Impresión»

Si el cliente lleva material físico (impresión 8x10, canvas 16x20, álbum, cuadro…), su
línea de tiempo tiene un paso más **al final**, porque el cliente elige qué imprimir de las fotos
ya editadas:

`Solicitud → Reservado → Día de las fotos → Selección → Entrega → Impresión`

- **Cuándo aparece:** si el plan lo incluye (una línea de «Incluye» como «Impresión 8x10») o si
  eligió un extra físico (también un cargo añadido y aprobado después). El plan Básico sin material
  + un extra «Canvas 16x20» también la tiene. Si no hay material físico, el paso no aparece.
- **Detección automática:** por el texto (impresión, canvas/canva, lienzo, álbum, libro, cuadro,
  marco, ampliación, medidas como 8x10…). En **Planes y extras**, cada plan y extra tiene la casilla
  «Material físico» para corregirlo a mano.
- **Pasos:** al marcar la entrega de las fotos se abre la impresión → **Enviado a imprimir** (fecha +
  nota: laboratorio, pedido) → **Material entregado**. Se guarda en `r.print` (`orderedAt`, `note`,
  `readyAt`) dentro de la reserva; no requiere cambios en Supabase. Las entregas hechas antes de
  existir esta etapa cuentan como completas.
- «Deshacer último paso» también deshace estos dos pasos.

## Papelera

Todo lo que se borra en el panel (solicitudes, cargos, cupones, marcas, usuarios, imágenes y
videos) va a la **Papelera** (solo administradores): se restaura tal como estaba o se elimina para
siempre; a los 30 días se elimina sola. Tabla `trash_items` y funciones `trash_booking_request` /
`restore_booking_request` en `supabase/01_instalacion.sql`. Una solicitud restaurada no reenvía
correos (`payload.restoredAt`).

## Antelación mínima en días u horas

`rules.minNoticeUnit` = `days` (usa `minNoticeDays`) o `hours` (usa `minNoticeHours`). Lógica en
`src/lib/notice.js` y `src/lib/availability.js`; el servidor lo valida en `create_booking_request`.

## Pagos automáticos a Finanzas

Cada pago verificado en Booking entra solo en Finanzas como ingreso sin factura, con la fecha del día
en que se verificó; el cliente se crea en Finanzas sin duplicarse. Función `finanzas-sync` + webhook en
`booking_requests`. Necesita Finanzas 5.9.0 y su SQL. Instalación: `docs/FINANZAS.md`.

## Mensaje de WhatsApp «Fotos entregadas»

Al marcar una sesión como entregada se abre el mensaje «Fotos entregadas» (plantilla editable en
Personalización → marca → Mensajes de WhatsApp, variable `{enlace_galeria}`). Arriba del texto hay
un campo **Enlace de la galería** con botón **Pegar**: el enlace aparece solo en el mensaje y, al
copiarlo o abrir WhatsApp, se guarda en la reserva. Se puede reabrir con «Mensaje de entrega».
Pixieset no tiene API pública oficial, por eso el enlace se pega a mano.

## Cargos propuestos por el asistente

- En el detalle de una solicitud, el asistente pulsa **«Proponer cargo»**: elige un extra del catálogo (con cantidad) o escribe un concepto y un monto, y puede dejar una nota para el administrador.
- El cargo queda **«Por aprobar»**. Sale en el desglose de la reserva, pero **no se suma al total** ni al saldo, y el cliente no lo ve.
- El administrador lo ve en el número del menú «Solicitudes», en «Necesitan atención» del dashboard y con el filtro **Pago → «Con cargos por aprobar»**. Desde el detalle lo **aprueba** (se suma al total, al saldo y, si el extra suma tiempo, a la duración) o lo **rechaza** con un motivo opcional.
- Mientras esté pendiente, quien lo propuso puede **retirarlo**. Todo queda en el historial: quién lo propuso, quién lo aprobó o rechazó y por qué.
- Los administradores siguen añadiendo cargos directamente con «+ Agregar cargo».
- **En modo real** la base de datos tampoco deja que un asistente cambie el precio de una reserva, aunque manipule el navegador (`guard_booking_quote` en `supabase/01_instalacion.sql`).

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
