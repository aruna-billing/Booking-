// ════════════════════════════════════════════════════════════════════════════
// Función «finanzas-sync» (Supabase Edge Function del proyecto de BOOKING)
// ────────────────────────────────────────────────────────────────────────────
// Pasa a Finanzas, sola, cada pago que se confirma en Booking:
//   · Un pago verificado → un INGRESO en Finanzas (sin factura) con la fecha del
//     día en que se verificó, la marca elegida y el cliente.
//   · El cliente se crea en Clientes de Finanzas la primera vez; si ya existe
//     (mismo teléfono o correo), se usa el mismo.
//   · Si en Booking se anula o rechaza un pago que ya estaba verificado, su
//     ingreso se quita de Finanzas.
//   · Lo que se cambie a mano en Finanzas después (fecha, método, cuenta de banco)
//     no se toca: cada pago entra una sola vez.
//   · No se crean facturas ni se asigna cuenta de banco: eso se hace en Finanzas.
//
// La llama un «Database Webhook» de Booking en la tabla booking_requests
// (INSERT y UPDATE), con la cabecera x-webhook-secret.
//
// Secretos (Supabase de BOOKING → Edge Functions → Secrets):
//   FINANZAS_URL         dirección del proyecto de Finanzas (https://xxxx.supabase.co)
//   FINANZAS_SECRET_KEY  clave secreta del proyecto de Finanzas (sb_secret_… o service_role)
//   FINANZAS_EMAIL       correo de la cuenta de Finanzas dueña de los registros
//   FINANZAS_MARCA       nombre exacto de la marca en Finanzas (ej.: Morel Estudio)
//   WEBHOOK_SECRET       el mismo de «booking-emails»
// Ninguno va en el código ni en GitHub.
//
// Al desplegarla, desactiva «Enforce JWT verification».
// ════════════════════════════════════════════════════════════════════════════

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const env = (k: string): string => {
  // deno-lint-ignore no-explicit-any
  const g: any = globalThis;
  return String(g.Deno?.env?.get(k) ?? g.process?.env?.[k] ?? '').trim();
};

// deno-lint-ignore no-explicit-any
type Any = any;

const METHODS: Record<string, string> = { transfer: 'Transferencia', deposit: 'Depósito', cash: 'Efectivo', card: 'Tarjeta', other: 'Otro' };
const CONCEPTS: Record<string, string> = { deposit: 'Anticipo', full: 'Pago total', partial: 'Abono', balance: 'Saldo final', other: 'Pago' };

/** Fecha (AAAA-MM-DD) en República Dominicana (UTC−4, sin horario de verano). */
export const rdDate = (iso?: string | null) => {
  const t = iso ? Date.parse(iso) : Date.now();
  return new Date((Number.isFinite(t) ? t : Date.now()) - 4 * 3600e3).toISOString().slice(0, 10);
};

/** Pagos verificados de una reserva (payload de booking_requests). */
export const verifiedPayments = (payload: Any) => (Array.isArray(payload?.payments) ? payload.payments : []).filter((p: Any) => p?.status === 'verified' && Number(p.amount) > 0);

/** Qué hay que añadir y qué hay que quitar en Finanzas con este cambio. */
export function diffPayments(record: Any, oldRecord: Any) {
  const now = verifiedPayments(record?.payload);
  const before = verifiedPayments(oldRecord?.payload);
  const beforeIds = new Set(before.map((p: Any) => p.id));
  const nowIds = new Set(now.map((p: Any) => p.id));
  return { add: now.filter((p: Any) => !beforeIds.has(p.id)), remove: before.filter((p: Any) => !nowIds.has(p.id)) };
}

/** Fecha del ingreso: el día en que se verificó en Booking (o la fecha que puso el equipo al registrarlo ya verificado). */
export const incomeDate = (p: Any) => (p.reviewedAt ? rdDate(p.reviewedAt) : String(p.date || '').slice(0, 10) || rdDate(p.createdAt));

export const sourceRef = (reqId: string, payId: string) => `booking:${reqId}:${payId}`;

const shortId = (id: string) => String(id).replace(/^req-/, '').toUpperCase();

/** Fila de la tabla payments de Finanzas para un pago de Booking. */
export function paymentRow(r: Any, p: Any, ctx: { userId: string; brandId: string; clientId: string | null }) {
  const concept = ['Reserva Booking', r.planName, CONCEPTS[p.concept] ?? 'Pago'].filter(Boolean).join(' · ');
  return {
    user_id: ctx.userId,
    invoice_id: null,
    date: incomeDate(p),
    amount: Math.round(Number(p.amount) * 100) / 100,
    method: METHODS[p.method] ?? (p.method ? String(p.method) : null),
    ref: [p.reference && p.reference !== 'Comprobante adjunto' ? p.reference : '', `Booking ${shortId(r.id)}`].filter(Boolean).join(' · '),
    note: null,
    user_name: 'Booking',
    brand: ctx.brandId,
    client_id: ctx.clientId,
    cur: r.currency === 'USD' ? 'USD' : 'DOP',
    rate: 0,
    concept,
    source: 'booking',
    source_ref: sourceRef(r.id, p.id),
  };
}

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
/** Últimos 10 dígitos: 809-555-1234, +1 809 555 1234 y 8095551234 son el mismo teléfono. */
export const phoneKey = (s: unknown) => digits(s).slice(-10);

