import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

import { DataService, RatedFeature } from '@/adapters/DatabaseAdapter';
import { Feature } from '@/components/MapViewComponent';

// ═══════════════════════════════════════════════════════════
// DATA RANGER SERVICE
// ═══════════════════════════════════════════════════════════
// Manages curb ramp feature loading, proximity queries, and rating
// orchestration for DataRanger mode during active trips.
//
// Features are downloaded from Supabase Storage on first use and cached
// locally in AsyncStorage. Updates are checked on each app launch when
// DataRanger mode is enabled.
//
// Follows ObstacleService patterns: singleton, spatial grid,
// LRU cache, Haversine distance, graceful degradation.

// --- Error Messages ---

const ERROR_MESSAGES = {
  INVALID_RATING: 'Rating must be between 1 and 10',
  INVALID_FEATURE: 'Feature data is invalid or incomplete',
  INVALID_COORDINATES: 'Invalid latitude or longitude values',
  STORAGE_WRITE_FAILED: 'Failed to save rating. Please try again.',
  STORAGE_READ_FAILED: 'Failed to load ratings',
  IMAGE_UPLOAD_FAILED: 'Failed to upload image',
  NOT_INITIALIZED: 'DataRanger service is not initialized',
  FEATURE_QUERY_FAILED: 'Failed to query nearby features',
  GRADING_WINDOW_EXPIRED: 'Features can only be graded within 6 hours of trip completion',
};

// --- Internal Types ---

interface CurbRampProperties {
  LocationDescription: string;
  conditionScore: number;
  curbReturnLoc: string;
  positionOnReturn: string;
  CNN?: number;
  detectableSurf?: number | null;
  Location?: string;
}

interface CurbRampFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: CurbRampProperties;
}

interface CurbRampsGeoJSON {
  type: 'FeatureCollection';
  features: CurbRampFeature[];
}

interface InternalFeature {
  id: string;
  lat: number;
  lon: number;
  location_description: string;
  condition_score: number;
  location_in_intersection: string;
  position_on_curb: string;
}

// --- Spatial Grid (inline) ---

class SpatialGrid {
  private grid: Map<string, InternalFeature[]>;
  private cellSize: number;

  constructor(features: InternalFeature[], cellSize: number = 0.001) {
    this.cellSize = cellSize;
    this.grid = new Map();
    for (const feature of features) {
      const key = this.getKey(feature.lat, feature.lon);
      const cell = this.grid.get(key);
      if (cell) {
        cell.push(feature);
      } else {
        this.grid.set(key, [feature]);
      }
    }
  }

  private getKey(lat: number, lon: number): string {
    return `${Math.floor(lat / this.cellSize)}_${Math.floor(lon / this.cellSize)}`;
  }

  queryNearby(lat: number, lon: number, radiusMeters: number): InternalFeature[] {
    // Convert radius to approximate grid cells to search
    const cellsToSearch = Math.ceil(radiusMeters / (this.cellSize * 111000)) + 1;
    const centerCellLat = Math.floor(lat / this.cellSize);
    const centerCellLon = Math.floor(lon / this.cellSize);
    const candidates: InternalFeature[] = [];

    for (let dLat = -cellsToSearch; dLat <= cellsToSearch; dLat++) {
      for (let dLon = -cellsToSearch; dLon <= cellsToSearch; dLon++) {
        const key = `${centerCellLat + dLat}_${centerCellLon + dLon}`;
        const cell = this.grid.get(key);
        if (cell) {
          candidates.push(...cell);
        }
      }
    }
    return candidates;
  }

  getStats(): { totalCells: number; totalFeatures: number } {
    let totalFeatures = 0;
    for (const cell of this.grid.values()) {
      totalFeatures += cell.length;
    }
    return { totalCells: this.grid.size, totalFeatures };
  }
}

// --- DataRanger Service ---

class DataRangerServiceClass {
  private features: InternalFeature[] = [];
  private spatialIndex: SpatialGrid | null = null;
  private isInitialized: boolean = false;
  private queryCache: Map<string, { features: Feature[]; location: { lat: number; lon: number } }> = new Map();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly CACHE_INVALIDATION_DISTANCE_M = 10;
  private readonly MAX_RESULTS = 50;
  private readonly DEFAULT_RADIUS_M = 50;
  
  // Storage paths for FileSystem (large files)
  private readonly DATA_FILE_NAME = 'dataranger_curb_ramps.json';
  
  // Storage keys for AsyncStorage (small metadata only)
  private readonly STORAGE_KEY_VERSION = '@dataranger/curb_ramps_version';

