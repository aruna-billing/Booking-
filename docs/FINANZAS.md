# Pasar los pagos de Booking a Finanzas (automático)

Cada pago que se **verifica** en Booking aparece solo en Finanzas como **ingreso**, con la fecha del día en que se verificó:

| En Booking | En Finanzas |
| --- | --- |
| Hoy se acepta la sesión y se verifica el anticipo de RD$ 500 | Ingreso de RD$ 500 con fecha de hoy |
| Otro día se registra el saldo de RD$ 500 como recibido | Ingreso de RD$ 500 con fecha de ese día |
| Se paga un cargo extra aprobado | Ingreso por ese monto el día que se registra |
| Se anula o rechaza un pago que ya estaba verificado | Ese ingreso se quita de Finanzas |

- **Sin facturas.** Los ingresos salen en **Ingresos**, el **Dashboard**, el perfil del cliente y **Bancos**, marcados «sin factura» y con categoría **Booking**. En Facturas no aparece nada.
- **Cliente.** Se crea en **Clientes** de Finanzas la primera vez que paga. Si ya existe (mismo teléfono o correo), se usa el mismo, así que no se duplica.
- **Marca y dueño.** Todo va a la marca y a la cuenta de Finanzas que pongas en los secretos. A ninguna otra cuenta del mismo Finanzas le cae nada.
- **Cuenta de banco.** No se asigna. Se asigna en Finanzas → Bancos, como siempre.
- **Cambios en Finanzas.** Lo que cambies después (fecha, monto, método, cuenta) se respeta: cada pago entra una sola vez.
- **Pagos anteriores.** Solo pasan los pagos que se verifiquen **después** de instalar esto.

Se instala una sola vez, en dos partes: primero en Finanzas y después en Booking.

## 1. En Finanzas (una vez)

1. Sube a tu hosting la versión **5.9.0** del archivo de Finanzas (`index-…-v5.9.0.html`) en lugar de la 5.8.2.
2. Supabase **de Finanzas** → **SQL Editor → New query** → pega todo `FINANZAS-booking.sql` → **Run**. Al final deben salir 7 columnas. No borra datos.
3. Supabase de Finanzas → **Project Settings → API Keys** → copia la **Secret key** (empieza por `sb_secret_`). Si no tienes una, **Create new secret key**. Copia también la **URL** del proyecto (Project Settings → Data API → Project URL).

## 2. En Booking (una vez)

1. Supabase **de Booking** → **Edge Functions → Deploy a new function → Via Editor**:
   - Nombre: **`finanzas-sync`** (así, en minúsculas).
   - Pega todo `supabase/functions/finanzas-sync/index.ts` → **Deploy function**.
   - Abre la función → **Details** → desactiva **Enforce JWT verification** → **Save**.
2. Supabase de Booking → **Edge Functions → Secrets → Add new secret**:

   | Nombre | Valor |
   | --- | --- |
   | `FINANZAS_URL` | la URL del proyecto de Finanzas (`https://….supabase.co`) |
   | `FINANZAS_SECRET_KEY` | la Secret key de Finanzas (`sb_secret_…`) |
   | `FINANZAS_EMAIL` | el correo con el que entras a Finanzas (el dueño de los registros) |
   | `FINANZAS_MARCA` | el nombre de la marca en Finanzas, tal cual se ve (por ejemplo `Aruna Visuals Studio`) |

   `WEBHOOK_SECRET` ya lo tienes de los correos; la función usa el mismo.

   **La Secret key de Finanzas solo va aquí**, en los secretos de Supabase: nunca en GitHub, en el `.env` ni en el código.

3. Supabase de Booking → **Integrations → Database Webhooks → Create a new hook**:
   - **Name:** `finanzas_sync`
   - **Table:** `booking_requests`
   - **Events:** **Insert** y **Update**
   - **Type:** **Supabase Edge Functions** → función **finanzas-sync**, método **POST**
   - **Timeout:** **5000** ms
   - **HTTP Headers → Add a new header:** `x-webhook-secret` = tu `WEBHOOK_SECRET`

## 3. Probar

Verifica un pago en Booking (o acepta una sesión con su comprobante). En unos segundos debe aparecer en Finanzas → **Ingresos** como «Reserva Booking · Plan · Anticipo · sin factura», y el cliente en **Clientes**.

## Si no aparece

Supabase de Booking → **Edge Functions → finanzas-sync → Logs**. El mensaje dice qué falta:

- **«No existe en Finanzas la marca …»:** revisa `FINANZAS_MARCA`. El mensaje lista las marcas que sí existen en esa cuenta.
- **«No existe en Finanzas una cuenta con el correo…»:** revisa `FINANZAS_EMAIL`.
- **«Faltan secretos…»:** falta alguno de los cuatro.
- **Error 401 o «Invalid API key»:** la `FINANZAS_SECRET_KEY` no es la Secret key de Finanzas.
- **Error de columnas (`brand`, `source_ref`…):** falta ejecutar `FINANZAS-booking.sql` en Finanzas.
- **Sin ninguna línea en Logs:** revisa el webhook (paso 2.3): tabla `booking_requests`, eventos Insert y Update y la cabecera.
