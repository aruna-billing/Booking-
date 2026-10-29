# Morel Media Group · Booking

Esta copia parte del prototipo de reservas (versión 2) y añade **Seguimientos**. Las decisiones generales siguen abajo; la sección nueva está al final.

# Decisiones visuales y de experiencia

## Dirección general

Editorial y sobria: mucho aire, tipografía de títulos con carácter, líneas finas y pocos colores. La fotografía debe ser la protagonista; la interfaz se retira.

- **Paleta base:** marfil (`#F6F2EA`), negro cálido (`#161513`) y dorado suave (`#B08D57`).
- **El dorado es decorativo, no textual.** Su contraste sobre marfil es bajo (≈2,9:1), así que se usa en filetes, indicadores de paso, viñetas y sellos. Todo texto y todo botón principal usan negro/marfil (contraste > 15:1).
- **Botón principal negro** en ambas marcas: es la acción más reconocible y legible.
- **Estados con color + texto + punto**, nunca solo color. Tonos verde/ámbar/rojo con contraste AA sobre su fondo.

## Identidad por marca

Cada marca define sus tokens en `src/data/brands.js` y `brandStyle()` los aplica como variables CSS. Ningún componente tiene colores de marca escritos a mano.

| | Aruna Visuals | Elian López Photo |
|---|---|---|
| Tono | Cálido, cercano | Editorial, nocturno, sofisticado |
| Títulos | Fraunces, redonda | Cormorant Garamond, cursiva |
| Cabecera | Arena clara | Negro casi puro |
| Moneda / anticipo | RD$ · 50 % | US$ · 30 % |
| Agenda | Varias sesiones al día | Una boda por día, 30 días de antelación |

El panel administrativo usa un tema neutro común y distingue cada marca con un punto de color (relleno = color de cabecera de la marca).

## Imágenes y logotipos

No se incluyeron fotografías: no hay material propio y usar fotos de terceros sería engañoso. Cada plan muestra un **marcador abstracto** con la leyenda «Imagen de muestra». Los logotipos son **tipográficos provisionales** (`BrandMark.jsx`). Ambos están aislados en un solo componente para sustituirlos fácilmente.

## Móvil primero

- La **barra inferior fija** muestra siempre el total (o el importe a transferir en el pago) junto a Atrás / Continuar: el cliente nunca pierde de vista el precio.
- En móvil el indicador de pasos se reduce a «Paso 2 de 6 · Extras» + barra de progreso; en escritorio muestra las seis etapas, y las completadas son enlaces.
- El resumen de la reserva va en columna lateral fija en escritorio y bajo el contenido en móvil.
- Campos de 46 px de alto y texto de 16 px (evita el zoom automático de iOS); objetivos táctiles ≥ 40 px.
- Los modales se convierten en hoja inferior en pantallas pequeñas.

## Flujo y reglas

- **Extras opcionales** pero visibles: el botón cambia a «Continuar sin extras» si no se eligió ninguno.
- Un extra puede limitarse a ciertos planes (p. ej. «Persona adicional» solo para Sesión Familiar). Si el cliente cambia de plan, los extras no aplicables se ignoran en el cálculo automáticamente.
- **Fecha solicitada ≠ fecha reservada.** El texto lo dice en el paso 3 y en los términos; la fecha solo se reserva cuando el equipo verifica el anticipo.
- **Pago:** el importe a transferir es lo más grande de la pantalla. Las cuentas llevan «(FICTICIA)» en el número y un aviso «Demo» encima.
- El comprobante y la casilla «Ya hice mi pago» son obligatorios: sin comprobante no hay nada que revisar.
- Tras enviar, los pasos anteriores redirigen a la pantalla de agradecimiento para evitar envíos duplicados.

## Estados (separados)

- **Solicitud:** En revisión · Esperando pago · Confirmada · Completada · Cancelada.
- **Pago:** Sin comprobante · Por verificar · Verificado · Rechazado.

