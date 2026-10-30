# Correos automáticos al cliente

El sistema envía dos correos al cliente:

| Correo | Cuándo se envía |
|---|---|
| **Reserva en revisión** | En cuanto el cliente envía su solicitud con el comprobante. |
| **Reserva confirmada** | Cuando el equipo acepta la sesión o verifica el pago y confirma. |

Los textos se editan en el panel → **Personalización → Correos al cliente**. Cada correo se puede apagar, y los datos (nombre, plan, fecha, hora, montos…) se rellenan solos.

Funcionamiento: Supabase avisa a la función `booking-emails` cada vez que se crea o cambia una reserva, y la función envía el correo con **Resend**. No depende del navegador del cliente: si el envío falla, la reserva se guarda igual.

Tiempo aproximado: 20 minutos (más la espera de verificación del dominio).

---

## 1. Crear la cuenta de Resend y verificar el dominio

1. Entra a [resend.com](https://resend.com) y crea una cuenta. El plan gratis permite 3,000 correos al mes (100 por día).
2. **Domains → Add Domain** → escribe tu dominio (ej.: `tudominio.com`) → región **US East**.
3. Resend te muestra varios registros DNS (**MX** y **TXT**). Como el dominio está en Cloudflare:
   - Cloudflare → tu dominio → **DNS → Records → Add record**.
   - Copia cada registro tal cual: tipo, nombre y valor. En el registro MX pon también la prioridad que indique Resend.
   - Si Cloudflare muestra la nube naranja, ponla en gris («DNS only»).
4. Vuelve a Resend y pulsa **Verify DNS Records**. Puede tardar unos minutos. Cuando diga **Verified**, sigue.

> Estos registros no tocan el correo que ya uses con el dominio: Resend usa un subdominio propio (`send.`) para el envío.

## 2. Crear la clave de Resend

**API Keys → Create API Key** → nombre `booking`, permiso **Sending access** y tu dominio → **Add**. Copia la clave (empieza por `re_`): solo se muestra una vez.

## 3. Subir la función a Supabase

1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Nombre: **`booking-emails`**, exactamente así.
3. Borra el código de ejemplo, pega **todo** el contenido de `supabase/functions/booking-emails/index.ts` y pulsa **Deploy function**.
4. Abre la función → **Details** → desactiva **Enforce JWT verification** → **Save**.

## 4. Guardar los secretos

Supabase → **Edge Functions → Secrets** → **Add new secret**:

| Nombre | Valor |
|---|---|
| `RESEND_API_KEY` | La clave de Resend del paso 2 (`re_…`). |
| `EMAIL_FROM` | La dirección que envía, de tu dominio verificado. Ej.: `reservas@tudominio.com` |
| `WEBHOOK_SECRET` | Una contraseña larga inventada (30 caracteres o más, sin espacios). La usarás también en el paso 5. |
| `SB_PUBLISHABLE_KEY` | Tu clave *publishable* (la misma de `VITE_SUPABASE_PUBLISHABLE_KEY` en el `.env`). |

El nombre que ve el cliente es el de la marca. Si responde al correo, la respuesta va al correo de la marca (panel → Marcas → Correo), si está puesto.

## 5. Conectar la base de datos con la función (webhook)

1. Supabase → **Database → Webhooks**. Si aparece **Enable Hooks**, actívalo.
2. **Create a new hook**:
   - **Name:** `booking_emails`
   - **Table:** `booking_requests`
   - **Events:** marca **Insert** y **Update**
   - **Type:** **Supabase Edge Functions** → función **booking-emails**, método **POST**
   - **HTTP Headers → Add a new header:** nombre `x-webhook-secret`, valor = el mismo `WEBHOOK_SECRET` del paso 4
3. **Create webhook**.

## 6. Probar

1. Panel → **Personalización** → tu marca → **Correos al cliente**: revisa los textos y pulsa **Guardar**.
2. En la misma tarjeta, escribe tu correo y pulsa **Enviar prueba**. Debe llegarte un correo con «[Prueba]» en el asunto.
3. Prueba real: haz una reserva en la web con tu correo. Debe llegarte **Reserva en revisión**. Confírmala en el panel y debe llegarte **Reserva confirmada**. Luego cancélala.

## Si no llega

| Qué pasa | Qué revisar |
|---|---|
| «La función booking-emails no está desplegada» | Paso 3: el nombre debe ser exactamente `booking-emails`. |
| «Faltan los secretos RESEND_API_KEY o EMAIL_FROM» | Paso 4. |
| «Resend no envió el correo: … domain is not verified» | Paso 1: el dominio debe estar verificado y `EMAIL_FROM` debe ser de ese dominio. |
| «No se pudo leer la configuración del sitio» | Paso 4: `SB_PUBLISHABLE_KEY`. |
| La prueba llega pero los de reservas no | Paso 5: el webhook (tabla, eventos Insert y Update, y la cabecera `x-webhook-secret` igual al secreto). Mira **Edge Functions → booking-emails → Logs**: un error 401 significa que el secreto no coincide. |
| Llega a spam | Normal los primeros días. Ayuda añadir en Cloudflare el registro **DMARC** que sugiere Resend y pedir a los primeros clientes que lo marquen como «No es spam». |

En **Resend → Emails** ves cada correo enviado y si fue entregado.

## Límites

- **Correo mal escrito:** si el cliente escribe mal su correo, no le llega. Por eso los textos dicen que también lo contactarán por WhatsApp.
- **Volver a confirmar:** si una reserva se reabre y se vuelve a confirmar, el cliente recibe otra vez el correo de confirmada.
- **Rechazos:** al rechazar una sesión no se envía correo. Se avisa por WhatsApp desde el panel.
- **Plan gratis de Resend:** hasta 100 correos por día y 3,000 al mes.
