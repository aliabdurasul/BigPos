-- ============================================
-- LEZZET POS — V8 ADD MISSING order_items COLUMNS
-- Idempotent. Run AFTER migration_v7.
-- ============================================

-- 1. Add modifiers column if missing
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers jsonb DEFAULT '[]'::jsonb;

-- 2. Add payment_status column if missing
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