Regla del prototipo: verificar el pago de una solicitud en revisión la confirma; rechazar un comprobante exige motivo y pasa la solicitud a «Esperando pago». Una solicitud no puede confirmarse sin pago verificado.

## Accesibilidad

- Etiquetas reales en todos los campos, `aria-invalid` y `aria-describedby` hacia el error y la ayuda.
- Al enviar con errores aparece un **resumen enfocable** con enlaces a cada campo.
- Modal con `role="dialog"`, `aria-modal`, título asociado, trampa de foco, cierre con Escape y devolución del foco.
- Calendario navegable con flechas; cada día anuncia su estado («martes 4 de noviembre. Disponible»).
- Enlace «Saltar al contenido», foco al contenido principal al cambiar de paso, `prefers-reduced-motion` respetado.

## Versión 2 (inspirada en una página de reservas de referencia)

- **Paso 1 como página de estudio:** portada a lo ancho, frase y presentación centradas con botón «Reserva una cita», franja de galería deslizable y sección «Reserva tu cita». La página primero presenta el estudio y después vende los planes.
- **Tarjetas horizontales:** imagen a la izquierda e información a la derecha (nombre, descripción, lista «Incluye», línea, duración, precio, «Reservar ahora»). En móvil se apilan. Todo el detalle del plan se ve directamente en la tarjeta, sin botón «Detalles aquí».
- **Franjas negras** para el encabezado (logotipo y menú) y el pie (redes, aviso legal, términos). El indicador de pasos pasa a una franja clara debajo.
- **Titulares en Archivo 800, mayúsculas.** Los nombres de plan siguen en la tipografía de cada marca, para conservar el contraste entre lo publicitario y lo editorial.
- **Acento dorado en vez del rojo** de la referencia, para respetar la paleta marfil/negro/dorado del encargo.
- **Bordes rectos** (sin radio) en botones y tarjetas, como en la referencia.
- No se copiaron textos, imágenes ni logotipos de la referencia: los textos son originales y las imágenes siguen siendo marcadores.

## Duración de la sesión y minutos extra

- Cada plan tiene su duración (Aruna Visuals: Retrato Esencial 30 min, Graduación 45 min, Sesión Familiar 1 h, Retrato Editorial 1 h 30 min).
- Un extra puede **sumar minutos** (`addsMinutes`, por unidad). «30 minutos adicionales de sesión» suma 30 min por cada unidad; en Elian López Photo, «Hora adicional de cobertura» suma 60 min.
- La duración total se muestra en una franja negra al inicio del paso de extras («1 h del plan + 30 min adicionales») y en el resumen.
- **El calendario usa la duración total:** solo ofrece inicios donde la sesión completa cabe antes del cierre (18:00), no cruza la pausa de almuerzo (13:00–14:00) y no se solapa con otra reserva, dejando 15 min de margen. Cada horario indica hasta qué hora dura.
- Si el cliente cambia los minutos extra después de elegir horario, el horario se borra y se le avisa para que lo elija de nuevo. El servidor simulado vuelve a comprobar el horario con la duración total al enviar.
- Las bodas siguen con un evento por día: la duración se informa pero no limita el horario de inicio.
- En el panel se ve el horario de inicio y fin y el desglose de la duración; los extras pueden configurarse con los minutos que suman.

## Finanzas y pagos

- **Sección «Finanzas»** en el panel, con su propio resumen y selector de periodo (este mes, 3 meses, año, todo).
- **Cada moneda va por separado** (RD$ para Aruna Visuals, US$ para Elian López Photo). Nunca se suman monedas distintas.
- **Cinco cifras, con definiciones visibles en la pantalla:**
  - *Facturado:* reservas confirmadas o completadas con sesión en el periodo.
  - *Recibido:* pagos verificados con fecha en el periodo.
  - *Falta por cobrar:* saldo de esas reservas, con lo vencido destacado.
  - *Por verificar:* pagos reportados que aún no se revisan.
  - *Por confirmar:* solicitudes que todavía no se facturan.
