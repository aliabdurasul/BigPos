-- ============================================
-- LEZZET POS - V7 SIMPLIFY STATUSES
-- Idempotent. Run AFTER migration_v6_architecture.sql
--
-- Reduces order statuses to: active, ready, paid
-- Reduces table statuses to: available, occupied, waiting_payment
-- Updates RPCs accordingly
-- ============================================

-- 1. DROP OLD CONSTRAINTS FIRST (so data migration can use new values)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;

-- 2. MIGRATE EXISTING ORDER DATA
UPDATE orders SET status = 'active'  WHERE status IN ('created', 'sent_to_kitchen', 'preparing');
UPDATE orders SET status = 'ready'   WHERE status = 'waiting_payment';
-- 'ready' stays 'ready', 'paid' stays 'paid'
UPDATE orders SET status = 'paid'    WHERE status = 'closed';

-- 3. ADD NEW ORDER STATUS CONSTRAINT
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('active', 'ready', 'paid'));
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'active';

-- 4. MIGRATE EXISTING TABLE DATA
UPDATE tables SET status = 'occupied' WHERE status IN ('preparing', 'ready');
-- 'available', 'occupied', 'waiting_payment' stay as-is

-- 5. ADD NEW TABLE STATUS CONSTRAINT
ALTER TABLE tables ADD CONSTRAINT tables_status_check
  CHECK (status IN ('available', 'occupied', 'waiting_payment'));

-- 5. UPDATE mark_order_ready RPC
-- Now: sets order to 'ready', table to 'waiting_payment'
DROP FUNCTION IF EXISTS mark_order_ready(uuid);
CREATE OR REPLACE FUNCTION mark_order_ready(p_order_id uuid)
RETURNS void AS $fn$
DECLARE
  v_table_id uuid;
BEGIN
  SELECT table_id INTO v_table_id
  FROM orders WHERE id = p_order_id;

  UPDATE orders
  SET status = 'ready'
  WHERE id = p_order_id
    AND status = 'active';

  IF v_table_id IS NOT NULL THEN
    UPDATE tables
    SET status = 'waiting_payment'
    WHERE id = v_table_id;
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. UPDATE complete_payment RPC
-- Now: sets order to 'paid', resets table to 'available'
-- Also checks if ALL orders on that table are paid before resetting table
DROP FUNCTION IF EXISTS complete_payment(uuid, numeric, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION complete_payment(
  p_order_id uuid, p_amount numeric, p_method text,
  p_staff_id uuid DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_discount_reason text DEFAULT NULL
) RETURNS uuid AS $fn$
DECLARE
  v_table_id uuid;
  v_restaurant_id uuid;
  v_payment_id uuid;
BEGIN
  SELECT table_id, restaurant_id INTO v_table_id, v_restaurant_id
  FROM orders WHERE id = p_order_id;

  v_payment_id := gen_random_uuid();

  INSERT INTO payments (id, order_id, amount, method, restaurant_id, staff_id, discount_amount, discount_reason)
  VALUES (v_payment_id, p_order_id, p_amount, p_method, v_restaurant_id, p_staff_id, p_discount_amount, p_discount_reason);

  UPDATE orders SET status = 'paid' WHERE id = p_order_id;

  -- Only reset table if ALL orders on this table are now paid
  IF v_table_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM orders
      WHERE table_id = v_table_id AND status IN ('active', 'ready')
    ) THEN
      UPDATE tables
      SET status = 'available', current_total = 0, opened_at = NULL
      WHERE id = v_table_id;
    END IF;
  END IF;

  RETURN v_payment_id;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. DROP send_order_to_kitchen RPC (no longer needed)
DROP FUNCTION IF EXISTS send_order_to_kitchen(uuid);

-- 8. UPDATE create_order_with_items RPC
-- Remove sent_to_kitchen and status from order_items insert
DROP FUNCTION IF EXISTS create_order_with_items(uuid, uuid, text, uuid, text, jsonb);
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_restaurant_id uuid, p_table_id uuid, p_table_name text,
  p_staff_id uuid, p_items jsonb
) RETURNS uuid AS $fn$
DECLARE
  v_order_id uuid := gen_random_uuid();
  v_total numeric := 0;
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + (v_item->>'price')::numeric * (v_item->>'quantity')::int;
  END LOOP;

  INSERT INTO orders (id, table_id, table_name, status, total, restaurant_id, staff_id, prepayment)
  VALUES (v_order_id, p_table_id, p_table_name, 'active', v_total, p_restaurant_id, p_staff_id, 0);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (id, order_id, menu_item_id, menu_item_name, menu_item_price,
      quantity, modifiers, note, restaurant_id, payment_status)
    VALUES (
      gen_random_uuid(), v_order_id,
      NULLIF(v_item->>'menu_item_id', '')::uuid,
      v_item->>'name', (v_item->>'price')::numeric,
      (v_item->>'quantity')::int,
      COALESCE(v_item->'modifiers', '[]'::jsonb),
      NULLIF(v_item->>'note', ''),
      p_restaurant_id, 'unpaid'
    );
  END LOOP;

  UPDATE tables SET status = 'occupied', opened_at = COALESCE(opened_at, now())
  WHERE id = p_table_id AND status = 'available';

  RETURN v_order_id;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. UPDATE pay_order_items RPC (from v6)
DROP FUNCTION IF EXISTS pay_order_items(uuid, uuid[], numeric, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION pay_order_items(
  p_order_id uuid, p_item_ids uuid[], p_amount numeric, p_method text,
  p_staff_id uuid DEFAULT NULL, p_discount_amount numeric DEFAULT 0, p_discount_reason text DEFAULT NULL
) RETURNS uuid AS $fn$
DECLARE
  v_pid uuid := gen_random_uuid();
  v_rid uuid;
  v_table_id uuid;
BEGIN
  SELECT restaurant_id, table_id INTO v_rid, v_table_id FROM orders WHERE id = p_order_id;

  INSERT INTO payments (id, order_id, amount, method, type, restaurant_id, staff_id, discount_amount, discount_reason)
  VALUES (v_pid, p_order_id, p_amount, p_method, 'payment', v_rid, p_staff_id, p_discount_amount, p_discount_reason);

  UPDATE order_items SET payment_status = 'paid' WHERE id = ANY(p_item_ids) AND order_id = p_order_id;

  -- If all items are paid, mark order as paid
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND payment_status = 'unpaid') THEN
    UPDATE orders SET status = 'paid' WHERE id = p_order_id;
    -- Only reset table if ALL orders on this table are now paid
    IF v_table_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE table_id = v_table_id AND status IN ('active', 'ready')
      ) THEN
        UPDATE tables SET status = 'available', current_total = 0, opened_at = NULL
        WHERE id = v_table_id;
      END IF;
    END IF;
  END IF;

  RETURN v_pid;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
