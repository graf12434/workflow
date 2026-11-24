-- v2.6: обов'язковий двофакторний вхід (Google Authenticator) для всіх користувачів.
--
-- ПОРЯДОК: спершу на сайт має потрапити v2.6 (екран підключення Google Authenticator),
-- лише потім виконувати цей файл. Інакше після нього старий сайт не покаже жодних даних.
-- Виконати один раз у Supabase SQL Editor. Повторний запуск безпечний.
--
-- Як працює: після пароля сесія має рівень aal1, після коду з Google Authenticator — aal2.
-- Обмежувальні (restrictive) політики додаються до наявних: тепер, крім ролі, кожен запит
-- до таблиць вимагає aal2. Пароль без телефона не дає жодних даних — ні на сайті, ні через API.
-- Підключення Google Authenticator (QR-код) працює на рівні aal1 через Supabase Auth,
-- тож заблокуватись цим файлом неможливо.
--
-- Загублений телефон: Supabase Dashboard → Authentication → Users → користувач →
-- видалити MFA-фактор. Наступного входу сайт знову покаже QR-код.

begin;

create or replace function public.has_second_factor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

drop policy if exists require_mfa on public.profiles;
create policy require_mfa on public.profiles
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

drop policy if exists require_mfa on public.workflow_records;
create policy require_mfa on public.workflow_records
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

drop policy if exists require_mfa on public.workflow_records_history;
create policy require_mfa on public.workflow_records_history
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

drop policy if exists require_mfa on public.workflow_reb_far;
create policy require_mfa on public.workflow_reb_far
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

drop policy if exists require_mfa on public.workflow_assets;
create policy require_mfa on public.workflow_assets
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

drop policy if exists require_mfa on public.workflow_areas;
create policy require_mfa on public.workflow_areas
  as restrictive for all to authenticated
  using ((select public.has_second_factor()))
  with check ((select public.has_second_factor()));

-- Функції з правами власника оминають RLS — перевірка aal2 і в них
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid())
    and (select public.has_second_factor());
$$;

create or replace function public.get_display_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = any(ids)
    and (select auth.uid()) is not null
    and (select public.has_second_factor());
$$;

commit;

-- Перевірка: 6 політик require_mfa
select tablename, policyname, permissive from pg_policies where policyname = 'require_mfa' order by 1;

-- АВАРІЙНЕ ВІДКАТ (лише якщо щось пішло не так) — зняти вимогу коду:
-- drop policy if exists require_mfa on public.profiles;
-- drop policy if exists require_mfa on public.workflow_records;
-- drop policy if exists require_mfa on public.workflow_records_history;
-- drop policy if exists require_mfa on public.workflow_reb_far;
-- drop policy if exists require_mfa on public.workflow_assets;
-- drop policy if exists require_mfa on public.workflow_areas;
