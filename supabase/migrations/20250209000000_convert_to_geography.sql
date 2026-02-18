-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SPATIAL OPTIMIZATION
-- Migration: Convert geometry columns to geography for accurate distance calculations
-- Date: 2025-02-09
--
-- This migration converts spatial columns from geometry to geography type
-- to enable accurate distance calculations on Earth's surface.
--
-- WHY THIS MATTERS:
-- - geometry type: Uses flat (planar) math, returns distances in degrees
-- - geography type: Uses spherical math, returns distances in meters
--
-- FOR DATARANGER SERVICE:
-- - "Find features within 50m" now works accurately
-- - ST_DWithin(geography, geography, 50) → correct meter-based queries
-- - No coordinate conversions needed (staying in SRID 4326)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- CONVERT SPATIAL COLUMNS TO GEOGRAPHY
-- ───────────────────────────────────────────────────────────

-- Convert trips.geometry to geography
-- Stores GPS paths of user trips with accurate distance calculations
ALTER TABLE trips
  ALTER COLUMN geometry TYPE geography(LINESTRING, 4326)
  USING ST_Transform(geometry, 4326)::geography;
COMMENT ON COLUMN trips.geometry IS
  'GPS path of trip as geography(LINESTRING, 4326). Uses spherical math for accurate distance calculations in meters.';
-- Convert rated_features.geometry to geography
-- Stores curb ramp locations with accurate proximity queries
ALTER TABLE rated_features
  ALTER COLUMN geometry TYPE geography(POINT, 4326)
  USING ST_Transform(geometry, 4326)::geography;
COMMENT ON COLUMN rated_features.geometry IS
  'Curb ramp location as geography(POINT, 4326). Enables accurate "within 50m of user" queries for DataRanger service.';
-- Convert corrected_segments.geometry to geography
-- Stores corrected sidewalk paths with accurate length calculations
ALTER TABLE corrected_segments
  ALTER COLUMN geometry TYPE geography(LINESTRING, 4326)
  USING ST_Transform(geometry, 4326)::geography;
COMMENT ON COLUMN corrected_segments.geometry IS
  'Corrected sidewalk path as geography(LINESTRING, 4326). Enables accurate distance and length calculations.';
-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- QUERY EXAMPLES WITH GEOGRAPHY:
--
-- 1. Find features within 50 meters of user position:
--    SELECT * FROM rated_features
--    WHERE ST_DWithin(
--      geometry,
--      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
--      50  -- meters
--    );
--
-- 2. Calculate trip distance in meters:
--    SELECT ST_Length(geometry) as distance_meters FROM trips;
--
-- 3. Calculate distance between two points in meters:
--    SELECT ST_Distance(point1, point2) as meters
--    FROM rated_features;
--
-- PERFORMANCE NOTES:
-- - geography queries are slightly slower than geometry (typically negligible)
-- - For large datasets (>100k rows), consider spatial indexes
-- - SRID 4326 geography is optimized for Earth's surface
--
-- COMPATIBILITY:
-- - GeoJSON output still works (ST_AsGeoJSON)
-- - Mapbox still displays correctly (both use WGS84/4326)
-- - No app code changes needed if using GeoJSON
--
-- ═══════════════════════════════════════════════════════════;
