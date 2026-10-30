// ════════════════════════════════════════════════════════════════════════════
// MOREL BOOKING · Función «google-calendar» (Supabase Edge Function)
// ────────────────────────────────────────────────────────────────────────────
// Conecta las reservas con Google Calendar usando una cuenta de servicio de Google
// con la que se compartió el calendario. No usa dependencias externas.
//
// Acciones (POST con JSON { action, ... }):
//   · busy    → público. Horas ocupadas en Google entre dos fechas, sin títulos ni
//               datos de los eventos: solo fecha, hora y duración.
//   · sync    → equipo. Crea, actualiza o borra el evento de una reserva según su
//               estado (confirmada o realizada = evento; pendiente o cancelada = sin evento).
//   · status  → equipo. ¿Está configurado? ¿Se puede leer el calendario?
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT_JSON  el archivo JSON completo de la cuenta de servicio
//   GOOGLE_CALENDAR_ID           el correo de tu calendario (p. ej. tucorreo@gmail.com)
//   SITE_URL (opcional)          dirección del sitio, para el enlace al panel en el evento
//
// Al desplegarla, desactiva «Enforce JWT verification»: la función comprueba ella
// misma quién llama (las acciones del equipo exigen una sesión de un miembro activo).
// ════════════════════════════════════════════════════════════════════════════

const TZ = 'America/Santo_Domingo';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const CAL_API = 'https://www.googleapis.com/calendar/v3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string): string => {
  // deno-lint-ignore no-explicit-any
  const g: any = globalThis;
  return (g.Deno?.env?.get(k) ?? g.process?.env?.[k] ?? '') as string;
};

// ───────────────────────── Acceso a Google (cuenta de servicio) ─────────────────────────

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function importKey(pem: string) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

let tokenCache: { token: string; exp: number } | null = null;

/** Por qué el secreto no sirve (o '' si está bien). Se muestra en el panel. */
export let serviceAccountProblem = '';

/**
 * Lee la cuenta de servicio del secreto. Acepta el JSON tal cual, entre comillas,
 * en base64, o con los saltos de línea de la clave convertidos al pegarlo.
 */
export function readServiceAccount() {
  let raw = env('GOOGLE_SERVICE_ACCOUNT_JSON').trim();
  if (!raw) {
    serviceAccountProblem = 'No existe el secreto GOOGLE_SERVICE_ACCOUNT_JSON (revisa que el nombre esté escrito exactamente así).';
    return null;
  }
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && !raw.startsWith('"{'))) raw = raw.slice(1, -1).trim();
  if (!raw.startsWith('{')) {
    try {
      const decoded = atob(raw.replace(/\s+/g, ''));
      if (decoded.trim().startsWith('{')) raw = decoded.trim();
    } catch {
      /* no es base64 */
    }
  }
  let email = '';
  let key = '';
  let tokenUri = '';
  try {
    const sa = JSON.parse(raw);
    email = sa.client_email ?? '';
    key = sa.private_key ?? '';
    tokenUri = sa.token_uri ?? '';
  } catch {
    // JSON dañado al pegarlo (p. ej. saltos de línea reales dentro de la clave): se rescatan los datos.
    email = /"client_email"\s*:\s*"([^"]+)"/.exec(raw)?.[1] ?? '';
    key = /(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----)/.exec(raw)?.[1] ?? '';
  }
  if (!email || !key.includes('PRIVATE KEY')) {
    serviceAccountProblem = raw.includes('"type"') || raw.includes('client_email')
      ? 'El secreto GOOGLE_SERVICE_ACCOUNT_JSON está incompleto: pega de nuevo TODO el archivo .json, desde { hasta }.'
      : 'El secreto GOOGLE_SERVICE_ACCOUNT_JSON no tiene el contenido del archivo .json de la cuenta de servicio (ábrelo con un editor de texto y copia todo).';
    return null;
  }
  serviceAccountProblem = '';
  return { email, key: key.replace(/\\n/g, '\n'), tokenUri: tokenUri || 'https://oauth2.googleapis.com/token' };
}

