import { processImage, IMAGE_TYPES } from './images.js';
import { processVideo, VIDEO_TYPES } from './videos.js';
import { addImage, addVideo } from '../store/imageStore.js';

export const MEDIA_OPTS = { accept: IMAGE_TYPES, maxInputMB: 15, maxSide: 2000, quality: 0.82 };
export const ACCEPT = { image: IMAGE_TYPES, video: VIDEO_TYPES, all: [...IMAGE_TYPES, ...VIDEO_TYPES] };

/** Procesa y guarda varios archivos (imágenes y/o videos). Devuelve los añadidos y los errores por archivo. */
export async function uploadToLibrary(fileList, { brandId = null, kind = 'all' } = {}) {
  const added = [];
  const errors = [];
  for (const file of [...fileList]) {
    try {
      const isVid = file.type.startsWith('video/');
      if (kind === 'image' && isVid) throw new Error('Aquí solo se aceptan imágenes.');
      if (kind === 'video' && !isVid) throw new Error('Aquí solo se aceptan videos (MP4 o WebM).');
      if (isVid) added.push(await addVideo(await processVideo(file), { brandId }));
      else added.push(await addImage(await processImage(file, MEDIA_OPTS), { brandId }));
    } catch (e) {
      errors.push(`${file.name}: ${e.message}`);
    }
  }
  return { added, errors };
}
