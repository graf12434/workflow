alter table public.workflow_records
  drop constraint if exists workflow_records_action_type_check;

alter table public.workflow_records
  add constraint workflow_records_action_type_check
  check (action_type in ('deploy', 'recover', 'relocate', 'destroyed'));