export async function googleToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const sa = readServiceAccount();
  if (!sa) throw new Error(serviceAccountProblem);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.email, scope: SCOPE, aud: sa.tokenUri, iat: now, exp: now + 3600 }));
  const key = await importKey(sa.key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch(sa.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google no aceptó la cuenta de servicio (${data.error_description || data.error || res.status}).`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function gcal(path: string, init: RequestInit = {}) {
  const token = await googleToken();
  return fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function googleError(res: Response, what: string) {
  const data = await res.json().catch(() => ({}));
  const msg = data?.error?.message || res.statusText;
  if (res.status === 404) return new Error(`${what}: no se encuentra el calendario. ¿Lo compartiste con la cuenta de servicio y el GOOGLE_CALENDAR_ID es correcto?`);
  if (res.status === 403) return new Error(`${what}: la cuenta de servicio no tiene permiso. Compártele el calendario con «Hacer cambios en eventos».`);
  return new Error(`${what}: ${msg}`);
}

// ───────────────────────── Fechas (República Dominicana, UTC−4 todo el año) ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha y hora locales (Santo Domingo) de un instante. */
export function localParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Instante UTC de una fecha y hora locales. */
export const localToUtc = (iso: string, hhmm = '00:00') => new Date(`${iso}T${hhmm}:00-04:00`);

/**
 * Convierte intervalos ocupados (UTC) en bloques por día local: { date, time, durationMin }.
 * Un evento que cruza la medianoche se parte en un bloque por cada día.
 */
export function toDayBlocks(intervals: { start: string; end: string }[]) {
  const out: { date: string; time: string; durationMin: number }[] = [];
  for (const it of intervals) {
    const s = localParts(new Date(it.start));
    const e = localParts(new Date(it.end));
    let day = s.date;
    let from = s.min;
    for (let guard = 0; guard < 400; guard++) {
      const last = day === e.date;
      const to = last ? e.min : 1440;
      if (to > from) out.push({ date: day, time: `${pad(Math.floor(from / 60))}:${pad(from % 60)}`, durationMin: to - from });
      if (last || day > e.date) break;
      day = addDaysIso(day, 1);
      from = 0;
    }
  }
  return out;
}

// ───────────────────────── Eventos de reservas ─────────────────────────

/** Id fijo del evento para cada solicitud (Google solo admite a–v y 0–9). */
export const eventIdFor = (requestId: string) => `morel${requestId.toLowerCase().replace(/[^a-v0-9]/g, '')}`;

const KEEP = ['confirmed', 'completed'];

export function eventFor(r: Record<string, any>, siteUrl = '') {
  const name = `${r.client?.firstName ?? ''} ${r.client?.lastName ?? ''}`.trim() || 'Cliente';
  const dur = Number(r.quote?.durationMin) || 60;
  const start = localToUtc(r.date, r.time || '09:00');
  const end = new Date(start.getTime() + dur * 60_000);
  const local = (d: Date) => {
    const p = localParts(d);
    return `${p.date}T${pad(Math.floor(p.min / 60))}:${pad(p.min % 60)}:00`;
  };
  const lines = [
    `Plan: ${r.planName ?? ''}`,
    `Teléfono: ${r.client?.phone ?? ''}`,
    `Solicitud: ${r.id}`,
    siteUrl ? `Panel: ${siteUrl.replace(/\/+$/, '')}/#/admin/solicitudes/${r.id}` : '',
  ].filter(Boolean);
  return {
    id: eventIdFor(r.id),
    summary: `${name} · ${r.planName ?? 'Sesión'}`,
    description: lines.join('\n'),
    start: { dateTime: local(start), timeZone: TZ },
    end: { dateTime: local(end), timeZone: TZ },
    status: 'confirmed',
    extendedProperties: { private: { morelRequestId: r.id } },
  };
}

