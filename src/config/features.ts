/**
 * Feature Flags Configuration
 * 
 * Toggle features on/off for gradual rollout and A/B testing
 */

export const FeatureFlags = {
  /**
   * Use Mapbox GL JS vector tiles instead of Leaflet raster tiles
   * 
   * Benefits:
   * - Smaller tile sizes (3-5 KB vs 15-20 KB)
   * - Crisp rendering at all zoom levels
   * - GPU-accelerated rendering (60fps)
   * - Dynamic styling capabilities
   * 
   * Requirements:
   * - Device must support WebGL
   * - Internet connection for initial tile loading
   * 
   * Set to true to enable Mapbox, false to use Leaflet
   */
  USE_MAPBOX_VECTOR_TILES: true,
};

export type FeatureFlagKey = keyof typeof FeatureFlags;
