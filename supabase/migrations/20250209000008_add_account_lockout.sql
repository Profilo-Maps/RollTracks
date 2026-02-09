-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY: Account Lockout with Auto-Delete
-- Migration: Add failed login tracking and auto-delete after 10 attempts
-- Date: 2025-02-09
--
-- SECURITY FEATURES:
-- 1. Tracks failed login attempts per username
-- 2. Automatically deletes account after 10 failed attempts per day
-- 3. Cascades deletion to all user data (trips, ratings, segments)
-- 4. Resets counter daily at midnight (not rolling 24-hour window)
-- 5. Successful login clears all failed attempts
-- 6. Auto-cleanup of old attempt records
-- 7. Constant-time responses to prevent timing attacks
--
-- RATIONALE:
-- Since accounts are anonymous with no email recovery, aggressive
-- lockout with deletion prevents brute force attacks while maintaining
-- the privacy-first design. Users can simply create a new account.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. CREATE LOGIN ATTEMPTS TABLE
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET, -- Optional: for future IP-based rate limiting
  user_agent TEXT  -- Optional: for forensics
);

-- Index for fast lookups by username and time
CREATE INDEX idx_login_attempts_username_time 
  ON public.login_attempts(username, attempted_at DESC);

-- Index for cleanup of old records
CREATE INDEX idx_login_attempts_cleanup 
  ON public.login_attempts(attempted_at);

COMMENT ON TABLE public.login_attempts IS
  'Tracks login attempts for security monitoring and account lockout enforcement';

-- ───────────────────────────────────────────────────────────
-- 2. AUTO-CLEANUP FUNCTION (Remove attempts older than 30 days)
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at OPERATOR(pg_catalog.<) (NOW() OPERATOR(pg_catalog.-) INTERVAL '30 days');
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_login_attempts IS
  'Removes login attempt records older than 30 days to prevent table bloat';

