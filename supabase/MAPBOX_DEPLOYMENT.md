# Mapbox Integration Deployment Guide

## Overview

This guide walks you through deploying the Mapbox proxy integration to Supabase. The Mapbox access token is stored securely as a Supabase secret and never exposed in the mobile app.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Supabase project created and linked
- Mapbox account with public token

## Step 1: Apply Database Migration

Run the migration to create the tile caching and usage tracking tables:

```bash
# From project root
supabase db push
```

This creates:
- `tile_cache` table for caching tiles (24-hour expiration)
- `tile_usage` table for rate limiting and analytics
- Helper functions for cache management

## Step 2: Set Mapbox Token as Supabase Secret

Store your Mapbox token securely in Supabase:

```bash
# Set the Mapbox access token
supabase secrets set MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA

# Verify the secret was set
supabase secrets list
```

**Important**: The token is now stored server-side and will NEVER be in your mobile app code or APK.

## Step 3: Deploy Edge Function

Deploy the mapbox-tiles Edge Function:

```bash
# Deploy the function
supabase functions deploy mapbox-tiles

# The function will be available at:
# https://your-project.supabase.co/functions/v1/mapbox-tiles
```

## Step 4: Test the Edge Function

Test the function with a sample tile request:

```bash
# Get your user JWT token from Supabase dashboard or app
# Then test the function:

curl -X POST \
  'https://your-project.supabase.co/functions/v1/mapbox-tiles' \
  -H 'Authorization: Bearer YOUR_USER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"z":10,"x":163,"y":395}'
```

Expected response:
- Status 200
- Binary tile data (Protocol Buffer format)
- Headers: `X-Cache: MISS` (first request) or `X-Cache: HIT` (cached)

## Step 5: Verify Database Tables

Check that the tables were created:

```sql
-- Check tile_cache table
SELECT COUNT(*) as cached_tiles FROM tile_cache;

-- Check tile_usage table
SELECT COUNT(*) as total_requests FROM tile_usage;

-- Get cache statistics
SELECT * FROM get_cache_stats();
```

## Configuration

### Rate Limiting

The Edge Function is configured for free tier usage:
- **500 tiles per user per day** (conservative limit)
- **24-hour cache expiration** (minimal caching)
- **50 MB max cache size** (keeps database small)

To adjust these limits, edit `supabase/functions/mapbox-tiles/index.ts`:

```typescript
const CONFIG = {
  RATE_LIMIT_PER_DAY: 500,        // Increase if needed
  CACHE_EXPIRATION_HOURS: 24,     // Increase for longer caching
  MAX_CACHE_SIZE_MB: 50,          // Increase for more caching
  ENABLE_CACHING: true,           // Set false to disable caching
};
```

### Mapbox Tileset

Default tileset: `mapbox.mapbox-streets-v8`

To use a different tileset, pass `tilesetId` in the request:

```json
{
  "z": 10,
  "x": 163,
  "y": 395,
  "tilesetId": "mapbox.satellite"
}
```

## Monitoring

### View Usage Statistics

```sql
-- Total requests in last 24 hours
SELECT COUNT(*) as requests_24h
FROM tile_usage
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Cache hit rate
SELECT 
  COUNT(*) FILTER (WHERE cache_hit = TRUE) as cache_hits,
  COUNT(*) FILTER (WHERE cache_hit = FALSE) as cache_misses,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit = TRUE) / COUNT(*), 2) as hit_rate_percent
FROM tile_usage
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Top users by tile requests
SELECT 
  user_id,
  COUNT(*) as requests,
  COUNT(DISTINCT tile_key) as unique_tiles
FROM tile_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY requests DESC
LIMIT 10;

-- Cache size and statistics
SELECT * FROM get_cache_stats();
```

### Edge Function Logs

View Edge Function logs in Supabase Dashboard:
1. Go to Edge Functions
2. Click on `mapbox-tiles`
3. View logs tab

Or use CLI:

```bash
supabase functions logs mapbox-tiles
```

## Maintenance

### Clean Up Expired Tiles

Expired tiles are automatically cleaned up, but you can manually trigger cleanup:

```sql
-- Remove expired tiles
SELECT cleanup_expired_tiles();

-- Remove old tiles if cache is too large
SELECT cleanup_old_tiles(50); -- 50 MB limit
```

### Reset Cache

To clear all cached tiles:

```sql
TRUNCATE tile_cache;
```

### Reset Usage Statistics

To clear usage history (be careful with rate limiting):

```sql
-- Clear old usage data (keep last 7 days)
DELETE FROM tile_usage 
WHERE created_at < NOW() - INTERVAL '7 days';
```

## Troubleshooting

### Error: "Missing authorization header"
- User is not authenticated
- Check that `supabase.auth.getSession()` returns a valid session

### Error: "Rate limit exceeded"
- User has exceeded 500 tiles per day
- Wait 24 hours or increase `RATE_LIMIT_PER_DAY` in Edge Function

### Error: "Mapbox API error"
- Check that `MAPBOX_ACCESS_TOKEN` secret is set correctly
- Verify token is valid at https://account.mapbox.com/access-tokens/
- Check Mapbox API status

### Tiles not caching
- Check `ENABLE_CACHING` is `true` in Edge Function config
- Verify `tile_cache` table exists
- Check database storage limits

### High Mapbox API usage
- Increase `CACHE_EXPIRATION_HOURS` for longer caching
- Increase `MAX_CACHE_SIZE_MB` for more cached tiles
- Check for unusual usage patterns in `tile_usage` table

## Security Notes

1. **Token Security**: Mapbox token is stored as Supabase secret, never in app code
2. **Authentication**: All requests require valid Supabase user authentication
3. **Rate Limiting**: Prevents abuse and controls Mapbox API costs
4. **RLS Policies**: Database tables protected by Row Level Security

## Cost Estimates

### Supabase (Free Tier)
- 500,000 Edge Function invocations/month ✓
- 500 MB database storage ✓
- Plenty of headroom for RollTracks usage

### Mapbox (Free Tier)
- 50,000 tile requests/month
- With 24-hour caching and 500 tiles/user/day limit
- Supports ~100 active users comfortably

## Next Steps

1. ✅ Database migration applied
2. ✅ Mapbox token set as secret
3. ✅ Edge Function deployed
4. ✅ Function tested
5. ⏭️ Integrate with mobile app (MapView component)
6. ⏭️ Test end-to-end with real devices

## Support

For issues or questions:
- Check Supabase Edge Function logs
- Review `tile_usage` table for usage patterns
- Monitor cache statistics with `get_cache_stats()`
- Check Mapbox dashboard for API usage
