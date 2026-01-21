import { RatedFeature } from '../types';

/**
 * Processed rated feature with most recent rating information
 * Used for displaying markers on the HomeScreen map
 */
export interface ProcessedRatedFeature {
  feature_id: string;
  latitude: number;
  longitude: number;
  rating: number;        // Most recent rating value (1-10)
  trip_id: string;       // Trip ID of most recent rating
  timestamp: string;     // Timestamp of most recent rating
  properties: any;       // Feature properties
}

/**
 * Map region for displaying features
 */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Process ratings to group by feature_id and find the most recent rating for each feature
 * 
 * Algorithm:
 * 1. Group ratings by feature_id using a Map
 * 2. For each feature_id group, sort by timestamp (descending) and take the first (most recent)
 * 3. Extract relevant data into ProcessedRatedFeature format
 * 
 * @param ratings - Array of all ratings from RatingService.getAllRatings()
 * @returns Array of unique features with their most recent ratings
 * 
 * Requirements: 2.4, 3.4, 6.2
 */
export function processRatings(ratings: RatedFeature[]): ProcessedRatedFeature[] {
  // Group ratings by feature_id
  const featureMap = new Map<string, RatedFeature[]>();
  
  for (const rating of ratings) {
    const existing = featureMap.get(rating.id);
    if (existing) {
      existing.push(rating);
    } else {
      featureMap.set(rating.id, [rating]);
    }
  }
  
  // For each feature, find the most recent rating
  const processedFeatures: ProcessedRatedFeature[] = [];
  
  for (const [featureId, featureRatings] of featureMap.entries()) {
    // Sort by timestamp descending (most recent first)
    const sortedRatings = featureRatings.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Take the most recent rating
    const mostRecent = sortedRatings[0];
    
    // Extract coordinates from GeoJSON geometry
    const [longitude, latitude] = mostRecent.geometry.coordinates;
    
    processedFeatures.push({
      feature_id: featureId,
      latitude,
      longitude,
      rating: mostRecent.userRating,
      trip_id: mostRecent.tripId,
      timestamp: mostRecent.timestamp,
      properties: mostRecent.properties,
    });
  }
  
  return processedFeatures;
}

/**
 * Calculate map region that encompasses all features with padding
 * 
 * Algorithm:
 * 1. If array is empty, return null (caller should use default region)
 * 2. Extract all latitudes and longitudes
 * 3. Calculate min/max bounds and center point
 * 4. Add 20% padding to deltas for better visualization
 * 
 * @param features - Array of ProcessedRatedFeature objects
 * @returns MapRegion with center and deltas, or null if no features
 * 
 * Requirements: 2.5
 */
export function calculateMapRegion(features: ProcessedRatedFeature[]): MapRegion | null {
  if (features.length === 0) {
    return null;
  }
  
  // Single feature case - use small default delta
  if (features.length === 1) {
    return {
      latitude: features[0].latitude,
      longitude: features[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }
  
  // Extract all coordinates
  const latitudes = features.map(f => f.latitude);
  const longitudes = features.map(f => f.longitude);
  
  // Calculate bounds
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  
  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Calculate deltas with 20% padding
  const latDelta = (maxLat - minLat) * 1.2;
  const lngDelta = (maxLng - minLng) * 1.2;
  
  // Ensure minimum delta for very close features
  const minDelta = 0.01;
  
  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max(latDelta, minDelta),
    longitudeDelta: Math.max(lngDelta, minDelta),
  };
}

/**
 * Map rating values to colors for marker visualization
 * 
 * Color scheme:
 * - 1-3: Red (#FF4444) - Poor accessibility
 * - 4-6: Yellow (#FFAA00) - Moderate accessibility
 * - 7-10: Green (#44FF44) - Good accessibility
 * 
 * @param rating - Rating value (1-10)
 * @returns Hex color string
 * 
 * Requirements: 3.1, 3.2
 */
export function getMarkerColor(rating: number): string {
  if (rating >= 1 && rating <= 3) {
    return '#FF4444'; // Red
  } else if (rating >= 4 && rating <= 6) {
    return '#FFAA00'; // Yellow
  } else if (rating >= 7 && rating <= 10) {
    return '#44FF44'; // Green
  }
  
  // Default to gray for invalid ratings
  return '#999999';
}