- **Vencimiento del saldo:** el pago total vence **el día de la sesión** (o del evento, en bodas), para todas las marcas. Coincide con los términos.
- **Gráfico mensual** (6 meses) de facturado contra recibido: un solo eje y la misma unidad. Los colores azul y ocre pasaron el validador de daltonismo (ΔE 24). Tiene leyenda, detalle al pasar el cursor y vista de tabla.
- **Lista de saldos pendientes** ordenada por vencimiento, con «Agregar pago» en cada fila. También muestra los últimos pagos.

### Agregar pago

- Está en el detalle de cada solicitud, en la barra de acciones y en la tarjeta «Cobros y pagos», y en la tabla de Finanzas.
- **Campos:** monto, concepto (anticipo, abono, saldo final u otro), método, fecha, referencia y nota.
- **Montos rápidos:** «Anticipo» y «Todo el saldo».
- **Validaciones:** el monto no puede superar lo que falta, ni la fecha puede ser futura.
- La casilla «Ya confirmé que el dinero está en la cuenta» decide si el pago cuenta como recibido o queda «por verificar».
- Un pago no se borra: se **anula** con motivo y queda en el historial.
- **Estado de cobro de cada reserva:** sin pagos, anticipo pagado, pago parcial o pagado completo. Se muestra con una barra que marca dónde llega el anticipo.
- El comprobante que sube el cliente crea un pago «por verificar». Al verificarlo o rechazarlo desde Comprobantes, el pago cambia igual.

## Logos, marca matriz e imágenes de planes

- **Configuración de marcas sin ejemplos:** se quitaron las vistas previas con «Plan de ejemplo». Cada marca muestra solo su formulario; los logos se previsualizan en sus propios recuadros.
- **Marca matriz (Aruna One):** se configura en «Configuración de marcas» con nombre, descripción corta, logo para fondos claros y logo opcional para fondos oscuros. Aparece en:
  - la portada de selección de marca;
  - la barra lateral del panel;
  - el título de la pestaña del panel;
  - el icono del navegador (favicon);
  - el pie de cada marca («Una marca de …»), que se puede desactivar.
- **Logo de cada marca:** mismas dos variantes. Sustituye al logotipo tipográfico en la cabecera, el pie y las vistas previas. Si solo hay versión para fondos claros, sobre la franja negra se muestra sobre una placa blanca para que siempre se lea.
- **Imagen de cada plan:** se sube desde el ordenador al editar el plan (JPG, PNG o WebP, hasta 10 MB) y se ve en la tarjeta pública y en el catálogo. Se reduce a 1600 px de lado mayor. «Quitar» vuelve al marcador.
- **Formatos de logo:** PNG, SVG, WebP o JPG. Los PNG y WebP conservan la transparencia y se reducen a 800 px. Los SVG se guardan tal cual (máx. 300 KB) y se muestran con `<img>`, que no ejecuta scripts.
- Se puede arrastrar el archivo al recuadro o usar el botón. Los formatos no permitidos y los archivos demasiado grandes muestran un error claro.

## Pie de página configurable (marca matriz)

Se configura dentro de la tarjeta «Marca matriz» y se aplica a la portada y a la web de cada marca. Tiene vista previa en vivo y un selector para verla como la portada o como cualquiera de las marcas.

- **Firma:** se puede activar o desactivar y su texto es editable («Una marca de» + logo de la marca matriz).
- **Texto legal** con marcadores: `{año}` se cambia por el año actual y `{marca}` por el nombre de la marca donde se muestra. Así cada web dice «© 2026 Aruna Visuals…» o «© 2026 Elian López Photo…».
- **Enlaces propios:** hasta 6. Solo se aceptan direcciones `https://…` o `mailto:…`, y el botón Guardar se desactiva mientras haya un enlace mal escrito. Los enlaces externos abren en otra pestaña.
- **Interruptores:**
  - Instagram y WhatsApp de cada marca.
  - Enlace a los términos.
  - Enlace al panel administrativo, que conviene desactivar al publicar.
