create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "records_insert_operator_admin" on public.workflow_records;
drop policy if exists "records_update_operator_admin" on public.workflow_records;
drop policy if exists "records_delete_admin" on public.workflow_records;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "records_insert_operator_admin"
on public.workflow_records for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.get_my_role() in ('admin', 'operator')
);

create policy "records_update_operator_admin"
on public.workflow_records for update
to authenticated
using (public.get_my_role() in ('admin', 'operator'))
with check (public.get_my_role() in ('admin', 'operator'));

create policy "records_delete_admin"
on public.workflow_records for delete
to authenticated
using (public.get_my_role() = 'admin');
