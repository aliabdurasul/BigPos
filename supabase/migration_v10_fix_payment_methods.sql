-- migration_v10_fix_payment_methods.sql
-- Fix payment method values: ensure all are standardized
-- Run in Supabase SQL Editor

-- 1. Fix any incorrectly stored payment methods
UPDATE payments SET method = 'kredi_karti' WHERE LOWER(method) IN ('kredi kartı', 'kredi karti', 'card');
UPDATE payments SET method = 'nakit' WHERE LOWER(method) IN ('cash') AND method != 'nakit';
UPDATE payments SET method = 'bolunmus' WHERE LOWER(method) IN ('bölünmüş', 'split') AND method != 'bolunmus';

-- 2. Recreate constraint to be safe
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('nakit', 'kredi_karti', 'bolunmus', 'discount'));
