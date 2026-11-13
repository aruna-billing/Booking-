-- ════════════════════════════════════════════════════════════════════════════
-- Recordatorio automático «Día de la sesión» (opcional)
-- ────────────────────────────────────────────────────────────────────────────
-- Cada hora, en punto, revisa las reservas CONFIRMADAS y, cuando llega el día
-- (o el día antes, según Personalización → Correos → «Día de la sesión») y la hora
-- elegida, las marca. Esa marca dispara el mismo Database Webhook de siempre, y la
-- función «booking-emails» envía el correo con el texto del panel.
--
-- · No lleva contraseñas ni claves: usa el webhook que ya tienes configurado.
-- · Cada reserva recibe un solo recordatorio por fecha. Si la mueves a otro día,
--   recibe otro para la fecha nueva.
-- · Si apagas el correo «Día de la sesión» en el panel, no se marca nada.
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se puede ejecutar varias veces sin problema.
-- Para quitarlo:  select cron.unschedule('recordatorio-dia-sesion');
-- ════════════════════════════════════════════════════════════════════════════

-- 1) pg_cron: el programador de tareas de Supabase.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- 2) Columnas para no enviar dos veces (el panel no las toca).
alter table public.booking_requests add column if not exists reminder_for date;
alter table public.booking_requests add column if not exists reminder_at  timestamptz;

-- 3) Marca las reservas a las que les toca recordatorio ahora mismo.
create or replace function public.mark_session_reminders()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now    timestamp := now() at time zone 'America/Santo_Domingo';  -- hora de RD
  v_brand  jsonb;
  v_rem    jsonb;
  v_hour   integer;
  v_before boolean;
  v_target date;
  v_n      integer;
  v_total  integer := 0;
begin
  for v_brand in
    select b from public.site_config c, jsonb_array_elements(coalesce(c.data->'brands', '[]'::jsonb)) b where c.id = 'public'
  loop
    v_rem := coalesce(v_brand #> '{web,emails,reminder}', '{}'::jsonb);
    continue when coalesce(v_rem->>'enabled', 'true') = 'false';

    v_hour := case when coalesce(v_rem->>'hour', '') ~ '^\d{1,2}$' then least((v_rem->>'hour')::integer, 23) else 8 end;
    continue when extract(hour from v_now) < v_hour;

    v_before := coalesce(v_rem->>'when', '') = 'day_before';
    v_target := v_now::date + case when v_before then 1 else 0 end;

    update public.booking_requests r
       set reminder_for = v_target,
           reminder_at  = now(),
           payload      = jsonb_set(
             r.payload, '{history}',
             coalesce(r.payload->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
               'label', 'Recordatorio «Día de la sesión» enviado por correo (automático)',
               'by', 'Sistema')))
     where r.brand_id = v_brand->>'id'
       and r.status = 'confirmed'
       and r.date = v_target
       and r.reminder_for is distinct from v_target
       and coalesce(r.payload->'client'->>'email', '') like '%@%'
       -- El mismo día: solo si la sesión aún no ha empezado.
       and (v_before or r.time is null or r.time > to_char(v_now, 'HH24:MI'));
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end $$;

revoke all on function public.mark_session_reminders() from public, anon, authenticated;

-- 4) Programarlo cada hora, en punto (si ya existía, se actualiza).
select cron.schedule('recordatorio-dia-sesion', '0 * * * *', 'select public.mark_session_reminders()');

-- Comprobación: debe salir una fila «recordatorio-dia-sesion».
select jobname, schedule, active from cron.job where jobname = 'recordatorio-dia-sesion';
