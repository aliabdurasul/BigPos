-- ─────────────────────────────────────────────────────────────────────────────
-- Migration v12: Item status (void/return), item-level discounts, refund payments
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add item_status to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_status TEXT NOT NULL DEFAULT 'active'
  CHECK (item_status IN ('active', 'cancelled', 'returned'));

-- 2. Add item-level discount columns to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- 3. Extend payments.type to include 'refund'
--    Drop the old check constraint and recreate with refund included.
--    (Constraint name may vary; use the safe DO block approach.)
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_name = 'payments'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%type%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('payment', 'prepayment', 'refund'));

-- 4. RPC: void_order_item — marks item as cancelled
CREATE OR REPLACE FUNCTION void_order_item(p_order_id UUID, p_item_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_items
  SET item_status = 'cancelled'
  WHERE id = p_item_id AND order_id = p_order_id;
END;
$$;

-- 5. RPC: return_order_item — marks item as returned
CREATE OR REPLACE FUNCTION return_order_item(p_order_id UUID, p_item_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_items
  SET item_status = 'returned'
  WHERE id = p_item_id AND order_id = p_order_id;
END;
$$;

-- 6. RPC: apply_item_discount — sets item-level discount
CREATE OR REPLACE FUNCTION apply_item_discount(
  p_order_id UUID,
  p_item_id UUID,
  p_discount_amount NUMERIC,
  p_discount_reason TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_items
  SET discount_amount = p_discount_amount,
      discount_reason = p_discount_reason
  WHERE id = p_item_id AND order_id = p_order_id;
END;
$$;

-- 7. RPC: record_refund — inserts a refund payment entry
CREATE OR REPLACE FUNCTION record_refund(
  p_order_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'nakit',
  p_staff_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_payment_id UUID := gen_random_uuid();
  v_restaurant_id UUID;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id FROM orders WHERE id = p_order_id;

  INSERT INTO payments (id, order_id, restaurant_id, amount, method, type, staff_id, created_at)
  VALUES (v_payment_id, p_order_id, v_restaurant_id, p_amount, p_method, 'refund', p_staff_id, NOW());

  RETURN v_payment_id;
END;
$$;
