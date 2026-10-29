import { LIVE } from '../../lib/mode.js';
import { createContext, useCallback, useContext, useState } from 'react';
import { PAYMENT_STATUS, REQUEST_STATUS } from '../../data/statuses.js';

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export const RequestStatusBadge = ({ status }) => {
  const s = REQUEST_STATUS[status];
  return <Badge tone={s?.tone}>{s?.label ?? status}</Badge>;
};

export const PaymentStatusBadge = ({ status }) => {
  const s = PAYMENT_STATUS[status];
  return (
    <Badge tone={s?.tone}>
      <span className="visually-hidden">Pago: </span>
      {s?.label ?? status}
    </Badge>
  );
};

/**
 * Marcador de imagen. El prototipo no incluye fotografías reales: cada plan muestra
 * una composición abstracta con el tono de la marca y la leyenda «Imagen de muestra».
 * Al integrar, se reemplaza por <img> desde Supabase Storage / Cloudflare Images.
 */
const TONES = {
  sand: ['#E9DCC6', '#C9AE86', '#8C7350'],
  olive: ['#DCD8C2', '#A3A27C', '#5F6142'],
  clay: ['#EAD3C3', '#C49478', '#7E5442'],
  ink: ['#3A3733', '#22201D', '#B08D57'],
  linen: ['#EFE9DE', '#CFC3AE', '#8F826C'],
  noir: ['#2B2A27', '#121211', '#A88A5C'],
  gold: ['#D9C7A3', '#A88A5C', '#3B3123'],
  warm: ['#EFE5D6', '#D3BC98', '#9C7D52'],
};

export function PhotoPlaceholder({ tone = 'sand', label = 'Imagen de muestra', ratio = '4 / 5', variant = 0, className = '' }) {
  const [a, b, c] = TONES[tone] ?? TONES.sand;
  const shapes = [
    <circle key="s" cx="62%" cy="38%" r="22%" fill={c} opacity="0.55" />,
    <rect key="s" x="18%" y="22%" width="44%" height="58%" rx="200" fill={c} opacity="0.5" />,
    <ellipse key="s" cx="40%" cy="62%" rx="34%" ry="18%" fill={c} opacity="0.5" />,
  ];
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={`${label} (marcador, sin fotografía real)`}>
      <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`g-${tone}-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#g-${tone}-${variant})`} />
        {shapes[variant % shapes.length]}
        <line x1="0" y1="78%" x2="100%" y2="70%" stroke={c} strokeOpacity="0.25" />
      </svg>
      <span className="photo__label">{label}</span>
    </div>
  );
}

export function QtyStepper({ value, min = 0, max = 10, onChange, label }) {
  return (
    <div className="qty" role="group" aria-label={`Cantidad: ${label}`}>
      <button type="button" className="qty__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Quitar uno de ${label}`}>
        −
      </button>
      <output className="qty__value" aria-live="polite">
        {value}
      </output>
      <button type="button" className="qty__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Añadir uno de ${label}`}>
        +
      </button>
    </div>
  );
}

/**
 * Aviso de prototipo. En el sitio real (Supabase) no se muestra, salvo que se pase
 * `live` con un texto que siga siendo cierto: entonces se muestra como nota normal.
 */
export function DemoNotice({ children, compact = false, live }) {
  if (LIVE) {
    if (!live) return null;
    return (
      <div className={`demo-notice demo-notice--live ${compact ? 'demo-notice--compact' : ''}`} role="note">
        <span>{live}</span>
      </div>
    );
  }
  return (
    <div className={`demo-notice ${compact ? 'demo-notice--compact' : ''}`} role="note">
      <span className="demo-notice__tag">Demo</span>
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__text">{children}</p>}
      {action}
    </div>
  );
}

// ——— Notificaciones (toasts) ———
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'neutral') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
