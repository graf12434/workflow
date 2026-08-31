create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  asset text not null,
  name text not null,
  serial_number text not null,
  area text not null,
  action_type text not null check (action_type in ('deploy', 'recover')),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_records_date_idx on public.workflow_records(date desc);
create index if not exists workflow_records_serial_idx on public.workflow_records(lower(serial_number));
create index if not exists workflow_records_area_idx on public.workflow_records(area);
create index if not exists workflow_records_asset_idx on public.workflow_records(asset);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workflow_records_set_updated_at on public.workflow_records;
create trigger workflow_records_set_updated_at
before update on public.workflow_records
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_user();

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.workflow_records enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "records_select_authenticated" on public.workflow_records;
drop policy if exists "records_insert_operator_admin" on public.workflow_records;
drop policy if exists "records_update_operator_admin" on public.workflow_records;
drop policy if exists "records_delete_admin" on public.workflow_records;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "records_select_authenticated"
on public.workflow_records for select
to authenticated
using (true);

create policy "records_insert_operator_admin"
on public.workflow_records for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.get_my_role() in ('admin', 'operator')
);

create policy "records_update_operator_admin"
on public.workflow_records for update
to authenticated
using (public.get_my_role() in ('admin', 'operator'))
with check (public.get_my_role() in ('admin', 'operator'));

create policy "records_delete_admin"
on public.workflow_records for delete
to authenticated
using (public.get_my_role() = 'admin');

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

-- Після створення першого користувача призначте адміністратора:
-- update public.profiles set role = 'admin' where email = 'your@email.com';
