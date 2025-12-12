import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { ObstacleFeature, ProximityQuery } from '../types';
import { SpatialGrid } from './SpatialGrid';

/**
 * Service for loading and querying obstacle features from a GeoJSON file.
 * Provides efficient proximity-based queries using spatial indexing.
 */
class ObstacleService {
  private features: ObstacleFeature[] = [];
  private spatialIndex: SpatialGrid | null = null;
  private isInitialized: boolean = false;
  private queryCache: Map<string, { features: ObstacleFeature[]; location: { lat: number; lon: number } }> = new Map();
  private readonly MAX_CACHE_SIZE = 10;

  /**
   * Initialize the service by loading and parsing the GeoJSON file
   * Note: Does not throw errors - obstacles are optional
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('ObstacleService already initialized');
      return;
    }

    try {
      console.log('Initializing ObstacleService...');
      
      // Load and parse GeoJSON file
      await this.loadGeoJsonFile();
      
      // Only build spatial index if we have features
      if (this.features.length > 0) {
        // Build spatial index
        this.buildSpatialIndex();
        
        this.isInitialized = true;
        console.log(`ObstacleService initialized with ${this.features.length} features`);
      } else {
        console.warn('ObstacleService: No features loaded, obstacle visualization will be disabled');
      }
    } catch (error) {
      // Log but don't throw - obstacles are optional
      console.warn('ObstacleService initialization failed (obstacles will be disabled):', error);
    }
  }

  /**
   * Query features within a specified radius of a location
   * @param query - Location and radius for proximity search
   * @returns Array of features within the specified radius
   */
  queryNearby(query: ProximityQuery): ObstacleFeature[] {
    if (!this.isInitialized) {
      console.warn('ObstacleService not initialized, returning empty results');
      return [];
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(query.latitude, query.longitude);
      const cached = this.queryCache.get(cacheKey);
      
      if (cached) {
        // Check if cached location is within 10m of query location
        const distance = this.calculateDistance(
          cached.location.lat,
          cached.location.lon,
          query.latitude,
          query.longitude
        );
        
        if (distance <= 10) {
          return cached.features;
        } else {
          // Invalidate cache if moved more than 10m
          this.queryCache.delete(cacheKey);
        }
      }

      // Perform query
      let candidates: ObstacleFeature[];
      
      if (this.spatialIndex) {
        // Use spatial index for efficient query
        candidates = this.spatialIndex.queryNearby(
          query.latitude,
          query.longitude,
          query.radiusMeters
        );
        console.log(`Spatial index returned ${candidates.length} candidates`);
      } else {
        // Fallback to linear search - check all features
        console.warn('Spatial index not available, using linear search');
        candidates = this.features;
      }

      // Filter by actual distance
      const results = candidates.filter(feature => {
        const distance = this.calculateDistance(
          query.latitude,
          query.longitude,
          feature.latitude,
          feature.longitude
        );
        const withinRadius = distance <= query.radiusMeters;
        if (!withinRadius && candidates.length < 10) {
          // Log first few rejections for debugging
          console.log(`Rejecting feature at distance ${distance.toFixed(1)}m (limit: ${query.radiusMeters}m)`);
        }
        return withinRadius;
      });

      console.log(`Obstacle query: ${candidates.length} candidates, ${results.length} within ${query.radiusMeters}m`);
      if (results.length > 0) {
        const distances = results.map(f => 
          this.calculateDistance(query.latitude, query.longitude, f.latitude, f.longitude)
        );
        console.log(`Distance range: ${Math.min(...distances).toFixed(1)}m - ${Math.max(...distances).toFixed(1)}m`);
      }

      // Sort by distance and limit to 50 closest
      results.sort((a, b) => {
        const distA = this.calculateDistance(query.latitude, query.longitude, a.latitude, a.longitude);
        const distB = this.calculateDistance(query.latitude, query.longitude, b.latitude, b.longitude);
        return distA - distB;
      });

      const limitedResults = results.slice(0, 50);

      // Cache the results
      this.cacheQueryResult(cacheKey, limitedResults, query.latitude, query.longitude);

      return limitedResults;
    } catch (error) {
      console.error('Error querying nearby features:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @returns Distance in meters
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    console.log('Cleaning up ObstacleService...');
    this.features = [];
    this.spatialIndex = null;
    this.queryCache.clear();
    this.isInitialized = false;
  }

  /**
   * Get the asset path for the GeoJSON file based on platform
   * @private
   */
  private getObstacleDataPath(): string {
    if (Platform.OS === 'android') {
      // Android assets are accessed via a special path
      // react-native-fs uses readFileAssets for Android assets
      return 'curb_ramps.geojson';
    } else if (Platform.OS === 'ios') {
      // iOS path
      return `${RNFS.MainBundlePath}/curb_ramps.geojson`;
    } else {
      // Development fallback
      return 'curb_ramps.geojson';
    }
  }

  /**
   * Load and parse the obstacle data from GeoJSON file
   * @private
   */
  private async loadGeoJsonFile(): Promise<void> {
    const path = this.getObstacleDataPath();
    
    console.log('Loading obstacle data from:', path);

    try {
      // Try loading from bundled assets using XMLHttpRequest
      await this.loadGeoJsonFromAsset(path);
      console.log(`Loaded ${this.features.length} features from obstacle data`);
    } catch (error) {
      console.warn('XMLHttpRequest failed, trying alternative method:', error instanceof Error ? error.message : 'Unknown error');
      
      try {
        // Fallback: Try loading as a required module (if converted to .json)
        // This would require the file to be in the project and imported
        // For now, just log the error
        throw error;
      } catch (fallbackError) {
        // Log error but don't throw - obstacles are optional
        console.warn('Could not load obstacle data (file may not be bundled yet):', error instanceof Error ? error.message : 'Unknown error');
        console.warn('The app will continue without obstacle visualization. Rebuild the app after running "npm run copy-geojson" to include obstacles.');
        // Don't throw - allow app to continue without obstacles
      }
    }
  }

  /**
   * Load GeoJSON file from bundled asset
   * @private
   */
  private async loadGeoJsonFromAsset(assetPath: string): Promise<void> {
    console.log(`Reading GeoJSON file from assets: ${assetPath}`);
    
    // Use react-native-fs to read the asset file
    // On Android, use readFileAssets which reads from the assets folder
    let fileContent: string;
    if (Platform.OS === 'android') {
      fileContent = await RNFS.readFileAssets(assetPath, 'utf8');
    } else {
      fileContent = await RNFS.readFile(assetPath, 'utf8');
    }
    
    console.log(`Read ${fileContent.length} characters from file`);
    
    // Parse the JSON
    const geojson = JSON.parse(fileContent);
    console.log(`Successfully parsed GeoJSON with ${geojson.features?.length || 0} features`);
    
    if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new Error('Invalid GeoJSON format: expected FeatureCollection with features array');
    }

    // Validate and load features
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < geojson.features.length; i++) {
      const geoFeature = geojson.features[i];
      
      try {
        // Extract coordinates from GeoJSON geometry
        // GeoJSON uses [longitude, latitude] order
        if (geoFeature.geometry?.type !== 'Point' || !Array.isArray(geoFeature.geometry.coordinates)) {
          invalidCount++;
          continue;
        }

        const [longitude, latitude] = geoFeature.geometry.coordinates;

        // Validate coordinates
        if (!this.isValidCoordinate(latitude, longitude)) {
          invalidCount++;
          continue;
        }

        // Generate ID from properties or index
        const id = geoFeature.properties?.CNN?.toString() || `feature_${i}`;

        // Add to features array
        this.features.push({
          id,
          latitude,
          longitude,
          attributes: geoFeature.properties || {}
        });

        validCount++;

        // Limit to 100,000 features to prevent memory issues
        if (validCount >= 100000) {
          console.warn('Reached maximum feature limit (100,000), stopping load');
          break;
        }
      } catch (error) {
        console.warn('Error loading feature:', error);
        invalidCount++;
      }
    }

    console.log(`Loaded ${validCount} valid features, ${invalidCount} invalid`);

    if (validCount === 0) {
      throw new Error('No valid features found in obstacle data');
    }
  }

