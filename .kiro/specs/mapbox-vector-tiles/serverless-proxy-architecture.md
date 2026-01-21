# Serverless Proxy Architecture for Mapbox API

## Overview

Instead of bundling Mapbox API keys in the mobile app, we'll use Supabase Edge Functions as a secure proxy. This keeps your Mapbox token completely server-side and never exposed in the APK.

## Architecture

```
Mobile App → Supabase Edge Function → Mapbox API
(no token)   (token in secrets)      (authenticated)
```

## Benefits

- ✅ **Zero token exposure**: Mapbox token never in APK
- ✅ **Usage control**: Rate limiting and authentication at proxy level
- ✅ **Cost control**: Monitor and limit Mapbox API usage
- ✅ **User tracking**: Know which users are making requests
- ✅ **Caching**: Cache responses at edge for better performance
- ✅ **Free tier**: Supabase Edge Functions have generous free tier

## Implementation

### 1. Supabase Edge Function Structure

```
supabase/
└── functions/
    ├── mapbox-proxy/
    │   ├── index.ts           # Main proxy handler
    │   └── _shared/
    │       ├── auth.ts        # User authentication
    │       ├── cache.ts       # Response caching
    │       └── ratelimit.ts   # Rate limiting
    └── mapbox-tiles/
        └── index.ts           # Tile-specific proxy
```

### 2. Edge Function: Mapbox Tile Proxy

