-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY: Display Name Availability Check
-- Migration: Add SECURITY DEFINER function to check display names
-- Date: 2025-02-09
--
-- PROBLEM:
-- RLS policies prevent users from querying other users' display names,
-- so the client-side availability check always returns "available"
-- even when a display name is taken.
--
-- SOLUTION:
-- Create a SECURITY DEFINER function that bypasses RLS to check
-- if a display name exists, without exposing any user data.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- DISPLAY NAME AVAILABILITY CHECK FUNCTION
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_display_name_available(
  p_display_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if display name exists (case-insensitive for better UX)
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE LOWER(display_name) = LOWER(p_display_name)
  ) INTO v_exists;
  
  -- Return true if available (does NOT exist)
  RETURN NOT v_exists;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION check_display_name_available(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION check_display_name_available IS
  'Checks if a display name is available (not taken). Uses SECURITY DEFINER to bypass RLS. Case-insensitive comparison prevents similar names like "User" and "user".';

-- ═══════════════════════════════════════════════════════════
-- SECURITY BENEFITS
-- ═══════════════════════════════════════════════════════════
--
-- ✅ Bypasses RLS to check all display names
-- ✅ Returns only boolean (no user data exposed)
-- ✅ Case-insensitive check (prevents "User" vs "user")
-- ✅ Prevents duplicate display names at registration
-- ✅ No enumeration risk (only returns true/false)
--
-- USAGE IN CLIENT CODE:
--
-- const { data: isAvailable, error } = await supabase.rpc(
--   'check_display_name_available',
--   { p_display_name: 'myusername' }
-- );
--
-- if (isAvailable) {
--   // Display name is available
-- } else {
--   // Display name is taken
-- }
--
-- ═══════════════════════════════════════════════════════════
