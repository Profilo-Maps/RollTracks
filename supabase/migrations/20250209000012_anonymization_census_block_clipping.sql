-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS ANONYMIZATION SERVICE — TIER 1 LEVEL 1
-- Migration: Census Block Clipping for Origin/Destination Privacy
-- Date: 2025-02-09
--
-- This migration implements the first level of server-side
-- anonymization: clipping trip route geometries to exclude
-- portions within origin and destination census blocks.
--
-- Only the route data BETWEEN census blocks is stored.
-- This prevents identification of where trips start or end.
--
-- ANONYMIZATION LAYERS IMPLEMENTED:
-- 1. Relative timestamps (client-side, TripService)
-- 2. Characteristic binning (client-side, DatabaseAdapter)
-- 3. Census block clipping (THIS MIGRATION, server-side trigger)
--
-- EXCLUDED: corrected_segments table is NOT subject to
-- Tier 1 anonymization to preserve accurate geometries.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 0. ENSURE POSTGIS IS IN SEARCH PATH
-- ───────────────────────────────────────────────────────────
-- PostGIS may be installed in 'extensions', 'public', or another schema.
-- Dynamically find it and add to search_path so geometry types and
-- functions (ST_Contains, ST_Difference, etc.) are resolvable for
-- both DDL and PL/pgSQL DECLARE blocks.

DO $$
DECLARE
  ext_schema TEXT;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF ext_schema IS NULL THEN
    RAISE EXCEPTION 'PostGIS extension not found. Enable it in the Supabase dashboard under Database > Extensions.';
  END IF;

  -- Set search_path for the rest of this transaction (migration)
  PERFORM pg_catalog.set_config(
    'search_path',
    'public, ' || ext_schema,
    false  -- false = SESSION-scoped (persists across statements)
  );
END;
$$;
-- ───────────────────────────────────────────────────────────
-- 1. CREATE CENSUS BLOCKS REFERENCE TABLE
-- ───────────────────────────────────────────────────────────

CREATE TABLE public.census_blocks (
  id SERIAL PRIMARY KEY,
  geoid20 VARCHAR(15) UNIQUE NOT NULL,
  name20 VARCHAR(50),
  geom geometry(POLYGON, 4326) NOT NULL
);
COMMENT ON TABLE public.census_blocks IS
  'Census block polygons from Blocks.geojson used for origin/destination clipping anonymization. Uses geometry (not geography) because ST_Contains and ST_Difference require geometry type.';
COMMENT ON COLUMN public.census_blocks.geoid20 IS
  'Unique Census Bureau block identifier (e.g., 060210102002055).';
COMMENT ON COLUMN public.census_blocks.geom IS
  'Block boundary polygon in SRID 4326. Source data is EPSG:4269 (NAD83), treated as 4326 (sub-meter difference in continental US).';
-- Spatial index for fast ST_Contains lookups
CREATE INDEX idx_census_blocks_geom ON public.census_blocks USING GIST(geom);
-- ───────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY FOR CENSUS BLOCKS
-- ───────────────────────────────────────────────────────────

ALTER TABLE public.census_blocks ENABLE ROW LEVEL SECURITY;
-- All authenticated users (including anonymous) can read blocks.
-- Required for the BEFORE INSERT trigger which runs in the
-- session user's security context.
CREATE POLICY "census_blocks_select"
  ON public.census_blocks
  FOR SELECT
  TO authenticated
  USING (true);
-- No INSERT/UPDATE/DELETE policies — only admins can modify block data.

-- ───────────────────────────────────────────────────────────
-- 3. RPC FUNCTION FOR SEEDING CENSUS BLOCKS
-- ───────────────────────────────────────────────────────────

-- Used by the seed script to insert blocks with GeoJSON→geometry
-- conversion handled server-side. SECURITY DEFINER allows the
-- function to bypass RLS (no INSERT policy on census_blocks).
-- Uses LANGUAGE plpgsql (not sql) so the body is compiled at
-- execution time, avoiding search_path issues with PostGIS
-- functions during CREATE.
CREATE OR REPLACE FUNCTION public.insert_census_block(
  p_geoid20 TEXT,
  p_name20 TEXT,
  p_geojson TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  INSERT INTO public.census_blocks (geoid20, name20, geom)
  VALUES (
    p_geoid20,
    p_name20,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)
  )
  ON CONFLICT (geoid20) DO NOTHING;
