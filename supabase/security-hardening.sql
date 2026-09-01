-- ============================================================
-- CORENERGY THE GYM — SECURITY HARDENING MIGRATION
-- Run this ONCE for an existing Phase 3 Supabase project.
-- ============================================================

-- A singleton admin record. Only the FIRST Supabase Auth user becomes admin.
create table if not exists admin_users (
  id int primary key default 1 check (id = 1),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- Helper used by RLS. SECURITY DEFINER avoids recursive RLS checks.
create or replace function public.is_gym_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_gym_admin() from public;
grant execute on function public.is_gym_admin() to anon, authenticated;

-- Safely marks the very first Auth user as the only admin.
create or replace function public.handle_first_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_users (id, user_id)
  values (1, new.id)
  on conflict (id) do nothing;

  if exists (select 1 from public.admin_users where id = 1 and user_id = new.id) then
    update public.system_config
      set setup_completed = true,
          updated_at = now()
      where id = 1;
  end if;

  return new;
end;
$$;

-- Install the trigger on Supabase Auth users.
drop trigger if exists on_auth_user_created_make_first_admin on auth.users;
create trigger on_auth_user_created_make_first_admin
  after insert on auth.users
  for each row execute procedure public.handle_first_admin();

-- Backfill safely if this is being run after an admin already exists.
-- IMPORTANT: If admin_users is empty, the oldest existing auth user becomes admin.
insert into public.admin_users (id, user_id)
select 1, id
from auth.users
order by created_at asc
limit 1
on conflict (id) do nothing;

update public.system_config
set setup_completed = exists (select 1 from public.admin_users where id = 1),
    updated_at = now()
where id = 1;

-- Replace broad authenticated-user policies with admin-only policies.
drop policy if exists "system_config_update_authenticated" on public.system_config;
drop policy if exists "gym_settings_all_authenticated" on public.gym_settings;
drop policy if exists "members_all_authenticated" on public.members;
drop policy if exists "memberships_all_authenticated" on public.memberships;
drop policy if exists "payments_all_authenticated" on public.payments;

drop policy if exists "member_photos_read_authenticated" on storage.objects;
drop policy if exists "member_photos_write_authenticated" on storage.objects;
drop policy if exists "member_photos_update_authenticated" on storage.objects;
drop policy if exists "member_photos_delete_authenticated" on storage.objects;

create policy "system_config_update_admin" on public.system_config
  for update using (public.is_gym_admin())
  with check (public.is_gym_admin());

create policy "gym_settings_admin_only" on public.gym_settings
  for all using (public.is_gym_admin())
  with check (public.is_gym_admin());

create policy "members_admin_only" on public.members
  for all using (public.is_gym_admin())
  with check (public.is_gym_admin());

create policy "memberships_admin_only" on public.memberships
  for all using (public.is_gym_admin())
  with check (public.is_gym_admin());

create policy "payments_admin_only" on public.payments
  for all using (public.is_gym_admin())
  with check (public.is_gym_admin());

create policy "member_photos_read_admin" on storage.objects
  for select using (bucket_id = 'member-photos' and public.is_gym_admin());

create policy "member_photos_write_admin" on storage.objects
  for insert with check (bucket_id = 'member-photos' and public.is_gym_admin());

create policy "member_photos_update_admin" on storage.objects
  for update using (bucket_id = 'member-photos' and public.is_gym_admin())
  with check (bucket_id = 'member-photos' and public.is_gym_admin());

create policy "member_photos_delete_admin" on storage.objects
  for delete using (bucket_id = 'member-photos' and public.is_gym_admin());

-- admin_users itself is not exposed for browsing. The helper function above
-- is the only thing normal application policies need.
