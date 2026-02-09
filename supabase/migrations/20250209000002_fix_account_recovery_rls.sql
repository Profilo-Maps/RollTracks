-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS FIX: Account Recovery RLS Policies
-- Migration: Fix RLS policies to allow registration flow
-- Date: 2025-02-09
--
-- ISSUE:
-- During registration, after creating anonymous user, the app tries to:
-- 1. Insert into account_recovery (username + password_hash)
-- 2. Insert into user_recovery_links (link recovery to user)
--
-- The current policies are too restrictive and block step 1.
--
-- SOLUTION:
-- - Allow INSERT into account_recovery for any authenticated user (including anonymous)
-- - Keep SELECT restricted to prevent bulk scraping
-- - Use verify_login_credentials() function for secure login
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- FIX: ACCOUNT_RECOVERY INSERT POLICY
-- ───────────────────────────────────────────────────────────

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Anyone can create recovery credentials" ON account_recovery;

-- Create new policy that allows authenticated users (including anonymous) to insert
CREATE POLICY "Authenticated users can create recovery credentials"
  ON account_recovery FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

COMMENT ON POLICY "Authenticated users can create recovery credentials" ON account_recovery IS
  'Allows any authenticated user (including anonymous) to create recovery credentials during registration';

-- ───────────────────────────────────────────────────────────
-- VERIFY: USER_RECOVERY_LINKS POLICIES ARE CORRECT
-- ───────────────────────────────────────────────────────────

-- The existing policy should work, but let's ensure it's correct
DROP POLICY IF EXISTS "Users can create their own recovery links" ON user_recovery_links;
CREATE POLICY "Users can create their own recovery links"
  ON user_recovery_links FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can create their own recovery links" ON user_recovery_links IS
  'Allows users to link their anonymous user ID to recovery credentials during registration';

-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- REGISTRATION FLOW (Now Fixed):
-- 1. Client calls supabase.auth.signInAnonymously() → creates anonymous user
-- 2. Client gets auth.uid() from session
-- 3. Client inserts into account_recovery (username, password_hash) ✅ NOW WORKS
-- 4. Client inserts into user_recovery_links (recovery_id, user_id) ✅ WORKS
-- 5. Client inserts into user_profiles (id, display_name, etc.) ✅ WORKS
--
-- LOGIN FLOW (Unchanged):
-- 1. Client calls verify_login_credentials(username) RPC
-- 2. Client verifies password with argon2.verify()
-- 3. Client creates new anonymous user
-- 4. Client migrates data from old user to new user
-- 5. Client updates user_recovery_links to point to new user
--
-- SECURITY:
-- ✅ SELECT on account_recovery still restricted (prevents scraping)
-- ✅ verify_login_credentials() function provides secure login
-- ✅ Users can only read their own recovery credentials
-- ✅ All other tables remain properly secured
--
-- ═══════════════════════════════════════════════════════════
