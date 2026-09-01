-- ============================================================
-- PHASE 2 ADDITIONS — run this AFTER supabase/schema.sql
-- (Supabase Dashboard -> SQL Editor -> New Query -> paste -> Run)
-- ============================================================

-- Generates member IDs like CE-0001, CE-0002, ... one at a time,
-- safely even if two people add a member at the exact same moment
-- (a plain "count + 1" in JavaScript can't guarantee that; a
-- database sequence can).
create sequence if not exists member_code_seq start 1;

create or replace function generate_member_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val int;
begin
  next_val := nextval('member_code_seq');
  return 'CE-' || lpad(next_val::text, 4, '0');
end;
$$;

-- Only logged-in admins can call this (matches every other table's rule)
revoke all on function generate_member_code() from public, anon;
grant execute on function generate_member_code() to authenticated;
