-- Migration: Fix Census Block Storage and Account Deletion Cascade
--
-- This migration addresses two issues:
-- 1. Census block clipping was corrupting polyline geometry - now we only store GEOIDs
-- 2. Account deletion was not cleaning up recovery credentials - now uses CASCADE

-- ═══════════════════════════════════════════════════════════
-- PART 1: FIX CENSUS BLOCK TRIGGER (NO GEOMETRY CLIPPING)
-- ═══════════════════════════════════════════════════════════
--
-- APPROACH: Instead of clipping geometry on the server (which causes encoding bugs),
-- we store the original polyline AND the census block GEOIDs. This allows:
-- 1. Users to see their full route in the app
-- 2. Researchers to clip data during export/analysis
-- 3. No data corruption from encoding/decoding bugs
--
-- The client can choose to display clipped or full routes based on privacy settings.

CREATE OR REPLACE FUNCTION public.store_trip_census_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  trip_geom public.geometry;
  origin_point public.geometry;
  dest_point public.geometry;
  origin_geoid TEXT;
  dest_geoid TEXT;
BEGIN
  -- Skip if geometry is NULL or empty
  IF NEW.geometry IS NULL OR NEW.geometry = '' THEN
    NEW.od_geoids := NULL;
    RETURN NEW;
  END IF;

  -- Decode polyline to PostGIS geometry
  BEGIN
    trip_geom := decode_polyline(NEW.geometry);
  EXCEPTION WHEN OTHERS THEN
    -- If decoding fails, log and continue without processing
    RAISE WARNING 'Failed to decode polyline for trip %: %', NEW.trip_id, SQLERRM;
    NEW.od_geoids := NULL;
    RETURN NEW;
  END;

  -- Skip if decoded geometry is NULL or has less than 2 points
  IF trip_geom IS NULL OR ST_NPoints(trip_geom) < 2 THEN
    NEW.od_geoids := NULL;
    RETURN NEW;
  END IF;

  -- Get origin and destination points
  origin_point := ST_StartPoint(trip_geom);
  dest_point := ST_EndPoint(trip_geom);

  -- Find origin census block
  SELECT geoid20 INTO origin_geoid
  FROM census_blocks
  WHERE ST_Contains(geom, origin_point)
  LIMIT 1;

  -- Find destination census block  
  SELECT geoid20 INTO dest_geoid
  FROM census_blocks
  WHERE ST_Contains(geom, dest_point)
  LIMIT 1;

  -- Store the GEOIDs without modifying geometry
  -- This preserves the original polyline for accurate display
  NEW.od_geoids := ARRAY[origin_geoid, dest_geoid];

  -- DO NOT modify NEW.geometry - keep original polyline intact
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.store_trip_census_blocks IS
  'BEFORE INSERT trigger that finds origin/destination census blocks and stores GEOIDs. Does NOT modify geometry to preserve data integrity. Clipping can be done during data export for research purposes.';

-- ═══════════════════════════════════════════════════════════
-- PART 2: FIX ACCOUNT DELETION CASCADE
-- ═══════════════════════════════════════════════════════════
--
-- PROBLEM: When deleting a user account, the user_recovery_links and account_recovery
-- records are not being deleted, leaving orphaned data in the database.
--
-- SOLUTION: Add CASCADE delete constraint from user_recovery_links to user_profiles,
-- and ensure account_recovery records are cleaned up when no links reference them.

-- Add foreign key constraint with CASCADE delete
-- First, check if the constraint already exists and drop it if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_recovery_links_user_id_fkey'
    AND table_name = 'user_recovery_links'
  ) THEN
    ALTER TABLE user_recovery_links DROP CONSTRAINT user_recovery_links_user_id_fkey;
  END IF;
END $$;

-- Add foreign key constraint with CASCADE delete
-- When a user is deleted, all associated recovery links are deleted
ALTER TABLE user_recovery_links
ADD CONSTRAINT user_recovery_links_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT user_recovery_links_user_id_fkey ON user_recovery_links IS
  'Ensures recovery links are deleted when the associated user is deleted';

-- Create trigger to clean up orphaned account_recovery records
-- When a user_recovery_link is deleted, check if the account_recovery record
-- has any other links. If not, delete it to prevent orphaned credentials.

CREATE OR REPLACE FUNCTION cleanup_orphaned_recovery_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  link_count INTEGER;
BEGIN
  -- Count how many links still reference this recovery_id
  SELECT COUNT(*) INTO link_count
  FROM user_recovery_links
  WHERE recovery_id = OLD.recovery_id;

  -- If no links remain, delete the account_recovery record
  IF link_count = 0 THEN
    DELETE FROM account_recovery WHERE id = OLD.recovery_id;
    RAISE NOTICE 'Deleted orphaned account_recovery record: %', OLD.recovery_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Create trigger on user_recovery_links
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_recovery ON user_recovery_links;

CREATE TRIGGER trigger_cleanup_orphaned_recovery
AFTER DELETE ON user_recovery_links
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_recovery_credentials();

COMMENT ON FUNCTION cleanup_orphaned_recovery_credentials IS
  'Automatically deletes account_recovery records when no user_recovery_links reference them';

-- Clean up existing orphaned records
-- Delete user_recovery_links that reference non-existent users
DELETE FROM user_recovery_links
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete account_recovery records that have no links
DELETE FROM account_recovery
WHERE id NOT IN (SELECT DISTINCT recovery_id FROM user_recovery_links);

-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- PART 1 - CENSUS BLOCKS:
-- - Stores census block GEOIDs without modifying geometry
-- - Preserves original polyline data for accurate display
-- - Prevents encoding/decoding bugs from corrupting trip data
-- - Block outlines can still be displayed for privacy visualization
--
-- PART 2 - ACCOUNT DELETION:
-- - Adds CASCADE delete from user_recovery_links to auth.users
-- - Automatically cleans up orphaned account_recovery records
-- - Removes existing orphaned data
-- - Ensures complete data removal when user deletes account
--
-- ═══════════════════════════════════════════════════════════