  /**
   * Build spatial index for efficient queries
   * @private
   */
  private buildSpatialIndex(): void {
    if (this.features.length === 0) {
      console.warn('No features to index');
      return;
    }

    try {
      console.log('Building spatial index...');
      this.spatialIndex = new SpatialGrid(this.features, 0.001);
      
      const stats = this.spatialIndex.getStats();
      console.log('Spatial index stats:', stats);
    } catch (error) {
      console.error('Failed to build spatial index:', error);
      console.warn('Falling back to linear search');
      this.spatialIndex = null;
    }
  }

  /**
   * Generate cache key from coordinates
   * @private
   */
  private getCacheKey(lat: number, lon: number): string {
    // Round to 3 decimal places (~100m precision)
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLon = Math.round(lon * 1000) / 1000;
    return `${roundedLat}_${roundedLon}`;
  }

  /**
   * Cache query result with LRU eviction
   * @private
   */
  private cacheQueryResult(
    key: string,
    features: ObstacleFeature[],
    lat: number,
    lon: number
  ): void {
    // Implement LRU eviction if cache is full
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.queryCache.delete(firstKey);
      }
    }

    this.queryCache.set(key, {
      features,
      location: { lat, lon }
    });
  }

  /**
   * Check if a coordinate is valid
   * @private
   */
  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }
}

// Export singleton instance
export const obstacleService = new ObstacleService();
export default obstacleService;