END;
$$;
COMMENT ON FUNCTION public.insert_census_block IS
  'Inserts a single census block from GeoJSON. ON CONFLICT skips duplicates for idempotent re-runs.';
-- Batch insert for efficient seeding. Accepts a JSONB array of objects
-- with keys: geoid20, name20, geojson (geometry as GeoJSON string).
-- Returns the count of newly inserted blocks.
-- Uses LANGUAGE plpgsql to defer PostGIS function resolution to execution time.
CREATE OR REPLACE FUNCTION public.batch_insert_census_blocks(p_blocks JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  insert_count INTEGER;
BEGIN
  WITH inserted AS (
    INSERT INTO public.census_blocks (geoid20, name20, geom)
    SELECT
      (block ->> 'geoid20')::VARCHAR(15),
      (block ->> 'name20')::VARCHAR(50),
      ST_SetSRID(ST_GeomFromGeoJSON(block ->> 'geojson'), 4326)
    FROM jsonb_array_elements(p_blocks) AS block
    ON CONFLICT (geoid20) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO insert_count FROM inserted;
  RETURN insert_count;
END;
$$;
COMMENT ON FUNCTION public.batch_insert_census_blocks IS
  'Batch inserts census blocks from a JSONB array. Used by seed script for efficient bulk loading. ON CONFLICT skips duplicates.';
-- ───────────────────────────────────────────────────────────
-- 4. CENSUS BLOCK CLIPPING TRIGGER FUNCTION
-- ───────────────────────────────────────────────────────────
-- Dynamically create the function with schema-qualified geometry types.
-- This avoids search_path issues during function compilation.

DO $$
DECLARE
  ext_schema TEXT;
  func_sql TEXT;
BEGIN
  -- Find PostGIS schema
  SELECT n.nspname INTO ext_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';

  IF ext_schema IS NULL THEN
    RAISE EXCEPTION 'PostGIS extension not found.';
  END IF;

  -- Build function with schema-qualified geometry type
  func_sql := format($func$
    CREATE OR REPLACE FUNCTION public.clip_trip_to_census_blocks()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = 'public, %I'
    AS $body$
    DECLARE
      trip_geom %I.geometry;
      origin_point %I.geometry;
      dest_point %I.geometry;
      origin_block %I.geometry;
      dest_block %I.geometry;
      clipped_geom %I.geometry;
    BEGIN
      -- Skip if geometry is NULL (e.g., metadata-only trip)
      IF NEW.geometry IS NULL THEN
        RETURN NEW;
      END IF;

      -- Cast geography(LINESTRING, 4326) to geometry for spatial operations
      trip_geom := NEW.geometry::geometry;

      -- Need at least 2 points to have origin and destination
      IF ST_NPoints(trip_geom) < 2 THEN
        RETURN NEW;
      END IF;

      -- Extract origin (first point) and destination (last point)
      origin_point := ST_StartPoint(trip_geom);
      dest_point := ST_EndPoint(trip_geom);

      -- Find the census block containing the origin
      SELECT cb.geom INTO origin_block
      FROM public.census_blocks cb
      WHERE ST_Contains(cb.geom, origin_point)
      LIMIT 1;

      -- Find the census block containing the destination
      SELECT cb.geom INTO dest_block
      FROM public.census_blocks cb
      WHERE ST_Contains(cb.geom, dest_point)
      LIMIT 1;

      -- If neither point is in a census block (outside coverage area),
      -- pass through unmodified
      IF origin_block IS NULL AND dest_block IS NULL THEN
        RETURN NEW;
      END IF;

      -- Start with the full trip geometry
      clipped_geom := trip_geom;

      -- Clip origin block: remove route portion within origin block
      IF origin_block IS NOT NULL THEN
        clipped_geom := ST_Difference(clipped_geom, origin_block);
      END IF;

      -- Clip destination block: remove route portion within destination block
      -- Skip if same block as origin (already clipped)
      IF dest_block IS NOT NULL THEN
        IF origin_block IS NULL OR NOT ST_Equals(origin_block, dest_block) THEN
          clipped_geom := ST_Difference(clipped_geom, dest_block);
        END IF;
      END IF;

      -- Handle NULL or empty result (entire trip within block(s))
      IF clipped_geom IS NULL OR ST_IsEmpty(clipped_geom) THEN
        -- Still insert the trip — metadata is analytically valuable
        -- but clear the geometry to fully anonymize the route
        NEW.geometry := NULL;
        NEW.distance_mi := 0;
        RETURN NEW;
      END IF;

      -- Handle GEOMETRYCOLLECTION results (extract linestrings only)
      IF ST_GeometryType(clipped_geom) = 'ST_GeometryCollection' THEN
        clipped_geom := ST_CollectionExtract(clipped_geom, 2); -- 2 = linestrings
        IF clipped_geom IS NULL OR ST_IsEmpty(clipped_geom) THEN
          NEW.geometry := NULL;
          NEW.distance_mi := 0;
          RETURN NEW;
        END IF;
      END IF;

      -- Handle MULTILINESTRING results
      IF ST_GeometryType(clipped_geom) = 'ST_MultiLineString' THEN
        -- Try to merge adjacent lines into a single LineString
        clipped_geom := ST_LineMerge(clipped_geom);

        -- If still a MultiLineString after merge, take the longest segment
        -- (the main route between origin and destination blocks)
        IF ST_GeometryType(clipped_geom) = 'ST_MultiLineString' THEN
          SELECT sub.geom INTO clipped_geom
          FROM (
            SELECT (ST_Dump(clipped_geom)).geom
          ) sub
          ORDER BY ST_Length(sub.geom::geography) DESC
          LIMIT 1;
        END IF;
      END IF;

      -- Final safety check
      IF clipped_geom IS NULL OR ST_IsEmpty(clipped_geom) OR ST_NPoints(clipped_geom) < 2 THEN
        NEW.geometry := NULL;
        NEW.distance_mi := 0;
        RETURN NEW;
      END IF;

      -- Set the clipped geometry (cast back to geography)
      NEW.geometry := clipped_geom::geography;

      -- Recalculate distance from clipped geometry
      -- ST_Length on geography returns meters; convert to miles
      NEW.distance_mi := ST_Length(clipped_geom::geography) / 1609.34;

      RETURN NEW;
    END;
    $body$;
  $func$, ext_schema, ext_schema, ext_schema, ext_schema, ext_schema, ext_schema, ext_schema);

  -- Execute the dynamically built function
  EXECUTE func_sql;
END;
$$;
COMMENT ON FUNCTION public.clip_trip_to_census_blocks IS
  'BEFORE INSERT trigger function that clips trip route geometries to exclude portions within origin and destination census blocks. Part of Tier 1 Level 1 anonymization. Trips entirely within blocks are stored with NULL geometry (metadata preserved).';
-- ───────────────────────────────────────────────────────────
-- 5. ATTACH TRIGGER TO TRIPS TABLE
-- ───────────────────────────────────────────────────────────

CREATE TRIGGER trg_clip_trip_census_blocks
  BEFORE INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.clip_trip_to_census_blocks();
COMMENT ON TRIGGER trg_clip_trip_census_blocks ON public.trips IS
  'Anonymization Tier 1 Level 1: Clips route geometry to exclude portions within origin/destination census blocks before storage.';
-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- AFTER RUNNING THIS MIGRATION:
-- 1. Run the seed script to load census block data:
--    node scripts/seed-census-blocks.js
--
-- 2. Verify blocks loaded:
--    SELECT COUNT(*) FROM census_blocks;
--
-- BEHAVIOR:
-- - All new trip INSERTs are automatically clipped
-- - Trips outside the coverage area pass through unmodified
-- - Trips entirely within blocks store with NULL geometry
-- - corrected_segments are NOT affected (trigger is trips-only)
-- - Re-inserted trips (data migration) are safely handled:
--   already-clipped routes have start/end points outside blocks
--
-- TRIGGER EXECUTION CONTEXT:
-- The trigger runs as SECURITY DEFINER (function owner) so it
-- can always access the census_blocks table regardless of the
-- calling user's RLS policies.
--
-- ═══════════════════════════════════════════════════════════;
