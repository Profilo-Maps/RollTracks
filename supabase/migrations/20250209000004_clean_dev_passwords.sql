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
  'User profiles with Argon2id-hashed passwords. Uses memory=64MiB, time=3, parallelism=4 for optimal mobile security.';

-- ═══════════════════════════════════════════════════════════
-- SECURITY NOTES
-- ═══════════════════════════════════════════════════════════
--
-- After this migration:
-- ✅ All dev_hash passwords removed
-- ✅ Only Argon2id-hashed passwords allowed going forward
-- ✅ create_recovery_credentials() function validates Argon2 format
-- ✅ Users must re-register with secure passwords
--
-- ═══════════════════════════════════════════════════════════
