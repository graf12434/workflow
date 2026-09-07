alter table public.workflow_reb_far
  drop constraint if exists workflow_reb_far_ownership_check;

alter table public.workflow_reb_far
  add constraint workflow_reb_far_ownership_check
  check (ownership in ('company', 'regiment', 'community'));
