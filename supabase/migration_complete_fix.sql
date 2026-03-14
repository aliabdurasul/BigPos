-- ============================================
-- LEZZET-I ALA POS - COMPLETE FIX MIGRATION
-- IDEMPOTENT: Safe to run regardless of current
-- database state (fresh or partially migrated)
-- Run in: Supabase Dashboard -> SQL Editor
-- ============================================

-- 0. Extensions
create extension if not exists pgcrypto;

-- 1. RESTAURANTS
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_name text,
  owner_email text,
  phone text,
  address text,
  license_plan text not null default 'free'
    check (license_plan in ('free', 'starter', 'pro', 'enterprise')),
  active boolean default true,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. PLATFORM USERS (email/password auth)
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

-- 3. FLOORS
create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table floors add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;

-- 4. STAFF
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  role text not null,
  pin text not null,
  active boolean default true,
  created_at timestamptz default now()
);
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('garson', 'mutfak', 'restoran_admin', 'manager', 'cashier'));

-- 5. CATEGORIES
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table categories add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;

-- 6. MENU ITEMS
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  category_id uuid references categories(id) on delete set null,
  has_modifiers boolean default false,
  image text,
  active boolean default true,
  created_at timestamptz default now()
);
alter table menu_items add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
alter table menu_items add column if not exists portion_info text;
alter table menu_items add column if not exists allergen_info text;
alter table menu_items add column if not exists spice_level int default 0;
alter table menu_items add column if not exists ingredients text[];
alter table menu_items add column if not exists kitchen_note text;

-- 7. MODIFIER GROUPS
create table if not exists modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('checkbox', 'radio')),
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table modifier_groups add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;

-- 8. MODIFIER OPTIONS
create table if not exists modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references modifier_groups(id) on delete cascade,
  name text not null,
  extra_price numeric(10,2) default 0,
  sort_order int default 0
);

-- 9. PRODUCT MODIFIER GROUPS
create table if not exists product_modifier_groups (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  modifier_group_id uuid not null references modifier_groups(id) on delete cascade,
  primary key (menu_item_id, modifier_group_id)
);

-- 10. TABLES
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'available',
  floor_id uuid references floors(id) on delete cascade,
  current_total numeric(10,2) default 0,
  opened_at timestamptz,
  created_at timestamptz default now()
);
alter table tables add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;

-- Fix tables.status constraint: Turkish -> English
alter table tables drop constraint if exists tables_status_check;
update tables set status = 'available'       where status = 'bos';
update tables set status = 'occupied'        where status = 'dolu';
update tables set status = 'waiting_payment' where status = 'odeme_bekliyor';
update tables set status = 'available'
  where status not in ('available', 'occupied', 'preparing', 'ready', 'waiting_payment');
alter table tables add constraint tables_status_check
  check (status in ('available', 'occupied', 'preparing', 'ready', 'waiting_payment'));
alter table tables alter column status set default 'available';

-- 11. ORDERS
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references tables(id) on delete set null,
  table_name text not null default 'Masa',
  status text not null default 'created',
  total numeric(10,2) default 0,
  prepayment numeric(10,2) default 0,
  created_at timestamptz default now()
);
alter table orders add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
alter table orders add column if not exists staff_id uuid references staff(id) on delete set null;
alter table orders add column if not exists prepayment numeric(10,2) default 0;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'table_name') then
    alter table orders add column table_name text not null default 'Masa';
  end if;
end $$;

-- Fix orders.status constraint: Turkish -> English
alter table orders drop constraint if exists orders_status_check;
update orders set status = 'created'   where status = 'yeni';
update orders set status = 'preparing' where status = 'hazirlaniyor';
update orders set status = 'ready'     where status = 'hazir';
update orders set status = 'paid'      where status = 'tamamlandi';
update orders set status = 'created'
  where status not in ('created','sent_to_kitchen','preparing','ready','waiting_payment','paid','closed');
alter table orders add constraint orders_status_check
  check (status in ('created','sent_to_kitchen','preparing','ready','waiting_payment','paid','closed'));
alter table orders alter column status set default 'created';

