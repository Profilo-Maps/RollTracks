-- Fix: migrate_user_to_new_session INSERT fails on display_name unique constraint
-- because old profile row still exists when new row is inserted.
-- Solution: UPDATE the profile's id directly (single row, no conflict).

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
  v_new_user_id := auth.uid();

  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated session';
  END IF;

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

  -- Update profile id directly (avoids unique constraint on display_name)
  UPDATE public.user_profiles
  SET id = v_new_user_id
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
END;
$$;