- **Redes de la marca matriz** (Instagram, Facebook, TikTok, correo y sitio web), que se muestran en la portada.
- La línea «Prototipo · datos de demostración» no es configurable, para que el prototipo nunca se presente como sitio real.

## Añadir y eliminar marcas

- **«+ Añadir marca»** está en Configuración de marcas. Se piden nombre, tipo de agenda (sesiones con horario o un evento por día), moneda, anticipo y una marca existente de la que copiar colores y tipografía.
- **La marca nueva nace oculta.** Al crearla se generan sus reglas de agenda y unos términos de partida. Luego se completa en su tarjeta (Instagram, logos, colores) y en Personalización (textos e imágenes).
- **Publicar** solo se activa cuando hay al menos un plan activo y una cuenta bancaria activa; la tarjeta dice qué falta y enlaza a cada pantalla. «Ocultar de la portada» la retira sin borrar nada. Una marca oculta sigue abriéndose por su enlace, con un aviso de vista previa.
- **Eliminar marca:**
  - Hay que escribir el nombre de la marca para confirmar.
  - Borra la marca con sus planes, extras, cuentas, términos, reglas y bloqueos.
  - Si tiene solicitudes o pagos, no se puede eliminar, porque se perdería el historial y descuadraría Finanzas; el diálogo ofrece ocultarla en su lugar.
  - Siempre debe quedar al menos una marca.
- **Tipo de marca como dato, no como nombre.** El comportamiento que antes dependía de que la marca fuera «Elian López Photo» ahora sale de su dato `bookingType` (sesión o evento). Así cualquier marca nueva funciona igual.
- Las marcas nuevas sin logo muestran su nombre en su tipografía de títulos.

## Personalización de la web (sección propia del panel)

Separa dos cosas: **Marcas** guarda la identidad y el negocio (nombre, moneda, anticipo, colores, logos, publicación) y **Personalización** guarda lo que se ve en la web (textos, imágenes, secciones).

**Pestañas:**
- **Portada general:** título y texto de la página donde se elige estudio, y si se muestra la descripción de la marca matriz.
- **Una pestaña por marca**, con las secciones en el mismo orden en que aparecen en la web:
  1. Portada: imagen, altura (baja, normal o alta) y opción de ocultarla.
  2. Presentación: lema, texto y botón; se puede ocultar.
  3. Galería: hasta 8 fotos. Se reordenan arrastrando o con flechas (accesible por teclado), cada una con su etiqueta; se puede ocultar.
  4. Sección de planes: texto superior, titular e imagen de cada plan.
  5. Tarjeta en la portada general: imagen y descripción.
  6. Textos del recorrido: introducción de extras y del formulario, ayuda de notas, instrucciones de pago y mensaje final. Si un campo queda vacío se usa el texto predeterminado (se ve en gris) y «Restaurar» lo devuelve.
- **Biblioteca de imágenes:**
  - Subida múltiple (o arrastrando), búsqueda y filtro por marca.
  - Cada imagen avisa si le falta descripción.
  - En el detalle se edita el texto alternativo y la marca, y se marca el **punto de enfoque** haciendo clic (o con las flechas del teclado), con vista de cómo queda recortada en 21:9, 4:5 y 1:1.
  - Muestra dónde se usa cada foto. Al borrarla avisa y esos espacios vuelven al marcador.

**Funcionamiento:**
- **Guardar:** barra fija abajo con «Cambios sin guardar · Descartar · Guardar». Si cambias de pestaña con cambios pendientes, pide confirmación.
- **Elegir imagen:** cualquier espacio abre el selector de la biblioteca, que permite subir una foto en el momento (si se sube una sola, queda elegida). Por defecto muestra las fotos de esa marca y las que no tienen marca.
- **Texto alternativo:** si la foto tiene descripción, se usa como texto alternativo en la web; si no, el nombre de la sección o del plan.
- **Almacenamiento:** las imágenes pasaron de localStorage (~5 MB) a **IndexedDB** (cientos de MB), en una biblioteca aparte que el resto de la app referencia por id. Así una galería completa por marca cabe sin problema. «Restablecer datos demo» también vacía la biblioteca.

