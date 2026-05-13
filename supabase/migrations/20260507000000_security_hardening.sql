-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SECURITY: Session Migration & Deletion Hardening
-- Migration: Add migrate_user_to_new_session function, update
--            delete_user_completely to cover new edit tables,
--            and prepare REVOKE for verify_login_credentials.
-- Date: 2026-05-07
--
-- SECURITY FEATURES:
-- 1. migrate_user_to_new_session: Transfers all user data from
--    an old anonymous session to a new one using recovery_id
--    as authorization proof.
-- 2. delete_user_completely: Extended to cascade-delete from
--    segment_edits, geometry_edits, and feature_edits tables.
-- 3. Deferred REVOKE on verify_login_credentials (commented out
--    until Edge Function is deployed).
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. FUNCTION: MIGRATE USER TO NEW SESSION
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.migrate_user_to_new_session(
  p_old_user_id UUID,
  p_recovery_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_user_id UUID;
BEGIN
  -- Get caller's session ID (the NEW anonymous user)
  v_new_user_id := auth.uid();

  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated session';
  END IF;

  -- Prevent self-migration
  IF v_new_user_id OPERATOR(pg_catalog.=) p_old_user_id THEN
    RAISE EXCEPTION 'Cannot migrate to same user';
  END IF;

  -- Authorization: verify recovery_id is linked to old_user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.user_recovery_links
    WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id
      AND user_id OPERATOR(pg_catalog.=) p_old_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid recovery credentials';
  END IF;

  -- Copy user profile to new user ID
  INSERT INTO public.user_profiles (id, display_name, age, mode_list, dataranger_mode)
  SELECT v_new_user_id, display_name, age, mode_list, dataranger_mode
  FROM public.user_profiles
  WHERE id OPERATOR(pg_catalog.=) p_old_user_id;

  -- Update user_id in all data tables
  UPDATE public.trips SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.rated_features SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.corrected_segments SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.segment_edits SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.geometry_edits SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.feature_edits SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  -- Update recovery link to point to new user
  UPDATE public.user_recovery_links
  SET user_id = v_new_user_id
  WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id;

  -- Delete old profile
  DELETE FROM public.user_profiles
  WHERE id OPERATOR(pg_catalog.=) p_old_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_user_to_new_session(UUID, UUID) TO anon, authenticated;

-- ───────────────────────────────────────────────────────────
-- 2. UPDATED: DELETE USER COMPLETELY (adds new edit tables)
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

  -- Delete new edit tables
  DELETE FROM public.segment_edits
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.geometry_edits
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.feature_edits
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

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

-- ───────────────────────────────────────────────────────────
-- 3. DEFERRED REVOKE FOR verify_login_credentials
-- ───────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════
-- DEFERRED: Apply AFTER Edge Function is deployed and client code updated.
-- Revoking before the Edge Function is live will break all logins.
-- ═══════════════════════════════════════════════════════════
-- REVOKE EXECUTE ON FUNCTION public.verify_login_credentials(TEXT) FROM anon, authenticated;
