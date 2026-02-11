-- Fix the trip insert trigger to ensure trip_id is properly generated
-- The previous trigger might be interfering with the auto-generated trip_id

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.store_trip_census_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  -- Skip if geometry is NULL or empty
  IF NEW.geometry IS NULL OR NEW.geometry = '' THEN
    -- Set od_geoids to NULL for trips without geometry
    NEW.od_geoids := NULL;
    RETURN NEW;
  END IF;

  -- For now, just set od_geoids to NULL
  -- Future Edge Function will decode polyline and populate this
  NEW.od_geoids := NULL;

  -- Always return NEW to allow the insert to proceed
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block the insert
    RAISE WARNING 'Error in store_trip_census_blocks trigger: %', SQLERRM;
    NEW.od_geoids := NULL;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.store_trip_census_blocks IS
  'BEFORE INSERT trigger that prepares trip for census block anonymization. Errors are logged but do not block inserts.';