  // Track ratings for current trip: cris_id → userRating
  private ratedFeatures: Map<string, number> = new Map();
  private currentTripId: string | null = null;
  
  // Debug counter for logging
  private debugRatedCount: number = 0;

  /**
   * Initialize by loading curb ramps from cache, local assets, or downloading from server.
   * Priority: Cache → Local Assets → Supabase Storage
   * Checks for updates if DataRanger mode is enabled.
   * Non-fatal on failure — features are optional.
   */
  async initialize(checkForUpdates: boolean = false): Promise<void> {
    if (this.isInitialized) {
      console.log('[DataRangerService] Already initialized');
      
      // Still check for updates if requested
      if (checkForUpdates) {
        await this.checkAndUpdateFeatures();
      }
      return;
    }

    try {
      console.log('[DataRangerService] Initializing...');

      // Try to load from cache first
      const cachedData = await this.loadFromCache();
      
      if (cachedData) {
        console.log('[DataRangerService] Loaded from cache');
        await this.loadFeatures(cachedData);
        
        // Check for updates in background if requested
        if (checkForUpdates) {
          this.checkAndUpdateFeatures().catch(err => 
            console.warn('[DataRangerService] Background update check failed:', err)
          );
        }
      } else {
        // No cache, try loading from local assets first
        console.log('[DataRangerService] No cache found, loading from local assets...');
        try {
          await this.loadFromLocalAssets();
          
          // After loading local assets, check for server updates in background
          if (checkForUpdates) {
            this.checkAndUpdateFeatures().catch(err => 
              console.warn('[DataRangerService] Background update check failed:', err)
            );
          }
        } catch (localError) {
          // Local assets failed, try downloading from server
          console.warn('[DataRangerService] Local assets failed, downloading from server...', localError);
          await this.downloadAndCacheFeatures();
        }
      }

      this.isInitialized = true;
    } catch (error) {
      // Log but don't throw — features are optional
      console.warn('[DataRangerService] Initialization failed (features will be disabled):', error);
    }
  }

  /**
   * Load features from cached data in FileSystem.
   */
  private async loadFromCache(): Promise<CurbRampsGeoJSON | null> {
    try {
      const file = new File(Paths.document, this.DATA_FILE_NAME);
      
      if (!file.exists) {
        return null;
      }
      
      const cached = await file.text();
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[DataRangerService] Failed to load from cache:', error);
      return null;
    }
  }

  /**
   * Load features from local assets bundled with the app.
   * This serves as a fallback when no cache exists and server is unavailable.
   * 
   * Note: Disabled for now because Metro bundler has issues with large JSON files.
   * The app will fall back to downloading from Supabase Storage instead.
   */
  private async loadFromLocalAssets(): Promise<void> {
    throw new Error('Local assets loading disabled - will download from server instead');
    
    // TODO: Re-enable if needed by using expo-file-system to load from assets
    // or by converting the GeoJSON to a smaller format that Metro can handle
  }

  /**
   * Download features from Supabase Storage and cache locally.
   */
  private async downloadAndCacheFeatures(): Promise<void> {
    try {
      // Download from server
      const data: CurbRampsGeoJSON = await DataService.downloadAsset('CurbRamps');
      
      // Cache the data to FileSystem (handles large files)
      const file = new File(Paths.document, this.DATA_FILE_NAME);
      file.write(JSON.stringify(data));
      
      // Store the current version timestamp in AsyncStorage (small metadata)
      const version = new Date().toISOString();
      await AsyncStorage.setItem(this.STORAGE_KEY_VERSION, version);
      
      console.log('[DataRangerService] Downloaded and cached features');
      
      // Load into memory
      await this.loadFeatures(data);
    } catch (error) {
      console.error('[DataRangerService] Failed to download features:', error);
      throw error;
    }
  }

  /**
   * Check for updates and download if available.
   */
  private async checkAndUpdateFeatures(): Promise<void> {
    try {
      // Get server version
      const serverVersion = await DataService.checkAssetUpdates('CurbRamps');
      if (!serverVersion) {
        console.log('[DataRangerService] No version info available on server');
        return;
      }

      // Get local version
      const localVersion = await AsyncStorage.getItem(this.STORAGE_KEY_VERSION);
      
      if (!localVersion || new Date(serverVersion) > new Date(localVersion)) {
        console.log('[DataRangerService] Update available, downloading...');
        await this.downloadAndCacheFeatures();
      } else {
        console.log('[DataRangerService] Features are up to date');
      }
    } catch (error) {
      console.warn('[DataRangerService] Failed to check for updates:', error);
    }
  }

