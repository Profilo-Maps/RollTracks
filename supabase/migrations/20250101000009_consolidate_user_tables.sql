-- Consolidate user_accounts and profiles into a single table
-- This simplifies the schema and eliminates the need for joins

-- Drop the profiles table (no data to migrate yet)
DROP TABLE IF EXISTS profiles CASCADE;

-- Add profile fields to user_accounts table
ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS mode_list TEXT[],
  ADD COLUMN IF NOT EXISTS trip_history_ids UUID[];

-- Add check constraint for age (optional field, but if provided must be valid)
ALTER TABLE user_accounts
  ADD CONSTRAINT check_age_valid CHECK (age IS NULL OR (age >= 13 AND age <= 120));

-- Update the RLS policies (already permissive, no changes needed)

-- Note: The user_accounts table now contains:
-- - id: UUID (primary key)
-- - display_name: TEXT (unique, for login)
-- - password_hash: TEXT (bcrypt hash)
-- - age: INTEGER (optional profile data)
-- - mode_list: TEXT[] (optional profile data)
-- - trip_history_ids: UUID[] (optional profile data)
-- - created_at: TIMESTAMP
-- - updated_at: TIMESTAMP
