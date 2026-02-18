-- Fix Function Search Path Mutable warnings
-- Using ALTER FUNCTION with correct signatures from database

-- 1. batch_insert_census_blocks
ALTER FUNCTION public.batch_insert_census_blocks(p_blocks jsonb) SET search_path = '';

-- 2. encode_signed_number
ALTER FUNCTION public.encode_signed_number(num integer) SET search_path = '';

-- 3. set_rated_features_geometry
ALTER FUNCTION public.set_rated_features_geometry() SET search_path = '';

-- 4. get_cache_stats
ALTER FUNCTION public.get_cache_stats() SET search_path = '';

-- 5. update_corrected_segments_updated_at
ALTER FUNCTION public.update_corrected_segments_updated_at() SET search_path = '';

-- 6. seed_curb_ramps_bulk
ALTER FUNCTION public.seed_curb_ramps_bulk(p_data jsonb) SET search_path = '';

-- 7. rated_features_to_geojson
ALTER FUNCTION public.rated_features_to_geojson(p_user_id uuid) SET search_path = '';

-- 8. corrected_segments_to_geojson
ALTER FUNCTION public.corrected_segments_to_geojson(p_user_id uuid) SET search_path = '';

-- 9. cleanup_old_tiles
ALTER FUNCTION public.cleanup_old_tiles(max_cache_size_mb integer) SET search_path = '';

-- 10. get_user_tile_usage
ALTER FUNCTION public.get_user_tile_usage(p_user_id uuid, p_hours integer) SET search_path = '';

-- 11. hash_password
ALTER FUNCTION public.hash_password(password text) SET search_path = '';

-- 12. cleanup_expired_tiles
ALTER FUNCTION public.cleanup_expired_tiles() SET search_path = '';

-- 13. seed_curb_ramp
ALTER FUNCTION public.seed_curb_ramp(
  p_cnn integer,
  p_location_description text,
  p_curb_return_loc text,
  p_position_on_return text,
  p_condition_score integer,
  p_detectable_surf numeric,
  p_location_text text,
  p_lng numeric,
  p_lat numeric
) SET search_path = '';

-- 14. trips_to_geojson
ALTER FUNCTION public.trips_to_geojson(p_user_id uuid) SET search_path = '';

-- 15. update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- 16. verify_password
ALTER FUNCTION public.verify_password(password text, password_hash text) SET search_path = '';

COMMENT ON SCHEMA public IS 'All functions now have search_path set to empty string to prevent search path hijacking attacks.';;
