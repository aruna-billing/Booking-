// Validación de videos y fotograma de portada.
// PROTOTIPO: el archivo se guarda tal cual (no se recomprime en el navegador).
// En producción conviene transcodificar en el servidor (p. ej. Cloudflare Stream o
// una función con ffmpeg) para generar versiones ligeras para celular.

export const VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const VIDEO_LIMITS = { maxMB: 50, maxSeconds: 60 };

const loadMeta = (url) =>
  new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('El navegador no puede reproducir este video. Usa MP4 (H.264) o WebM.'));
    v.src = url;
  });

const seek = (v, t) =>
  new Promise((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
    setTimeout(done, 2500); // por si el navegador no emite «seeked»
  });

/**
 * Valida un video y genera su fotograma de portada.
 * @returns {Promise<{ blob, type, name, width, height, duration, bytes, poster }>}
 */
export async function processVideo(file) {
  if (!VIDEO_TYPES.includes(file.type)) throw new Error('Formato de video no permitido. Usa MP4 o WebM.');
  if (file.size > VIDEO_LIMITS.maxMB * 1024 * 1024) throw new Error(`El video supera ${VIDEO_LIMITS.maxMB} MB. Exporta una versión más ligera (1080p, sin audio).`);
  const url = URL.createObjectURL(file);
  try {
    const v = await loadMeta(url);
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    if (duration > VIDEO_LIMITS.maxSeconds) {
      throw new Error(`El video dura ${Math.round(duration)} s. Para la portada usa uno de ${VIDEO_LIMITS.maxSeconds} s o menos.`);
    }
    // Fotograma: al 10 % del video (evita el primer cuadro, que suele ser negro).
    await seek(v, Math.min(duration * 0.1 || 0, 2));
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((v.videoWidth || 1280) * scale));
    c.height = Math.max(1, Math.round((v.videoHeight || 720) * scale));
    let poster = null;
    try {
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      poster = c.toDataURL('image/jpeg', 0.8);
    } catch {
      poster = null; // sin fotograma: se usará la imagen de respaldo o el marcador
    }
    return { blob: file, type: file.type, name: file.name, width: v.videoWidth, height: v.videoHeight, duration, bytes: file.size, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const formatSeconds = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
