-- ============================================
-- LEZZET-I ALA POS - MIGRATION V5
-- Production POS Transformation
-- IDEMPOTENT: Safe to re-run
-- Run AFTER migration_v4.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ADD restaurant_id TO order_items & payments
-- ============================================

alter table order_items add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;
alter table payments add column if not exists restaurant_id uuid references restaurants(id) on delete cascade;

-- Backfill from parent order
update order_items oi
set restaurant_id = o.restaurant_id
from orders o
where oi.order_id = o.id
  and oi.restaurant_id is null;

update payments p
set restaurant_id = o.restaurant_id
from orders o
where p.order_id = o.id
  and p.restaurant_id is null;

create index if not exists idx_order_items_restaurant on order_items(restaurant_id);
create index if not exists idx_payments_restaurant on payments(restaurant_id);

-- ============================================
-- 2. EXPAND TABLE STATUS
-- From: bos, dolu, odeme_bekliyor
-- To:   available, occupied, preparing, ready, waiting_payment
-- ============================================

alter table tables drop constraint if exists tables_status_check;

update tables set status = 'available' where status = 'bos';
update tables set status = 'occupied' where status = 'dolu';
update tables set status = 'waiting_payment' where status = 'odeme_bekliyor';

alter table tables add constraint tables_status_check
  check (status in ('available', 'occupied', 'preparing', 'ready', 'waiting_payment'));

alter table tables alter column status set default 'available';

-- ============================================
-- 3. EXPAND ORDER STATUS
-- From: yeni, hazirlaniyor, hazir, tamamlandi
-- To:   created, sent_to_kitchen, preparing, ready, waiting_payment, paid, closed
-- ============================================

alter table orders drop constraint if exists orders_status_check;

update orders set status = 'created' where status = 'yeni';
update orders set status = 'preparing' where status = 'hazirlaniyor';
update orders set status = 'ready' where status = 'hazir';
update orders set status = 'paid' where status = 'tamamlandi';

alter table orders add constraint orders_status_check
  check (status in ('created', 'sent_to_kitchen', 'preparing', 'ready', 'waiting_payment', 'paid', 'closed'));

alter table orders alter column status set default 'created';

-- ============================================
-- 4. ADD CASHIER ROLE TO STAFF
-- ============================================

alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('garson', 'mutfak', 'manager', 'cashier'));

-- ============================================
-- 5. EXPAND PAYMENT METHOD
-- ============================================

alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('nakit', 'kredi_karti', 'bolunmus', 'discount'));

-- Add discount tracking columns to payments
alter table payments add column if not exists discount_amount numeric(10,2) default 0;
alter table payments add column if not exists discount_reason text;
alter table payments add column if not exists staff_id uuid references staff(id) on delete set null;

-- ============================================
-- 6. ADD ITEM-LEVEL STATUS TO ORDER_ITEMS
-- ============================================

alter table order_items add column if not exists status text not null default 'pending'
  check (status in ('pending', 'sent', 'preparing', 'ready', 'cancelled'));

-- Migrate: items already sent to kitchen
update order_items set status = 'sent' where sent_to_kitchen = true and status = 'pending';

-- ============================================
-- 7. CREATE kitchen_logs TABLE
-- ============================================

create table if not exists kitchen_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  product_id uuid references menu_items(id) on delete set null,
  product_name text,
  quantity int not null default 1,
  reason text not null check (reason in ('wrong_order', 'staff_meal', 'waste', 'test', 'cancelled')),
  staff_id uuid references staff(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

alter table kitchen_logs enable row level security;
drop policy if exists "Allow all on kitchen_logs" on kitchen_logs;
create policy "Allow all on kitchen_logs" on kitchen_logs for all using (true) with check (true);

create index if not exists idx_kitchen_logs_restaurant on kitchen_logs(restaurant_id);
create index if not exists idx_kitchen_logs_created on kitchen_logs(created_at);

-- ============================================
-- 8. CREATE discounts TABLE
-- ============================================

create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric(10,2) not null,
  active boolean default true,
  created_at timestamptz default now()
);

