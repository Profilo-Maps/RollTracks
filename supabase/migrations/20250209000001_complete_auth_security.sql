-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS COMPLETE AUTHENTICATION & SECURITY
-- Migration: Consolidated auth schema, RLS policies, and secure login
-- Date: 2025-02-09
--
-- This migration:
-- 1. Creates auth tables (account_recovery, user_recovery_links)
-- 2. Enables Row Level Security on all tables
-- 3. Configures restrictive RLS policies
-- 4. Adds SECURITY DEFINER function for secure login
--
-- ARCHITECTURE ALIGNMENT:
-- - user_profiles.password_hash: Per architecture spec
-- - account_recovery.password_hash: Bcrypt hashed (10 rounds)
-- - Supabase anonymous users + username/password recovery
-- - CAPTCHA after 3 failed login attempts (client-side)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- PART 1: CREATE AUTH TABLES
-- ───────────────────────────────────────────────────────────

-- Account recovery credentials table
CREATE TABLE IF NOT EXISTS account_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Index for fast username lookups during login
CREATE INDEX IF NOT EXISTS idx_account_recovery_username ON account_recovery(username);
COMMENT ON TABLE account_recovery IS
  'Stores username and bcrypt-hashed password for multi-device account recovery';
COMMENT ON COLUMN account_recovery.password_hash IS
  'Bcrypt-hashed password for multi-device recovery. Uses 10 salt rounds for mobile performance.';
-- User recovery links table (links anonymous users to recovery credentials)
CREATE TABLE IF NOT EXISTS user_recovery_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_id UUID NOT NULL REFERENCES account_recovery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE user_recovery_links IS
  'Links Supabase anonymous user IDs to account recovery credentials for multi-device access';
-- ───────────────────────────────────────────────────────────
-- PART 2: SECURITY DEFINER FUNCTION FOR SECURE LOGIN
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_login_credentials(
  p_username TEXT
)
RETURNS TABLE (
  recovery_id UUID,
  password_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges, bypassing RLS
SET search_path = public
AS $$
BEGIN
  -- Only return the single row matching the username
  -- This prevents bulk table access while allowing login verification
  RETURN QUERY
  SELECT 
    id,
    account_recovery.password_hash
  FROM account_recovery
  WHERE username = p_username
  LIMIT 1;
  
  -- Note: Password verification happens client-side using bcrypt.compare()
  -- This function only retrieves the hash for comparison
END;
$$;
-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION verify_login_credentials(TEXT) TO anon, authenticated;
COMMENT ON FUNCTION verify_login_credentials IS
  'Securely retrieves recovery credentials for login verification without exposing entire table. Runs with SECURITY DEFINER to bypass RLS.';
-- ───────────────────────────────────────────────────────────
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recovery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rated_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrected_segments ENABLE ROW LEVEL SECURITY;
-- ───────────────────────────────────────────────────────────
-- PART 4: USER_PROFILES POLICIES
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT TO authenticated, anon
  USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE TO authenticated, anon
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can delete their own profile" ON user_profiles;
CREATE POLICY "Users can delete their own profile"
  ON user_profiles FOR DELETE TO authenticated, anon
  USING (auth.uid() = id);
-- ───────────────────────────────────────────────────────────
-- PART 5: ACCOUNT_RECOVERY POLICIES (Restrictive)
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can create recovery credentials" ON account_recovery;
CREATE POLICY "Anyone can create recovery credentials"
  ON account_recovery FOR INSERT TO authenticated, anon
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can read their own recovery credentials" ON account_recovery;
DROP POLICY IF EXISTS "Anyone can read recovery by username for login" ON account_recovery;
CREATE POLICY "Users can read their own recovery credentials"
  ON account_recovery FOR SELECT TO authenticated, anon
  USING (
    id IN (
      SELECT recovery_id FROM user_recovery_links
      WHERE user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can delete their own recovery credentials" ON account_recovery;
CREATE POLICY "Users can delete their own recovery credentials"
  ON account_recovery FOR DELETE TO authenticated, anon
  USING (
    id IN (
      SELECT recovery_id FROM user_recovery_links
      WHERE user_id = auth.uid()
    )
  );
-- ───────────────────────────────────────────────────────────
-- PART 6: USER_RECOVERY_LINKS POLICIES
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can create their own recovery links" ON user_recovery_links;
CREATE POLICY "Users can create their own recovery links"
  ON user_recovery_links FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can read their own recovery links" ON user_recovery_links;
CREATE POLICY "Users can read their own recovery links"
  ON user_recovery_links FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own recovery links" ON user_recovery_links;
CREATE POLICY "Users can update their own recovery links"
  ON user_recovery_links FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own recovery links" ON user_recovery_links;
CREATE POLICY "Users can delete their own recovery links"
  ON user_recovery_links FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id);
-- ───────────────────────────────────────────────────────────
-- PART 7: TRIPS POLICIES
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own trips" ON trips;
CREATE POLICY "Users can insert their own trips"
  ON trips FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can read their own trips" ON trips;
CREATE POLICY "Users can read their own trips"
  ON trips FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips"
  ON trips FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;
CREATE POLICY "Users can delete their own trips"
  ON trips FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id);
-- ───────────────────────────────────────────────────────────
-- PART 8: RATED_FEATURES POLICIES
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own ratings" ON rated_features;
CREATE POLICY "Users can insert their own ratings"
  ON rated_features FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can read their own ratings" ON rated_features;
CREATE POLICY "Users can read their own ratings"
  ON rated_features FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own ratings" ON rated_features;
CREATE POLICY "Users can update their own ratings"
  ON rated_features FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own ratings" ON rated_features;
CREATE POLICY "Users can delete their own ratings"
  ON rated_features FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id);
-- ───────────────────────────────────────────────────────────
-- PART 9: CORRECTED_SEGMENTS POLICIES
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own corrections" ON corrected_segments;
CREATE POLICY "Users can insert their own corrections"
  ON corrected_segments FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can read their own corrections" ON corrected_segments;
CREATE POLICY "Users can read their own corrections"
  ON corrected_segments FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own corrections" ON corrected_segments;
CREATE POLICY "Users can update their own corrections"
  ON corrected_segments FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own corrections" ON corrected_segments;
CREATE POLICY "Users can delete their own corrections"
  ON corrected_segments FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id);
-- ═══════════════════════════════════════════════════════════
-- SECURITY SUMMARY
-- ═══════════════════════════════════════════════════════════
--
-- ✅ SECURITY DEFINER function prevents bulk table scraping
-- ✅ Restrictive RLS policies prevent direct account_recovery access
-- ✅ Anonymous users must use verify_login_credentials() RPC
-- ✅ All user data isolated by user_id (anonymous UUID)
-- ✅ Bcrypt hashing (10 rounds) for passwords
-- ✅ CAPTCHA after 3 failed login attempts (client-side)
--
-- RATE LIMITING (Configure in Supabase Dashboard):
-- - Anonymous users: 30/hour per IP
-- - Sign-ups and sign-ins: 30 per 5 min per IP
-- - Token refreshes: 150 per 5 min per IP
--
-- ═══════════════════════════════════════════════════════════;
