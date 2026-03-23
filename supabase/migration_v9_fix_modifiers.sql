-- migration_v9_fix_modifiers.sql
-- Fix modifier system: ensure product_modifier_groups is properly configured
-- Run in Supabase SQL Editor

-- 1. Ensure product_modifier_groups table exists
CREATE TABLE IF NOT EXISTS product_modifier_groups (
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- 2. Ensure RLS is enabled
ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;

-- 3. Drop and recreate policy to ensure it's correct
DROP POLICY IF EXISTS "Allow all on product_modifier_groups" ON product_modifier_groups;
CREATE POLICY "Allow all on product_modifier_groups"
  ON product_modifier_groups FOR ALL
  USING (true) WITH CHECK (true);

-- 4. CRITICAL: Grant permissions to Supabase roles (without this, anon/authenticated can't write)
GRANT ALL ON product_modifier_groups TO anon;
GRANT ALL ON product_modifier_groups TO authenticated;
GRANT ALL ON product_modifier_groups TO service_role;

-- 5. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_pmg_menu_item ON product_modifier_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_pmg_modifier_group ON product_modifier_groups(modifier_group_id);

-- 6. Ensure realtime is enabled
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE product_modifier_groups;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 7. Clean up orphan rows (modifier groups or menu items that no longer exist)
DELETE FROM product_modifier_groups
WHERE menu_item_id NOT IN (SELECT id FROM menu_items)
   OR modifier_group_id NOT IN (SELECT id FROM modifier_groups);

-- 8. Drop has_modifiers column from menu_items if it exists (no longer used in code)
ALTER TABLE menu_items DROP COLUMN IF EXISTS has_modifiers;

-- 9. Also ensure modifier_groups and modifier_options have proper grants
GRANT ALL ON modifier_groups TO anon;
GRANT ALL ON modifier_groups TO authenticated;
GRANT ALL ON modifier_groups TO service_role;

GRANT ALL ON modifier_options TO anon;
GRANT ALL ON modifier_options TO authenticated;
GRANT ALL ON modifier_options TO service_role;
