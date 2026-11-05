-- Посилення захисту бази. Безпечно запускати повторно.
-- Застосунок читає й пише дані лише після входу (роль authenticated), а таблиці
-- профілів та історії змінюють тільки тригери. Тому все інше закриваємо.

-- 1. Анонімний ключ (він публічний — лежить у коді сайту) більше не має жодних прав
--    на таблиці. Раніше від даних захищали лише політики RLS; тепер — і самі права.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 2. TRUNCATE обходить RLS — його не має бути ні в кого з клієнтів.
revoke truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate on tables from authenticated;

-- 3. Профілі та історія змін — лише читання. Ролі й журнал дій не змінити з браузера
--    навіть за помилки в політиках; пише в них тільки тригер.
revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.workflow_records_history from authenticated;

-- 4. Тригерні функції не можна викликати через API (/rest/v1/rpc/...).
--    Тригери при цьому працюють як і раніше: право виконання перевіряється лише
--    під час створення тригера.
revoke execute on function public.create_profile_for_user() from public, anon, authenticated;
revoke execute on function public.log_workflow_records_change() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- 5. get_my_role потрібна політикам і застосунку після входу — лишаємо тільки авторизованим.
revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

-- 6. Фіксований search_path, щоб функцію не можна було підмінити чужою схемою.
alter function public.set_updated_at() set search_path = '';

-- 7. Профілі (email і роль) кожен бачить лише свій. Для історії змін позивні авторів
--    віддає окрема функція — тільки id і позивний, без email.
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create or replace function public.get_display_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = any(ids)
    and (select auth.uid()) is not null;
$$;

revoke execute on function public.get_display_names(uuid[]) from public, anon;
grant execute on function public.get_display_names(uuid[]) to authenticated;
