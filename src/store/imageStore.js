// Biblioteca de imágenes y videos del prototipo.
// Las imágenes se guardan como data URL; los videos como Blob (archivo binario) con un
// fotograma de portada generado al subirlos. En memoria cada video tiene además un
// `src` (URL temporal del navegador) que no se guarda.
// Se guarda en IndexedDB (cientos de MB disponibles, frente a ~5 MB de localStorage).
// Si IndexedDB no está disponible, funciona solo en memoria hasta recargar.
//
// Modo real (Supabase): los archivos van al bucket público «media» y sus datos (texto
// alternativo, punto focal, marca…) a la tabla `media`. Así el sitio público los ve
// desde cualquier dispositivo. Las pantallas solo usan las funciones exportadas aquí.

import { useSyncExternalStore } from 'react';
import { LIVE } from '../lib/mode.js';
import { supabase } from '../lib/supabase.js';
import { dataUrlToBlob, extFor, friendlyError } from '../services/cloud.js';

const DB_NAME = 'elian-booking-media';
const STORE = 'images';

let images = new Map();
let snapshot = { ready: false, persistent: false, list: [] };
const listeners = new Set();
let dbPromise = null;

function emit() {
  snapshot = {
    ready: true,
    persistent: snapshot.persistent,
    list: [...images.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
  listeners.forEach((l) => l());
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

const tx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
  });
};

/** Carga la biblioteca al iniciar la app. */
export async function initImageStore() {
  if (LIVE) return initCloud();
  try {
    const db = await openDb();
    const all = await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    images = new Map(all.map((x) => [x.id, hydrate(x)]));
    snapshot = { ...snapshot, persistent: true };
  } catch {
    snapshot = { ...snapshot, persistent: false };
  }
  emit();
}

/** Los videos se guardan como Blob; su URL temporal se crea al cargar. */
function hydrate(rec) {
  if (rec.kind === 'video' && rec.blob && !rec.src) return { ...rec, src: URL.createObjectURL(rec.blob) };
  return rec;
}
const forStorage = (rec) => {
  if (rec.kind !== 'video') return rec;
  const { src: _src, ...rest } = rec; // la URL temporal no sirve tras recargar
  return rest;
};

const save = async (rec) => {
  if (LIVE || !snapshot.persistent) return;
  try {
    await tx('readwrite', (s) => s.put(forStorage(rec)));
  } catch {
    /* sin persistencia: queda en memoria */
  }
};

/** Añade una imagen ya procesada ({ src, name, width, height, bytes }). */
export async function addImage(img, { brandId = null } = {}) {
  const rec = {
    id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'image',
    brandId,
    name: img.name,
    src: img.src,
    width: img.width,
    height: img.height,
    bytes: img.bytes,
    alt: '',
    focal: { x: 50, y: 50 },
    createdAt: new Date().toISOString(),
  };
  if (LIVE) {
    const blob = dataUrlToBlob(img.src);
    return addCloud({ ...rec, src: null, type: blob.type }, blob, null);
  }
  images.set(rec.id, rec);
  emit();
  await save(rec);
  return rec;
}