-- 12. ORDER ITEMS
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  menu_item_name text not null,
  menu_item_price numeric(10,2) not null,
  quantity int not null default 1,
  modifiers jsonb default '[]'::jsonb,
  note text,
  sent_to_kitchen boolean default false,
  created_at timestamptz default now()
);
alter table order_items add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
alter table order_items add column if not exists sent_to_kitchen boolean default false;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'order_items' and column_name = 'status') then
    alter table order_items add column status text not null default 'pending';
  end if;
end $$;

alter table order_items drop constraint if exists order_items_status_check;
update order_items set status = 'pending'
  where status not in ('pending','sent','preparing','ready','cancelled');
alter table order_items add constraint order_items_status_check
  check (status in ('pending','sent','preparing','ready','cancelled'));
update order_items set status = 'sent' where sent_to_kitchen = true and status = 'pending';
update order_items oi set restaurant_id = o.restaurant_id
from orders o where oi.order_id = o.id and oi.restaurant_id is null and o.restaurant_id is not null;

-- 13. PAYMENTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  amount numeric(10,2) not null,
  method text not null,
  created_at timestamptz default now()
);
alter table payments add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
alter table payments add column if not exists staff_id uuid references staff(id) on delete set null;
alter table payments add column if not exists discount_amount numeric(10,2) default 0;
alter table payments add column if not exists discount_reason text;
alter table payments drop constraint if exists payments_method_check;
update payments set method = 'nakit' where method not in ('nakit','kredi_karti','bolunmus','discount');
alter table payments add constraint payments_method_check
  check (method in ('nakit','kredi_karti','bolunmus','discount'));
update payments p set restaurant_id = o.restaurant_id
from orders o where p.order_id = o.id and p.restaurant_id is null and o.restaurant_id is not null;

-- 14. DAILY CLOSURES
create table if not exists daily_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  closed_by text, closed_at timestamptz default now(),
  date text not null, total_revenue numeric(10,2) default 0,
  total_orders int default 0, cash_total numeric(10,2) default 0,
  card_total numeric(10,2) default 0, top_products jsonb default '[]'::jsonb,
  notes text, created_at timestamptz default now()
);

-- 15. KITCHEN LOGS
create table if not exists kitchen_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  product_id uuid references menu_items(id) on delete set null,
  product_name text, quantity int not null default 1,
  reason text not null check (reason in ('wrong_order','staff_meal','waste','test','cancelled')),
  staff_id uuid references staff(id) on delete set null,
  notes text, created_at timestamptz default now()
);

-- 16. DISCOUNTS
create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null, type text not null check (type in ('percentage','fixed')),
  value numeric(10,2) not null, active boolean default true,
  created_at timestamptz default now()
);

-- 17. ORDER ITEM MODIFIERS
create table if not exists order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  modifier_option_id uuid references modifier_options(id) on delete set null,
  modifier_group_id uuid references modifier_groups(id) on delete set null,
  option_name text not null, group_name text not null,
  extra_price numeric(10,2) default 0
);

-- 18. INDEXES
create index if not exists idx_categories_restaurant      on categories(restaurant_id);
create index if not exists idx_menu_items_restaurant      on menu_items(restaurant_id);
create index if not exists idx_modifier_groups_restaurant on modifier_groups(restaurant_id);
create index if not exists idx_tables_restaurant          on tables(restaurant_id);
create index if not exists idx_orders_restaurant_status   on orders(restaurant_id, status);
create index if not exists idx_orders_created_at          on orders(created_at);
create index if not exists idx_order_items_order          on order_items(order_id);
create index if not exists idx_order_items_restaurant     on order_items(restaurant_id);
create index if not exists idx_payments_order             on payments(order_id);
create index if not exists idx_payments_restaurant        on payments(restaurant_id);
create index if not exists idx_staff_restaurant           on staff(restaurant_id);
create index if not exists idx_floors_restaurant          on floors(restaurant_id);

-- 19. ROW LEVEL SECURITY + POLICIES
alter table restaurants             enable row level security;
alter table platform_users          enable row level security;
alter table staff                   enable row level security;
alter table floors                  enable row level security;
alter table categories              enable row level security;
alter table menu_items              enable row level security;
alter table modifier_groups         enable row level security;
alter table modifier_options        enable row level security;
alter table product_modifier_groups enable row level security;
alter table tables                  enable row level security;
alter table orders                  enable row level security;
alter table order_items             enable row level security;
alter table payments                enable row level security;
alter table daily_closures          enable row level security;
alter table kitchen_logs            enable row level security;
alter table discounts               enable row level security;
alter table order_item_modifiers    enable row level security;

