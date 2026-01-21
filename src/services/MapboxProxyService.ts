/**
 * Mapbox Proxy Service
 * 
 * Handles communication with Supabase Edge Function for secure Mapbox tile fetching.
 * All Mapbox API credentials are stored server-side, never exposed in the mobile app.
 */

import { supabase } from '../config/supabase.config';

export interface TileUsageStats {
  count: number;
  limit: number;
  percentage: number;
}

export interface CacheStats {
  totalTiles: number;
  cacheSizeMb: number;
  cacheHitRate: number;
  tilesLast24h: number;
}

export class MapboxProxyService {
  private static readonly EDGE_FUNCTION_NAME = 'mapbox-tiles';
  private static readonly DEFAULT_TILESET = 'mapbox.mapbox-streets-v8';

  /**
   * Fetch a vector tile through the Supabase proxy
   * @param z Zoom level
   * @param x Tile X coordinate
   * @param y Tile Y coordinate
   * @param tilesetId Optional Mapbox tileset ID
   * @returns ArrayBuffer containing the tile data
   */
  static async fetchTile(
    z: number,
    x: number,
    y: number,
    tilesetId: string = this.DEFAULT_TILESET
  ): Promise<ArrayBuffer> {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('User not authenticated. Please log in to load map tiles.');
      }

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke(this.EDGE_FUNCTION_NAME, {
        body: { z, x, y, tilesetId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`Failed to fetch tile: ${error.message}`);
      }

      // Check if response is an error object
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(data.error || 'Unknown error from proxy');
      }

      // Convert response to ArrayBuffer
      if (data instanceof ArrayBuffer) {
        return data;
      } else if (data instanceof Blob) {
        return await data.arrayBuffer();
      } else {
        throw new Error('Unexpected response format from proxy');
      }

    } catch (error) {
      console.error(`Error fetching tile ${z}/${x}/${y}:`, error);
      throw error;
    }
  }

  /**
   * Get user's tile usage statistics
   * @returns Usage statistics including count, limit, and percentage
   */
  static async getUserUsage(): Promise<TileUsageStats> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { count: 0, limit: 500, percentage: 0 };
      }

      const { data, error } = await supabase
        .rpc('get_user_tile_usage', { 
          p_user_id: user.id,
          p_hours: 24 
        });

      if (error) {
        console.error('Error fetching usage:', error);
        return { count: 0, limit: 500, percentage: 0 };
      }

      const count = data || 0;
      const limit = 500; // Match Edge Function rate limit
      const percentage = Math.round((count / limit) * 100);

      return { count, limit, percentage };

    } catch (error) {
      console.error('Error in getUserUsage:', error);
      return { count: 0, limit: 500, percentage: 0 };
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics including size and hit rate
   */
  static async getCacheStats(): Promise<CacheStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_cache_stats');

      if (error) {
        console.error('Error fetching cache stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          totalTiles: 0,
          cacheSizeMb: 0,
          cacheHitRate: 0,
          tilesLast24h: 0,
        };
      }

      const stats = data[0];
      return {
        totalTiles: parseInt(stats.total_tiles) || 0,
        cacheSizeMb: parseFloat(stats.cache_size_mb) || 0,
        cacheHitRate: parseFloat(stats.cache_hit_rate) || 0,
        tilesLast24h: parseInt(stats.tiles_last_24h) || 0,
      };

    } catch (error) {
      console.error('Error in getCacheStats:', error);
      return null;
    }
  }

  /**
   * Get user's tile usage history
   * @param hours Number of hours to look back (default: 24)
   * @returns Array of usage records
   */
  static async getUserUsageHistory(hours: number = 24) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return [];
      }

      const { data, error } = await supabase
        .from('tile_usage')
        .select('tile_key, zoom_level, cache_hit, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching usage history:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error in getUserUsageHistory:', error);
      return [];
    }
  }

  /**
   * Check if user is approaching rate limit
   * @returns True if user has used > 80% of daily limit
   */
  static async isApproachingRateLimit(): Promise<boolean> {
    const usage = await this.getUserUsage();
    return usage.percentage >= 80;
  }

  /**
   * Validate tile coordinates
   * @param z Zoom level
   * @param x Tile X coordinate
   * @param y Tile Y coordinate
   * @returns True if coordinates are valid
   */
  static isValidTileCoordinate(z: number, x: number, y: number): boolean {
    if (z < 0 || z > 22) return false;
    const maxTile = Math.pow(2, z);
    return x >= 0 && x < maxTile && y >= 0 && y < maxTile;
  }
}
