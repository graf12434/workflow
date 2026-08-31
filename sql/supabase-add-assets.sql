create table if not exists public.workflow_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists workflow_assets_name_idx on public.workflow_assets(lower(name));

alter table public.workflow_assets enable row level security;

drop policy if exists "assets_select_authenticated" on public.workflow_assets;
drop policy if exists "assets_insert_admin" on public.workflow_assets;

create policy "assets_select_authenticated"
on public.workflow_assets for select
to authenticated
using (true);

create policy "assets_insert_admin"
on public.workflow_assets for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.get_my_role() = 'admin'
);

insert into public.workflow_assets (name)
values ('Starlink'), ('РЕБ'), ('Ретранслятор')
on conflict (name) do nothing;
