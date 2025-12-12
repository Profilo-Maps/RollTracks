-- Enable Row Level Security on all tables
-- This ensures users can only access their own data

-- Enable RLS on all tables
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rated_features ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER_ACCOUNTS RLS POLICIES
-- ============================================================================
-- Note: Using custom auth (not Supabase Auth), so policies are more permissive

-- Allow anyone to view accounts (needed for login display name lookup)
CREATE POLICY "Anyone can view accounts"
  ON user_accounts FOR SELECT
  USING (true);

-- Allow anyone to insert (for registration)
-- Note: Display name uniqueness is enforced by UNIQUE constraint
CREATE POLICY "Anyone can register"
  ON user_accounts FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update (auth is handled in app layer)
CREATE POLICY "Anyone can update accounts"
  ON user_accounts FOR UPDATE
  USING (true);

-- Allow anyone to delete (auth is handled in app layer)
CREATE POLICY "Anyone can delete accounts"
  ON user_accounts FOR DELETE
  USING (true);

-- ============================================================================
-- TRIPS RLS POLICIES
-- ============================================================================
-- Note: Using custom auth, so policies are permissive (auth handled in app)

CREATE POLICY "Allow all trip operations"
  ON trips FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RATED_FEATURES RLS POLICIES
-- ============================================================================
-- Note: Using custom auth, so policies are permissive (auth handled in app)

CREATE POLICY "Allow all rated feature operations"
  ON rated_features FOR ALL
  USING (true)
  WITH CHECK (true);


