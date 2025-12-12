-- Update profiles table to match current app schema
-- Note: This assumes the old profiles table exists and needs updating
-- If starting fresh, this creates the table with the correct schema

-- Drop old profiles table if it exists (from demo version)
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table with updated schema
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  mode_list TEXT[] NOT NULL, -- Array of modes: wheelchair, assisted_walking, skateboard, scooter, walking
  trip_history_ids UUID[], -- Array of trip IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast user_id lookups
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
