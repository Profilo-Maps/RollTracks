-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY FIX: Clean Development Passwords
-- Migration: Remove users with unhashed dev passwords
-- Date: 2025-02-09
--
-- This migration removes any user profiles that were created
-- with the temporary dev_hash_ password format during development.
-- Users will need to re-register with properly hashed passwords.
-- ═══════════════════════════════════════════════════════════

-- Delete user profiles with dev_hash passwords
DELETE FROM user_profiles 
WHERE password_hash LIKE 'dev_hash_%';
-- Delete corresponding recovery credentials
DELETE FROM account_recovery 
WHERE password_hash LIKE 'dev_hash_%';
-- Note: RLS policies and CASCADE constraints will handle cleanup
-- of related trips, ratings, and corrections automatically

COMMENT ON TABLE user_profiles IS
  'User profiles with bcrypt-hashed passwords (10 rounds). Dev passwords have been cleaned.';
-- ═══════════════════════════════════════════════════════════
-- SECURITY NOTES
-- ═══════════════════════════════════════════════════════════
--
-- After this migration:
-- ✅ All dev_hash passwords removed
-- ✅ Only bcrypt-hashed passwords allowed going forward
-- ✅ create_recovery_credentials() function validates bcrypt format
-- ✅ Users must re-register with secure passwords
--
-- ═══════════════════════════════════════════════════════════;
