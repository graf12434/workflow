alter table public.workflow_assets
  add column if not exists variant text check (variant in ('РЕБ', 'РЕР'));

create index if not exists workflow_assets_variant_idx on public.workflow_assets(variant);
