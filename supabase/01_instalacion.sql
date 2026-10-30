-- ════════════════════════════════════════════════════════════════════════════
-- BOOKING (Elian López Photo) · Instalación de la base de datos en Supabase
-- ────────────────────────────────────────────────────────────────────────────
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se puede volver a ejecutar sin perder datos (usa «if not exists» y reemplaza
-- funciones y políticas).
--
-- Qué crea:
--   · staff_profiles     equipo del panel (administradores y asistentes)
--   · site_config        configuración del sitio: marca, planes, extras, términos,
--                        horario, cuentas… (fila 'public' visible para todos,
--                        fila 'private' solo para administradores)
--   · booking_requests   solicitudes de reserva (solo el equipo puede leerlas)
--   · media              biblioteca de imágenes y videos de la web
--   · Buckets de Storage: 'media' (público) y 'receipts' (privado: comprobantes)
--   · Funciones: create_booking_request (reservas del público, valida precio,
--     horario, cupones y cupos en el servidor), get_busy_slots (horarios ocupados,
--     sin datos personales), get_plan_usage (cupos ocupados de los planes
--     limitados), check_coupon y add_staff_member (alta de miembros del equipo).
--
-- No contiene claves ni datos personales.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────── 1. Equipo ───────────────────────────

create table if not exists public.staff_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null check (role in ('admin', 'assistant')),
  brand_ids  text[],                 -- null = todas las marcas
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid() and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid() and is_active and role = 'admin');
$$;

create or replace function public.staff_can_see_brand(p_brand text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and is_active
      and (role = 'admin' or brand_ids is null or p_brand = any (brand_ids))
  );
$$;

-- Nunca puede quedarse el sistema sin un administrador activo.
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.staff_profiles where role = 'admin' and is_active) then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  return null;
end $$;

drop trigger if exists staff_keep_one_admin on public.staff_profiles;
create constraint trigger staff_keep_one_admin
  after update or delete on public.staff_profiles
  deferrable initially deferred
  for each row execute function public.keep_one_admin();

alter table public.staff_profiles enable row level security;

drop policy if exists "staff ve su perfil o admin ve todos" on public.staff_profiles;
create policy "staff ve su perfil o admin ve todos" on public.staff_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin edita perfiles" on public.staff_profiles;
create policy "admin edita perfiles" on public.staff_profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin borra perfiles" on public.staff_profiles;
create policy "admin borra perfiles" on public.staff_profiles
  for delete to authenticated using (public.is_admin() and user_id <> auth.uid());

-- Alta de un miembro: la cuenta debe existir antes en Authentication → Users.
create or replace function public.add_staff_member(p_email text, p_name text, p_role text, p_brand_ids text[] default null)
returns public.staff_profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_row public.staff_profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede añadir miembros del equipo.';
  end if;
  if p_role not in ('admin', 'assistant') then
    raise exception 'Rol no válido.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    raise exception 'No existe una cuenta con ese correo. Créala primero en Supabase → Authentication → Users → Add user.';
  end if;
  insert into public.staff_profiles (user_id, email, full_name, role, brand_ids, is_active)
  values (v_user, lower(trim(p_email)), trim(p_name), p_role, p_brand_ids, true)
  on conflict (user_id) do update
    set email = excluded.email, full_name = excluded.full_name, role = excluded.role,
        brand_ids = excluded.brand_ids, is_active = true
  returning * into v_row;
  return v_row;
end $$;

-- ─────────────────────────── 2. Configuración del sitio ───────────────────────────

