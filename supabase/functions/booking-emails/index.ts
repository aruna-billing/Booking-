// ════════════════════════════════════════════════════════════════════════════
// Función «booking-emails» (Supabase Edge Function) · correos al cliente con Resend
// ────────────────────────────────────────────────────────────────────────────
// La llama un «Database Webhook» de Supabase cada vez que se crea o cambia una fila
// de booking_requests:
//   · nueva solicitud (INSERT, estado «en revisión») → correo «Reserva en revisión»
//   · pasa a «confirmada» (UPDATE)                    → correo «Reserva confirmada»
// Los textos salen del panel (Personalización → Correos al cliente).
//
// También acepta { action: 'test', brandId, kind, to } desde el panel (solo
// administradores con sesión) para enviar un correo de prueba.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   clave de Resend (resend.com → API Keys)
//   EMAIL_FROM       remitente verificado en Resend, p. ej. reservas@tudominio.com
//   WEBHOOK_SECRET   una contraseña larga inventada; la misma va en el webhook
//   SB_PUBLISHABLE_KEY (opcional) tu clave publishable, si la función no puede leer
//                    la configuración con la clave que Supabase le da por defecto.
//
// Al desplegarla, desactiva «Enforce JWT verification»: la función comprueba ella
// misma el secreto del webhook o la sesión del administrador.
// ════════════════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string): string => {
  // deno-lint-ignore no-explicit-any
  const g: any = globalThis;
  return (g.Deno?.env?.get(k) ?? g.process?.env?.[k] ?? '') as string;
};

// ───────────────────────── Textos (mismas reglas que src/lib/emails.js) ─────────────────────────

const isEvent = (b: any) => b?.bookingType === 'event';

export function defaultEmail(kind: string, brand: any) {
  const ev = isEvent(brand);
  const what = ev ? 'tu fecha' : 'tu sesión';
  if (kind === 'confirmed') {
    return {
      subject: '¡Tu reserva está confirmada! · {marca}',
      body: `Hola {nombre}:

¡Buenas noticias! Verificamos tu pago y ${what} quedó confirmada.

· Plan: {plan}
· Fecha: {fecha}, a las {hora}
· Saldo pendiente: {saldo} (se paga el día ${ev ? 'del evento' : 'de la sesión'})

Si necesitas cambiar algo, responde a este correo o escríbenos por WhatsApp: {whatsapp}.

¡Nos vemos pronto!
{marca}`,
    };
  }
  return {
    subject: 'Recibimos tu solicitud · {marca}',
    body: `Hola {nombre}:

¡Gracias por tu interés! Recibimos tu solicitud y tu comprobante de pago. Tu reserva está en revisión: en cuanto verifiquemos el pago te confirmaremos ${what}.

· Plan: {plan}
· Fecha solicitada: {fecha}, a las {hora}
· Total: {total} · Anticipo enviado: {anticipo}
· Número de solicitud: {solicitud}

Te contactaremos mediante WhatsApp. Si tienes alguna duda, responde a este correo.

{marca}`,
  };
}

export function emailTemplate(brand: any, kind: string) {
  const saved = brand?.web?.emails?.[kind] ?? {};
  const def = defaultEmail(kind, brand);
  return {
    enabled: saved.enabled !== false,
    subject: saved.subject?.trim() ? saved.subject : def.subject,
    body: saved.body?.trim() ? saved.body : def.body,
  };
}

const CURRENCY: Record<string, string> = { DOP: 'RD$', USD: 'US$' };
const money = (n: number, cur: string) => `${CURRENCY[cur] ?? cur} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0)}`;
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
};
const hour = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
};

export function emailVars(r: any, brand: any) {
  const cur = r.currency || brand.currency;
  return {
    nombre: r.client?.firstName ?? '',
    apellido: r.client?.lastName ?? '',
    marca: brand.name,
    plan: r.planName ?? '',
    fecha: r.date ? longDate(r.date) : '',
    hora: r.time ? hour(r.time) : '',
    total: money(r.quote?.total ?? 0, cur),
    anticipo: money(r.quote?.deposit ?? 0, cur),
    saldo: money(r.quote?.balance ?? 0, cur),
    solicitud: String(r.id ?? '').replace(/^req-/, ''),
    whatsapp: brand.whatsappDisplay || '—',
  } as Record<string, string>;
}