**File: `supabase/functions/mapbox-tiles/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TileRequest {
  z: number;
  x: number;
  y: number;
  tilesetId?: string;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request
    const { z, x, y, tilesetId = 'mapbox.mapbox-streets-v8' }: TileRequest = await req.json();

    // 3. Validate coordinates
    if (!isValidTileCoordinate(z, x, y)) {
      return new Response(JSON.stringify({ error: 'Invalid tile coordinates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Check rate limit
    const rateLimitOk = await checkRateLimit(user.id, supabase);
    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Check cache first
    const cached = await getCachedTile(z, x, y, supabase);
    if (cached) {
      return new Response(cached.data, {
        headers: {
          'Content-Type': 'application/x-protobuf',
          'X-Cache': 'HIT',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 6. Fetch from Mapbox
    const mapboxUrl = `https://api.mapbox.com/v4/${tilesetId}/${z}/${x}/${y}.mvt?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const mapboxResponse = await fetch(mapboxUrl);

    if (!mapboxResponse.ok) {
      return new Response(JSON.stringify({ error: 'Mapbox API error' }), {
        status: mapboxResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tileData = await mapboxResponse.arrayBuffer();

    // 7. Cache the tile
    await cacheTile(z, x, y, tileData, supabase);

    // 8. Log usage
    await logTileRequest(user.id, z, x, y, supabase);

    // 9. Return tile
    return new Response(tileData, {
      headers: {
        'Content-Type': 'application/x-protobuf',
        'X-Cache': 'MISS',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in mapbox-tiles function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function isValidTileCoordinate(z: number, x: number, y: number): boolean {
  if (z < 0 || z > 22) return false;
  const maxTile = Math.pow(2, z);
  return x >= 0 && x < maxTile && y >= 0 && y < maxTile;
}

async function checkRateLimit(userId: string, supabase: any): Promise<boolean> {
  // Check if user has exceeded rate limit (e.g., 1000 tiles per day)
  const { data, error } = await supabase
    .from('tile_usage')
    .select('count')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Rate limit check error:', error);
    return true; // Allow on error
  }

  return !data || data.count < 1000;
}

async function getCachedTile(z: number, x: number, y: number, supabase: any) {
  const key = `${z}/${x}/${y}`;
  const { data, error } = await supabase
    .from('tile_cache')
    .select('data')
    .eq('tile_key', key)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  
  // Decode base64 to ArrayBuffer
  const binaryString = atob(data.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { data: bytes.buffer };
}

async function cacheTile(z: number, x: number, y: number, data: ArrayBuffer, supabase: any) {
  const key = `${z}/${x}/${y}`;
  
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  // Cache for 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await supabase
    .from('tile_cache')
    .upsert({
      tile_key: key,
      data: base64,
      expires_at: expiresAt.toISOString(),
    });
}

async function logTileRequest(userId: string, z: number, x: number, y: number, supabase: any) {
  await supabase
    .from('tile_usage')
    .insert({
      user_id: userId,
      tile_key: `${z}/${x}/${y}`,
      zoom_level: z,
    });
}
```

### 3. Database Schema for Caching and Usage Tracking

**File: `supabase/migrations/20250120000000_mapbox_proxy_tables.sql`**

```sql
-- Tile cache table
CREATE TABLE IF NOT EXISTS tile_cache (
  id BIGSERIAL PRIMARY KEY,
  tile_key TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL, -- Base64 encoded tile data
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_tile_cache_key ON tile_cache(tile_key);
CREATE INDEX idx_tile_cache_expires ON tile_cache(expires_at);

-- Tile usage tracking
CREATE TABLE IF NOT EXISTS tile_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tile_key TEXT NOT NULL,
  zoom_level INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limiting queries
CREATE INDEX idx_tile_usage_user_date ON tile_usage(user_id, created_at);
CREATE INDEX idx_tile_usage_created ON tile_usage(created_at);

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_tiles()
RETURNS void AS $$
BEGIN
  DELETE FROM tile_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user tile usage count
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
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE tile_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role only)
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
```

### 4. Mobile App Integration

**File: `src/services/MapboxProxyService.ts`**

```typescript
import { supabase } from '../config/supabase.config';

export class MapboxProxyService {
  private static readonly EDGE_FUNCTION_URL = `${process.env.SUPABASE_URL}/functions/v1/mapbox-tiles`;

  /**
   * Fetch a vector tile through the Supabase proxy
   */
  static async fetchTile(z: number, x: number, y: number): Promise<ArrayBuffer> {
    const session = await supabase.auth.getSession();
    
    if (!session.data.session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(this.EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ z, x, y }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch tile');
    }

    return await response.arrayBuffer();
  }

  /**
   * Get user's tile usage statistics
   */
  static async getUserUsage(): Promise<{ count: number; limit: number }> {
    const { data, error } = await supabase
      .rpc('get_user_tile_usage', { p_hours: 24 });

    if (error) {
      console.error('Error fetching usage:', error);
      return { count: 0, limit: 1000 };
    }

    return { count: data || 0, limit: 1000 };
  }
}
```

### 5. WebView Integration with Proxy

**Update MapView WebView HTML:**

```javascript
// Inside WebView - use proxy instead of direct Mapbox API
mapboxgl.addProtocol('proxy', async (params, callback) => {
  const match = params.url.match(/proxy:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf/);
  if (match) {
    const [, z, x, y] = match;
    
    // Send message to React Native to fetch via proxy
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'fetchTile',
      payload: { z, x, y }
    }));
    
    // Wait for response (implement promise-based message handling)
    // ... response handling logic
  }
  
  return { cancel: () => {} };
});

// Map style uses proxy protocol
const style = {
  version: 8,
  sources: {
    'proxy-tiles': {
      type: 'vector',
      tiles: ['proxy://tiles/{z}/{x}/{y}.pbf'],
      minzoom: 10,
      maxzoom: 18
    }
  },
  // ... rest of style
};
```

## Deployment

### 1. Set Mapbox Token as Supabase Secret

```bash
# Using Supabase CLI
supabase secrets set MAPBOX_ACCESS_TOKEN=sk.your_secret_token_here

# Verify
supabase secrets list
```

### 2. Deploy Edge Function

```bash
# Deploy the function
supabase functions deploy mapbox-tiles

# Test the function
supabase functions invoke mapbox-tiles \
  --body '{"z":10,"x":163,"y":395}' \
  --header "Authorization: Bearer YOUR_USER_JWT"
```

### 3. Run Migration

```bash
# Apply database schema
supabase db push
```

## Cost Analysis

### Supabase Edge Functions (Free Tier)
- 500,000 invocations/month
- 100GB bandwidth/month
- More than enough for RollTracks

### Mapbox API (Free Tier)
- 50,000 tile requests/month
- With caching, this goes much further

### Estimated Usage
```
Scenario: 1000 active users
- Average 50 tiles per session
- 10 sessions per month per user
- Total: 500,000 tile requests/month

With 7-day caching:
- Cache hit rate: ~80%
- Actual Mapbox requests: ~100,000/month
- Still within free tier with room to grow
```

## Security Benefits

1. **Token Security**: Mapbox token never leaves server
2. **User Authentication**: Only authenticated users can access
3. **Rate Limiting**: Prevent abuse and control costs
4. **Usage Tracking**: Monitor per-user consumption
5. **Caching**: Reduce Mapbox API calls by 80%+
6. **Audit Trail**: Log all tile requests for debugging

## Performance Considerations

### Latency
- Direct Mapbox: ~100-200ms
- Via proxy: ~150-300ms (acceptable for tiles)
- Cached tiles: ~50-100ms (faster than direct!)

### Optimization Strategies
1. **Aggressive caching**: 7-day cache for tiles
2. **Batch requests**: Fetch multiple tiles in one call
3. **Edge deployment**: Supabase Edge Functions run globally
4. **Prefetching**: Download adjacent tiles proactively

## Monitoring

### Dashboard Queries

```sql
-- Daily tile usage by user
SELECT 
  user_id,
  DATE(created_at) as date,
  COUNT(*) as tile_count
FROM tile_usage
GROUP BY user_id, DATE(created_at)
ORDER BY date DESC, tile_count DESC;

-- Cache hit rate
SELECT 
  COUNT(*) FILTER (WHERE expires_at > NOW()) as cached_tiles,
  COUNT(*) as total_tiles,
  ROUND(100.0 * COUNT(*) FILTER (WHERE expires_at > NOW()) / COUNT(*), 2) as hit_rate_percent
FROM tile_cache;

-- Top tile consumers
SELECT 
  user_id,
  COUNT(*) as requests,
  COUNT(DISTINCT tile_key) as unique_tiles
FROM tile_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY requests DESC
LIMIT 10;
```

## Fallback Strategy

If proxy fails, fall back to bundled tiles:

```typescript
async function fetchTileWithFallback(z: number, x: number, y: number): Promise<ArrayBuffer> {
  try {
    // Try proxy first
    return await MapboxProxyService.fetchTile(z, x, y);
  } catch (error) {
    console.warn('Proxy failed, trying bundled tiles:', error);
    
    // Fall back to bundled tiles
    return await loadBundledTile(z, x, y);
  }
}
```

## Summary

This serverless proxy architecture provides:
- ✅ Maximum security (no tokens in APK)
- ✅ Cost control (caching + rate limiting)
- ✅ User tracking and analytics
- ✅ Scalability (Supabase Edge Functions)
- ✅ Performance (edge caching)
- ✅ Free tier friendly (500k invocations/month)

The implementation adds minimal latency while providing enterprise-grade security and control over your Mapbox API usage.