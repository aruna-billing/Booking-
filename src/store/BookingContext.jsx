// Estado del flujo público de reserva (borrador del cliente).
// Se guarda en sessionStorage para sobrevivir a una recarga; las vistas previas de
// imágenes (blob URLs) no se guardan porque solo existen en memoria.

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const STORAGE_KEY = 'morel-booking-draft-v1';

export const emptyDraft = (brandId = null) => ({
  brandId,
  planId: null,
  extras: {}, // { [extraId]: cantidad }
  date: null,
  time: null,
  details: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    inspirationFiles: [], // { id, name, size, type, previewUrl? }
    acceptedTerms: false,
  },
  payment: { receipt: null, confirmedPaid: false },
  submittedRequestId: null,
});

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return state.brandId === action.brandId && !state.submittedRequestId ? state : emptyDraft(action.brandId);
    case 'selectPlan':
      // Al cambiar de plan se descartan extras que no apliquen (se filtran en la vista).
      return { ...state, planId: action.planId, extras: action.keepExtras ?? {} };
    case 'setExtra': {
      const extras = { ...state.extras };
      if (!action.qty) delete extras[action.extraId];
      else extras[action.extraId] = action.qty;
      return { ...state, extras };
    }
    case 'setSlot':
      return { ...state, date: action.date, time: action.time };
    case 'updateDetails':
      return { ...state, details: { ...state.details, ...action.patch } };
    case 'updatePayment':
      return { ...state, payment: { ...state.payment, ...action.patch } };
    case 'submitted':
      return { ...state, submittedRequestId: action.requestId };
    case 'reset':
      return emptyDraft(action.brandId ?? null);
    default:
      return state;
  }
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [draft, dispatch] = useReducer(reducer, undefined, loadDraft);

  useEffect(() => {
    try {
      // Se guarda la ruta de los archivos ya subidos (modo real); los que se estaban
      // subiendo se descartan porque la subida no sobrevive a una recarga.
      const strip = (f) => (f ? { id: f.id, name: f.name, size: f.size, type: f.type, ...(f.path ? { path: f.path, status: 'ready' } : {}) } : f);
      const keep = (f) => f && f.status !== 'uploading' && f.status !== 'error';
      const serializable = {
        ...draft,
        details: { ...draft.details, inspirationFiles: draft.details.inspirationFiles.filter(keep).map(strip) },
        payment: { ...draft.payment, receipt: keep(draft.payment.receipt) ? strip(draft.payment.receipt) : null },
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      /* sin almacenamiento: el borrador vive solo en memoria */
    }
  }, [draft]);

  const value = useMemo(() => ({ draft, dispatch }), [draft]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking debe usarse dentro de <BookingProvider>');
  return ctx;
}

/** Primer paso incompleto: protege el acceso directo por URL a pasos posteriores. */
export function firstIncompleteStep(draft) {
  if (!draft.planId) return 'planes';
  if (!draft.date || !draft.time) return 'fecha';
  const d = draft.details;
  if (!d.firstName || !d.lastName || !d.email || !d.phone || !d.acceptedTerms) return 'datos';
  if (!draft.payment.receipt || !draft.payment.confirmedPaid) return 'pago';
  return null;
}
