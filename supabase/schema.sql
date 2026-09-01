-- ============================================================
-- CORENERGY THE GYM — DATABASE SCHEMA
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. SYSTEM CONFIG (tracks whether the first admin has been created)
-- ------------------------------------------------------------
create table if not exists system_config (
  id int primary key default 1 check (id = 1), -- only one row ever
  setup_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into system_config (id, setup_completed)
values (1, false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. GYM SETTINGS (single row of gym info, editable in Settings page)
-- ------------------------------------------------------------
create table if not exists gym_settings (
  id int primary key default 1 check (id = 1),
  gym_name text not null default 'CoreEnergy The Gym',
  contact_number text,
  whatsapp_number text,
  address text,
  expiring_soon_days int not null default 7, -- configurable "expiring soon" threshold
  updated_at timestamptz not null default now()
);

insert into gym_settings (id)
values (1)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. MEMBERS
-- ------------------------------------------------------------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  member_code text unique not null, -- human-friendly ID e.g. CE-0001
  full_name text not null,
  mobile text not null,
  alt_mobile text,
  date_of_birth date,
  gender text,
  address text,
  emergency_contact text,
  notes text,
  photo_path text, -- path inside the private "member-photos" storage bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_name on members (full_name);
create index if not exists idx_members_mobile on members (mobile);
create index if not exists idx_members_code on members (member_code);

-- ------------------------------------------------------------
-- 4. MEMBERSHIPS (one member -> many memberships over time)
-- ------------------------------------------------------------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  plan text not null,
  duration_days int not null,
  start_date date not null,
  expiry_date date not null,
  fee numeric(10,2) not null default 0 check (fee >= 0),
  renewed_from_membership_id uuid references memberships(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_member on memberships (member_id);
create index if not exists idx_memberships_expiry on memberships (expiry_date);

-- ------------------------------------------------------------
-- 5. PAYMENTS (one membership -> many payments)
-- ------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_date date not null default current_date,
  purpose text default 'Membership',
  method text, -- Cash / UPI / Bank Transfer / Other
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_membership on payments (membership_id);
create index if not exists idx_payments_member on payments (member_id);
create index if not exists idx_payments_date on payments (payment_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- Rule: nobody can read/write member, membership, payment or
-- settings data unless they are logged in (authenticated).
-- system_config is the one exception — it must be readable by
-- anyone so the app can decide "show setup" vs "show login".
-- ============================================================

alter table system_config enable row level security;
alter table gym_settings enable row level security;
alter table members enable row level security;
alter table memberships enable row level security;
alter table payments enable row level security;

-- system_config: anyone can check setup status, only logged-in users can update it
create policy "system_config_read_all" on system_config
  for select using (true);

create policy "system_config_update_authenticated" on system_config
  for update using (auth.role() = 'authenticated');

-- gym_settings: fully private to logged-in admin
create policy "gym_settings_all_authenticated" on gym_settings
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- members: fully private to logged-in admin
create policy "members_all_authenticated" on members
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- memberships: fully private to logged-in admin
create policy "memberships_all_authenticated" on memberships
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- payments: fully private to logged-in admin
create policy "payments_all_authenticated" on payments
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE: private bucket for member photos
-- Run this part too — it creates a bucket that is NOT public.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', false)
on conflict (id) do nothing;

create policy "member_photos_read_authenticated"
  on storage.objects for select
  using (bucket_id = 'member-photos' and auth.role() = 'authenticated');

create policy "member_photos_write_authenticated"
  on storage.objects for insert
  with check (bucket_id = 'member-photos' and auth.role() = 'authenticated');

create policy "member_photos_update_authenticated"
  on storage.objects for update
  using (bucket_id = 'member-photos' and auth.role() = 'authenticated');

create policy "member_photos_delete_authenticated"
  on storage.objects for delete
  using (bucket_id = 'member-photos' and auth.role() = 'authenticated');
