import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { RatedFeature, ObstacleFeature } from '../types';

const ERROR_MESSAGES = {
  INVALID_RATING: 'Rating must be between 1 and 10',
  NO_ACTIVE_TRIP: 'Cannot rate feature without an active trip',
  INVALID_FEATURE: 'Feature data is invalid or incomplete',
  STORAGE_WRITE_FAILED: 'Failed to save rating. Please try again.',
  STORAGE_READ_FAILED: 'Failed to load ratings',
  FEATURE_NOT_FOUND: 'Rated feature not found',
};

/**
 * Service for managing accessibility ratings of obstacle features.
 * Provides methods for creating, updating, and retrieving rated features.
 */
export class RatingService {
  private storageAdapter: LocalStorageAdapter;

  constructor(storageAdapter: LocalStorageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  /**
   * Create a new rating for an obstacle feature
   * @param feature - The obstacle feature to rate
   * @param tripId - The ID of the trip during which the rating is created
   * @param rating - The accessibility rating (1-10)
   * @returns The created RatedFeature
   * @throws Error if validation fails or storage operation fails
   */
  async createRating(
    feature: ObstacleFeature,
    tripId: string,
    rating: number
  ): Promise<RatedFeature> {
    try {
      // Validate rating is between 1-10
      if (rating < 1 || rating > 10) {
        throw new Error(ERROR_MESSAGES.INVALID_RATING);
      }

      // Validate feature has required properties
      if (!feature.id || typeof feature.latitude !== 'number' || typeof feature.longitude !== 'number') {
        throw new Error(ERROR_MESSAGES.INVALID_FEATURE);
      }

      // Validate tripId is provided
      if (!tripId) {
        throw new Error(ERROR_MESSAGES.NO_ACTIVE_TRIP);
      }

      // Create RatedFeature object with all properties
      const ratedFeature: RatedFeature = {
        id: feature.id,
        tripId: tripId,
        userRating: rating,
        timestamp: new Date().toISOString(),
        geometry: {
          type: 'Point',
          coordinates: [feature.longitude, feature.latitude], // GeoJSON format: [lon, lat]
        },
        properties: { ...feature.attributes }, // Copy all original properties
      };

      // Save to storage
      await this.storageAdapter.saveRatedFeature(ratedFeature);

      return ratedFeature;
    } catch (error: any) {
      if (error.message && Object.values(ERROR_MESSAGES).includes(error.message)) {
        throw error;
      }
      console.error('Error creating rating:', error);
      throw new Error(ERROR_MESSAGES.STORAGE_WRITE_FAILED);
    }
  }

  /**
   * Get all ratings for a specific trip
   * @param tripId - The ID of the trip
   * @returns Array of rated features for the trip
   */
  async getRatingsForTrip(tripId: string): Promise<RatedFeature[]> {
    try {
      return await this.storageAdapter.getRatedFeaturesForTrip(tripId);
    } catch (error) {
      console.error('Error getting ratings for trip:', error);
      throw new Error(ERROR_MESSAGES.STORAGE_READ_FAILED);
    }
  }

  /**
   * Get rating for a specific feature in a trip
   * @param featureId - The ID of the feature
   * @param tripId - The ID of the trip
   * @returns The rated feature if found, null otherwise
   */
  async getRatingForFeature(
    featureId: string,
    tripId: string
  ): Promise<RatedFeature | null> {
    try {
      const ratings = await this.getRatingsForTrip(tripId);
      const rating = ratings.find(r => r.id === featureId);
      return rating || null;
    } catch (error) {
      console.error('Error getting rating for feature:', error);
      return null;
    }
  }

  /**
   * Update an existing rating
   * @param featureId - The ID of the feature
   * @param tripId - The ID of the trip
   * @param rating - The new accessibility rating (1-10)
   * @returns The updated RatedFeature
   * @throws Error if validation fails or feature not found
   */
  async updateRating(
    featureId: string,
    tripId: string,
    rating: number
  ): Promise<RatedFeature> {
    try {
      // Validate rating is between 1-10
      if (rating < 1 || rating > 10) {
        throw new Error(ERROR_MESSAGES.INVALID_RATING);
      }

      // Update the feature (timestamp is preserved by updateRatedFeature)
      await this.storageAdapter.updateRatedFeature(featureId, tripId, {
        userRating: rating,
      });

      // Retrieve and return the updated feature
      const updatedFeature = await this.getRatingForFeature(featureId, tripId);
      if (!updatedFeature) {
        throw new Error(ERROR_MESSAGES.FEATURE_NOT_FOUND);
      }

      return updatedFeature;
    } catch (error: any) {
      if (error.message && Object.values(ERROR_MESSAGES).includes(error.message)) {
        throw error;
      }
      console.error('Error updating rating:', error);
      throw new Error(ERROR_MESSAGES.STORAGE_WRITE_FAILED);
    }
  }

  /**
   * Get all ratings across all trips
   * @returns Array of all rated features
   */
  async getAllRatings(): Promise<RatedFeature[]> {
    try {
      return await this.storageAdapter.getRatedFeatures();
    } catch (error) {
      console.error('Error getting all ratings:', error);
      throw new Error(ERROR_MESSAGES.STORAGE_READ_FAILED);
    }
  }

  /**
   * Export all ratings as GeoJSON FeatureCollection
   * @returns JSON string of GeoJSON FeatureCollection
   */
  async exportAsGeoJSON(): Promise<string> {
    try {
      const ratings = await this.getAllRatings();
      
      // Format as GeoJSON FeatureCollection
      const geojson = {
        type: 'FeatureCollection',
        features: ratings.map(rating => ({
          type: 'Feature',
          id: rating.id,
          geometry: rating.geometry,
          properties: {
            ...rating.properties,
            userRating: rating.userRating,
            tripId: rating.tripId,
            timestamp: rating.timestamp,
          },
        })),
      };

      return JSON.stringify(geojson, null, 2);
    } catch (error) {
      console.error('Error exporting ratings as GeoJSON:', error);
      throw new Error('Failed to export ratings');
    }
  }
}
