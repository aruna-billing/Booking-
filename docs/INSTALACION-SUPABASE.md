# Poner en marcha el sistema de reservas con Supabase

Tiempo aproximado: 20 minutos. Necesitas un proyecto de Supabase propio (supabase.com → New project).

## 1. Crear la base de datos (una sola vez)

1. Entra a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor** → **New query**.
2. Abre el archivo `supabase/01_instalacion.sql`, copia **todo** su contenido, pégalo y pulsa **Run**.
   Debe terminar con «Success». Si lo vuelves a ejecutar no pasa nada: no borra datos.

## 2. Crear tu usuario administrador

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
   Escribe tu correo y una contraseña segura, y marca **Auto Confirm User**.
2. Abre `supabase/02_primer_administrador.sql`, cambia `tu-correo@ejemplo.com` por ese correo y `Tu nombre` por tu nombre.
3. Pégalo en el **SQL Editor** y pulsa **Run**. Debe mostrar una fila con `role = admin`.

## 3. Publicar el sitio

El proyecto es un sitio estático (Vite). Sirve cualquier hosting: Cloudflare Pages, Netlify o Vercel.

| Opción | Valor |
|---|---|
| Comando de build | `npm run build` |
| Carpeta de salida | `dist` |
| Versión de Node | 20 o superior |

**Variables de entorno.** El archivo `.env` debe llevar los datos de tu proyecto (Project Settings → API), y el build los usa si lo subes junto con el código. Si tu hosting no lo recibe, añádelas en su panel (en Cloudflare Pages: *Settings → Environment variables*) y vuelve a publicar:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

La clave *publishable* es pública por diseño: va dentro de la web y cualquiera puede verla. Lo que protege los datos son las reglas (RLS) del paso 1. **Nunca** pongas en el proyecto la clave *secret* ni la *service_role*.

## 4. Configuración inicial

1. Abre tu sitio y entra a **Acceso del equipo** (pie de página) o a `tu-sitio/#/admin`.
2. Inicia sesión con el usuario del paso 2.
3. Verás **Configuración inicial**. Pulsa **Crear configuración inicial**: crea la marca Elian López Photo, sus planes, extras de ejemplo, el horario y los términos.
4. Antes de recibir reservas:
   - **Cuentas bancarias**: añade las cuentas reales. Sin al menos una cuenta activa, el cliente no ve dónde pagar.
   - **Marcas**: WhatsApp, correo, anticipo, plazo de entrega y logos.
   - **Planes y extras**: confirma precios y extras. Los extras vienen de ejemplo.
   - **Términos**: reemplaza el texto de ejemplo por el oficial.
   - **Calendario**: días y horario de trabajo, pausas y días bloqueados.
   - **Personalización**: fotos de portada, galería e imágenes de los planes.

## 5. Añadir al equipo (asistentes u otros administradores)

1. Supabase → **Authentication → Users → Add user**, con el correo y una contraseña para esa persona (marca *Auto Confirm User*).
2. En el panel → **Usuarios y roles** → **Añadir usuario**, con el **mismo correo**, y elige el rol.
   - **Administrador**: todo el panel.
   - **Asistente**: ve solicitudes, comprobantes y seguimientos; acepta o rechaza sesiones; marca fotos realizadas y entregas. Puede limitarse a algunas marcas.
3. **Cambiar una contraseña.** El sitio no tiene «¿Olvidaste tu contraseña?». Hay que borrar al usuario en Supabase → Authentication → Users y crearlo de nuevo con otra contraseña. Después se vuelve a añadir en **Usuarios y roles**. Supabase no deja borrar al único administrador activo.

## Al actualizar a una versión nueva

Cuando subas una versión nueva del proyecto, vuelve a ejecutar **`supabase/01_instalacion.sql`** completo en el SQL Editor. No borra datos y añade lo nuevo (por ejemplo, la comprobación de cupones). Si usas Google Calendar, actualiza también la función `google-calendar` con el `index.ts` nuevo.

## Cupones de descuento

En el panel → **Cupones**:
- **Tipo de descuento:** porcentaje o monto fijo. Se aplica al total (plan + extras) y el anticipo se calcula ya con el descuento.
- **Fechas:** desde y hasta qué fecha se puede usar. Cuenta el día en que el cliente envía la reserva.
- **Usos:** cuántas reservas pueden usarlo en total y, si quieres, solo una vez por cliente (por correo). Si una reserva con cupón se cancela, ese uso se libera.
- **Borrar:** un cupón que ya se usó no se puede borrar, solo desactivar, para no perder el historial.
- **Mostrar el campo:** el interruptor de arriba muestra u oculta «¿Tienes un cupón?» en la web.

**Seguridad:** la lista de cupones está en la configuración privada; el público nunca la ve. El navegador solo pregunta por un código concreto (`check_coupon`), con una pequeña espera para frenar a quien intente adivinar códigos. Al enviar la reserva, el servidor vuelve a comprobar el cupón y calcula el descuento él mismo.

## Qué hace el servidor (y por qué es seguro)

- **El público** solo puede leer la configuración publicada. No puede leer las solicitudes de otros clientes.
- **Al reservar**, la función `create_booking_request`:
  - Recalcula el precio, el anticipo y la duración con el catálogo publicado e ignora cualquier precio que mande el navegador.
  - Vuelve a comprobar que el día, la hora, las pausas y el margen entre sesiones estén libres. Tiene un bloqueo para que dos personas no reserven el mismo hueco a la vez.
  - Exige que el comprobante esté subido.
- **Los comprobantes e imágenes de inspiración** van a un almacenamiento privado (bucket `receipts`). El cliente puede subirlos pero no verlos ni borrarlos; solo el equipo los abre, con enlaces temporales de 5 minutos.
- **El calendario público** solo recibe fecha, hora y duración de los horarios ocupados, sin nombres ni datos personales.
- **Los asistentes** no pueden cambiar la configuración, las cuentas ni el equipo: lo impide la base de datos, no solo la pantalla.
- **Siempre queda al menos un administrador activo.**

## Límites conocidos

- **Avisos:** el cliente recibe correos automáticos si se configura [`CORREOS.md`](CORREOS.md). El equipo no recibe correo de las reservas nuevas: el panel se actualiza solo (tiempo real, y si falla, cada 2 minutos y al volver a la pestaña), pero alguien debe revisarlo. WhatsApp no está conectado.
- **Google Calendar:** es opcional y se conecta con [`GOOGLE-CALENDAR.md`](GOOGLE-CALENDAR.md). Sin él, la agenda que ve el cliente sale solo de las reservas activas y los días bloqueados en el panel.
- **Archivos sin uso:** si un cliente sube un comprobante y no termina la reserva, el archivo queda en `receipts/incoming/` sin solicitud. Puedes borrarlos de vez en cuando desde Storage.
- **Configuración compartida:** si dos administradores editan la configuración a la vez, se guarda el último cambio.
- **Permisos de asistente:** la base de datos impide que un asistente cambie la configuración. Dentro de una solicitud de sus marcas, en cambio, la pantalla limita lo que puede hacer, pero la base de datos le deja editarla completa.
- **Sin límite de solicitudes:** no hay límite de solicitudes por persona; si recibes spam, se puede añadir un captcha.
- **Pruebas:** este proyecto se probó con una base Postgres local que imita Supabase, no con tu proyecto real. Después de publicar, haz una reserva de prueba completa y cancélala desde el panel.