## Video en la portada

En Personalización, en la pestaña de cada marca, la sección «1 · Portada» permite elegir **Imagen** o **Video**.

- **Video:** MP4 (H.264) o WebM, hasta 50 MB y 60 segundos.
  - Se rechazan los formatos que no se pueden reproducir, los videos más largos y las imágenes subidas en el espacio de video.
  - Se reproduce **sin sonido, en bucle y a todo el ancho**. Recomendado: horizontal 1920×1080, de 10 a 20 s, exportado sin audio.
- **Fotograma automático:** al subir el video se toma uno de sus fotogramas (al 10 % de la duración, para evitar el primer cuadro negro). Se usa como miniatura y como imagen de espera.
- **Imagen de respaldo (opcional):** si se elige, sustituye al fotograma. Se ve mientras el video carga y en los casos siguientes.
- **Accesibilidad:**
  - Hay un botón para **pausar o reproducir** sobre el video, porque un contenido en movimiento de más de 5 segundos debe poder detenerse.
  - Con «reducir movimiento» activado en el dispositivo, el video **no arranca solo** y se ofrece el botón de reproducir.
  - La descripción del video se usa como su etiqueta accesible.
- **Ahorro de datos:** la opción «En celulares, mostrar la imagen en lugar del video» hace que en pantallas de 640 px o menos se muestre la imagen. En ese caso el video ni siquiera se descarga.
- **En la biblioteca** los videos conviven con las imágenes:
  - Hay un filtro por tipo, y cada video muestra su fotograma con la duración.
  - El detalle incluye un reproductor de vista previa.
  - Se puede marcar el punto de enfoque, que define qué parte se conserva al recortar.
  - Se ve dónde se usa cada video. Si se borra uno en uso, la portada pasa a la imagen de respaldo.
- **Almacenamiento:** los videos se guardan como archivo binario en IndexedDB (no como texto, que ocuparía un 33 % más).

## Corrección: el total vence el día de la sesión

- **Regla única para todas las marcas:** el pago total vence el día de la sesión o del evento. Se eliminó la regla de «15 días antes» de las bodas y el campo para configurarla. La tarjeta de la marca muestra la regla como dato fijo.
- **Dónde se aplica:**
  - Detalle de la solicitud: «El saldo vence el … (día de la sesión)».
  - Finanzas: columna «Vence» y cálculo de lo vencido.
  - Paso de pago: «saldo de … a pagar el día de la sesión».
  - Resumen de la reserva: «Saldo · se paga el día de la sesión».
  - Términos de ambas marcas.
- Los datos guardados con la regla anterior se interpretan con la nueva sin migración.

## Tipografía de los planes

Está en Personalización, en la pestaña de cada marca, sección «4 · Sección de planes». Tiene vista previa en vivo con un plan real de la marca.

- **Nombre del plan:** fuente, grosor (regular a negrita), tamaño (pequeño, normal o grande) y estilo (normal o cursiva).
- **Texto, lista y precio:** fuente.
- **Titular de la sección** («Reserva tu cita»): fuente y opción de mayúsculas.
- **«Como la marca»** es el valor por defecto. Usa la tipografía de títulos definida en Marcas, así que nada cambia hasta que se elige otra. «Restaurar tipografía de la marca» vuelve a ese estado.
- **Catálogo de fuentes:** 13 de Google Fonts, entre serif editoriales y sans. Solo se descarga la fuente que se usa; en el panel se cargan todas para la vista previa.
  - Si una fuente no tiene cierto grosor, se usa el más cercano disponible (p. ej. DM Serif Display solo tiene regular).
  - La opción de cursiva solo aparece si la fuente la tiene.
- El cambio afecta solo a la sección de planes de esa marca. El resto de la página y la otra marca conservan su tipografía.

## Roles: Administrador y Asistente

