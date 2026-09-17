-- Аудит-журнал: автоматично фіксує кожне створення/редагування/видалення
-- запису в журналі подій (workflow_records), хто це зробив і коли.

-- Позивний/ім'я для відображення замість email у вікні "Історія". Значення
-- проставляються вручну командою update нижче (заповни своїми email і
-- позивними) — це не частина цього файлу навмисно, щоб реальні email не
-- потрапляли в git-репозиторій.
alter table public.profiles add column if not exists display_name text;

create table if not exists public.workflow_records_history (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index if not exists workflow_records_history_record_idx
  on public.workflow_records_history(record_id, changed_at desc);

create or replace function public.log_workflow_records_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (new.id, 'created', auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (new.id, 'updated', auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.workflow_records_history (record_id, action, changed_by, snapshot)
    values (old.id, 'deleted', auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists workflow_records_log_changes on public.workflow_records;
create trigger workflow_records_log_changes
after insert or update or delete on public.workflow_records
for each row execute function public.log_workflow_records_change();

alter table public.workflow_records_history enable row level security;

drop policy if exists "records_history_select_authenticated" on public.workflow_records_history;

create policy "records_history_select_authenticated"
on public.workflow_records_history for select
to authenticated
using (true);

-- Щоб у вікні "Історія" можна було показати email автора кожної дії (а не
-- лише свого власного), потрібно розширити читання profiles на всіх
-- авторизованих користувачів (раніше кожен бачив лише свій профіль).
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);
