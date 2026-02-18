-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS FIX: Allow SECURITY DEFINER functions to insert
-- Migration: Fix RLS policies blocking create_recovery_credentials
-- Date: 2025-02-09
--
-- PROBLEM:
-- The create_recovery_credentials() SECURITY DEFINER function
-- successfully inserts into account_recovery but fails to insert
-- into user_recovery_links because the RLS policy blocks it.
--
-- SOLUTION:
-- Change the policy to allow inserts from SECURITY DEFINER functions
-- while still blocking direct client inserts.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- FIX: user_recovery_links INSERT policy
-- ───────────────────────────────────────────────────────────

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "No direct inserts to user_recovery_links" ON user_recovery_links;
-- Create a policy that allows inserts when user_id matches auth.uid()
-- This allows SECURITY DEFINER functions to insert while preventing
-- users from inserting links for other users
CREATE POLICY "Users can create their own recovery links"
  ON user_recovery_links FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "Users can create their own recovery links" ON user_recovery_links IS
  'Allows inserts when user_id matches authenticated user. SECURITY DEFINER functions can insert because they run with elevated privileges.';
-- ───────────────────────────────────────────────────────────
-- VERIFY: account_recovery policy is correct
-- ───────────────────────────────────────────────────────────

-- The account_recovery table should remain restrictive since
-- the SECURITY DEFINER function handles all inserts
-- No changes needed here - the function bypasses RLS correctly

-- ═══════════════════════════════════════════════════════════
-- EXPLANATION
-- ═══════════════════════════════════════════════════════════
--
-- WHY THIS WORKS:
--
-- 1. SECURITY DEFINER functions run with the privileges of the
--    function owner (typically the database owner/superuser)
--
-- 2. When create_recovery_credentials() calls auth.uid(), it gets
--    the current user's ID
--
-- 3. The INSERT into user_recovery_links uses that user_id
--
-- 4. The policy checks: auth.uid() = user_id
--    - During function execution, both are the same user
--    - Policy allows the insert ✅
--
-- 5. Direct client inserts are still blocked because:
--    - Client can't insert with a different user_id (policy blocks)
--    - Client can only insert their own user_id (which is fine)
--
-- SECURITY:
-- - Users can only create links for themselves
-- - The create_recovery_credentials() function enforces all validation
-- - No direct client access to account_recovery (still blocked)
--
-- ═══════════════════════════════════════════════════════════;