/** Añade un video ya validado ({ blob, name, width, height, duration, bytes, poster, type }). */
export async function addVideo(v, { brandId = null } = {}) {
  const rec = {
    id: `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'video',
    brandId,
    name: v.name,
    blob: v.blob,
    type: v.type,
    poster: v.poster,
    width: v.width,
    height: v.height,
    duration: v.duration,
    bytes: v.bytes,
    alt: '',
    focal: { x: 50, y: 50 },
    createdAt: new Date().toISOString(),
  };
  if (LIVE) return addCloud({ ...rec, blob: undefined, poster: null }, v.blob, v.poster);
  const live = hydrate(rec);
  images.set(rec.id, live);
  emit();
  await save(live);
  return live;
}

export async function updateImage(id, patch) {
  const cur = images.get(id);
  if (!cur) return;
  const rec = { ...cur, ...patch };
  if (LIVE) {
    const { error } = await supabase.from('media').update({ alt: rec.alt ?? '', focal: rec.focal, brand_id: rec.brandId ?? null, name: rec.name ?? '' }).eq('id', id);
    if (error) throw new Error(friendlyError(error, 'No se pudo guardar.'));
  }
  images.set(id, rec);
  emit();
  await save(rec);
}

export async function removeImage(id) {
  const cur = images.get(id);
  if (LIVE) {
    const { error } = await supabase.from('media').delete().eq('id', id);
    if (error) throw new Error(friendlyError(error, 'No se pudo borrar.'));
    if (cur) await supabase.storage.from('media').remove([cur.path, cur.posterPath].filter(Boolean));
    images.delete(id);
    emit();
    return;
  }
  if (cur?.kind === 'video' && cur.src) URL.revokeObjectURL(cur.src);
  images.delete(id);
  emit();
  if (snapshot.persistent) {
    try {
      await tx('readwrite', (s) => s.delete(id));
    } catch {
      /* ignorar */
    }
  }
}

export async function clearImages() {
  if (LIVE) return; // en el sitio real la biblioteca no se borra en bloque
  images.forEach((x) => x.kind === 'video' && x.src && URL.revokeObjectURL(x.src));
  images = new Map();
  emit();
  if (snapshot.persistent) {
    try {
      await tx('readwrite', (s) => s.clear());
    } catch {
      /* ignorar */
    }
  }
}


// ───────────────────────── Modo real (Supabase Storage) ─────────────────────────

const publicUrl = (path) => (path ? supabase.storage.from('media').getPublicUrl(path).data.publicUrl : null);

function fromRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    brandId: r.brand_id,
    name: r.name,
    path: r.path,
    posterPath: r.poster_path,
    src: publicUrl(r.path),
    poster: publicUrl(r.poster_path),
    type: r.mime_type,
    width: r.width,
    height: r.height,
    duration: r.duration === null ? null : Number(r.duration),
    bytes: r.bytes,
    alt: r.alt ?? '',
    focal: r.focal ?? { x: 50, y: 50 },
    createdAt: r.created_at,
  };
}

const toRow = (rec) => ({
  id: rec.id,
  kind: rec.kind,
  brand_id: rec.brandId ?? null,
  name: rec.name ?? '',
  path: rec.path,
  poster_path: rec.posterPath ?? null,
  mime_type: rec.type ?? null,
  width: rec.width ?? null,
  height: rec.height ?? null,
  duration: rec.duration ?? null,
  bytes: rec.bytes ?? null,
  alt: rec.alt ?? '',
  focal: rec.focal ?? { x: 50, y: 50 },
});

async function initCloud() {
  const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false });
  images = new Map((error ? [] : data).map((r) => [r.id, fromRow(r)]));
  snapshot = { ...snapshot, persistent: !error };
  emit();
}

async function uploadMedia(path, blob, type) {
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(friendlyError(error, 'No se pudo subir el archivo.'));
}

async function addCloud(rec, blob, posterDataUrl) {
  rec.path = `library/${rec.id}.${extFor(rec.type || blob.type, rec.name)}`;
  await uploadMedia(rec.path, blob, rec.type || blob.type);
  if (posterDataUrl) {
    rec.posterPath = `library/${rec.id}-poster.jpg`;
    await uploadMedia(rec.posterPath, dataUrlToBlob(posterDataUrl), 'image/jpeg');
  }
  const { data, error } = await supabase.from('media').insert(toRow(rec)).select('*').single();
  if (error) {
    await supabase.storage.from('media').remove([rec.path, rec.posterPath].filter(Boolean));
    throw new Error(friendlyError(error, 'No se pudo guardar el archivo.'));
  }
  const live = fromRow(data);
  images.set(live.id, live);
  emit();
  return live;
}

export const getImage = (id) => (id ? images.get(id) ?? null : null);
export const isVideo = (rec) => rec?.kind === 'video';

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** { ready, persistent, list } — se actualiza al subir, editar o borrar. */
export const useImageLibrary = () => useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
