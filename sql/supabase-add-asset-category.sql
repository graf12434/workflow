-- 1. Розширити variant, щоб дозволити нові прості каталоги.
alter table public.workflow_assets drop constraint if exists workflow_assets_variant_check;
alter table public.workflow_assets
  add constraint workflow_assets_variant_check
  check (variant in ('РЕБ', 'РЕР', 'АДР', 'Спец обладнання', 'Запчастини', 'Інше'));

-- 2. Додати категорію (верхній рівень поділу для РЕБ/РЕР).
alter table public.workflow_assets add column if not exists category text;
alter table public.workflow_assets drop constraint if exists workflow_assets_category_check;
alter table public.workflow_assets
  add constraint workflow_assets_category_check
  check (category in ('directional', 'dome', 'rer', 'video'));
create index if not exists workflow_assets_category_idx on public.workflow_assets(category);

-- 3. Backfill: старі "Купольні" (type='dome') не мали дальності — призначаємо
--    "Дальньої дії" за замовчуванням. Решта РЕБ-записів -> "Спрямованої дії".
--    Усі наявні РЕР-записи -> "Засіб РЕР" (категорія "відео" стартує порожньою).
update public.workflow_assets set category = 'directional'
  where variant = 'РЕБ' and type in ('long', 'medium');
update public.workflow_assets set category = 'dome', type = 'long'
  where variant = 'РЕБ' and type = 'dome';
update public.workflow_assets set category = 'rer'
  where variant = 'РЕР';

-- 4. Тепер, коли жоден рядок не має type='dome', звузити type до самої лише
--    дальності (dome більше не тип, а категорія).
alter table public.workflow_assets drop constraint if exists workflow_assets_type_check;
alter table public.workflow_assets
  add constraint workflow_assets_type_check
  check (type in ('long', 'medium'));
