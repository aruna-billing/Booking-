# Plan de integración (fase 2)

El prototipo se organizó para que la integración cambie **solo la capa de datos**:

```
pantallas  →  services/api.js  →  store/mockDb.js   (hoy)
pantallas  →  services/api.js  →  Supabase / Edge Functions   (después)
```

Las pantallas leen con `useDb()` y escriben con funciones de `services/api.js`. Al integrar, `useDb()` se sustituye por consultas (p. ej. TanStack Query + `supabase-js`) y cada función de `api.js` conserva su firma.

## Supabase — tablas sugeridas

| Tabla | Origen en el prototipo | Notas |
| --- | --- | --- |
| `organization` | `data/organization.js` | Una fila: nombre, descripción, `logo_path`, `logo_dark_path`, `footer jsonb` (firma, texto legal, enlaces, interruptores, redes). |
| `brands` | `data/brands.js` | `web jsonb` (portada, presentación, galería con ids de `media`, tarjeta, textos, `planType` con la tipografía de los planes); `theme` como `jsonb`; `logo_path`, `logo_dark_path` en Storage; `booking_type`, `published` (el saldo vence siempre el día de la sesión: `due_date = session_date`). Borrado con `ON DELETE RESTRICT` desde `booking_requests` (mismo criterio que el panel: con historial solo se oculta). |
| `plans` | `data/catalog.js` | `brand_id`, `price` en enteros, `duration_min`, `image_path` en Storage (hoy `plan.image.src` es un data URL; `lib/images.js` es el punto donde se cambia la subida). |
| `extras` | `data/catalog.js` | `pricing` (`fixed`/`per_unit`), `max_qty`, `adds_minutes`, `applies_to uuid[]`. |
| `bank_accounts` | `data/bankAccounts.js` | Lectura pública solo de cuentas `active` de la marca. |
| `terms_versions` | `data/terms.js` | Versionado; la solicitud guarda la versión aceptada. |
| `availability_rules` | `data/availabilityRules.js` | Por marca. |
| `blocked_dates` | `mockDb.blockedDates` | |
| `booking_requests` | `demoRequests.js` | Snapshot de plan, extras y `quote` (precio al momento). |
| `payments` | `request.payments` | `amount`, `concept`, `method`, `paid_on`, `reference`, `status` (`pending`/`verified`/`rejected`/`void`), `void_reason`. Nunca se borran. Los totales de Finanzas pueden ser una vista SQL con la lógica de `lib/finance.js`. |
| `media` | `store/imageStore.js` (IndexedDB) | `id`, `kind` (`image`/`video`), `brand_id`, `path` (Storage), `poster_path`, `duration`, `alt`, `focal_x`, `focal_y`, `width`, `height`, `bytes`. Las pantallas solo usan las funciones de `imageStore.js`. |
| `booking_files` | `inspirationFiles`, `receipt` | Rutas a Storage, buckets **privados**. |
| `booking_events` | `history` | Auditoría de cambios de estado. |
| `internal_notes` | `internalNotes` | Solo admins. |

**RLS:** el público puede leer catálogo/cuentas/términos activos e **insertar** solicitudes mediante una RPC; no puede leer solicitudes. Los administradores (Supabase Auth) leen y actualizan todo.

### `createBookingRequest` → RPC / Edge Function

Debe hacer en el servidor lo que hoy simula el navegador:

1. Recalcular el precio con la lógica de `lib/pricing.js` (no confiar en el total del cliente).
2. Revalidar disponibilidad con la **duración total** (plan + minutos extra) contra reglas, bloqueos, reservas y Google Calendar. Guardar `starts_at` y `ends_at`.
3. Subir archivos a Storage con URLs firmadas, validar tipo y tamaño (`lib/validation.js → FILE_RULES`).
4. Guardar la versión de términos aceptada.
5. Protección anti-spam (Cloudflare Turnstile).

## Google Calendar

- **Lectura (free/busy):** sustituye a `simulatedBusySlots()` en `lib/availability.js`. Hacerlo en una Edge Function con cuenta de servicio o OAuth del estudio; cachear por día.
- **Escritura:** `confirmRequest()` crea el evento con la duración total en el calendario de la marca; `cancelRequest()` lo elimina. Guardar `google_event_id` en la solicitud.
- Credenciales solo en variables de entorno del servidor, nunca en el frontend.

## WhatsApp

Hoy el panel genera un **borrador de texto** para copiar. Opciones futuras: enlace `wa.me` con texto prellenado (sin API) o WhatsApp Business Cloud API con plantillas aprobadas, ejecutado desde el servidor.

## Cloudflare

- `npm run build` genera un sitio estático en `dist/` apto para **Cloudflare Pages**.
- Variables públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en la configuración de Pages; ninguna clave secreta en el cliente.
- Imágenes de planes: Supabase Storage o Cloudflare Images.
- Cuando haya backend real, proteger `/admin` con Supabase Auth (y opcionalmente Cloudflare Access).

## Orden recomendado

1. Esquema + RLS + datos semilla (desde `src/data`).
2. Lectura pública del catálogo y términos.
3. RPC de creación de solicitudes + Storage.
4. Auth y panel con datos reales.
5. Google Calendar (lectura → escritura).
6. Notificaciones (correo/WhatsApp).

## Video de portada en producción

- Subir el original a Supabase Storage (o directamente a **Cloudflare Stream**) y transcodificar en el servidor a dos versiones: 1080p para escritorio y 720p para celular, ambas sin audio, más un póster JPG.
- Servir el video con `preload="metadata"` desde un CDN, y elegir la versión según el ancho de pantalla.
- `lib/videos.js` es el punto donde hoy se valida y se genera el fotograma en el navegador. Con transcodificación en servidor solo queda la validación previa.

## Roles y permisos en producción

- **Autenticación** con Supabase Auth (correo con enlace mágico o contraseña). `lib/auth.js` es el único punto que hoy simula la sesión («Ver como»).
- **Tabla `staff`:** `user_id`, `name`, `role` (`admin` o `assistant`), `brand_ids uuid[]` (vacío = todas), `active`.
- **Permisos en el servidor:** replicar `data/roles.js` en políticas RLS. Por ejemplo, un asistente solo puede hacer `select` en `booking_requests` cuando `brand_id = any(staff.brand_ids)`, y no tiene acceso a `payments`, `bank_accounts` ni a la configuración.
- **Aceptar y rechazar** deben ser funciones RPC (`accept_session`, `reject_session`) con `security definer` que validen rol, marca y estado, como hace hoy `services/api.js`.
- **Invitaciones:** `saveUser` para un usuario nuevo debe enviar una invitación (`auth.admin.inviteUserByEmail`) desde una función del servidor, nunca desde el navegador.

## Seguimientos en producción

- **Columnas en `booking_requests`:** `confirmed_at`, `shot_at`, `delivered_at`, `gallery_url`, `delivery_note`. En `brands`: `delivery_days`. En `extras`: `express_delivery boolean`.
- **Funciones RPC** `mark_shot`, `mark_delivered` y `undo_tracking_step`, con las mismas validaciones que `services/api.js` (fecha de sesión, URL, permisos).
- **Aviso automático** (Edge Function programada cada mañana): resumen por correo o WhatsApp con las entregas que vencen hoy, las vencidas y las sesiones de ayer sin marcar.
- **Opcional:** al marcar «Entregado», enviar al cliente el enlace de la galería por correo o WhatsApp con una plantilla.