/** Deja el calendario como debe estar según el estado de la solicitud. */
export async function syncRequest(r: Record<string, any>, calendarId: string, siteUrl = '') {
  const cal = encodeURIComponent(calendarId);
  const id = eventIdFor(r.id);
  const wanted = KEEP.includes(r.status) && r.date && r.time;

  if (!wanted) {
    const res = await gcal(`/calendars/${cal}/events/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 404 || res.status === 410) return { action: 'removed' };
    throw await googleError(res, 'No se pudo quitar el evento');
  }

  const ev = eventFor(r, siteUrl);
  // 1) Actualizar si ya existe (también si se había borrado: vuelve a «confirmed»).
  let res = await gcal(`/calendars/${cal}/events/${id}`, { method: 'PUT', body: JSON.stringify(ev) });
  if (res.ok) return { action: 'updated' };
  if (res.status !== 404) throw await googleError(res, 'No se pudo actualizar el evento');
  // 2) Crear.
  res = await gcal(`/calendars/${cal}/events`, { method: 'POST', body: JSON.stringify(ev) });
  if (res.ok) return { action: 'created' };
  throw await googleError(res, 'No se pudo crear el evento');
}

const busyCache = new Map<string, { at: number; data: unknown }>();

/** Horas ocupadas (sin detalles) entre dos fechas locales. Excluye los eventos de reservas. */
export async function busyBlocks(calendarId: string, from: string, to: string) {
  const key = `${from}|${to}`;
  const hit = busyCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const params = new URLSearchParams({
    timeMin: localToUtc(from).toISOString(),
    timeMax: localToUtc(addDaysIso(to, 1)).toISOString(),
    singleEvents: 'true',
    maxResults: '2500',
    fields: 'nextPageToken,items(id,start,end,transparency,status,extendedProperties)',
  });
  const items: any[] = [];
  for (let page = 0; page < 5; page++) {
    const res = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    if (!res.ok) throw await googleError(res, 'No se pudo leer el calendario');
    const data = await res.json();
    items.push(...(data.items ?? []));
    if (!data.nextPageToken) break;
    params.set('pageToken', data.nextPageToken);
  }
  const intervals = items
    // Las reservas ya cuentan como ocupadas desde la base de datos; los eventos
    // marcados como «Disponible» en Google no bloquean.
    .filter((e: any) => e.status !== 'cancelled' && e.transparency !== 'transparent' && !e.extendedProperties?.private?.morelRequestId)
    .map((e: any) => ({
      start: e.start?.dateTime ?? localToUtc(e.start?.date).toISOString(),
      end: e.end?.dateTime ?? localToUtc(e.end?.date).toISOString(),
    }));
  const blocks = toDayBlocks(intervals);
  busyCache.set(key, { at: Date.now(), data: blocks });
  return blocks;
}

// ───────────────────────── Quién llama ─────────────────────────

/** Comprueba que quien llama es un miembro activo del equipo (con su propia sesión). */
async function staffFrom(req: Request) {
  const url = env('SUPABASE_URL');
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? env('SUPABASE_ANON_KEY');
  if (!url || !auth.startsWith('Bearer ')) return null;
  const headers = { apikey, Authorization: auth };
  const u = await fetch(`${url}/auth/v1/user`, { headers });
  if (!u.ok) return null;
  const user = await u.json();
  const p = await fetch(`${url}/rest/v1/staff_profiles?select=role,is_active,brand_ids&user_id=eq.${user.id}`, { headers });
  const rows = p.ok ? await p.json() : [];
  if (!rows[0]?.is_active) return null;
  return { headers, url, profile: rows[0] };
}

// ───────────────────────── Entrada ─────────────────────────

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
  const body = await req.json().catch(() => ({}));
  const calendarId = env('GOOGLE_CALENDAR_ID');
  const configured = Boolean(calendarId && readServiceAccount());

  try {
    if (body.action === 'busy') {
      if (!configured) return json({ configured: false, blocks: [] });
      const from = String(body.from ?? '');
      const to = String(body.to ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: 'Fechas no válidas.' }, 400);
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
      if (days < 0 || days > 400) return json({ error: 'Rango de fechas no válido.' }, 400);
      return json({ configured: true, blocks: await busyBlocks(calendarId, from, to) });
    }

    const staff = await staffFrom(req);
    if (!staff) return json({ error: 'Inicia sesión como miembro del equipo.' }, 401);

    if (body.action === 'status') {
      if (!configured) return json({ configured: false, reason: !calendarId ? 'Falta el secreto GOOGLE_CALENDAR_ID.' : serviceAccountProblem });
      const res = await gcal(`/calendars/${encodeURIComponent(calendarId)}`);
      if (!res.ok) return json({ configured: true, ok: false, reason: (await googleError(res, 'Calendario')).message, serviceAccount: readServiceAccount()?.email });
      const cal = await res.json();
      return json({ configured: true, ok: true, calendar: cal.summary, serviceAccount: readServiceAccount()?.email });
    }

    if (body.action === 'sync') {
      if (!configured) return json({ configured: false, skipped: true });
      const ids: string[] = (Array.isArray(body.requestIds) ? body.requestIds : [body.requestId]).filter(Boolean).slice(0, 200);
      if (!ids.length) return json({ error: 'Falta la solicitud.' }, 400);
      const results: Record<string, unknown> = {};
      for (const id of ids) {
        // Se lee con la sesión de quien llama: solo ve solicitudes de sus marcas.
        const q = await fetch(`${staff.url}/rest/v1/booking_requests?select=payload&id=eq.${encodeURIComponent(id)}`, { headers: staff.headers });
        const rows = q.ok ? await q.json() : [];
        if (!rows[0]) {
          results[id] = { error: 'No encontrada o sin acceso.' };
          continue;
        }
        try {
          results[id] = await syncRequest(rows[0].payload, calendarId, env('SITE_URL') || req.headers.get('origin') || '');
        } catch (e) {
          results[id] = { error: (e as Error).message };
        }
      }
      const failed = Object.values(results).filter((x: any) => x?.error);
      return json({ configured: true, results, ok: failed.length === 0, error: failed.length ? (failed[0] as any).error : undefined });
    }

    return json({ error: 'Acción no válida.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

// deno-lint-ignore no-explicit-any
const g: any = globalThis;
if (g.Deno?.serve) g.Deno.serve(handler);