export const fillTemplate = (text: string, vars: Record<string, string>) => String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Correo en HTML sencillo con los colores de la marca (y versión de texto). */
export function buildEmail(brand: any, kind: string, r: any) {
  const t = emailTemplate(brand, kind);
  const vars = emailVars(r, brand);
  const subject = fillTemplate(t.subject, vars).replace(/[\r\n]+/g, ' ').slice(0, 200);
  const text = fillTemplate(t.body, vars);
  const theme = brand.theme ?? {};
  const ink = /^#[0-9a-f]{3,8}$/i.test(theme.ink ?? '') ? theme.ink : '#111111';
  const accent = /^#[0-9a-f]{3,8}$/i.test(theme.accent ?? '') ? theme.accent : '#111111';
  const logo = typeof brand.logo?.src === 'string' && brand.logo.src.startsWith('https://') ? brand.logo.src : '';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px 12px;background:#f4f2ee;font-family:Helvetica,Arial,sans-serif;color:${ink}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-top:4px solid ${accent}" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 28px 8px">${logo ? `<img src="${esc(logo)}" alt="${esc(brand.name)}" height="40" style="display:block;height:40px;width:auto">` : `<strong style="font-size:18px">${esc(brand.name)}</strong>`}</td></tr>
<tr><td style="padding:16px 28px 12px;font-size:15px">${paragraphs}</td></tr>
</table>
<p style="font-size:12px;color:#77736b;margin:16px 0 0">${esc(brand.name)}${brand.email ? ` · ${esc(brand.email)}` : ''}</p>
</td></tr></table></body></html>`;
  return { subject, text, html, enabled: t.enabled };
}

// ───────────────────────── Envío ─────────────────────────

export async function sendEmail({ to, subject, html, text, fromName, replyTo }: { to: string; subject: string; html: string; text: string; fromName: string; replyTo?: string }) {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (!key || !from) throw new Error('Faltan los secretos RESEND_API_KEY o EMAIL_FROM.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName.replace(/[<>"]/g, '')} <${from}>`,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend no envió el correo: ${data?.message || res.status}`);
  return data?.id as string;
}

async function loadConfig(req: Request) {
  const url = env('SUPABASE_URL');
  const key = env('SB_PUBLISHABLE_KEY') || req.headers.get('apikey') || env('SUPABASE_ANON_KEY');
  // Solo la cabecera apikey: con las claves nuevas («sb_publishable_…») no se envía como Bearer.
  const res = await fetch(`${url}/rest/v1/site_config?id=eq.public&select=data`, { headers: { apikey: key } });
  const rows = res.ok ? await res.json() : [];
  if (!rows[0]?.data) throw new Error('No se pudo leer la configuración del sitio (revisa el secreto SB_PUBLISHABLE_KEY).');
  return rows[0].data;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Qué correo toca según el evento del webhook (o null). */
export function kindFor(type: string, record: any, old: any) {
  const status = record?.payload?.status ?? record?.status;
  const before = old?.payload?.status ?? old?.status;
  if (type === 'INSERT' && status === 'pending_review') return 'review';
  if (type === 'UPDATE' && status === 'confirmed' && before !== 'confirmed') return 'confirmed';
  return null;
}

async function isAdmin(req: Request) {
  const url = env('SUPABASE_URL');
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? env('SUPABASE_ANON_KEY');
  if (!url || !auth.startsWith('Bearer ')) return false;
  const headers = { apikey, Authorization: auth };
  const u = await fetch(`${url}/auth/v1/user`, { headers });
  if (!u.ok) return false;
  const user = await u.json();
  const p = await fetch(`${url}/rest/v1/staff_profiles?select=role,is_active&user_id=eq.${user.id}`, { headers });
  const rows = p.ok ? await p.json() : [];
  return rows[0]?.is_active === true && rows[0]?.role === 'admin';
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
  const body = await req.json().catch(() => ({}));

  try {
    // ── Correo de prueba desde el panel ──
    if (body.action === 'test') {
      if (!(await isAdmin(req))) return json({ error: 'Solo un administrador con sesión puede enviar correos de prueba.' }, 401);
      const to = String(body.to ?? '').trim();
      if (!EMAIL_RE.test(to)) return json({ error: 'Escribe un correo válido.' }, 400);
      const cfg = await loadConfig(req);
      const brand = (cfg.brands ?? []).find((b: any) => b.id === body.brandId);
      if (!brand) return json({ error: 'Marca no encontrada.' }, 404);
      const kind = body.kind === 'confirmed' ? 'confirmed' : 'review';
      const plan = (cfg.plans ?? []).find((p: any) => p.brandId === brand.id && p.active !== false);
      const price = plan?.price ?? 5000;
      const deposit = Math.round((price * (brand.depositPercent ?? 50)) / 100);
      const sample = { id: 'req-1234', client: { firstName: 'Ana', lastName: 'Pérez' }, planName: plan?.name ?? 'Plan', date: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10), time: isEvent(brand) ? '15:00' : '10:00', currency: brand.currency, quote: { total: price, deposit, balance: price - deposit } };
      const msg = buildEmail(brand, kind, sample);
      const id = await sendEmail({ to, subject: `[Prueba] ${msg.subject}`, html: msg.html, text: msg.text, fromName: brand.name, replyTo: brand.email || undefined });
      return json({ ok: true, id });
    }

    // ── Webhook de la base de datos ──
    const secret = env('WEBHOOK_SECRET');
    if (!secret || req.headers.get('x-webhook-secret') !== secret) return json({ error: 'No autorizado.' }, 401);
    if (body.table !== 'booking_requests') return json({ skipped: 'otra tabla' });
    const kind = kindFor(body.type, body.record, body.old_record);
    if (!kind) return json({ skipped: 'sin correo para este cambio' });
    const r = body.record.payload;
    const to = String(r?.client?.email ?? '').trim();
    if (!EMAIL_RE.test(to)) return json({ skipped: 'la solicitud no tiene un correo válido' });
    const cfg = await loadConfig(req);
    const brand = (cfg.brands ?? []).find((b: any) => b.id === r.brandId);
    if (!brand) return json({ skipped: 'marca no encontrada' });
    const msg = buildEmail(brand, kind, r);
    if (!msg.enabled) return json({ skipped: 'correo desactivado en el panel' });
    const id = await sendEmail({ to, subject: msg.subject, html: msg.html, text: msg.text, fromName: brand.name, replyTo: brand.email || undefined });
    return json({ ok: true, kind, id });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 502);
  }
}

// deno-lint-ignore no-explicit-any
const g: any = globalThis;
if (g.Deno?.serve) g.Deno.serve(handler);
