-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY FIX: Update Argon2 Hash Validation
-- Migration: Fix regex to allow base64 padding characters
-- Date: 2025-02-09
--
-- ISSUE:
-- The previous Argon2 validation regex didn't account for base64
-- padding characters (=) which can appear at the end of the salt
-- and hash components. This caused "Invalid password hash format"
-- errors during registration.
--
-- FIX:
-- Update regex pattern to include '=' in the base64 character class
-- ═══════════════════════════════════════════════════════════

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
  -- FIXED: Added '=' to character class to allow base64 padding
  IF p_password_hash !~ '^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$' THEN
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
  'Securely creates recovery credentials with Argon2 hash validation. Prevents username enumeration and enforces format validation. Updated to support base64 padding characters.';
