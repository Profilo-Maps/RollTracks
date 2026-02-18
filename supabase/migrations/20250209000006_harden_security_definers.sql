-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY HARDENING: Fix SECURITY DEFINER Functions
-- Migration: Harden all SECURITY DEFINER functions against injection
-- Date: 2025-02-09
--
-- VULNERABILITY FIXED:
-- Based on https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/
--
-- CHANGES:
-- 1. SET search_path = '' (empty, not 'public')
-- 2. Schema-qualify ALL object references (tables, functions, operators)
-- 3. Explicitly use pg_catalog operators to prevent injection
-- 4. Add public. prefix to function definitions
--
-- WHY THIS MATTERS:
-- Even with search_path set, unqualified operators like =, ~, etc.
-- can be hijacked by malicious users creating custom operators.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. HARDEN: verify_login_credentials
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_login_credentials(
  p_username TEXT
)
RETURNS TABLE (
  recovery_id UUID,
  password_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- Empty for maximum security
AS $$
BEGIN
  -- Schema-qualified table and operator references
  RETURN QUERY
  SELECT 
    public.account_recovery.id,
    public.account_recovery.password_hash
  FROM public.account_recovery
  WHERE public.account_recovery.username OPERATOR(pg_catalog.=) p_username
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_login_credentials(TEXT) TO anon, authenticated;
COMMENT ON FUNCTION public.verify_login_credentials IS
  'Securely retrieves recovery credentials for login. HARDENED: Schema-qualified to prevent operator injection attacks.';
-- ───────────────────────────────────────────────────────────
-- 2. HARDEN: create_recovery_credentials
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_recovery_credentials(
  p_username TEXT,
  p_password_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- Empty for maximum security
AS $$
DECLARE
  v_recovery_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current authenticated user ID (schema-qualified)
  v_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create recovery credentials';
  END IF;
  
  -- Validate username format using explicit pg_catalog operator
  IF NOT (p_username OPERATOR(pg_catalog.~) '^[a-zA-Z0-9_-]{3,30}$') THEN
    RAISE EXCEPTION 'Invalid username format. Must be 3-30 characters, alphanumeric with _ or -';
  END IF;
  
  -- Validate password hash format using explicit pg_catalog operator
  IF NOT (p_password_hash OPERATOR(pg_catalog.~) '^\$2[aby]\$\d{2}\$.{53}$') THEN
    RAISE EXCEPTION 'Invalid password hash format';
  END IF;
  
  -- Check if user already has recovery credentials (schema-qualified)
  IF EXISTS (
    SELECT 1 FROM public.user_recovery_links 
    WHERE user_id OPERATOR(pg_catalog.=) v_user_id
  ) THEN
    RAISE EXCEPTION 'User already has recovery credentials';
  END IF;
  
  -- Insert into account_recovery (atomic transaction, schema-qualified)
  BEGIN
    INSERT INTO public.account_recovery (username, password_hash)
    VALUES (p_username, p_password_hash)
    RETURNING id INTO v_recovery_id;
    
    -- Link recovery credentials to user
    INSERT INTO public.user_recovery_links (recovery_id, user_id)
    VALUES (v_recovery_id, v_user_id);
    
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Registration failed. Please try a different username.';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Registration failed: %', SQLERRM;
  END;
  
  RETURN v_recovery_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_recovery_credentials(TEXT, TEXT) TO anon, authenticated;
COMMENT ON FUNCTION public.create_recovery_credentials IS
  'Securely creates recovery credentials. HARDENED: Schema-qualified to prevent operator injection attacks.';
-- ───────────────────────────────────────────────────────────
-- 3. HARDEN: check_display_name_available
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_display_name_available(
  p_display_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- Empty for maximum security
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if display name exists (case-insensitive, schema-qualified)
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE pg_catalog.lower(display_name) OPERATOR(pg_catalog.=) pg_catalog.lower(p_display_name)
  ) INTO v_exists;
  
  -- Return true if available (does NOT exist)
  RETURN NOT v_exists;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_display_name_available(TEXT) TO anon, authenticated;
COMMENT ON FUNCTION public.check_display_name_available IS
  'Checks if display name is available. HARDENED: Schema-qualified to prevent operator injection attacks.';
-- ═══════════════════════════════════════════════════════════
-- SECURITY HARDENING SUMMARY
-- ═══════════════════════════════════════════════════════════
--
-- ✅ SET search_path = '' (empty, not 'public')
-- ✅ All table references schema-qualified (public.table_name)
-- ✅ All operators explicitly use pg_catalog (OPERATOR(pg_catalog.=))
-- ✅ All functions schema-qualified (pg_catalog.lower, auth.uid)
-- ✅ Function definitions include schema (public.function_name)
--
-- ATTACK PREVENTION:
-- Even if a malicious user creates:
--   CREATE OPERATOR public.= (...)
--   CREATE FUNCTION public.lower(...)
-- These functions will NOT use them because we explicitly
-- reference pg_catalog.= and pg_catalog.lower
--
-- REFERENCES:
-- https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/
-- https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
--
-- ═══════════════════════════════════════════════════════════;
