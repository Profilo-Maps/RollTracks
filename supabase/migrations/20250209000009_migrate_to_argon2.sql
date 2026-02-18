-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY ENHANCEMENT: Migrate to Argon2
-- Migration: Update password hash validation from bcrypt to Argon2
-- Date: 2025-02-09
--
-- SECURITY IMPROVEMENTS:
-- 1. Argon2id is the winner of the Password Hashing Competition
-- 2. More resistant to GPU/ASIC attacks than bcrypt
-- 3. Configurable memory-hard function
-- 4. Better protection against side-channel attacks
--
-- MIGRATION STRATEGY:
-- - New registrations will use Argon2id hashes
-- - Existing bcrypt hashes remain valid (users must re-register)
-- - Validation function updated to accept Argon2 format
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- UPDATE REGISTRATION FUNCTION FOR ARGON2
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_recovery_credentials(
  p_username TEXT,
  p_password_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
  v_recovery_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create recovery credentials';
  END IF;
  
  -- Validate username format (alphanumeric, underscore, hyphen, 3-30 chars)
  IF p_username !~ '^[a-zA-Z0-9_-]{3,30}$' THEN
    RAISE EXCEPTION 'Invalid username format. Must be 3-30 characters, alphanumeric with _ or -';
  END IF;
  
  -- Validate password hash format (Argon2 hashes start with $argon2)
  -- Format: $argon2<variant>$v=<version>$m=<memory>,t=<iterations>,p=<parallelism>$<salt>$<hash>
  -- Example: $argon2id$v=19$m=65536,t=3,p=4$...
  IF p_password_hash !~ '^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$' THEN
    RAISE EXCEPTION 'Invalid password hash format. Must be Argon2 hash.';
  END IF;
  
  -- Check if user already has recovery credentials
  IF EXISTS (
    SELECT 1 FROM user_recovery_links WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User already has recovery credentials';
  END IF;
  
  -- Insert into account_recovery (atomic transaction)
  BEGIN
    INSERT INTO account_recovery (username, password_hash)
    VALUES (p_username, p_password_hash)
    RETURNING id INTO v_recovery_id;
    
    -- Link recovery credentials to user
    INSERT INTO user_recovery_links (recovery_id, user_id)
    VALUES (v_recovery_id, v_user_id);
    
  EXCEPTION
    WHEN unique_violation THEN
      -- Don't reveal which constraint was violated (prevents username enumeration)
      RAISE EXCEPTION 'Registration failed. Please try a different username.';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Registration failed: %', SQLERRM;
  END;
  
  RETURN v_recovery_id;
END;
$$;
-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION create_recovery_credentials(TEXT, TEXT) TO anon, authenticated;
COMMENT ON FUNCTION create_recovery_credentials IS
  'Securely creates recovery credentials with Argon2 hash validation. Prevents username enumeration and enforces format validation.';
-- ───────────────────────────────────────────────────────────
-- UPDATE TABLE COMMENTS
-- ───────────────────────────────────────────────────────────

COMMENT ON TABLE account_recovery IS
  'Stores username and Argon2id-hashed password for multi-device account recovery';
COMMENT ON COLUMN account_recovery.password_hash IS
  'Argon2id-hashed password for multi-device recovery. Uses memory=64MiB, time=3, parallelism=4 for optimal mobile security.';
COMMENT ON TABLE user_profiles IS
  'User profiles with Argon2id-hashed passwords. New registrations use Argon2id for enhanced security.';
-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- ARGON2 CONFIGURATION:
-- - Type: argon2id (hybrid mode, best overall protection)
-- - Memory: 65536 KiB (64 MiB) - balanced for mobile devices
-- - Time: 3 iterations - good security without UX impact
-- - Parallelism: 4 threads
--
-- HASH FORMAT:
-- $argon2id$v=19$m=65536,t=3,p=4$<base64-salt>$<base64-hash>
--
-- EXISTING USERS:
-- - Existing bcrypt hashes in the database remain unchanged
-- - Users with bcrypt hashes will need to re-register
-- - Client-side code handles backward compatibility check
--
-- SECURITY BENEFITS:
-- ✅ Memory-hard function (resistant to GPU/ASIC attacks)
-- ✅ Side-channel attack resistance
-- ✅ Configurable parameters for future-proofing
-- ✅ Winner of Password Hashing Competition
-- ✅ Recommended by OWASP and security experts
--
-- CLIENT-SIDE USAGE:
-- import * as argon2 from 'argon2';
--
-- const hash = await argon2.hash(password, {
--   type: argon2.argon2id,
--   memoryCost: 65536,
--   timeCost: 3,
--   parallelism: 4,
-- });
--
-- const isValid = await argon2.verify(hash, password);
--
-- ═══════════════════════════════════════════════════════════;
