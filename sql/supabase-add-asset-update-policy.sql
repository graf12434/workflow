drop policy if exists "assets_update_admin" on public.workflow_assets;

create policy "assets_update_admin"
on public.workflow_assets for update
to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');
