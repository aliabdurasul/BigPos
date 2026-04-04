-- Migration v11: Ensure settings JSONB column exists on restaurants table
-- Safe to re-run — ADD COLUMN IF NOT EXISTS is a no-op if already present.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
