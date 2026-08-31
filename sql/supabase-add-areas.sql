create table if not exists public.workflow_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists workflow_areas_name_idx on public.workflow_areas(lower(name));

alter table public.workflow_areas enable row level security;

drop policy if exists "areas_select_authenticated" on public.workflow_areas;
drop policy if exists "areas_insert_admin" on public.workflow_areas;

create policy "areas_select_authenticated"
on public.workflow_areas for select
to authenticated
using (true);

create policy "areas_insert_admin"
on public.workflow_areas for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.get_my_role() = 'admin'
);
