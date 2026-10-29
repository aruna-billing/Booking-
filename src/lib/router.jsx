// Enrutador mínimo basado en hash (#/ruta). Sin dependencias.
// Se eligió hash para que el prototipo funcione abriendo el build en cualquier
// hosting estático. Puede sustituirse por react-router sin tocar las páginas,
// que solo usan `navigate`, `Link` y `useRoute`.

import { useEffect, useSyncExternalStore } from 'react';

const getPath = () => {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
};

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const usePath = () => useSyncExternalStore(subscribe, getPath, () => '/');

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}#${path}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
}

/** matchPath('/admin/solicitudes/:id', '/admin/solicitudes/req-1') → { id: 'req-1' } | null */
export function matchPath(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a href={`#${to}`} className={className} {...rest}>
      {children}
    </a>
  );
}

/** Lleva el foco al contenido principal al cambiar de ruta (accesibilidad). */
export function useFocusOnRouteChange(path, ref) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [path, ref]);
}
