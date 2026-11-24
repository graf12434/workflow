-- Видалення дублікатів засобів і захист від дублів (v2.3).
-- Виконати один раз у Supabase SQL Editor. Повторний запуск безпечний.
--
-- 1. Дублікати: "ХУАН" № 706 і № 707 внесено двічі (2026-11-01, з різницею 19 хв).
--    Лишаємо по одному запису. Для № 706 — той, що в стані "Ремонт": остання подія
--    в журналі (13.11.2026) — ремонт. Журнал прив'язаний до назви й номера, тож його
--    записи лишаються за засобом, що залишився.
--    Пари з номером "Б/Н" (Бар'єр UF, VIDIK-P_V3, Циклон) — різні засоби без номера,
--    їх не чіпаємо.
-- 2. Унікальний індекс засобів: назва + серійний № (без різниці у регістрі й пробілах
--    по краях); "Б/Н" — виняток.
-- 3. Унікальний індекс журналу: та сама дата, дія, засіб, номер і позиція — це одна подія.

begin;

delete from public.workflow_reb_far
where id in (
  'd61cad68-9bbd-431d-9709-80381fee40fc', -- ХУАН № 706, другий запис (в строю)
  '13ab0b81-8c30-4bc2-a24a-94f985a8aa5e'  -- ХУАН № 707, другий запис
);

create unique index if not exists workflow_reb_far_name_serial_key
  on public.workflow_reb_far (lower(btrim(name)), lower(btrim(serial_number)))
  where lower(btrim(serial_number)) <> 'б/н';

create unique index if not exists workflow_records_event_key
  on public.workflow_records (date, action_type, lower(btrim(asset)), lower(btrim(serial_number)), lower(btrim(name)));

commit;

-- Перевірка: має повернути 0 рядків
select name, serial_number, count(*)
from public.workflow_reb_far
where lower(btrim(serial_number)) <> 'б/н'
group by lower(btrim(name)), lower(btrim(serial_number)), name, serial_number
having count(*) > 1;
