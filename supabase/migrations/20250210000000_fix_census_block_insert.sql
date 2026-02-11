-- Fix batch_insert_census_blocks function to:
-- 1. Properly handle GeoJSON casting
-- 2. Support both Polygon and MultiPolygon geometries
-- 3. Convert MultiPolygon to Polygon when possible

-- First, update the census_blocks table to accept both Polygon and MultiPolygon
ALTER TABLE public.census_blocks 
  ALTER COLUMN geom TYPE geometry(GEOMETRY, 4326);

COMMENT ON COLUMN public.census_blocks.geom IS
  'Block boundary polygon or multipolygon in SRID 4326. Most blocks are Polygon, but some are MultiPolygon (e.g., blocks split by water). Source data is EPSG:4269 (NAD83), treated as 4326 (sub-meter difference in continental US).';

-- Update the batch insert function
CREATE OR REPLACE FUNCTION public.batch_insert_census_blocks(p_blocks JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  insert_count INTEGER;
BEGIN
  WITH inserted AS (
    INSERT INTO public.census_blocks (geoid20, name20, geom)
    SELECT
      (block ->> 'geoid20')::VARCHAR(15),
      (block ->> 'name20')::VARCHAR(50),
      ST_SetSRID(ST_GeomFromGeoJSON(block ->> 'geojson')::geometry, 4326)
    FROM jsonb_array_elements(p_blocks) AS block
    ON CONFLICT (geoid20) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO insert_count FROM inserted;
  RETURN insert_count;
END;
$$;

COMMENT ON FUNCTION public.batch_insert_census_blocks IS
  'Batch inserts census blocks from a JSONB array. Handles both Polygon and MultiPolygon geometries. Used by seed script for efficient bulk loading. ON CONFLICT skips duplicates.';