/** Busca el cliente por teléfono o correo entre los clientes de esa cuenta. */
export function findClient(clients: Any[], c: Any) {
  const ph = phoneKey(c?.phone);
  const em = String(c?.email ?? '').trim().toLowerCase();
  return (
    clients.find((x) => ph.length >= 7 && (phoneKey(x.phone) === ph || phoneKey(x.whatsapp) === ph)) ??
    clients.find((x) => em && String(x.email ?? '').trim().toLowerCase() === em) ??
    null
  );
}

// ───────────────────────── Acceso a Finanzas ─────────────────────────

async function fin(path: string, init: RequestInit = {}) {
  const key = env('FINANZAS_SECRET_KEY');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // clave antigua (service_role)
  const res = await fetch(`${env('FINANZAS_URL').replace(/\/+$/, '')}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Finanzas (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const q = encodeURIComponent;

async function ownerId() {
  const id = await fin('rpc/finanzas_user_id', { method: 'POST', body: JSON.stringify({ p_email: env('FINANZAS_EMAIL') }) });
  if (!id) throw new Error(`No existe en Finanzas una cuenta con el correo de FINANZAS_EMAIL.`);
  return id as string;
}

async function brandId(userId: string) {
  const name = env('FINANZAS_MARCA');
  const rows: Any[] = (await fin(`brands?select=id,name,type&user_id=eq.${userId}`)) ?? [];
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
  const b = rows.find((x) => norm(x.name) === norm(name) && !String(x.type ?? '').includes('"consolidated":true'));
  if (!b) throw new Error(`No existe en Finanzas la marca «${name}» (FINANZAS_MARCA). Marcas de esa cuenta: ${rows.map((x) => x.name).join(', ') || 'ninguna'}.`);
  return b.id as string;
}

async function ensureClient(userId: string, brand: string, r: Any) {
  const c = r.client ?? {};
  const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  if (!name) return null;
  const clients: Any[] = (await fin(`clients?select=id,name,phone,whatsapp,email&user_id=eq.${userId}`)) ?? [];
  const found = findClient(clients, c);
  if (found) return found.id as string;
  const created = await fin('clients', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      name,
      email: c.email || null,
      phone: c.phone || null,
      whatsapp: c.phone || null,
      brand,
      tags: [],
      client_date: rdDate(),
      notes: `Cliente creado desde Booking (reserva ${shortId(r.id)}).`,
    }),
  });
  return (created?.[0]?.id ?? null) as string | null;
}

// ───────────────────────── Entrada ─────────────────────────

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
  const secret = env('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return json({ error: 'No autorizado.' }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.table !== 'booking_requests' || !['INSERT', 'UPDATE'].includes(body.type)) return json({ skipped: 'no es un cambio de reserva' });

  const { add, remove } = diffPayments(body.record, body.type === 'UPDATE' ? body.old_record : null);
  if (!add.length && !remove.length) return json({ skipped: 'sin pagos nuevos ni anulados' });

  const missing = ['FINANZAS_URL', 'FINANZAS_SECRET_KEY', 'FINANZAS_EMAIL', 'FINANZAS_MARCA'].filter((k) => !env(k));
  if (missing.length) return json({ error: `Faltan secretos: ${missing.join(', ')}` }, 500);

  const r = { ...(body.record?.payload ?? {}), id: body.record?.payload?.id ?? body.record?.id };
  try {
    const out = { added: 0, removed: 0 };
    if (remove.length) {
      const refs = remove.map((p: Any) => `"${sourceRef(r.id, p.id)}"`).join(',');
      const del = await fin(`payments?source_ref=in.(${q(refs)})`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      out.removed = del?.length ?? 0;
    }
    if (add.length) {
      const userId = await ownerId();
      const brand = await brandId(userId);
      const clientId = await ensureClient(userId, brand, r);
      const rows = add.map((p: Any) => paymentRow(r, p, { userId, brandId: brand, clientId }));
      // Si el aviso llega repetido, el pago no se duplica (source_ref es único).
      const ins = await fin('payments?on_conflict=source_ref', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(rows),
      });
      out.added = ins?.length ?? 0;
    }
    console.log('finanzas-sync', r.id, out);
    return json({ ok: true, ...out });
  } catch (e) {
    console.error('finanzas-sync', r.id, (e as Error).message);
    return json({ error: (e as Error).message }, 502);
  }
}

// deno-lint-ignore no-explicit-any
const g: any = globalThis;
if (g.Deno?.serve) g.Deno.serve(handler);