  /**
   * Load features from GeoJSON data into memory and build spatial index.
   */
  private async loadFeatures(data: CurbRampsGeoJSON): Promise<void> {
    if (!data.features || !Array.isArray(data.features)) {
      console.warn('[DataRangerService] Invalid GeoJSON data');
      return;
    }

    // Clear existing features
    this.features = [];

    // Parse and validate GeoJSON features
    let validCount = 0;
    for (let i = 0; i < data.features.length; i++) {
      const feature = data.features[i];
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties;

      if (!this.isValidCoordinate(lat, lon)) {
        continue;
      }

      this.features.push({
        id: `cris_${props.CNN ?? i}`, // Use CNN as ID if available
        lat,
        lon,
        location_description: props.LocationDescription ?? '',
        condition_score: props.conditionScore ?? 0,
        location_in_intersection: props.curbReturnLoc ?? '',
        position_on_curb: props.positionOnReturn ?? '',
      });

      validCount++;

      // Limit to prevent memory issues
      if (validCount >= 100000) {
        console.warn('[DataRangerService] Reached maximum feature limit (100,000)');
        break;
      }
    }

    if (this.features.length > 0) {
      // Build spatial index
      this.spatialIndex = new SpatialGrid(this.features, 0.001);
      const stats = this.spatialIndex.getStats();
      console.log('[DataRangerService] Spatial index stats:', stats);
    }

    console.log(`[DataRangerService] Loaded ${validCount} features into memory`);
  }

  /**
   * Clear all cached data (useful when DataRanger mode is disabled).
   */
  async clearCache(): Promise<void> {
    try {
      // Remove the data file
      const file = new File(Paths.document, this.DATA_FILE_NAME);
      if (file.exists) {
        file.delete();
      }
      
      // Remove version metadata
      await AsyncStorage.removeItem(this.STORAGE_KEY_VERSION);
      
      console.log('[DataRangerService] Cache cleared');
    } catch (error) {
      console.warn('[DataRangerService] Failed to clear cache:', error);
    }
  }

  /**
   * Query features within radius of a location.
   * Returns Feature[] compatible with MapViewComponent.
   */
  queryNearbyFeatures(lat: number, lon: number, radiusM?: number): Feature[] {
    if (!this.isInitialized || this.features.length === 0) {
      return [];
    }

    const radius = radiusM ?? this.DEFAULT_RADIUS_M;

    try {
      // Check cache
      const cacheKey = this.getCacheKey(lat, lon);
      const cached = this.queryCache.get(cacheKey);

      if (cached) {
        const distance = this.calculateDistance(
          cached.location.lat,
          cached.location.lon,
          lat,
          lon,
        );
        if (distance <= this.CACHE_INVALIDATION_DISTANCE_M) {
          return cached.features;
        }
        this.queryCache.delete(cacheKey);
      }

      // Get candidates from spatial index
      let candidates: InternalFeature[];
      if (this.spatialIndex) {
        candidates = this.spatialIndex.queryNearby(lat, lon, radius);
      } else {
        candidates = this.features;
      }

      // Filter by actual Haversine distance
      const results = candidates.filter((feature) => {
        return this.calculateDistance(lat, lon, feature.lat, feature.lon) <= radius;
      });

      // Sort by distance and limit
      results.sort((a, b) => {
        const distA = this.calculateDistance(lat, lon, a.lat, a.lon);
        const distB = this.calculateDistance(lat, lon, b.lat, b.lon);
        return distA - distB;
      });

      const limited = results.slice(0, this.MAX_RESULTS);

      // Convert to MapViewComponent Feature[]
      const mapFeatures = limited.map((f) => this.toMapFeature(f));

      // Cache results
      this.cacheQueryResult(cacheKey, mapFeatures, lat, lon);

      return mapFeatures;
    } catch (error) {
      console.error('[DataRangerService] Error querying nearby features:', error);
      return [];
    }
  }

