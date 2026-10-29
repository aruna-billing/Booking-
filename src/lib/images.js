// Lectura de imágenes subidas desde el ordenador.
// PROTOTIPO: la imagen se reduce en el navegador y se guarda como data URL en el
// almacenamiento local. En producción se subirá a Supabase Storage (o Cloudflare Images)
// y aquí solo se guardará la URL pública.

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
    img.src = src;
  });

/**
 * Valida y reduce una imagen.
 * @param {File} file
 * @param {{ accept: string[], maxInputMB: number, maxSide: number, quality?: number, keepTransparency?: boolean }} opts
 * @returns {Promise<{ src: string, width: number, height: number, name: string, bytes: number }>}
 */
export async function processImage(file, { accept, maxInputMB, maxSide, quality = 0.82, keepTransparency = false }) {
  if (!accept.includes(file.type)) {
    const names = accept.map((t) => t.split('/')[1].replace('svg+xml', 'SVG').replace('jpeg', 'JPG').toUpperCase()).join(', ');
    throw new Error(`Formato no permitido. Usa ${names}.`);
  }
  if (file.size > maxInputMB * 1024 * 1024) throw new Error(`El archivo supera ${maxInputMB} MB.`);

  const original = await readAsDataUrl(file);

  // Los SVG se guardan tal cual (vectoriales); se muestran con <img>, que no ejecuta scripts.
  if (file.type === 'image/svg+xml') {
    if (file.size > 300 * 1024) throw new Error('El SVG supera 300 KB.');
    const img = await loadImage(original).catch(() => ({ naturalWidth: 0, naturalHeight: 0 }));
    return { src: original, width: img.naturalWidth, height: img.naturalHeight, name: file.name, bytes: file.size };
  }

  const img = await loadImage(original);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  // Logos con transparencia → PNG/WebP; fotos → JPEG (más ligero).
  const type = keepTransparency ? (file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png') : 'image/jpeg';
  const src = canvas.toDataURL(type, quality);
  return { src, width: w, height: h, name: file.name, bytes: Math.round((src.length * 3) / 4) };
}

/** Tamaño aproximado (KB) de un data URL, para avisar del espacio usado. */
export const dataUrlKB = (src) => (src ? Math.round((src.length * 3) / 4 / 1024) : 0);
