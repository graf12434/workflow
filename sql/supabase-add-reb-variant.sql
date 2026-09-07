alter table public.workflow_reb_far
  add column if not exists variant text not null default 'РЕБ' check (variant in ('РЕБ', 'РЕР'));

create index if not exists workflow_reb_far_variant_idx on public.workflow_reb_far(variant);
