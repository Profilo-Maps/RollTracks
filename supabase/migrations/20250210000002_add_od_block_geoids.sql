-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS TRIP HISTORY ENHANCEMENT
-- Migration: Store Origin/Destination Block GEOIDs for Display
-- Date: 2025-02-10
--
-- This migration adds storage for origin and destination census
-- block GEOIDs to the trips table, allowing the trip history
-- screen to display block polygon outlines on the map.
--
-- The trigger function is updated to capture and store the
-- GEOIDs of blocks that were clipped during anonymization.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. ADD OD_GEOIDS COLUMN TO TRIPS TABLE
-- ───────────────────────────────────────────────────────────

-- Store origin and destination block GEOIDs as a tuple
-- Format: (origin_geoid, destination_geoid)
-- NULL if trip was not clipped (outside coverage area)
ALTER TABLE public.trips
ADD COLUMN od_geoids VARCHAR(15)[] DEFAULT NULL;
COMMENT ON COLUMN public.trips.od_geoids IS
  'Array of [origin_geoid, destination_geoid] for census blocks that were clipped during anonymization. NULL if trip was not clipped. Used by trip history screen to display block polygon outlines.';
-- ───────────────────────────────────────────────────────────
-- 2. UPDATE TRIGGER FUNCTION TO CAPTURE BLOCK GEOIDS
-- ───────────────────────────────────────────────────────────

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
    SET search_path = 'public, %1$I'
    AS $body$
    DECLARE
      trip_geom %1$I.geometry;
      origin_point %1$I.geometry;
      dest_point %1$I.geometry;
      origin_block %1$I.geometry;
      dest_block %1$I.geometry;
      origin_geoid VARCHAR(15);
      dest_geoid VARCHAR(15);
      clipped_geom %1$I.geometry;
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
      SELECT cb.geom, cb.geoid20 INTO origin_block, origin_geoid
      FROM public.census_blocks cb
      WHERE ST_Contains(cb.geom, origin_point)
      LIMIT 1;

      -- Find the census block containing the destination
      SELECT cb.geom, cb.geoid20 INTO dest_block, dest_geoid
      FROM public.census_blocks cb
      WHERE ST_Contains(cb.geom, dest_point)
      LIMIT 1;

      -- If neither point is in a census block (outside coverage area),
      -- pass through unmodified
      IF origin_block IS NULL AND dest_block IS NULL THEN
        NEW.od_geoids := NULL;
        RETURN NEW;
      END IF;

      -- Store the block GEOIDs for display in trip history
      NEW.od_geoids := ARRAY[origin_geoid, dest_geoid];

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
  $func$, ext_schema);

  -- Execute the dynamically built function
  EXECUTE func_sql;
END;
$$;
COMMENT ON FUNCTION public.clip_trip_to_census_blocks IS
  'BEFORE INSERT trigger function that clips trip route geometries to exclude portions within origin and destination census blocks. Stores block GEOIDs in od_geoids column for trip history display. Part of Tier 1 Level 1 anonymization.';
-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- BEHAVIOR:
-- - New trips will have od_geoids populated with [origin, dest]
-- - Existing trips will have od_geoids = NULL (no retroactive update)
-- - Trip history screen can query census_blocks table using
--   od_geoids to fetch block polygons for display
-- - Blocks are displayed as outlines on the map to show where
--   the trip origin and destination were anonymized
--
-- ═══════════════════════════════════════════════════════════;