drop policy if exists "Allow all on restaurants"             on restaurants;
drop policy if exists "Allow all on platform_users"          on platform_users;
drop policy if exists "Allow all on staff"                   on staff;
drop policy if exists "Allow all on floors"                  on floors;
drop policy if exists "Allow all on categories"              on categories;
drop policy if exists "Allow all on menu_items"              on menu_items;
drop policy if exists "Allow all on modifier_groups"         on modifier_groups;
drop policy if exists "Allow all on modifier_options"        on modifier_options;
drop policy if exists "Allow all on product_modifier_groups" on product_modifier_groups;
drop policy if exists "Allow all on tables"                  on tables;
drop policy if exists "Allow all on orders"                  on orders;
drop policy if exists "Allow all on order_items"             on order_items;
drop policy if exists "Allow all on payments"                on payments;
drop policy if exists "Allow all on daily_closures"          on daily_closures;
drop policy if exists "Allow all on kitchen_logs"            on kitchen_logs;
drop policy if exists "Allow all on discounts"               on discounts;
drop policy if exists "Allow all on order_item_modifiers"    on order_item_modifiers;

create policy "Allow all on restaurants"             on restaurants             for all using (true) with check (true);
create policy "Allow all on platform_users"          on platform_users          for all using (true) with check (true);
create policy "Allow all on staff"                   on staff                   for all using (true) with check (true);
create policy "Allow all on floors"                  on floors                  for all using (true) with check (true);
create policy "Allow all on categories"              on categories              for all using (true) with check (true);
create policy "Allow all on menu_items"              on menu_items              for all using (true) with check (true);
create policy "Allow all on modifier_groups"         on modifier_groups         for all using (true) with check (true);
create policy "Allow all on modifier_options"        on modifier_options        for all using (true) with check (true);
create policy "Allow all on product_modifier_groups" on product_modifier_groups for all using (true) with check (true);
create policy "Allow all on tables"                  on tables                  for all using (true) with check (true);
create policy "Allow all on orders"                  on orders                  for all using (true) with check (true);
create policy "Allow all on order_items"             on order_items             for all using (true) with check (true);
create policy "Allow all on payments"                on payments                for all using (true) with check (true);
create policy "Allow all on daily_closures"          on daily_closures          for all using (true) with check (true);
create policy "Allow all on kitchen_logs"            on kitchen_logs            for all using (true) with check (true);
create policy "Allow all on discounts"               on discounts               for all using (true) with check (true);
create policy "Allow all on order_item_modifiers"    on order_item_modifiers    for all using (true) with check (true);

-- 20. REALTIME
do $$
begin
  begin alter publication supabase_realtime add table categories;             exception when others then null; end;
  begin alter publication supabase_realtime add table menu_items;              exception when others then null; end;
  begin alter publication supabase_realtime add table modifier_groups;         exception when others then null; end;
  begin alter publication supabase_realtime add table modifier_options;        exception when others then null; end;
  begin alter publication supabase_realtime add table product_modifier_groups; exception when others then null; end;
  begin alter publication supabase_realtime add table tables;                  exception when others then null; end;
  begin alter publication supabase_realtime add table orders;                  exception when others then null; end;
  begin alter publication supabase_realtime add table order_items;             exception when others then null; end;
  begin alter publication supabase_realtime add table payments;                exception when others then null; end;
  begin alter publication supabase_realtime add table kitchen_logs;            exception when others then null; end;
  begin alter publication supabase_realtime add table discounts;               exception when others then null; end;
  begin alter publication supabase_realtime add table order_item_modifiers;    exception when others then null; end;
end $$;

-- 21-27. RPCs
drop function if exists verify_staff_pin(text, uuid);
create or replace function verify_staff_pin(p_pin text, p_restaurant_id uuid)
returns table (id uuid, name text, role text, restaurant_id uuid, active boolean) as $fn$
begin
  return query select s.id,s.name,s.role,s.restaurant_id,s.active from staff s
  where s.pin=p_pin and s.restaurant_id=p_restaurant_id and s.active=true;
end; $fn$ language plpgsql security definer;

