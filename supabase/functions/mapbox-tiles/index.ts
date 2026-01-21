// Mapbox Tiles Proxy - Supabase Edge Function
// Securely proxies Mapbox API requests with authentication, rate limiting, and minimal caching
// Optimized for free tier usage

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables (set via Supabase secrets)
const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configuration for free tier optimization
const CONFIG = {
  RATE_LIMIT_PER_DAY: 500, // Conservative limit per user per day
  CACHE_EXPIRATION_HOURS: 24, // Minimal caching - 24 hours
  MAX_CACHE_SIZE_MB: 50, // Keep cache small for free tier
  ENABLE_CACHING: true, // Set to false to disable caching entirely
};

interface TileRequest {
  z: number;
  x: number;
  y: number;
  tilesetId?: string;
}

interface CachedTile {
  data: string; // Base64 encoded
  size_bytes: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const startTime = Date.now();

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Parse and validate request
    const { z, x, y, tilesetId = 'mapbox.mapbox-streets-v8' }: TileRequest = await req.json();

    if (!isValidTileCoordinate(z, x, y)) {
      return jsonResponse({ 
        error: 'Invalid tile coordinates',
        details: `z=${z}, x=${x}, y=${y} are out of valid range`
      }, 400);
    }

    const tileKey = `${z}/${x}/${y}`;

    // 3. Check rate limit (free tier protection)
    const rateLimitOk = await checkRateLimit(user.id, supabase);
    if (!rateLimitOk) {
      return jsonResponse({ 
        error: 'Rate limit exceeded',
        message: `You have exceeded ${CONFIG.RATE_LIMIT_PER_DAY} tile requests per day. Please try again tomorrow.`,
        limit: CONFIG.RATE_LIMIT_PER_DAY
      }, 429);
    }

    // 4. Check cache first (if enabled)
    if (CONFIG.ENABLE_CACHING) {
      const cached = await getCachedTile(tileKey, supabase);
      if (cached) {
        // Log cache hit
        await logTileRequest(user.id, tileKey, z, true, supabase);
        
        // Update last accessed time
        await updateTileAccess(tileKey, supabase);
        
        const tileData = base64ToArrayBuffer(cached.data);
        const responseTime = Date.now() - startTime;
        
        console.log(`Cache HIT: ${tileKey} (${responseTime}ms)`);
        
        return new Response(tileData, {
          headers: {
            'Content-Type': 'application/x-protobuf',
            'X-Cache': 'HIT',
            'X-Response-Time': `${responseTime}ms`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // 5. Fetch from Mapbox API
    const mapboxUrl = `https://api.mapbox.com/v4/${tilesetId}/${z}/${x}/${y}.mvt?access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    console.log(`Fetching from Mapbox: ${tileKey}`);
    const mapboxResponse = await fetch(mapboxUrl);

    if (!mapboxResponse.ok) {
      console.error(`Mapbox API error: ${mapboxResponse.status} ${mapboxResponse.statusText}`);
      return jsonResponse({ 
        error: 'Mapbox API error',
        status: mapboxResponse.status,
        message: mapboxResponse.statusText
      }, mapboxResponse.status);
    }

    const tileData = await mapboxResponse.arrayBuffer();
    const tileSize = tileData.byteLength;

    // 6. Cache the tile (if enabled and not too large)
    if (CONFIG.ENABLE_CACHING && tileSize < 1024 * 1024) { // Don't cache tiles > 1MB
      await cacheTile(tileKey, tileData, tileSize, supabase);
    }

    // 7. Log usage (cache miss)
    await logTileRequest(user.id, tileKey, z, false, supabase);

    // 8. Clean up cache periodically (every 100th request)
    if (Math.random() < 0.01) {
      supabase.rpc('cleanup_old_tiles', { max_cache_size_mb: CONFIG.MAX_CACHE_SIZE_MB })
        .then(() => console.log('Cache cleanup triggered'))
        .catch(err => console.error('Cache cleanup error:', err));
    }

    const responseTime = Date.now() - startTime;
    console.log(`Cache MISS: ${tileKey} (${responseTime}ms, ${tileSize} bytes)`);

    // 9. Return tile
    return new Response(tileData, {
      headers: {
        'Content-Type': 'application/x-protobuf',
        'X-Cache': 'MISS',
        'X-Response-Time': `${responseTime}ms`,
        'X-Tile-Size': `${tileSize}`,
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in mapbox-tiles function:', error);
    return jsonResponse({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Helper Functions

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function isValidTileCoordinate(z: number, x: number, y: number): boolean {
  if (z < 0 || z > 22) return false;
  const maxTile = Math.pow(2, z);
  return x >= 0 && x < maxTile && y >= 0 && y < maxTile;
}

async function checkRateLimit(userId: string, supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_tile_usage', { 
        p_user_id: userId, 
        p_hours: 24 
      });

    if (error) {
      console.error('Rate limit check error:', error);
      return true; // Allow on error to avoid blocking users
    }

    const usage = data || 0;
    console.log(`User ${userId} usage: ${usage}/${CONFIG.RATE_LIMIT_PER_DAY}`);
    
    return usage < CONFIG.RATE_LIMIT_PER_DAY;
  } catch (error) {
    console.error('Rate limit exception:', error);
    return true; // Allow on exception
  }
}

async function getCachedTile(tileKey: string, supabase: any): Promise<CachedTile | null> {
  try {
    const { data, error } = await supabase
      .from('tile_cache')
      .select('data, size_bytes')
      .eq('tile_key', tileKey)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    
    return data as CachedTile;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function cacheTile(tileKey: string, data: ArrayBuffer, sizeBytes: number, supabase: any): Promise<void> {
  try {
    const base64Data = arrayBufferToBase64(data);
    const expiresAt = new Date(Date.now() + CONFIG.CACHE_EXPIRATION_HOURS * 60 * 60 * 1000);
    
    await supabase
      .from('tile_cache')
      .upsert({
        tile_key: tileKey,
        data: base64Data,
        size_bytes: sizeBytes,
        expires_at: expiresAt.toISOString(),
        last_accessed: new Date().toISOString(),
      }, {
        onConflict: 'tile_key'
      });
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't throw - caching failure shouldn't break tile delivery
  }
}

async function updateTileAccess(tileKey: string, supabase: any): Promise<void> {
  try {
    await supabase
      .from('tile_cache')
      .update({ last_accessed: new Date().toISOString() })
      .eq('tile_key', tileKey);
  } catch (error) {
    console.error('Cache access update error:', error);
  }
}

async function logTileRequest(userId: string, tileKey: string, zoomLevel: number, cacheHit: boolean, supabase: any): Promise<void> {
  try {
    await supabase
      .from('tile_usage')
      .insert({
        user_id: userId,
        tile_key: tileKey,
        zoom_level: zoomLevel,
        cache_hit: cacheHit,
      });
  } catch (error) {
    console.error('Usage logging error:', error);
    // Don't throw - logging failure shouldn't break tile delivery
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
