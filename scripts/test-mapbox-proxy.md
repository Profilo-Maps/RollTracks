# Test Mapbox Proxy

## Get Your JWT Token

1. Open your RollTracks app
2. Log in as a user
3. In your app code, log the session token:
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('JWT Token:', session?.access_token);
   ```

Or get it from Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/vavqokubsuaiaaqmizso/auth/users
2. Click on a user
3. Copy the "Access Token (JWT)"

## Test with cURL

Replace `YOUR_JWT_TOKEN` with the actual token:

```bash
curl -X POST \
  'https://vavqokubsuaiaaqmizso.supabase.co/functions/v1/mapbox-tiles' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"z":10,"x":163,"y":395}'
```

## Expected Response

**Success**: Binary data (tile in Protocol Buffer format)
**Headers**:
- `X-Cache: MISS` (first request)
- `X-Cache: HIT` (subsequent requests within 24 hours)
- `X-Response-Time: XXXms`

## Test in Mobile App

```typescript
import { MapboxProxyService } from './services/MapboxProxyService';

// Test fetching a tile
async function testProxy() {
  try {
    const tile = await MapboxProxyService.fetchTile(10, 163, 395);
    console.log('✅ Tile fetched successfully:', tile.byteLength, 'bytes');
    
    // Check usage
    const usage = await MapboxProxyService.getUserUsage();
    console.log(`📊 Usage: ${usage.count}/${usage.limit} tiles (${usage.percentage}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testProxy();
```

## Common Errors

### "Missing authorization header"
- User is not logged in
- Check that `supabase.auth.getSession()` returns a valid session

### "Unauthorized"
- JWT token is invalid or expired
- Get a fresh token from the app

### "Rate limit exceeded"
- User has exceeded 500 tiles per day
- Wait 24 hours or increase limit in Edge Function config

### "Mapbox API error"
- Check that `MAPBOX_ACCESS_TOKEN` secret is set correctly
- Verify token at https://account.mapbox.com/access-tokens/

## Monitor Usage

Check the database:

```sql
-- View recent tile requests
SELECT * FROM tile_usage 
ORDER BY created_at DESC 
LIMIT 10;

-- Cache statistics
SELECT * FROM get_cache_stats();

-- Your usage
SELECT COUNT(*) as tiles_today
FROM tile_usage
WHERE user_id = auth.uid()
  AND created_at >= NOW() - INTERVAL '24 hours';
```

## View Edge Function Logs

In Supabase Dashboard:
1. Go to Edge Functions
2. Click on `mapbox-tiles`
3. View the Logs tab

Or use CLI:
```bash
npx supabase functions logs mapbox-tiles --project-ref vavqokubsuaiaaqmizso
```
