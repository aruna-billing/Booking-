# Limitaciones del prototipo

> Este documento describe el **modo demo** (sin variables de Supabase). Para el sitio conectado a Supabase, ver `INSTALACION-SUPABASE.md` → «Límites conocidos».

- **Sin backend.** Los datos viven en `localStorage` (panel) y `sessionStorage` (borrador del cliente) de un solo navegador. Otro dispositivo no ve las mismas solicitudes.
- **Disponibilidad simulada.** Se genera con reglas por marca + una ocupación pseudoaleatoria determinista + las solicitudes del prototipo. No representa la agenda real y **no está conectada a Google Calendar**.
- **Sin pagos reales.** Solo transferencia/depósito manual simulado; no hay pago con tarjeta. Las cuentas bancarias son ficticias y el panel añade «(FICTICIA)» a cualquier cuenta nueva.
- **Archivos simulados.** Las imágenes de inspiración y el comprobante se leen solo en el navegador para mostrar una vista previa; únicamente se guardan nombre, tamaño y tipo. El panel muestra representaciones, no los archivos.
- **Sin mensajería.** No se envían correos ni WhatsApp. El panel prepara un borrador para copiar.
- **Sin autenticación.** Cualquiera con la URL puede abrir `/admin`. No publicar este prototipo con datos reales.
- **El importe declarado** en el comprobante se toma igual al anticipo requerido (no hay OCR ni campo de importe).
- **Reglas de agenda** (días, horarios, antelación) se muestran pero no se editan desde el panel.
- **Sin fotografías ni logotipos oficiales:** se usan marcadores y logotipos tipográficos provisionales.
- **Fechas demo relativas:** las solicitudes de ejemplo se regeneran cada día para que el calendario siempre tenga actividad. «Restablecer datos demo» borra los cambios locales.
- **Textos legales de ejemplo:** los términos deben ser revisados por un profesional antes de usarse.
- Las fuentes (Fraunces, Cormorant Garamond, Inter) se cargan desde Google Fonts; sin conexión se usan fuentes del sistema.
- **Finanzas** se calcula con datos ficticios en el navegador. No hay conciliación bancaria, facturas fiscales (NCF), impuestos (ITBIS) ni exportación contable.
- **Cancelaciones:** los anticipos de reservas canceladas siguen contando como recibidos (no reembolsables según los términos de ejemplo). No hay flujo de reembolso.
- **Imágenes:** las de la biblioteca (portada, galería, planes, tarjetas) se guardan en IndexedDB de este navegador; los logos, en localStorage (~5 MB). No se comparten entre dispositivos. En producción irán a Supabase Storage o Cloudflare Images.
- La biblioteca guarda una sola versión reducida (2000 px) de cada foto; no genera tamaños distintos para celular y escritorio.
- **Video de portada:** se guarda el archivo original sin recomprimir, así que un video pesado tarda en cargar. Conviene exportarlo ligero (1080p, sin audio, menos de 10 MB). No se generan versiones distintas para celular; para eso está la opción de mostrar la imagen en celulares.
- **Roles sin inicio de sesión real:** el usuario activo se elige con «Ver como». Cualquiera que abra el panel puede cambiar a Administrador. La protección real llegará con Supabase Auth y RLS.
