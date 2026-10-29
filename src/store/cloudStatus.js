// Estado de la conexión con Supabase (carga inicial, guardado y errores).
import { useSyncExternalStore } from 'react';

let status = {
  phase: 'idle', // 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  error: null, // error al cargar el sitio
  staff: 'idle', // datos del panel: 'idle' | 'loading' | 'ready' | 'error'
  justSetUp: false, // se acaba de crear la configuración inicial (muestra la lista de pendientes)
  saveError: null, // último error al guardar (se muestra en el panel con «Reintentar»)
};
const listeners = new Set();

export const getCloudStatus = () => status;
export function setCloudStatus(patch) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useCloudStatus = () => useSyncExternalStore(subscribe, getCloudStatus, getCloudStatus);
