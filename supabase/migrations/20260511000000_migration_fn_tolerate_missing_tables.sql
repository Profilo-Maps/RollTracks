-- Fix: migrate_user_to_new_session references tables that may not exist on remote
-- (geometry_edits, feature_edits were skipped in prior migration repair).
-- Use dynamic SQL guarded by to_regclass to tolerate missing tables.

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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_recovery_links
    WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id
      AND user_id OPERATOR(pg_catalog.=) p_old_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid recovery credentials';
  END IF;

  UPDATE public.user_profiles
  SET id = v_new_user_id
  WHERE id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.trips SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.rated_features SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  UPDATE public.corrected_segments SET user_id = v_new_user_id
  WHERE user_id OPERATOR(pg_catalog.=) p_old_user_id;

  -- Tolerate edit tables that may not yet exist on this database
  IF pg_catalog.to_regclass('public.segment_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'UPDATE public.segment_edits SET user_id = %L WHERE user_id = %L',
      v_new_user_id, p_old_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.geometry_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'UPDATE public.geometry_edits SET user_id = %L WHERE user_id = %L',
      v_new_user_id, p_old_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.feature_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'UPDATE public.feature_edits SET user_id = %L WHERE user_id = %L',
      v_new_user_id, p_old_user_id
    );
  END IF;

  UPDATE public.user_recovery_links
  SET user_id = v_new_user_id
  WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id;
END;
$$;

-- Also update delete_user_completely with the same defensive checks
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
  SELECT user_id INTO v_user_id
  FROM public.user_recovery_links
  WHERE recovery_id OPERATOR(pg_catalog.=) p_recovery_id;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF pg_catalog.to_regclass('public.segment_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'DELETE FROM public.segment_edits WHERE user_id = %L', v_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.geometry_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'DELETE FROM public.geometry_edits WHERE user_id = %L', v_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.feature_edits') IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'DELETE FROM public.feature_edits WHERE user_id = %L', v_user_id
    );
  END IF;

  DELETE FROM public.rated_features
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.corrected_segments
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.trips
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.user_profiles
  WHERE id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.user_recovery_links
  WHERE user_id OPERATOR(pg_catalog.=) v_user_id;

  DELETE FROM public.account_recovery
  WHERE id OPERATOR(pg_catalog.=) p_recovery_id;
END;
$$;