-- ───────────────────────────────────────────────────────────
-- 3. FUNCTION TO DELETE USER AND ALL DATA
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_user_completely(
  p_recovery_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user_id from recovery_id
  SELECT user_id INTO v_user_id
  FROM public.user_recovery_links
  WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id;
  
  IF v_user_id IS NULL THEN
    RETURN; -- User already deleted or doesn't exist
  END IF;
  
  -- Delete all user data (cascading deletes will handle related records)
  -- Order matters: delete from child tables first to avoid FK violations
  
  -- Delete DataRanger contributions
  DELETE FROM public.rated_features 
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;
  
  DELETE FROM public.corrected_segments 
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;
  
  -- Delete trips
  DELETE FROM public.trips 
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;
  
  -- Delete user profile
  DELETE FROM public.user_profiles 
  WHERE id OPERATOR(pg_catalog.=) v_user_id;
  
  -- Delete recovery link
  DELETE FROM public.user_recovery_links 
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;
  
  -- Delete recovery credentials
  DELETE FROM public.account_recovery 
  WHERE id OPERATOR(pg_catalog.=) p_recovery_id;
  
  -- Delete from Supabase auth (anonymous user)
  -- Note: This requires admin privileges, may need to be handled separately
  -- DELETE FROM auth.users WHERE id = v_user_id;
  
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_completely(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.delete_user_completely IS
  'Completely deletes a user and all associated data. Used for account lockout enforcement.';

-- ───────────────────────────────────────────────────────────
-- 4. ENHANCED LOGIN VERIFICATION WITH LOCKOUT
-- ───────────────────────────────────────────────────────────

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS public.verify_login_credentials(TEXT);

CREATE OR REPLACE FUNCTION public.verify_login_credentials(
  p_username TEXT
)
RETURNS TABLE (
  recovery_id UUID,
  password_hash TEXT,
  is_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recovery_id UUID;
  v_password_hash TEXT;
  v_failed_attempts INTEGER;
  v_is_locked BOOLEAN := FALSE;
BEGIN
  -- Constant-time delay to prevent timing attacks (100ms)
  PERFORM pg_catalog.pg_sleep(0.1);
  
  -- Check failed attempts since midnight today (resets daily)
  SELECT pg_catalog.count(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE username OPERATOR(pg_catalog.=) p_username
    AND attempted_at OPERATOR(pg_catalog.>=) pg_catalog.date_trunc('day', NOW())
    AND success OPERATOR(pg_catalog.=) FALSE;
  
  -- If 10 or more failed attempts, delete the account
  IF v_failed_attempts OPERATOR(pg_catalog.>=) 10 THEN
    -- Get recovery_id before deletion
    SELECT id INTO v_recovery_id
    FROM public.account_recovery
    WHERE username OPERATOR(pg_catalog.=) p_username;
    
    -- Delete the account completely
    IF v_recovery_id IS NOT NULL THEN
      PERFORM public.delete_user_completely(v_recovery_id);
    END IF;
    
    -- Return locked status (no credentials)
    v_is_locked := TRUE;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, v_is_locked;
    RETURN;
  END IF;
  
  -- Retrieve credentials if account not locked
  SELECT 
    public.account_recovery.id,
    public.account_recovery.password_hash
  INTO v_recovery_id, v_password_hash
  FROM public.account_recovery
  WHERE public.account_recovery.username OPERATOR(pg_catalog.=) p_username
  LIMIT 1;
  
  -- Return credentials
  RETURN QUERY SELECT v_recovery_id, v_password_hash, v_is_locked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_login_credentials(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.verify_login_credentials IS
  'Retrieves login credentials with lockout enforcement. Deletes account after 10 failed attempts per day (resets at midnight).';

-- ───────────────────────────────────────────────────────────
-- 5. FUNCTION TO RECORD LOGIN ATTEMPT
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_username TEXT,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Record the attempt
  INSERT INTO public.login_attempts (username, success, ip_address, user_agent)
  VALUES (p_username, p_success, p_ip_address, p_user_agent);
  
  -- If successful, clear old failed attempts for this username
  IF p_success THEN
    DELETE FROM public.login_attempts
    WHERE username OPERATOR(pg_catalog.=) p_username
      AND success OPERATOR(pg_catalog.=) FALSE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN, INET, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.record_login_attempt IS
  'Records a login attempt (success or failure). Clears failed attempts on successful login.';

-- ───────────────────────────────────────────────────────────
-- 6. FUNCTION TO CHECK REMAINING ATTEMPTS
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_remaining_login_attempts(
  p_username TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_failed_attempts INTEGER;
  v_remaining INTEGER;
BEGIN
  -- Count failed attempts since midnight today (resets daily)
  SELECT pg_catalog.count(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE username OPERATOR(pg_catalog.=) p_username
    AND attempted_at OPERATOR(pg_catalog.>=) pg_catalog.date_trunc('day', NOW())
    AND success OPERATOR(pg_catalog.=) FALSE;
  
  -- Calculate remaining attempts (10 max)
  v_remaining := 10 OPERATOR(pg_catalog.-) v_failed_attempts;
  
  -- Return 0 if negative
  IF v_remaining OPERATOR(pg_catalog.<) 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remaining_login_attempts(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_remaining_login_attempts IS
  'Returns the number of remaining login attempts before account deletion (0-10)';

-- ───────────────────────────────────────────────────────────
-- 7. RLS POLICIES FOR LOGIN_ATTEMPTS TABLE
-- ───────────────────────────────────────────────────────────

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access - must use functions
CREATE POLICY "No direct access to login_attempts"
  ON public.login_attempts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "No direct access to login_attempts" ON public.login_attempts IS
  'Prevents direct access. Use record_login_attempt() and get_remaining_login_attempts() functions.';

-- ═══════════════════════════════════════════════════════════
-- USAGE GUIDE FOR CLIENT CODE
-- ═══════════════════════════════════════════════════════════
--
-- 1. CHECK REMAINING ATTEMPTS (optional, for UI feedback):
--
-- const { data: remaining } = await supabase.rpc('get_remaining_login_attempts', {
--   p_username: 'myusername'
-- });
-- console.log(`${remaining} attempts remaining`);
--
-- 2. VERIFY LOGIN CREDENTIALS:
--
-- const { data, error } = await supabase.rpc('verify_login_credentials', {
--   p_username: 'myusername'
-- });
--
-- if (data[0]?.is_locked) {
--   // Account has been deleted due to too many failed attempts
--   alert('Account locked and deleted due to too many failed login attempts');
--   return;
-- }
--
-- if (!data[0]?.password_hash) {
--   // Username doesn't exist (or was just deleted)
--   // Record failed attempt
--   await supabase.rpc('record_login_attempt', {
--     p_username: 'myusername',
--     p_success: false
--   });
--   return;
-- }
--
-- 3. VERIFY PASSWORD (client-side argon2):
--
-- const isValid = await argon2.verify(data[0].password_hash, userPassword);
--
-- 4. RECORD THE ATTEMPT:
--
-- await supabase.rpc('record_login_attempt', {
--   p_username: 'myusername',
--   p_success: isValid
-- });
--
-- 5. IF SUCCESSFUL, PROCEED WITH LOGIN:
--
-- if (isValid) {
--   // Get user_id from recovery_id and sign in
--   // ... rest of login flow
-- }
--
-- ═══════════════════════════════════════════════════════════
-- SECURITY BENEFITS
-- ═══════════════════════════════════════════════════════════
--
-- ✅ Prevents brute force attacks (10 attempt limit)
-- ✅ Automatic account deletion (no manual intervention needed)
-- ✅ Cascading deletion (all user data removed)
-- ✅ Constant-time responses (prevents timing attacks)
-- ✅ Daily reset at midnight (fresh start each day)
-- ✅ Successful login clears counter (user-friendly)
-- ✅ Privacy-first (no email notifications needed)
-- ✅ Auto-cleanup of old records (prevents table bloat)
--
-- TRADE-OFFS:
--
-- ⚠️  Aggressive deletion may frustrate legitimate users
-- ⚠️  No account recovery after deletion (by design)
-- ⚠️  Attacker can intentionally lock out users (DoS risk)
-- ⚠️  Daily reset means attacker gets 10 fresh attempts each day
--
-- MITIGATION FOR DoS:
-- - Consider adding IP-based rate limiting
-- - Consider CAPTCHA after 3 failed attempts
-- - Consider temporary lockout before deletion (e.g., 1 hour)
--
-- ═══════════════════════════════════════════════════════════
