-- migration_v11_fix_table_status_derivation.sql
-- Fix mark_order_ready: only set 'waiting_payment' when ALL non-paid orders are 'ready'.
-- If any order on the table is still 'active', keep table as 'occupied'.

DROP FUNCTION IF EXISTS mark_order_ready(uuid);
CREATE OR REPLACE FUNCTION mark_order_ready(p_order_id uuid)
RETURNS void
AS $fn$
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
    -- Check if any orders on this table are still active
    IF EXISTS (
      SELECT 1 FROM orders
      WHERE table_id = v_table_id
        AND status = 'active'
        AND id != p_order_id
    ) THEN
      -- Other active orders remain — keep table as occupied
      UPDATE tables SET status = 'occupied' WHERE id = v_table_id;
    ELSE
      -- All non-paid orders are now ready — waiting for payment
      UPDATE tables SET status = 'waiting_payment' WHERE id = v_table_id;
    END IF;
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
