-- v2.5: додатковий захист бази після перевірки безпеки (2026-11-24).
-- Виконати один раз у Supabase SQL Editor. Повторний запуск безпечний.
--
-- 1. Автор і дата створення запису незмінні. Політики UPDATE перевіряють лише роль, тож
--    оператор міг би, редагуючи запис, підставити іншого автора (created_by) чи дату
--    створення. Тригер повертає старі значення при кожному оновленні.
-- 2. Функції з правами власника (SECURITY DEFINER) — з порожнім search_path і повними
--    іменами об'єктів, щоб їх не можна було підмінити об'єктами з іншої схеми.

begin;

-- 1. Незмінні автор і дата створення
create or replace function public.keep_row_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke execute on function public.keep_row_author() from public, anon, authenticated;

drop trigger if exists workflow_records_keep_author on public.workflow_records;
create trigger workflow_records_keep_author
  before update on public.workflow_records
  for each row execute function public.keep_row_author();

drop trigger if exists workflow_reb_far_keep_author on public.workflow_reb_far;
create trigger workflow_reb_far_keep_author
  before update on public.workflow_reb_far
  for each row execute function public.keep_row_author();

drop trigger if exists workflow_assets_keep_author on public.workflow_assets;
create trigger workflow_assets_keep_author
  before update on public.workflow_assets
  for each row execute function public.keep_row_author();

drop trigger if exists workflow_areas_keep_author on public.workflow_areas;
create trigger workflow_areas_keep_author
  before update on public.workflow_areas
  for each row execute function public.keep_row_author();

-- 2. Порожній search_path у функціях з правами власника
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.log_workflow_records_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (new.id, 'created', (select auth.uid()), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (new.id, 'updated', (select auth.uid()), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (old.id, 'deleted', (select auth.uid()), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

commit;

-- Перевірка: 4 тригери keep_author і search_path = '' у трьох функціях
select tgname, tgrelid::regclass from pg_trigger where tgname like '%keep_author' order by 1;
select proname, proconfig from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_my_role', 'create_profile_for_user', 'log_workflow_records_change');
