alter table public.workflow_reb_far
  drop constraint if exists workflow_reb_far_status_check;

update public.workflow_reb_far set status = 'in_formation' where status = 'ready';
update public.workflow_reb_far set status = 'company_storage' where status = 'not_ready';

alter table public.workflow_reb_far
  add constraint workflow_reb_far_status_check
  check (status in ('in_formation', 'company_storage', 'logistics_storage', 'repair', 'destroyed'));
