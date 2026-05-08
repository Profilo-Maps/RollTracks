-- Migration: Move census block clipping to client side
--
-- The server-side clipping trigger had encoding bugs when re-encoding clipped
-- geometry back to polyline format. Clipping is now performed client-side before
-- upload, so the trigger is simplified to a no-op.
--
-- A new RPC is added so the client can look up which census block contains a
-- given point using PostGIS, without needing to ship census block data locally.

-- ═══════════════════════════════════════════════════════════
-- 1. SIMPLIFY TRIGGER TO NO-OP
-- ═══════════════════════════════════════════════════════════
-- od_geoids and clipped geometry are now set by the client before insert.
-- The trigger no longer needs to inspect or modify the row.

CREATE OR REPLACE FUNCTION public.store_trip_census_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.store_trip_census_blocks IS
  'No-op trigger retained for compatibility. Census block lookup and geometry clipping are now performed client-side before insert.';

-- ═══════════════════════════════════════════════════════════
-- 2. ADD RPC: get_census_block_for_point
-- ═══════════════════════════════════════════════════════════
-- Returns the geoid20 and polygon geometry of the census block that contains
-- the given WGS-84 point. Returns no rows if no block contains the point.
-- Called twice per trip upload (once for origin, once for destination).

CREATE OR REPLACE FUNCTION public.get_census_block_for_point(lon float8, lat float8)
RETURNS TABLE(geoid20 text, geom geometry)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT geoid20, geom
  FROM census_blocks
  WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_census_block_for_point IS
  'Returns the census block (geoid20 + polygon geometry) that spatially contains the given WGS-84 lon/lat point. Used by the client to look up OD blocks before clipping trip geometry.';
