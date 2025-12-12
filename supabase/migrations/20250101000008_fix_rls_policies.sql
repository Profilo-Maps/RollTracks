-- Drop old RLS policies that use auth.uid()
-- and replace with permissive policies for custom auth

-- Drop old user_accounts policies
DROP POLICY IF EXISTS "Users can view own account" ON user_accounts;
DROP POLICY IF EXISTS "Users can update own account" ON user_accounts;
DROP POLICY IF EXISTS "Users can delete own account" ON user_accounts;
DROP POLICY IF EXISTS "Anyone can register" ON user_accounts;

-- Drop old profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Drop old trips policies
DROP POLICY IF EXISTS "Users can view own trips" ON trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON trips;
DROP POLICY IF EXISTS "Users can update own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON trips;

-- Drop old rated_features policies
DROP POLICY IF EXISTS "Users can view own rated features" ON rated_features;
DROP POLICY IF EXISTS "Users can insert own rated features" ON rated_features;
DROP POLICY IF EXISTS "Users can update own rated features" ON rated_features;
DROP POLICY IF EXISTS "Users can delete own rated features" ON rated_features;


-- Create new permissive policies for custom auth
-- USER_ACCOUNTS
CREATE POLICY "Allow all user_accounts operations"
  ON user_accounts FOR ALL
  USING (true)
  WITH CHECK (true);

-- PROFILES
CREATE POLICY "Allow all profile operations"
  ON profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- TRIPS
CREATE POLICY "Allow all trip operations"
  ON trips FOR ALL
  USING (true)
  WITH CHECK (true);

-- RATED_FEATURES
CREATE POLICY "Allow all rated feature operations"
  ON rated_features FOR ALL
  USING (true)
  WITH CHECK (true);