alter table discounts enable row level security;
drop policy if exists "Allow all on discounts" on discounts;
create policy "Allow all on discounts" on discounts for all using (true) with check (true);

create index if not exists idx_discounts_restaurant on discounts(restaurant_id);

-- ============================================
-- 9. CREATE order_item_modifiers TABLE
-- (normalized modifier storage for order items)
-- ============================================

create table if not exists order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  modifier_option_id uuid references modifier_options(id) on delete set null,
  modifier_group_id uuid references modifier_groups(id) on delete set null,
  option_name text not null,
  group_name text not null,
  extra_price numeric(10,2) default 0
);

alter table order_item_modifiers enable row level security;
drop policy if exists "Allow all on order_item_modifiers" on order_item_modifiers;
create policy "Allow all on order_item_modifiers" on order_item_modifiers for all using (true) with check (true);

create index if not exists idx_order_item_modifiers_item on order_item_modifiers(order_item_id);

-- ============================================
-- 10. DATABASE FUNCTION: mark_order_ready
-- Atomically sets order + table to waiting_payment
-- ============================================

drop function if exists mark_order_ready(uuid);

create or replace function mark_order_ready(p_order_id uuid)
returns void as $fn$
declare
  v_table_id uuid;
begin
  select table_id into v_table_id
  from orders where id = p_order_id;

  update orders
  set status = 'waiting_payment'
  where id = p_order_id
    and status in ('ready', 'preparing');

  if v_table_id is not null then
    update tables
    set status = 'waiting_payment'
    where id = v_table_id;
  end if;
end;
$fn$ language plpgsql security definer;

-- ============================================
-- 11. DATABASE FUNCTION: complete_payment
-- Atomically closes order and resets table
-- ============================================

drop function if exists complete_payment(uuid, numeric, text, uuid, numeric, text);

create or replace function complete_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_staff_id uuid default null,
  p_discount_amount numeric default 0,
  p_discount_reason text default null
) returns uuid as $fn$
declare
  v_table_id uuid;
  v_restaurant_id uuid;
  v_payment_id uuid;
begin
  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from orders where id = p_order_id;

  v_payment_id := gen_random_uuid();

  insert into payments (id, order_id, amount, method, restaurant_id, staff_id, discount_amount, discount_reason)
  values (v_payment_id, p_order_id, p_amount, p_method, v_restaurant_id, p_staff_id, p_discount_amount, p_discount_reason);

  update orders
  set status = 'paid'
  where id = p_order_id;

  if v_table_id is not null then
    update tables
    set status = 'available',
        current_total = 0,
        opened_at = null
    where id = v_table_id;
  end if;

  return v_payment_id;
end;
$fn$ language plpgsql security definer;

-- ============================================
-- 12. DATABASE FUNCTION: send_order_to_kitchen
-- Atomically updates order + items + table status
-- ============================================

drop function if exists send_order_to_kitchen(uuid);

create or replace function send_order_to_kitchen(p_order_id uuid)
returns void as $fn$
declare
  v_table_id uuid;
begin
  select table_id into v_table_id
  from orders where id = p_order_id;

  update orders
  set status = 'sent_to_kitchen'
  where id = p_order_id
    and status = 'created';

  update order_items
  set status = 'sent', sent_to_kitchen = true
  where order_id = p_order_id
    and status = 'pending';

  if v_table_id is not null then
    update tables
    set status = 'occupied'
    where id = v_table_id
      and status = 'available';
  end if;
end;
$fn$ language plpgsql security definer;

-- ============================================
-- 13. ENABLE REALTIME ON NEW TABLES
-- ============================================

do $$
begin
  begin
    alter publication supabase_realtime add table kitchen_logs;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table discounts;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table order_item_modifiers;
  exception when others then null;
  end;
end $$;

-- ============================================
-- 14. COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

create index if not exists idx_orders_restaurant_status on orders(restaurant_id, status);
create index if not exists idx_tables_restaurant_status on tables(restaurant_id, status);
create index if not exists idx_order_items_order_status on order_items(order_id, status);
create index if not exists idx_payments_order_restaurant on payments(order_id, restaurant_id);
