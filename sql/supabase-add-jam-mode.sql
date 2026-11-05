-- Тип перешкоди засобів РЕБ: "Білий шум" (noise) або "Штора" (curtain).
-- Усі наявні записи стають "Білий шум", тож поточна версія сайту працює без змін.
-- "Штора" буває лише спрямованої дії й дального радіуса — це гарантує окреме обмеження.

alter table public.workflow_assets
  add column if not exists jam_mode text not null default 'noise';
alter table public.workflow_assets drop constraint if exists workflow_assets_jam_mode_check;
alter table public.workflow_assets
  add constraint workflow_assets_jam_mode_check
  check (jam_mode in ('noise', 'curtain'));
alter table public.workflow_assets drop constraint if exists workflow_assets_curtain_check;
alter table public.workflow_assets
  add constraint workflow_assets_curtain_check
  check (jam_mode <> 'curtain' or (category = 'directional' and type = 'long'));
create index if not exists workflow_assets_jam_mode_idx on public.workflow_assets(jam_mode);

alter table public.workflow_reb_far
  add column if not exists jam_mode text not null default 'noise';
alter table public.workflow_reb_far drop constraint if exists workflow_reb_far_jam_mode_check;
alter table public.workflow_reb_far
  add constraint workflow_reb_far_jam_mode_check
  check (jam_mode in ('noise', 'curtain'));
alter table public.workflow_reb_far drop constraint if exists workflow_reb_far_curtain_check;
alter table public.workflow_reb_far
  add constraint workflow_reb_far_curtain_check
  check (jam_mode <> 'curtain' or (category = 'directional' and type = 'long'));
create index if not exists workflow_reb_far_jam_mode_idx on public.workflow_reb_far(jam_mode);
