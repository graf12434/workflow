create table if not exists public.workflow_reb_far (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serial_number text not null,
  ownership text not null check (ownership in ('company', 'regiment')),
  status text not null check (status in ('ready', 'not_ready', 'repair', 'destroyed')),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_reb_far_name_idx on public.workflow_reb_far(lower(name));
create index if not exists workflow_reb_far_serial_idx on public.workflow_reb_far(lower(serial_number));

drop trigger if exists workflow_reb_far_set_updated_at on public.workflow_reb_far;
create trigger workflow_reb_far_set_updated_at
before update on public.workflow_reb_far
for each row execute function public.set_updated_at();

alter table public.workflow_reb_far enable row level security;

drop policy if exists "reb_far_select_authenticated" on public.workflow_reb_far;
drop policy if exists "reb_far_insert_operator_admin" on public.workflow_reb_far;
drop policy if exists "reb_far_update_operator_admin" on public.workflow_reb_far;
drop policy if exists "reb_far_delete_admin" on public.workflow_reb_far;

create policy "reb_far_select_authenticated"
on public.workflow_reb_far for select
to authenticated
using (true);

create policy "reb_far_insert_operator_admin"
on public.workflow_reb_far for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.get_my_role() in ('admin', 'operator')
);

create policy "reb_far_update_operator_admin"
on public.workflow_reb_far for update
to authenticated
using (public.get_my_role() in ('admin', 'operator'))
with check (public.get_my_role() in ('admin', 'operator'));

create policy "reb_far_delete_admin"
on public.workflow_reb_far for delete
to authenticated
using (public.get_my_role() = 'admin');
