-- Fix batch_insert_census_blocks function to properly handle GeoJSON
-- The issue is that ST_GeomFromGeoJSON returns geometry, not text,
-- so we need to explicitly cast it.

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
  'Batch inserts census blocks from a JSONB array. Used by seed script for efficient bulk loading. ON CONFLICT skips duplicates.';
