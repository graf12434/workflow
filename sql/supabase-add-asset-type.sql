alter table public.workflow_assets
  add column if not exists type text check (type in ('long', 'medium', 'dome'));

create index if not exists workflow_assets_type_idx on public.workflow_assets(type);
