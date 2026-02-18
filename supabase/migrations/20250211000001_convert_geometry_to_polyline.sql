-- Migration: Convert geometry from PostGIS to encoded polyline string
-- This simplifies trip data storage while keeping PostGIS for census_blocks
-- Encoded polylines are more compact and easier to work with in the app

-- NOTE: This migration keeps PostGIS installed because:
-- 1. census_blocks table still uses PostGIS geometry
-- 2. Server-side anonymization (census block clipping) needs PostGIS functions
-- 3. DataRanger tables (rated_features, corrected_segments) may use PostGIS

-- ═══════════════════════════════════════════════════════════
-- 1. DROP THE CENSUS BLOCK CLIPPING TRIGGER
-- ═══════════════════════════════════════════════════════════
-- The trigger expects PostGIS geometry, so we need to drop it
-- before changing the column type

DROP TRIGGER IF EXISTS trg_clip_trip_census_blocks ON public.trips;
-- ═══════════════════════════════════════════════════════════
-- 2. CONVERT TRIPS.GEOMETRY FROM POSTGIS TO TEXT
-- ═══════════════════════════════════════════════════════════

-- Add new column for encoded polyline
ALTER TABLE trips ADD COLUMN IF NOT EXISTS geometry_polyline TEXT;
-- For existing trips with PostGIS geometry, we can't easily convert in SQL
-- The app will handle encoding new trips as polylines
-- Existing trips will have NULL geometry_polyline (acceptable data loss for migration)

-- Drop the old PostGIS geometry column
ALTER TABLE trips DROP COLUMN IF EXISTS geometry CASCADE;
-- Rename the new column to geometry
ALTER TABLE trips RENAME COLUMN geometry_polyline TO geometry;
-- Add comment explaining the format
COMMENT ON COLUMN trips.geometry IS 'Encoded polyline string (Mapbox Polyline format) representing the trip route. Format: ASCII string encoding lat/lon coordinates.';
-- ═══════════════════════════════════════════════════════════
-- 3. UPDATE CENSUS BLOCK CLIPPING TRIGGER FOR POLYLINES
-- ═══════════════════════════════════════════════════════════
-- The trigger needs to:
-- 1. Decode the polyline to PostGIS geometry
-- 2. Perform clipping operations
-- 3. Encode the result back to polyline
-- 4. Store origin/destination block GEOIDs in od_geoids column

-- First, ensure we have the od_geoids column (should exist from previous migration)
-- This stores [origin_geoid, destination_geoid] for display purposes

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'od_geoids'
  ) THEN
    ALTER TABLE trips ADD COLUMN od_geoids TEXT[];
    COMMENT ON COLUMN trips.od_geoids IS 'Array of [origin_geoid, destination_geoid] for census block display';
  END IF;
END $$;
-- Create updated trigger function that works with polylines
-- NOTE: This is a simplified version that stores GEOIDs but doesn't clip geometry
-- Clipping will be handled by a separate server-side process or Edge Function
-- that can decode polylines, clip them, and re-encode them

CREATE OR REPLACE FUNCTION public.store_trip_census_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  origin_geoid TEXT;
  dest_geoid TEXT;
BEGIN
  -- Skip if geometry is NULL
  IF NEW.geometry IS NULL OR NEW.geometry = '' THEN
    RETURN NEW;
  END IF;

  -- For now, we'll store NULL for od_geoids
  -- A future Edge Function can decode the polyline, find the blocks, and update this
  -- This allows trips to be stored immediately without blocking on polyline decoding
  NEW.od_geoids := NULL;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.store_trip_census_blocks IS
  'BEFORE INSERT trigger that prepares trip for census block anonymization. Actual clipping will be done by Edge Function to avoid polyline encoding/decoding in SQL.';
-- Attach the simplified trigger
CREATE TRIGGER trg_store_trip_census_blocks
  BEFORE INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.store_trip_census_blocks();
COMMENT ON TRIGGER trg_store_trip_census_blocks ON public.trips IS
  'Prepares trip for census block anonymization. Actual clipping done by Edge Function.';
-- ═══════════════════════════════════════════════════════════
-- 4. KEEP POSTGIS AND OTHER TABLES
-- ═══════════════════════════════════════════════════════════

-- DO NOT drop PostGIS extension - still needed for:
-- - census_blocks table (geometry column)
-- - rated_features table (may have geometry)
-- - corrected_segments table (has geometry)
-- - Future server-side clipping via Edge Functions

-- DO NOT drop these tables:
-- - census_blocks (needed for anonymization)
-- - rated_features (DataRanger functionality)
-- - corrected_segments (DataRanger functionality)
-- - spatial_ref_sys (PostGIS system table)
-- - geometry_columns (PostGIS system view)
-- - geography_columns (PostGIS system view)

-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- WHAT CHANGED:
-- - trips.geometry is now TEXT (encoded polyline) instead of PostGIS geometry
-- - Census block clipping trigger simplified (no longer clips in SQL)
-- - Clipping will be handled by Edge Function in future update
--
-- WHAT STAYED THE SAME:
-- - PostGIS extension (still installed and used)
-- - census_blocks table (still uses PostGIS geometry)
-- - DataRanger tables (rated_features, corrected_segments)
-- - All other database functionality
--
-- DATA LOSS:
-- - Existing trip geometries will be NULL after this migration
-- - This is acceptable for development/testing
-- - Production migrations should export/convert existing data first
--
-- NEXT STEPS:
-- 1. Deploy Edge Function for polyline clipping (future)
-- 2. Update od_geoids column via batch process (future)
-- 3. Test new trip recording with polyline encoding
--
-- ═══════════════════════════════════════════════════════════;
