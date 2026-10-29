-- ════════════════════════════════════════════════════════════════════════════
-- MOREL BOOKING · Primer administrador
-- ────────────────────────────────────────────────────────────────────────────
-- 1. Supabase → Authentication → Users → «Add user» → «Create new user».
--    Escribe tu correo y una contraseña segura y marca «Auto Confirm User».
-- 2. Cambia abajo el correo y el nombre por los tuyos.
-- 3. SQL Editor → pega este archivo → Run.
--
-- Los demás miembros del equipo (administradores o asistentes) se añaden después
-- desde el panel: Usuarios y roles.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.staff_profiles (user_id, email, full_name, role)
select id, lower(email), 'Tu nombre', 'admin'
from auth.users
where lower(email) = lower('tu-correo@ejemplo.com')
on conflict (user_id) do update set role = 'admin', is_active = true;

-- Comprobación: debe aparecer una fila con role = admin.
select email, full_name, role, is_active from public.staff_profiles;