create table if not exists public.site_config (
  id         text primary key check (id in ('public', 'private')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function public.touch_site_config()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists site_config_touch on public.site_config;
create trigger site_config_touch before insert or update on public.site_config
  for each row execute function public.touch_site_config();

alter table public.site_config enable row level security;

drop policy if exists "todos leen la configuración pública" on public.site_config;
create policy "todos leen la configuración pública" on public.site_config
  for select to anon, authenticated using (id = 'public' or public.is_admin());

drop policy if exists "admin crea configuración" on public.site_config;
create policy "admin crea configuración" on public.site_config
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin edita configuración" on public.site_config;
create policy "admin edita configuración" on public.site_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────── 3. Solicitudes de reserva ───────────────────────────

create sequence if not exists public.booking_request_seq start 1001;

create table if not exists public.booking_requests (
  id           text primary key,
  brand_id     text not null,
  status       text not null default 'pending_review',
  date         date,
  time         text,
  duration_min integer,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists booking_requests_brand_date_idx on public.booking_requests (brand_id, date);
create index if not exists booking_requests_created_idx on public.booking_requests (created_at desc);

-- Las columnas se derivan del payload (la app guarda la solicitud completa en payload).
create or replace function public.sync_booking_columns()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'No se puede cambiar el número de solicitud.';
  end if;
  new.payload      := jsonb_set(new.payload, '{id}', to_jsonb(new.id));
  new.brand_id     := coalesce(new.payload->>'brandId', new.brand_id);
  new.status       := coalesce(new.payload->>'status', new.status);
  new.date         := nullif(new.payload->>'date', '')::date;
  new.time         := nullif(new.payload->>'time', '');
  new.duration_min := nullif(new.payload->'quote'->>'durationMin', '')::integer;
  new.updated_at   := now();
  return new;
end $$;

drop trigger if exists booking_requests_sync on public.booking_requests;
create trigger booking_requests_sync before insert or update on public.booking_requests
  for each row execute function public.sync_booking_columns();

alter table public.booking_requests enable row level security;

drop policy if exists "equipo lee solicitudes de sus marcas" on public.booking_requests;
create policy "equipo lee solicitudes de sus marcas" on public.booking_requests
  for select to authenticated using (public.staff_can_see_brand(brand_id));

drop policy if exists "equipo actualiza solicitudes de sus marcas" on public.booking_requests;
create policy "equipo actualiza solicitudes de sus marcas" on public.booking_requests
  for update to authenticated
  using (public.staff_can_see_brand(brand_id))
  with check (public.staff_can_see_brand(brand_id));

drop policy if exists "admin borra solicitudes" on public.booking_requests;
create policy "admin borra solicitudes" on public.booking_requests
  for delete to authenticated using (public.is_admin());

-- El público NO lee ni escribe la tabla: solo usa las funciones de abajo.
revoke all on public.booking_requests from anon;

-- Horarios ocupados (sin datos personales) para mostrar la disponibilidad real.
create or replace function public.get_busy_slots(p_brand text, p_from date, p_to date)
returns table (slot_date date, slot_time text, duration_min integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.date, r.time, r.duration_min
  from public.booking_requests r
  where r.brand_id = p_brand
    and r.status <> 'cancelled'
    and r.date between p_from and least(p_to, p_from + 400)
  order by r.date, r.time;
$$;

-- Cupones de descuento. La lista está en la configuración PRIVADA (solo administradores);
-- el público solo puede preguntar por un código concreto con esta función.
-- Devuelve el cupón si se puede usar, o el motivo si no.
-- (Las versiones anteriores, sin plan, se quitan para que no haya dos con el mismo nombre.)
drop function if exists public.check_coupon(text, text, text);
drop function if exists public.coupon_check(text, text, text, date);
create or replace function public.coupon_check(p_code text, p_brand text, p_email text, p_today date, p_plan text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_c      jsonb;
  v_uses   integer;
begin
  if v_code = '' then return jsonb_build_object('valid', false, 'message', 'Escribe el código del cupón.'); end if;
  select e into v_c
    from public.site_config sc, jsonb_array_elements(coalesce(sc.data->'coupons', '[]')) e
   where sc.id = 'private' and upper(e->>'code') = v_code
   limit 1;
  if v_c is null or coalesce((v_c->>'active')::boolean, true) is not true then
    return jsonb_build_object('valid', false, 'message', 'Este cupón no es válido.');
  end if;
  if jsonb_typeof(v_c->'brandIds') = 'array' and jsonb_array_length(v_c->'brandIds') > 0
     and not ((v_c->'brandIds') ? p_brand) then
    return jsonb_build_object('valid', false, 'message', 'Este cupón no aplica para esta marca.');
  end if;
  if p_plan is not null and jsonb_typeof(v_c->'planIds') = 'array' and jsonb_array_length(v_c->'planIds') > 0
     and not ((v_c->'planIds') ? p_plan) then
    return jsonb_build_object('valid', false, 'message', 'Este cupón no aplica para el plan elegido.');
  end if;
  if nullif(v_c->>'validFrom', '') is not null and p_today < (v_c->>'validFrom')::date then
    return jsonb_build_object('valid', false, 'message', 'Este cupón todavía no está activo.');
  end if;
  if nullif(v_c->>'validTo', '') is not null and p_today > (v_c->>'validTo')::date then
    return jsonb_build_object('valid', false, 'message', 'Este cupón ya expiró.');
  end if;
  select count(*) into v_uses from public.booking_requests
   where status <> 'cancelled' and upper(payload->'quote'->'coupon'->>'code') = v_code;
  if nullif(v_c->>'maxUses', '') is not null and jsonb_typeof(v_c->'maxUses') <> 'null'
     and v_uses >= (v_c->>'maxUses')::numeric then
    return jsonb_build_object('valid', false, 'message', 'Este cupón ya alcanzó su límite de usos.');
  end if;
  if coalesce((v_c->>'onePerClient')::boolean, false) and coalesce(trim(p_email), '') <> '' and exists (
       select 1 from public.booking_requests
        where status <> 'cancelled' and upper(payload->'quote'->'coupon'->>'code') = v_code
          and lower(payload->'client'->>'email') = lower(trim(p_email))) then
    return jsonb_build_object('valid', false, 'message', 'Ya usaste este cupón en otra reserva.');
  end if;
  return jsonb_build_object('valid', true, 'code', v_code, 'type', coalesce(v_c->>'type', 'percent'),
                            'value', coalesce((v_c->>'value')::numeric, 0),
                            'planIds', case when jsonb_typeof(v_c->'planIds') = 'array' then v_c->'planIds' else null end);
end $$;

-- Versión pública: frena los intentos de adivinar códigos con una pequeña espera.
create or replace function public.check_coupon(p_code text, p_brand text, p_email text default null, p_plan text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform pg_sleep(0.4);
  return public.coupon_check(p_code, p_brand, p_email, (now() at time zone 'America/Santo_Domingo')::date, p_plan);
end $$;

-- Planes limitados: cupos ocupados por plan (solo números, sin datos personales).
-- Un cupo = una solicitud no cancelada con ese plan.
create or replace function public.get_plan_usage(p_brand text)
returns table (plan_id text, used integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.payload->>'planId', count(*)::integer
  from public.booking_requests r
  where r.brand_id = p_brand and r.status <> 'cancelled'
    and r.payload->>'planId' in (
      select e->>'id' from public.site_config sc, jsonb_array_elements(coalesce(sc.data->'plans', '[]')) e
       where sc.id = 'public' and e->>'brandId' = p_brand and coalesce((e->'limit'->>'enabled')::boolean, false))
  group by 1;
$$;

-- Reserva del público. Recalcula precio y duración con el catálogo publicado,
-- vuelve a comprobar el horario y guarda la solicitud. Ignora cualquier precio
-- que mande el navegador.
create or replace function public.create_booking_request(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg        jsonb;
  v_brand    jsonb;
  v_plan     jsonb;
  v_rules    jsonb;
  v_extra    jsonb;
  v_brand_id text := p->>'brandId';
  v_plan_id  text := p->>'planId';
  v_today    date := (now() at time zone 'America/Santo_Domingo')::date;
  v_now      timestamptz := now();
  v_date     date;
  v_time     text := p->>'time';
  v_lines    jsonb := '[]'::jsonb;
  v_key      text;
  v_val      jsonb;
  v_qty      integer;
  v_units    integer;
  v_price    integer;
  v_plan_price   integer;
  v_extras_total integer := 0;
  v_extra_min    integer := 0;
  v_base_min     integer;
  v_dur      integer;
  v_total    integer;
  v_pct      integer;
  v_deposit  integer;
  v_start    integer;
  v_open     integer;
  v_close    integer;
  v_buffer   integer;
  v_count    integer;
  v_id       text;
  v_first    text := trim(coalesce(p->'client'->>'firstName', ''));
  v_last     text := trim(coalesce(p->'client'->>'lastName', ''));
  v_email    text := lower(trim(coalesce(p->'client'->>'email', '')));
  v_phone    text := trim(coalesce(p->'client'->>'phone', ''));
  v_notes    text := trim(coalesce(p->>'notes', ''));
  v_rpath    text := p->'receipt'->>'path';
  v_robj     record;
  v_insp     jsonb := '[]'::jsonb;
  v_file     jsonb;
  v_fobj     record;
  v_payload  jsonb;
  v_coupon   jsonb;
  v_subtotal integer;
  v_discount integer := 0;
  v_limit    jsonb;
  v_used     integer;
begin
  -- Catálogo publicado
  select data into cfg from public.site_config where id = 'public';
  if cfg is null then raise exception 'Las reservas todavía no están disponibles.'; end if;

  select e into v_brand from jsonb_array_elements(coalesce(cfg->'brands', '[]')) e
   where e->>'id' = v_brand_id and coalesce((e->>'published')::boolean, true) limit 1;
  if v_brand is null then raise exception 'Esta marca no está disponible para reservas.'; end if;

  select e into v_plan from jsonb_array_elements(coalesce(cfg->'plans', '[]')) e
   where e->>'id' = v_plan_id and e->>'brandId' = v_brand_id and coalesce((e->>'active')::boolean, true) limit 1;
  if v_plan is null then raise exception 'El plan elegido ya no está disponible. Vuelve a elegir tu plan.'; end if;

  v_rules := cfg->'rules'->v_brand_id;
  if v_rules is null then raise exception 'La agenda de esta marca no está configurada.'; end if;

  -- Datos del cliente
  if v_first = '' or v_last = '' then raise exception 'Escribe tu nombre y apellido.'; end if;
  if length(v_first) > 80 or length(v_last) > 80 then raise exception 'El nombre es demasiado largo.'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(v_email) > 160 then raise exception 'Revisa tu correo electrónico.'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 15 then raise exception 'Revisa tu teléfono.'; end if;
  if length(v_notes) > 1500 then raise exception 'Las notas no pueden superar 1500 caracteres.'; end if;
  if coalesce((p->>'acceptedTerms')::boolean, false) is not true then raise exception 'Debes aceptar los términos y condiciones.'; end if;

  -- Precio (mismo cálculo que src/lib/pricing.js)
  v_plan_price := greatest(round(coalesce((v_plan->>'price')::numeric, 0)), 0);
  v_base_min   := greatest(coalesce((v_plan->>'durationMin')::integer, 0), 0);

  for v_key, v_val in select * from jsonb_each(coalesce(p->'extras', '{}'::jsonb)) loop
    select e into v_extra from jsonb_array_elements(coalesce(cfg->'extras', '[]')) e
     where e->>'id' = v_key and e->>'brandId' = v_brand_id and coalesce((e->>'active')::boolean, true)
       and (e->'appliesTo' is null or jsonb_typeof(e->'appliesTo') <> 'array'
            or jsonb_array_length(e->'appliesTo') = 0 or (e->'appliesTo') ? v_plan_id)
     limit 1;
    begin
      v_qty := greatest(floor(v_val::text::numeric), 0);
    exception when others then
      v_qty := 0;
    end;
    continue when v_extra is null or v_qty = 0;
    v_units := case when v_extra->>'pricing' = 'per_unit'
                    then least(v_qty, coalesce((v_extra->>'maxQty')::integer, v_qty))
                    else 1 end;
    v_price := greatest(round(coalesce((v_extra->>'price')::numeric, 0)), 0);
    v_lines := v_lines || jsonb_build_object(
      'id', v_extra->>'id', 'name', v_extra->>'name', 'unitPrice', v_price, 'quantity', v_units,
      'total', v_price * v_units, 'minutes', coalesce((v_extra->>'addsMinutes')::integer, 0) * v_units);
    v_extras_total := v_extras_total + v_price * v_units;
    v_extra_min    := v_extra_min + coalesce((v_extra->>'addsMinutes')::integer, 0) * v_units;
  end loop;

  v_subtotal := v_plan_price + v_extras_total;

  -- Cupón (mismo cálculo que src/lib/coupons.js). Se comprueba con el correo del cliente.
  if nullif(trim(coalesce(p->>'couponCode', '')), '') is not null then
    -- Un uso a la vez por cupón, para que dos reservas simultáneas no pasen del límite.
    perform pg_advisory_xact_lock(hashtext('coupon|' || upper(trim(p->>'couponCode'))));
    v_coupon := public.coupon_check(p->>'couponCode', v_brand_id, v_email, v_today, v_plan_id);
    if not (v_coupon->>'valid')::boolean then
      raise exception '% Quítalo para continuar.', v_coupon->>'message';
    end if;
    v_discount := least(v_subtotal, case when v_coupon->>'type' = 'percent'
      then round(v_subtotal * least(100, greatest(0, (v_coupon->>'value')::numeric)) / 100.0)
      else round(greatest(0, (v_coupon->>'value')::numeric)) end);
  end if;

  v_total   := v_subtotal - v_discount;
  v_pct     := least(100, greatest(0, coalesce((v_brand->>'depositPercent')::integer, 0)));
  v_deposit := round(v_total * v_pct / 100.0);
  v_dur     := v_base_min + v_extra_min;
  if v_dur = 0 then v_dur := coalesce((v_rules->>'defaultDurationMin')::integer, 60); end if;

  -- Fecha
  begin
    v_date := (p->>'date')::date;
  exception when others then
    raise exception 'Fecha no válida.';
  end;
  if v_date is null then raise exception 'Elige una fecha.'; end if;

  -- Plan limitado (mismas reglas que src/lib/planLimits.js): fechas y cupos.
  -- Un plan a la vez, para que dos reservas simultáneas no pasen del límite.
  v_limit := v_plan->'limit';
  if coalesce((v_limit->>'enabled')::boolean, false) then
    perform pg_advisory_xact_lock(hashtext('plan|' || v_plan_id));
    if nullif(v_limit->>'saleFrom', '') is not null and v_today < (v_limit->>'saleFrom')::date then
      raise exception 'Este plan todavía no está disponible.';
    end if;
    if (nullif(v_limit->>'saleTo', '') is not null and v_today > (v_limit->>'saleTo')::date)
       or (nullif(v_limit->>'sessionTo', '') is not null and v_today > (v_limit->>'sessionTo')::date) then
      raise exception 'Este plan ya no está disponible. Elige otro plan.';
    end if;
    if jsonb_typeof(v_limit->'maxBookings') = 'number' and (v_limit->>'maxBookings')::numeric >= 1 then
      select count(*) into v_used from public.booking_requests
       where brand_id = v_brand_id and status <> 'cancelled' and payload->>'planId' = v_plan_id;
      if v_used >= (v_limit->>'maxBookings')::numeric then
        raise exception 'Este plan ya no tiene cupos disponibles. Elige otro plan.';
      end if;
    end if;
    if (nullif(v_limit->>'sessionFrom', '') is not null and v_date < (v_limit->>'sessionFrom')::date)
       or (nullif(v_limit->>'sessionTo', '') is not null and v_date > (v_limit->>'sessionTo')::date) then
      raise exception 'Esa fecha no está disponible para este plan. Elige otra.';
    end if;
  end if;
  if v_date < v_today + coalesce((v_rules->>'minNoticeDays')::integer, 0)
     or v_date > v_today + coalesce((v_rules->>'maxAdvanceDays')::integer, 365) then
    raise exception 'Esa fecha ya no se puede reservar. Elige otra.';
  end if;
  if not ((v_rules->'workingDays') @> to_jsonb(extract(dow from v_date)::integer)) then
    raise exception 'Ese día no hay sesiones. Elige otra fecha.';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(cfg->'blockedDates', '[]')) b
              where b->>'brandId' = v_brand_id and b->>'date' = v_date::text) then
    raise exception 'Esa fecha no está disponible. Elige otra.';
  end if;

  -- Una reserva a la vez por marca y día (evita dobles reservas simultáneas)
  perform pg_advisory_xact_lock(hashtext(v_brand_id || '|' || v_date::text));

  select count(*) into v_count from public.booking_requests
   where brand_id = v_brand_id and date = v_date and status <> 'cancelled';
  if v_count >= coalesce((v_rules->>'maxBookingsPerDay')::integer, 99) then
    raise exception 'Ese día ya está completo. Elige otra fecha.';
  end if;

  if v_time is null or v_time !~ '^\d{2}:\d{2}$' then raise exception 'Elige un horario.'; end if;
  v_start := split_part(v_time, ':', 1)::integer * 60 + split_part(v_time, ':', 2)::integer;

  if coalesce(v_rules->>'mode', 'timed') = 'exclusive_day' then
    if not ((v_rules->'startTimes') @> to_jsonb(v_time)) then raise exception 'Ese horario no está disponible.'; end if;
  else
    v_open   := split_part(v_rules->>'openTime', ':', 1)::integer * 60 + split_part(v_rules->>'openTime', ':', 2)::integer;
    v_close  := split_part(v_rules->>'closeTime', ':', 1)::integer * 60 + split_part(v_rules->>'closeTime', ':', 2)::integer;
    v_buffer := coalesce((v_rules->>'bufferMin')::integer, 0);
    if v_start < v_open or v_start + v_dur > v_close
       or (v_start - v_open) % greatest(coalesce((v_rules->>'startStepMin')::integer, 30), 5) <> 0 then
      raise exception 'Ese horario no está disponible para la duración de tu sesión.';
    end if;
    if exists (
      select 1 from jsonb_array_elements(coalesce(v_rules->'breaks', '[]')) br
       where v_start < split_part(br->>'end', ':', 1)::integer * 60 + split_part(br->>'end', ':', 2)::integer
         and split_part(br->>'start', ':', 1)::integer * 60 + split_part(br->>'start', ':', 2)::integer < v_start + v_dur
    ) then
      raise exception 'Ese horario cruza una pausa del estudio. Elige otro.';
    end if;
    if exists (
      select 1 from public.booking_requests r
       where r.brand_id = v_brand_id and r.date = v_date and r.status <> 'cancelled' and r.time is not null
         and v_start < split_part(r.time, ':', 1)::integer * 60 + split_part(r.time, ':', 2)::integer
                       + coalesce(r.duration_min, (v_rules->>'defaultDurationMin')::integer, 60) + v_buffer
         and split_part(r.time, ':', 1)::integer * 60 + split_part(r.time, ':', 2)::integer - v_buffer < v_start + v_dur
    ) then
      raise exception 'Ese horario acaba de ocuparse. Vuelve al paso de fecha y elige otro.';
    end if;
  end if;

  -- Comprobante (obligatorio) e imágenes de inspiración: deben estar ya subidos.
  if v_rpath is null or v_rpath !~ '^incoming/' then raise exception 'Adjunta el comprobante de pago.'; end if;
  select name, metadata into v_robj from storage.objects where bucket_id = 'receipts' and name = v_rpath;
  if not found then raise exception 'No encontramos tu comprobante. Vuelve a adjuntarlo.'; end if;

  for v_file in select * from jsonb_array_elements(coalesce(p->'inspirationFiles', '[]')) limit 6 loop
    continue when v_file->>'path' is null or v_file->>'path' !~ '^incoming/';
    select name, metadata into v_fobj from storage.objects where bucket_id = 'receipts' and name = v_file->>'path';
    continue when not found;
    v_insp := v_insp || jsonb_build_object(
      'name', left(coalesce(v_file->>'name', 'imagen'), 120), 'path', v_fobj.name,
      'size', coalesce((v_fobj.metadata->>'size')::bigint, 0), 'type', coalesce(v_fobj.metadata->>'mimetype', ''));
  end loop;

  v_id := 'req-' || nextval('public.booking_request_seq');

  v_payload := jsonb_build_object(
    'id', v_id,
    'brandId', v_brand_id,
    'createdAt', v_now,
    'status', 'pending_review',
    'paymentStatus', 'submitted',
    'paymentRejectionReason', null,
    'client', jsonb_build_object('firstName', v_first, 'lastName', v_last, 'email', v_email, 'phone', v_phone),
    'notes', v_notes,
    'inspirationFiles', v_insp,
    'planId', v_plan->>'id',
    'planName', v_plan->>'name',
    'currency', coalesce(v_brand->>'currency', 'DOP'),
    'quote', jsonb_build_object(
      'planPrice', v_plan_price, 'lines', v_lines, 'extrasTotal', v_extras_total,
      'subtotal', v_subtotal, 'discount', v_discount,
      'coupon', case when v_discount > 0 then jsonb_build_object('code', v_coupon->>'code', 'type', v_coupon->>'type', 'value', (v_coupon->>'value')::numeric) else null end,
      'total', v_total,
      'depositPercent', v_pct, 'deposit', v_deposit, 'balance', v_total - v_deposit,
      'baseDurationMin', v_base_min, 'extraMinutes', v_extra_min, 'durationMin', v_base_min + v_extra_min),
    'date', v_date::text,
    'time', v_time,
    'receipt', jsonb_build_object(
      'name', left(coalesce(p->'receipt'->>'name', 'comprobante'), 120), 'path', v_robj.name,
      'size', coalesce((v_robj.metadata->>'size')::bigint, 0), 'type', coalesce(v_robj.metadata->>'mimetype', ''),
      'uploadedAt', v_now, 'declaredAmount', v_deposit),
    'acceptedTermsVersion', cfg->'terms'->v_brand_id->>'version',
    'confirmedAt', null,
    'shotAt', null,
    'deliveredAt', null,
    'galleryUrl', '',
    'payments', jsonb_build_array(jsonb_build_object(
      'id', v_id || '-p1', 'amount', v_deposit, 'method', 'transfer', 'concept', 'deposit',
      'date', v_today::text, 'reference', 'Comprobante adjunto', 'status', 'pending',
      'source', 'client', 'createdAt', v_now)),
    'history', jsonb_build_array(
      jsonb_build_object('at', v_now, 'label', 'Solicitud recibida desde el formulario público', 'by', 'Cliente'),
      jsonb_build_object('at', v_now, 'label', 'Comprobante de pago adjuntado', 'by', 'Cliente')),
    'internalNotes', '[]'::jsonb
  );

  insert into public.booking_requests (id, brand_id, payload) values (v_id, v_brand_id, v_payload);

  -- Al público solo se le devuelve lo necesario para la pantalla de gracias.
  return jsonb_build_object('id', v_id, 'planName', v_plan->>'name', 'quote', v_payload->'quote',
                            'date', v_date::text, 'time', v_time, 'brandId', v_brand_id);
end $$;

-- ─────────────────────────── 4. Biblioteca de imágenes y videos ───────────────────────────

create table if not exists public.media (
  id          text primary key,
  kind        text not null check (kind in ('image', 'video', 'inline')),
  brand_id    text,
  name        text not null default '',
  path        text not null,
  poster_path text,
  mime_type   text,
  width       integer,
  height      integer,
  duration    numeric,
  bytes       bigint,
  alt         text not null default '',
  focal       jsonb not null default '{"x":50,"y":50}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.media enable row level security;

drop policy if exists "todos leen la biblioteca" on public.media;
create policy "todos leen la biblioteca" on public.media for select to anon, authenticated using (true);

drop policy if exists "admin gestiona la biblioteca" on public.media;
create policy "admin gestiona la biblioteca" on public.media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────── 5. Storage ───────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 104857600,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "booking media lectura" on storage.objects;
create policy "booking media lectura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists "booking media subir" on storage.objects;
create policy "booking media subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "booking media editar" on storage.objects;
create policy "booking media editar" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());

drop policy if exists "booking media borrar" on storage.objects;
create policy "booking media borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- Cualquiera puede SUBIR un comprobante a incoming/ (no puede verlo, cambiarlo ni borrarlo).
drop policy if exists "booking comprobantes subir" on storage.objects;
create policy "booking comprobantes subir" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = 'incoming');

drop policy if exists "booking comprobantes ver equipo" on storage.objects;
create policy "booking comprobantes ver equipo" on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and public.is_staff());

drop policy if exists "booking comprobantes borrar admin" on storage.objects;
create policy "booking comprobantes borrar admin" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and public.is_admin());

-- ─────────────────────────── 6. Permisos ───────────────────────────

grant usage on schema public to anon, authenticated;
grant select on public.site_config, public.media to anon;
grant select, insert, update on public.site_config to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, update, delete on public.booking_requests to authenticated;
grant select, update, delete on public.staff_profiles to authenticated;

revoke all on function public.create_booking_request(jsonb) from public;
grant execute on function public.create_booking_request(jsonb) to anon, authenticated;
revoke all on function public.get_busy_slots(text, date, date) from public;
grant execute on function public.get_busy_slots(text, date, date) to anon, authenticated;
revoke all on function public.check_coupon(text, text, text, text) from public;
grant execute on function public.check_coupon(text, text, text, text) to anon, authenticated;
revoke all on function public.coupon_check(text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.get_plan_usage(text) from public;
grant execute on function public.get_plan_usage(text) to anon, authenticated;
revoke all on function public.add_staff_member(text, text, text, text[]) from public;
grant execute on function public.add_staff_member(text, text, text, text[]) to authenticated;
grant execute on function public.is_staff(), public.is_admin(), public.staff_can_see_brand(text) to anon, authenticated;

-- ─────────────────────────── 7. Tiempo real ───────────────────────────
-- El panel se actualiza solo cuando llega una reserva o cambia la configuración.

do $$
declare t text;
begin
  foreach t in array array['booking_requests', 'site_config', 'media'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
