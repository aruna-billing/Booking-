# Conectar Google Calendar

Qué hace la conexión:

- **Reservas → Google.** Al confirmar una reserva se crea un evento en tu calendario con el nombre del cliente, el plan, su teléfono y un enlace a la solicitud en el panel. Si la reserva se cancela, el evento se borra.
- **Google → web.** Lo que tengas ocupado en ese calendario no se le ofrece al cliente. Los eventos marcados como **«Disponible»** en Google no bloquean.
- El público solo recibe las horas ocupadas. No ve títulos, nombres ni ningún otro dato de tus eventos.

Se conecta con una **cuenta de servicio** de Google, una especie de «usuario robot» con el que compartes tu calendario. No hace falta iniciar sesión con Google en la web. Tiempo: unos 15 minutos.

---

## 1. Crear la cuenta de servicio en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google.
2. Arriba, en el selector de proyectos, elige **Nuevo proyecto**. Nombre: `elian-booking` → **Crear**. Asegúrate de que quede seleccionado.
3. Menú ☰ → **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
4. Menú ☰ → **IAM y administración → Cuentas de servicio** → **Crear cuenta de servicio**.
   - Nombre: `booking-calendar` → **Crear y continuar**.
   - Los pasos de roles y accesos déjalos vacíos → **Listo**.
5. Abre la cuenta que se creó → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON → Crear**.
   Se descarga un archivo `.json`. **Guárdalo en un lugar seguro y no lo subas a GitHub:** es la llave de acceso a tu calendario.
6. Copia el correo de la cuenta de servicio. Termina en `@…iam.gserviceaccount.com` y también aparece en el archivo como `client_email`.

## 2. Compartir tu calendario con esa cuenta

1. Abre [calendar.google.com](https://calendar.google.com) → ⚙️ **Configuración**.
2. A la izquierda, en **Configuración de mis calendarios**, elige tu calendario principal (el que tiene tu nombre).
3. **Compartir con determinadas personas o grupos** → **Añadir personas**:
   - Pega el correo de la cuenta de servicio.
   - Permiso: **Hacer cambios en eventos**.
   - **Enviar**.
4. Un poco más abajo, en **Integrar el calendario**, copia el **ID de calendario**. En el principal suele ser tu Gmail.

> Si usas Google Workspace (correo de empresa) y no te deja compartir con alguien de fuera, un administrador de Workspace debe permitir compartir calendarios con usuarios externos.

## 3. Subir la función a Supabase

1. Supabase → tu proyecto → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre de la función: **`google-calendar`**, exactamente así.
3. Borra el código de ejemplo y pega **todo** el contenido de `supabase/functions/google-calendar/index.ts` → **Deploy function**.
4. Abre la función → **Details** (o *Settings*) → desactiva **Enforce JWT verification** (o *Verify JWT*) → **Save**.
   Es necesario: la web pública la usa para consultar horas ocupadas, y la función comprueba por sí misma quién puede crear eventos.

## 4. Guardar los secretos en Supabase

Supabase → **Edge Functions → Secrets** (o *Project Settings → Edge Functions*) → **Add new secret**:

| Nombre | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Abre el archivo `.json` del paso 1 con un editor de texto y pega **todo** su contenido, desde `{` hasta `}`. |
| `GOOGLE_CALENDAR_ID` | El ID de calendario del paso 2 (tu Gmail). |
| `SITE_URL` | La dirección de tu sitio, por ejemplo `https://elian-booking.pages.dev`. Sirve para el enlace al panel dentro de cada evento. |

Pulsa **Save**.

## 5. Comprobar

1. En el panel → **Calendario**. Arriba aparece la tarjeta **Google Calendar** → **Comprobar conexión**.
   Debe decir **Conectado** y el nombre de tu calendario.
2. Pulsa **Sincronizar reservas** para pasar a Google las reservas confirmadas que ya existían.
3. Prueba completa:
   - Crea en Google un evento de prueba (por ejemplo mañana de 10:00 a 11:00). En la web, como cliente, esa hora ya no debe aparecer. Puede tardar hasta 1 minuto.
   - Confirma una reserva en el panel: debe aparecer en tu Google Calendar.
   - Cancélala: el evento debe desaparecer.

## Si algo falla

| Mensaje en el panel | Qué hacer |
|---|---|
| «La función google-calendar no está desplegada» | Revisa el paso 3: el nombre debe ser exactamente `google-calendar`. |
| «Falta el secreto GOOGLE_CALENDAR_ID» o «…GOOGLE_SERVICE_ACCOUNT_JSON» | Revisa el paso 4: nombres exactos y JSON completo. |
| «no se encuentra el calendario» / «no tiene permiso» | Revisa el paso 2: compartido con el correo de la cuenta de servicio y con «Hacer cambios en eventos». |
| «Google no aceptó la cuenta de servicio» | La clave JSON no es válida o se borró. Crea una clave nueva (paso 1.5) y actualiza el secreto. |
| Aviso rojo «El cambio se guardó, pero no llegó a Google Calendar» | La reserva sí quedó guardada. Pulsa **Reintentar**, o más tarde **Sincronizar reservas** en Calendario. |

## Límites

- **Quién ve el evento:** lleva nombre, plan y teléfono del cliente; quien tenga acceso a tu calendario lo verá. El correo y las notas del cliente quedan solo en el panel.
- **Un minuto de margen:** la web consulta Google al abrir el paso de fecha y guarda la respuesta 1 minuto. Si alguien crea un evento en Google justo mientras un cliente está reservando esa hora, la reserva puede entrar igual. Al revisarla en el panel lo verás.
- **Cambios en Google:** si mueves o borras en Google el evento de una reserva, la reserva del panel **no** cambia. Los cambios de reservas se hacen en el panel.
- **Todas las marcas** usan el mismo calendario.