- **Administrador:** acceso completo, como hasta ahora.
- **Asistente:**
  - Ve solo **Solicitudes** (lista y detalle) y **Comprobantes**, de las marcas que tenga asignadas.
  - Puede **aceptar o rechazar sesiones**:
    - **Aceptar sesión** verifica el comprobante que envió el cliente y confirma la reserva. Solo es posible si hay comprobante.
    - **Rechazar sesión** pide un motivo (con opciones frecuentes: fecha no disponible, comprobante no válido…), cancela la solicitud y libera la fecha. El comprobante pendiente queda rechazado.
  - **No ve** el dashboard, Finanzas, el panel «Cobros y pagos», Calendario, Planes, Cuentas, Personalización, Marcas, Términos ni Usuarios.
  - **No puede** registrar pagos, cancelar reservas confirmadas, escribir notas internas, preparar mensajes de WhatsApp ni restablecer los datos demo. Las notas internas las puede leer.
  - Su inicio es Solicitudes, y la barra lateral solo muestra sus dos secciones.
- **Alcance por marca:** cada asistente atiende «todas las marcas» o algunas en concreto. El filtro de marcas, las listas, los contadores y el detalle respetan esa asignación; una solicitud de otra marca muestra «No tienes acceso».
- **Usuarios y roles** (solo administradores):
  - Alta, edición, desactivación y eliminación de usuarios.
  - Tabla de permisos por rol.
  - Protecciones: no se puede cambiar el propio rol ni eliminarse a uno mismo, siempre debe quedar al menos un administrador activo, y no se repiten correos.
- **«Ver como»** (barra superior): selector de demostración para cambiar de usuario, porque el prototipo no tiene inicio de sesión. La barra muestra quién está activo y con qué rol.
- **Doble protección:** además de ocultar botones y secciones, la capa de servicios comprueba el permiso y la marca en cada acción, igual que lo hará el servidor. Si alguien intenta una acción sin permiso, se rechaza con un mensaje claro.
- **Historial:** registra el nombre de quien hace cada cambio (p. ej. «María Peña: Sesión aceptada…»).

## Morel Media Group: marca y datos

- **Marca matriz:** Morel Media Group. **Marca publicada:** Morel Estudio.
- **Planes:** Plan Estándar y Plan Pro, con fotos, duración, precio y condición de vestuario según su página pública.
- **Robert Morel Photo** no se incluyó porque no hay información pública de sus servicios. Se añade desde «Marcas → Añadir marca».
- **Identidad:** franjas negras, fondo blanco, titulares en mayúsculas, nombres de plan en serif clásica (Libre Baskerville) y acento rojo, como en la página de referencia. No se copiaron logotipos, fotos ni textos.

## Seguimientos

- **Por qué dos vistas:**
  - La línea de tiempo vive en el detalle de la solicitud, donde ya se trabaja con cada cliente.
  - El tablero «Seguimientos» da la vista de conjunto tipo CRM.
  - Solicitudes sigue siendo la bandeja de entrada de lo que hay que aceptar o rechazar.
- **Etapas derivadas de datos:**
  - `confirmedAt`: fecha en que se confirmó la reserva.
  - `shotAt`: día de las fotos; pone el estado en «Sesión realizada».
  - `deliveredAt` y `galleryUrl`: entrega y enlace de la galería.
  - La etapa nunca se guarda como texto aparte, así que no puede quedar desincronizada.
- **«Fotos realizadas» solo desde el día de la sesión.** Las sesiones pasadas sin marcar se señalan en ámbar («¿Se realizó?»), porque son las que se olvidan.
- **Plazo de entrega en días hábiles** (lunes a viernes) desde el día de las fotos, configurable por marca. El extra con «Entrega exprés» usa 72 horas. Las entregas fuera de plazo quedan marcadas «con retraso» para poder medir el cumplimiento.
- **Tarjetas:** un borde de color indica urgencia (rojo vencida, ámbar próxima o sin marcar, verde hoy o entregada). El texto siempre acompaña al color.
- **En celular** el tablero se convierte en pestañas por etapa, para no tener que desplazarse de lado.
- **Asistente:** puede marcar etapas porque es trabajo operativo diario. Deshacer un paso es solo del administrador.