drop function if exists verify_platform_login(text, text);
create or replace function verify_platform_login(p_email text, p_password text)
returns table (id uuid, email text, name text, role text, restaurant_id uuid, active boolean) as $fn$
begin
  return query select u.id,u.email,u.name,u.role,u.restaurant_id,u.active from platform_users u
  where u.email=lower(trim(p_email)) and u.password_hash=crypt(p_password,u.password_hash) and u.active=true;
end; $fn$ language plpgsql security definer;

drop function if exists create_platform_user(text, text, text, text, uuid);
create or replace function create_platform_user(p_email text, p_password text, p_name text, p_role text, p_restaurant_id uuid default null)
returns uuid as $fn$
declare new_id uuid;
begin
  insert into platform_users (email,password_hash,name,role,restaurant_id)
  values (lower(trim(p_email)),crypt(p_password,gen_salt('bf')),p_name,p_role,p_restaurant_id) returning id into new_id;
  return new_id;
exception when unique_violation then
  update platform_users set password_hash=crypt(p_password,gen_salt('bf')),name=p_name,role=p_role,
    restaurant_id=coalesce(p_restaurant_id,restaurant_id) where email=lower(trim(p_email)) returning id into new_id;
  return new_id;
end; $fn$ language plpgsql security definer;

drop function if exists create_restaurant_with_admin(text,text,text,text,text,text,text,text);
create or replace function create_restaurant_with_admin(p_name text,p_slug text,p_owner_name text,p_phone text,p_address text,p_email text,p_password text,p_plan text)
returns uuid as $fn$
declare new_restaurant_id uuid;
begin
  insert into restaurants (name,slug,owner_name,phone,address,license_plan,active)
  values (p_name,lower(trim(p_slug)),p_owner_name,p_phone,p_address,p_plan,true) returning id into new_restaurant_id;
  insert into platform_users (email,password_hash,name,role,restaurant_id)
  values (lower(trim(p_email)),crypt(p_password,gen_salt('bf')),coalesce(p_owner_name,p_name),'restoran_admin',new_restaurant_id);
  return new_restaurant_id;
end; $fn$ language plpgsql security definer;

drop function if exists mark_order_ready(uuid);
create or replace function mark_order_ready(p_order_id uuid) returns void as $fn$
declare v_table_id uuid;
begin
  select table_id into v_table_id from orders where id=p_order_id;
  update orders set status='waiting_payment' where id=p_order_id and status in ('ready','preparing','sent_to_kitchen');
  if v_table_id is not null then update tables set status='waiting_payment' where id=v_table_id; end if;
end; $fn$ language plpgsql security definer;

drop function if exists complete_payment(uuid,numeric,text,uuid,numeric,text);
create or replace function complete_payment(p_order_id uuid,p_amount numeric,p_method text,p_staff_id uuid default null,p_discount_amount numeric default 0,p_discount_reason text default null)
returns uuid as $fn$
declare v_table_id uuid; v_restaurant_id uuid; v_payment_id uuid;
begin
  select table_id,restaurant_id into v_table_id,v_restaurant_id from orders where id=p_order_id;
  v_payment_id:=gen_random_uuid();
  insert into payments (id,order_id,amount,method,restaurant_id,staff_id,discount_amount,discount_reason)
  values (v_payment_id,p_order_id,p_amount,p_method,v_restaurant_id,p_staff_id,p_discount_amount,p_discount_reason);
  update orders set status='paid' where id=p_order_id;
  if v_table_id is not null then update tables set status='available',current_total=0,opened_at=null where id=v_table_id; end if;
  return v_payment_id;
end; $fn$ language plpgsql security definer;

drop function if exists send_order_to_kitchen(uuid);
create or replace function send_order_to_kitchen(p_order_id uuid) returns void as $fn$
declare v_table_id uuid;
begin
  select table_id into v_table_id from orders where id=p_order_id;
  update orders set status='sent_to_kitchen' where id=p_order_id and status='created';
  update order_items set status='sent',sent_to_kitchen=true where order_id=p_order_id and status='pending';
  if v_table_id is not null then update tables set status='occupied' where id=v_table_id and status='available'; end if;
end; $fn$ language plpgsql security definer;

-- DONE. Verify: select count(*) from restaurants;