  /**
   * Rate a feature. Persists to Supabase via DataService.
   * Updates the ratedFeatures map and invalidates cache.
   */
  /**
     * Rate a feature. Persists to Supabase via DataService.
     * Checks for existing rating and updates instead of creating duplicate.
     * Validates 6-hour grading window for completed trips.
     * Updates the ratedFeatures map and invalidates cache.
     * 
     * @param feature - Feature to rate
     * @param tripId - Trip ID (ULID format with embedded timestamp)
     * @param userId - User ID
     * @param rating - Rating value (1-10)
     * @param tripStatus - Current trip status for time window validation
     * @param imageUri - Optional image URI to upload
     * @throws Error if validation fails or storage operation fails
     */
    async rateFeature(
      feature: Feature,
      tripId: string,
      userId: string,
      rating: number,
      tripStatus: 'active' | 'paused' | 'completed',
      imageUri?: string,
    ): Promise<void> {
      try {
        // Validate rating
        if (rating < 1 || rating > 10) {
          throw new Error(ERROR_MESSAGES.INVALID_RATING);
        }

        // Validate feature
        if (!feature.id || !feature.coordinate || feature.coordinate.length !== 2) {
          throw new Error(ERROR_MESSAGES.INVALID_FEATURE);
        }

        // Validate coordinates
        const [lon, lat] = feature.coordinate;
        if (!this.isValidCoordinate(lat, lon)) {
          throw new Error(ERROR_MESSAGES.INVALID_COORDINATES);
        }

        // Check 6-hour grading window for completed trips
        if (tripStatus === 'completed' && !canGradeTrip(tripId, tripStatus)) {
          throw new Error(ERROR_MESSAGES.GRADING_WINDOW_EXPIRED);
        }

        let imageUrl: string | undefined;

        // Upload image if provided
        if (imageUri) {
          try {
            imageUrl = await DataService.uploadFeatureImage(
              userId,
              imageUri,
              feature.id,
            );
          } catch (error) {
            console.error('[DataRangerService] Failed to upload image:', error);
            // Don't throw - continue with rating submission
            // User should be notified via UI that image upload failed
          }
        }

        // Check if rating already exists for this feature in this trip
        const existingRatings = await DataService.getRatingsForTrip(tripId);
        const existingRating = existingRatings.find(r => r.crisId === feature.id);

        if (existingRating) {
          // Update existing rating
          console.log(`[DataRangerService] Updating existing rating for feature ${feature.id}`);
          await DataService.updateRating(existingRating.crisId, tripId, {
            userRating: rating,
            ...(imageUrl && { imageUrl }),
          });
        } else {
          // Create new rating
          console.log(`[DataRangerService] Creating new rating for feature ${feature.id}`);
          await DataService.writeRating({
            userId,
            tripId,
            crisId: feature.id,
            conditionScore: feature.properties?.condition_score ?? 0,
            userRating: rating,
            lat: lat,
            long: lon,
            timeStamp: new Date().toISOString(),
            imageUrl,
          });
        }

        // Track the rating in-memory
        this.ratedFeatures.set(feature.id, rating);

        // Invalidate cache so next query reflects rated status
        this.queryCache.clear();
      } catch (error: any) {
        // Re-throw validation errors as-is
        if (error.message && Object.values(ERROR_MESSAGES).includes(error.message)) {
          throw error;
        }
        // Wrap storage errors
        console.error('[DataRangerService] Error rating feature:', error);
        throw new Error(ERROR_MESSAGES.STORAGE_WRITE_FAILED);
      }
    }

  /**
   * Load existing ratings for a trip (e.g., when resuming).
   * Populates the ratedFeatures map.
   */
  async loadTripRatings(tripId: string): Promise<void> {
    try {
      console.log('[DataRangerService] loadTripRatings - Loading ratings for trip:', tripId);
      const ratings: RatedFeature[] = await DataService.getRatingsForTrip(tripId);
      console.log('[DataRangerService] loadTripRatings - Got ratings from DataService:', ratings.length);
      
      this.ratedFeatures.clear();
      this.debugRatedCount = 0; // Reset debug counter
      
      for (const r of ratings) {
        this.ratedFeatures.set(r.crisId, r.userRating);
        if (this.debugRatedCount < 3) {
          console.log('[DataRangerService] loadTripRatings - Adding rated feature:', {
            crisId: r.crisId,
            userRating: r.userRating,
          });
        }
      }
      
      this.currentTripId = tripId;
      console.log(`[DataRangerService] Loaded ${ratings.length} existing ratings for trip`);
      console.log(`[DataRangerService] ratedFeatures map size: ${this.ratedFeatures.size}`);
    } catch (error) {
      console.warn('[DataRangerService] Failed to load trip ratings:', error);
    }
  }
  /**
   * Load all ratings for the current user across all trips.
   * This allows showing previously rated features even on new trips.
   * Populates the ratedFeatures map with the most recent rating for each feature.
   */
  async loadAllUserRatings(userId: string): Promise<void> {
    try {
      const ratings: RatedFeature[] = await DataService.getUserRatings();

      // Clear existing ratings
      this.ratedFeatures.clear();

      // Build map of feature ID to most recent rating
      // If a feature was rated multiple times, keep the most recent
      const ratingsByFeature = new Map<string, { rating: number; timestamp: string }>();

      for (const r of ratings) {
        const existing = ratingsByFeature.get(r.crisId);
        if (!existing || new Date(r.timeStamp) > new Date(existing.timestamp)) {
          ratingsByFeature.set(r.crisId, {
            rating: r.userRating,
            timestamp: r.timeStamp,
          });
        }
      }

      // Populate ratedFeatures map
      for (const [crisId, data] of ratingsByFeature.entries()) {
        this.ratedFeatures.set(crisId, data.rating);
      }

      console.log(`[DataRangerService] Loaded ${this.ratedFeatures.size} user ratings across all trips`);
    } catch (error) {
      console.warn('[DataRangerService] Failed to load user ratings:', error);
    }
  }

