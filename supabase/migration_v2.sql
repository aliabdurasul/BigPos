-- ============================================
-- LEZZET-I ALA POS - DATABASE SCHEMA V2
-- Multi-tenant SaaS Upgrade
-- Run AFTER migration.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. RESTAURANTS TABLE (multi-tenancy root)
-- ============================================
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_name text,
  phone text,
  address text,
  license_plan text not null default 'free' check (license_plan in ('free', 'starter', 'pro', 'enterprise')),
  active boolean default true,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default restaurant for existing data
insert into restaurants (id, name, slug, owner_name, license_plan) values
  ('00000000-0000-0000-0000-000000000001', 'Lezzet-i Ala', 'lezzet-i-ala', 'Admin', 'pro');

-- ============================================
-- 2. STAFF TABLE
-- ============================================
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  role text not null check (role in ('garson', 'mutfak', 'restoran_admin')),
  pin text not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Default staff for the default restaurant
insert into staff (restaurant_id, name, role, pin) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'restoran_admin', '1234'),
  ('00000000-0000-0000-0000-000000000001', 'Ahmet', 'garson', '1111'),
  ('00000000-0000-0000-0000-000000000001', 'Mehmet', 'mutfak', '2222'),
  ('00000000-0000-0000-0000-000000000001', 'Ayşe', 'garson', '3333');

-- ============================================
-- 3. DAILY CLOSURES TABLE
-- ============================================
create table if not exists daily_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  closed_by text,
  closed_at timestamptz default now(),
  date date not null,
  total_revenue numeric(10,2) default 0,
  total_orders int default 0,
  cash_total numeric(10,2) default 0,
  card_total numeric(10,2) default 0,
  top_products jsonb default '[]'::jsonb,
  notes text,
  unique(restaurant_id, date)
);

-- ============================================
-- 4. PRODUCT-MODIFIER GROUPS JUNCTION TABLE
-- ============================================
create table if not exists product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  modifier_group_id uuid not null references modifier_groups(id) on delete cascade,
  unique(menu_item_id, modifier_group_id)
);

-- Link all existing has_modifiers=true items to all existing modifier groups
insert into product_modifier_groups (menu_item_id, modifier_group_id)
  select mi.id, mg.id
  from menu_items mi cross join modifier_groups mg
  where mi.has_modifiers = true
on conflict do nothing;

-- ============================================
-- 5. ADD restaurant_id FK TO EXISTING TABLES
-- ============================================

-- Categories
alter table categories add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
update categories set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- Menu Items
alter table menu_items add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
update menu_items set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- Modifier Groups
alter table modifier_groups add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
update modifier_groups set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- Floors
alter table floors add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
-- Drop unique constraint on name since it needs to be per-restaurant
alter table floors drop constraint if exists floors_name_key;
update floors set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- Tables
alter table tables add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
update tables set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- Orders
alter table orders add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
update orders set restaurant_id = '00000000-0000-0000-0000-000000000001' where restaurant_id is null;

-- ============================================
-- 6. ADD NEW COLUMNS TO menu_items
-- ============================================
alter table menu_items add column if not exists portion_info text;
alter table menu_items add column if not exists allergen_info text;
alter table menu_items add column if not exists spice_level int default 0;
alter table menu_items add column if not exists ingredients text[] default '{}';
alter table menu_items add column if not exists kitchen_note text;

-- ============================================
-- 7. ADD staff_id TO orders (who took the order)
-- ============================================
alter table orders add column if not exists staff_id uuid references staff(id) on delete set null;

-- ============================================
-- 8. RLS + REALTIME FOR NEW TABLES
-- ============================================
alter table restaurants enable row level security;
alter table staff enable row level security;
alter table daily_closures enable row level security;
alter table product_modifier_groups enable row level security;

create policy "Allow all on restaurants" on restaurants for all using (true) with check (true);
create policy "Allow all on staff" on staff for all using (true) with check (true);
create policy "Allow all on daily_closures" on daily_closures for all using (true) with check (true);
create policy "Allow all on product_modifier_groups" on product_modifier_groups for all using (true) with check (true);

alter publication supabase_realtime add table staff;
alter publication supabase_realtime add table restaurants;

-- ============================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================
create index if not exists idx_categories_restaurant on categories(restaurant_id);
create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id);
create index if not exists idx_menu_items_category on menu_items(category_id);
create index if not exists idx_modifier_groups_restaurant on modifier_groups(restaurant_id);
create index if not exists idx_floors_restaurant on floors(restaurant_id);
create index if not exists idx_tables_restaurant on tables(restaurant_id);
create index if not exists idx_tables_floor on tables(floor_id);
create index if not exists idx_orders_restaurant on orders(restaurant_id);
create index if not exists idx_orders_table on orders(table_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_staff_restaurant on staff(restaurant_id);
create index if not exists idx_daily_closures_restaurant on daily_closures(restaurant_id);
create index if not exists idx_product_modifier_groups_item on product_modifier_groups(menu_item_id);
create index if not exists idx_product_modifier_groups_group on product_modifier_groups(modifier_group_id);
