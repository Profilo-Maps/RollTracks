-- Mapbox Proxy Infrastructure
-- This migration creates tables for tile caching and usage tracking
-- Optimized for free tier with minimal caching

-- Tile cache table (minimal caching - 24 hour expiration)
CREATE TABLE IF NOT EXISTS tile_cache (
  id BIGSERIAL PRIMARY KEY,
  tile_key TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL, -- Base64 encoded tile data
  size_bytes INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_tile_cache_key ON tile_cache(tile_key);
CREATE INDEX idx_tile_cache_expires ON tile_cache(expires_at);
CREATE INDEX idx_tile_cache_last_accessed ON tile_cache(last_accessed);

-- Tile usage tracking for rate limiting and analytics
CREATE TABLE IF NOT EXISTS tile_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tile_key TEXT NOT NULL,
  zoom_level INTEGER NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limiting queries
CREATE INDEX idx_tile_usage_user_date ON tile_usage(user_id, created_at);
CREATE INDEX idx_tile_usage_created ON tile_usage(created_at);
CREATE INDEX idx_tile_usage_cache_hit ON tile_usage(cache_hit, created_at);

-- Function to clean up expired tiles (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM tile_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old tiles when cache is full (LRU eviction)
CREATE OR REPLACE FUNCTION cleanup_old_tiles(max_cache_size_mb INTEGER DEFAULT 50)
RETURNS INTEGER AS $$
DECLARE
  current_size_mb NUMERIC;
  deleted_count INTEGER := 0;
BEGIN
  -- Calculate current cache size in MB
  SELECT COALESCE(SUM(size_bytes) / 1024.0 / 1024.0, 0)
  INTO current_size_mb
  FROM tile_cache;
  
  -- If over limit, delete oldest accessed tiles
  IF current_size_mb > max_cache_size_mb THEN
    DELETE FROM tile_cache
    WHERE id IN (
      SELECT id
      FROM tile_cache
      ORDER BY last_accessed ASC
      LIMIT (SELECT COUNT(*) / 4 FROM tile_cache) -- Remove 25% of tiles
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user tile usage count (for rate limiting)
CREATE OR REPLACE FUNCTION get_user_tile_usage(p_user_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO usage_count
  FROM tile_usage
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE(
  total_tiles BIGINT,
  cache_size_mb NUMERIC,
  cache_hit_rate NUMERIC,
  tiles_last_24h BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_tiles,
    ROUND(COALESCE(SUM(tc.size_bytes) / 1024.0 / 1024.0, 0), 2) as cache_size_mb,
    ROUND(
      COALESCE(
        100.0 * COUNT(*) FILTER (WHERE tu.cache_hit = TRUE) / NULLIF(COUNT(*), 0),
        0
      ),
      2
    ) as cache_hit_rate,
    COUNT(*) FILTER (WHERE tu.created_at >= NOW() - INTERVAL '24 hours')::BIGINT as tiles_last_24h
  FROM tile_cache tc
  LEFT JOIN tile_usage tu ON tu.created_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE tile_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role only for tile_cache)
CREATE POLICY "Service role can manage tile cache"
  ON tile_cache
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage tile usage"
  ON tile_usage
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their own usage
CREATE POLICY "Users can view own tile usage"
  ON tile_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_tiles() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_tiles(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_tile_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cache_stats() TO authenticated;

-- Create a scheduled job to clean up expired tiles (if pg_cron is available)
-- This will run daily at 2 AM
-- Note: Uncomment if pg_cron extension is enabled
-- SELECT cron.schedule(
--   'cleanup-expired-tiles',
--   '0 2 * * *',
--   $$SELECT cleanup_expired_tiles()$$
-- );

COMMENT ON TABLE tile_cache IS 'Caches Mapbox vector tiles with 24-hour expiration (minimal caching for free tier)';
COMMENT ON TABLE tile_usage IS 'Tracks tile requests for rate limiting and analytics';
COMMENT ON FUNCTION cleanup_expired_tiles() IS 'Removes expired tiles from cache';
COMMENT ON FUNCTION cleanup_old_tiles(INTEGER) IS 'Removes oldest tiles when cache exceeds size limit (LRU eviction)';
COMMENT ON FUNCTION get_user_tile_usage(UUID, INTEGER) IS 'Returns tile request count for a user within specified hours';
COMMENT ON FUNCTION get_cache_stats() IS 'Returns cache statistics including size and hit rate';