  /**
   * Get ratings for a specific trip (for trip summary display).
   * Returns full rating data including feature IDs and user ratings.
   */
  async getRatingsForTrip(tripId: string): Promise<RatedFeature[]> {
    try {
      return await DataService.getRatingsForTrip(tripId);
    } catch (error) {
      console.warn('[DataRangerService] Failed to get ratings for trip:', error);
      return [];
    }
  }

  /**
   * Start tracking a new trip. Clears previous trip state.
   */
  startTrip(tripId: string): void {
    this.currentTripId = tripId;
    this.ratedFeatures.clear();
    this.queryCache.clear();
  }

  /**
   * End the current trip. Clears all trip state.
   */
  endTrip(): void {
    this.currentTripId = null;
    this.ratedFeatures.clear();
    this.queryCache.clear();
  }

  /**
   * Get total number of ratings across all trips for the current user.
   */
  async getUserRatingCount(): Promise<number> {
    try {
      const ratings = await DataService.getUserRatings();
      return ratings.length;
    } catch (error) {
      console.warn('[DataRangerService] Failed to get user rating count:', error);
      return 0;
    }
  }

  /**
   * Get number of features rated in the current trip.
   */
  getRatedCountForCurrentTrip(): number {
    return this.ratedFeatures.size;
  }

  /**
   * Get the existing rating for a feature in the current trip, or null.
   */
  getExistingRating(crisId: string | undefined): number | null {
    if (!crisId) return null;
    return this.ratedFeatures.get(crisId) ?? null;
  }

  /**
   * Whether the service is initialized and ready.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Release all resources and optionally clear cache.
   */
  cleanup(clearCache: boolean = false): void {
    console.log('[DataRangerService] Cleaning up...');
    this.features = [];
    this.spatialIndex = null;
    this.queryCache.clear();
    this.ratedFeatures.clear();
    this.currentTripId = null;
    this.isInitialized = false;
    
    if (clearCache) {
      this.clearCache().catch(err => 
        console.warn('[DataRangerService] Failed to clear cache during cleanup:', err)
      );
    }
  }

  // --- Private helpers ---

  /**
   * Haversine distance in meters between two coordinates.
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert InternalFeature to MapViewComponent Feature.
   */
  private toMapFeature(f: InternalFeature): Feature {
    const isRated = this.ratedFeatures.has(f.id);
    const userRating = this.ratedFeatures.get(f.id);
    
    // Debug: Log first few rated features
    if (isRated && this.debugRatedCount < 3) {
      console.log('[DataRangerService] toMapFeature - Rated feature:', {
        id: f.id,
        isRated,
        userRating,
        ratedFeaturesSize: this.ratedFeatures.size,
      });
      this.debugRatedCount++;
    }
    
    return {
      id: f.id,
      coordinate: [f.lon, f.lat],
      type: 'curb_ramp',
      properties: {
        location_description: f.location_description,
        condition_score: f.condition_score,
        location_in_intersection: f.location_in_intersection,
        position_on_curb: f.position_on_curb,
        rated: isRated,
        ...(userRating !== undefined && { userRating }), // Only include if defined
      },
    };
  }

  /**
   * Generate cache key from coordinates (rounded to ~100m precision).
   */
  private getCacheKey(lat: number, lon: number): string {
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLon = Math.round(lon * 1000) / 1000;
    return `${roundedLat}_${roundedLon}`;
  }

  /**
   * Cache query result with LRU eviction.
   */
  private cacheQueryResult(
    key: string,
    features: Feature[],
    lat: number,
    lon: number,
  ): void {
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.queryCache.delete(firstKey);
      }
    }
    this.queryCache.set(key, { features, location: { lat, lon } });
  }

  /**
   * Validate coordinate values.
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
export const DataRangerService = new DataRangerServiceClass();
