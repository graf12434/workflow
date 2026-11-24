-- v2.4: нова дія в журналі "Повернення з ремонту" (returned).
-- Після неї сайт переводить засіб у стан "Склад роти".
-- Виконати один раз у Supabase SQL Editor. Повторний запуск безпечний.
alter table public.workflow_records drop constraint if exists workflow_records_action_type_check;
alter table public.workflow_records
  add constraint workflow_records_action_type_check
  check (action_type in ('deploy', 'recover', 'relocate', 'repair', 'returned', 'maintenance', 'destroyed'));
