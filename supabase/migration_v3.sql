-- ============================================
-- LEZZET-I ALA POS - DATABASE SCHEMA V3
-- Two-Level Authentication System
-- Run AFTER migration_v2.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ENABLE PGCRYPTO
-- ============================================
create extension if not exists pgcrypto;

-- ============================================
-- 2. PLATFORM USERS TABLE (email/password auth)
-- ============================================
create table if not exists platform_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('super_admin', 'restoran_admin')),
  restaurant_id uuid references restaurants(id) on delete set null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- 3. RPC: CREATE PLATFORM USER (hashes password)
-- ============================================
create or replace function create_platform_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text,
  p_restaurant_id uuid default null
) returns uuid as $$
declare
  new_id uuid;
begin
  insert into platform_users (email, password_hash, name, role, restaurant_id)
  values (lower(trim(p_email)), crypt(p_password, gen_salt('bf')), p_name, p_role, p_restaurant_id)
  returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. RPC: VERIFY PLATFORM LOGIN
-- ============================================
create or replace function verify_platform_login(
  p_email text,
  p_password text
) returns table (
  id uuid,
  email text,
  name text,
  role text,
  restaurant_id uuid,
  active boolean
) as $$
begin
  return query
    select
      pu.id,
      pu.email,
      pu.name,
      pu.role,
      pu.restaurant_id,
      pu.active
    from platform_users pu
    where pu.email = lower(trim(p_email))
      and pu.password_hash = crypt(p_password, pu.password_hash);
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. SEED SUPER ADMIN
-- ============================================
select create_platform_user(
  'superadmin@mail.com',
  '12345',
  'Super Admin',
  'super_admin'
);

-- ============================================
-- 6. MIGRATE EXISTING RESTORAN_ADMIN STAFF → PLATFORM_USERS
-- ============================================
-- Create a platform_user for the default restaurant owner
select create_platform_user(
  'admin@lezzet.com',
  '1234',
  'Lezzet Admin',
  'restoran_admin',
  '00000000-0000-0000-0000-000000000001'
);

-- Remove restoran_admin entries from staff table (they now live in platform_users)
delete from staff where role = 'restoran_admin';

-- ============================================
-- 7. UPDATE STAFF ROLE CONSTRAINT
-- ============================================
-- Drop old constraint and add new one (staff only: garson, mutfak, manager)
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check check (role in ('garson', 'mutfak', 'manager'));

-- ============================================
-- 8. RLS FOR PLATFORM_USERS
-- ============================================
alter table platform_users enable row level security;

-- Block direct table reads — all access goes through security definer RPCs
create policy "Block direct access to platform_users"
  on platform_users for all using (false);

-- ============================================
-- 9. INDEXES
-- ============================================
create index if not exists idx_platform_users_email on platform_users(email);
create index if not exists idx_staff_pin_restaurant on staff(pin, restaurant_id);
