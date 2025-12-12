import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAdapter } from './types';
import { UserProfile, Trip, LocationPoint, RatedFeature } from '../types';

const STORAGE_KEYS = {
  PROFILE: '@rolltracks:profile',
  TRIPS: '@rolltracks:trips',
  ACTIVE_TRIP: '@rolltracks:active_trip',
  GPS_POINTS: '@rolltracks:gps_points', // Temporary storage during active trip
  RATED_FEATURES: '@rolltracks:rated_features', // Rated accessibility features
} as const;

export class LocalStorageAdapter implements StorageAdapter {
  // Profile operations
  async getProfile(): Promise<UserProfile | null> {
    try {
      const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!profileJson) {
        return null;
      }
      return JSON.parse(profileJson) as UserProfile;
    } catch (error) {
      console.error('Error getting profile from local storage:', error);
      throw error;
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      const profileJson = JSON.stringify(profile);
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, profileJson);
    } catch (error) {
      console.error('Error saving profile to local storage:', error);
      throw error;
    }
  }

  async updateProfile(id: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const existingProfile = await this.getProfile();
      if (!existingProfile || existingProfile.id !== id) {
        throw new Error(`Profile with id ${id} not found`);
      }

      const updatedProfile: UserProfile = {
        ...existingProfile,
        ...updates,
        id: existingProfile.id, // Ensure id doesn't change
        updated_at: new Date().toISOString(),
      };

      await this.saveProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating profile in local storage:', error);
      throw error;
    }
  }

  // Trip operations
  async getTrips(): Promise<Trip[]> {
    try {
      const tripsJson = await AsyncStorage.getItem(STORAGE_KEYS.TRIPS);
      if (!tripsJson) {
        return [];
      }
      return JSON.parse(tripsJson) as Trip[];
    } catch (error) {
      console.error('Error getting trips from local storage:', error);
      throw error;
    }
  }

  async getTrip(id: string): Promise<Trip | null> {
    try {
      const trips = await this.getTrips();
      const trip = trips.find(t => t.id === id);
      return trip || null;
    } catch (error) {
      console.error('Error getting trip from local storage:', error);
      throw error;
    }
  }

  async saveTrip(trip: Trip): Promise<void> {
    try {
      const trips = await this.getTrips();
      
      // Check if trip already exists
      const existingIndex = trips.findIndex(t => t.id === trip.id);
      
      // Mark trip as needing sync (synced_at will be null or undefined)
      const tripToSave = {
        ...trip,
        updated_at: new Date().toISOString(),
      };
      
      if (existingIndex >= 0) {
        // Update existing trip
        trips[existingIndex] = tripToSave;
      } else {
        // Add new trip
        trips.push(tripToSave);
      }

      const tripsJson = JSON.stringify(trips);
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, tripsJson);
    } catch (error) {
      console.error('Error saving trip to local storage:', error);
      throw error;
    }
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    try {
      const trips = await this.getTrips();
      const tripIndex = trips.findIndex(t => t.id === id);

      if (tripIndex === -1) {
        throw new Error(`Trip with id ${id} not found`);
      }

      const updatedTrip: Trip = {
        ...trips[tripIndex],
        ...updates,
        id: trips[tripIndex].id, // Ensure id doesn't change
        updated_at: new Date().toISOString(),
      };

      trips[tripIndex] = updatedTrip;

      const tripsJson = JSON.stringify(trips);
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, tripsJson);
    } catch (error) {
      console.error('Error updating trip in local storage:', error);
      throw error;
    }
  }

  async deleteTrip(id: string): Promise<void> {
    try {
      const trips = await this.getTrips();
      const filteredTrips = trips.filter(t => t.id !== id);

      const tripsJson = JSON.stringify(filteredTrips);
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, tripsJson);
    } catch (error) {
      console.error('Error deleting trip from local storage:', error);
      throw error;
    }
  }

  // GPS points operations (temporary storage during active trip)
  async getGPSPoints(): Promise<LocationPoint[]> {
    try {
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.GPS_POINTS);
      if (!pointsJson) {
        return [];
      }
      return JSON.parse(pointsJson) as LocationPoint[];
    } catch (error) {
      console.error('Error getting GPS points from local storage:', error);
      throw error;
    }
  }

  async saveGPSPoints(points: LocationPoint[]): Promise<void> {
    try {
      const pointsJson = JSON.stringify(points);
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_POINTS, pointsJson);
    } catch (error) {
      console.error('Error saving GPS points to local storage:', error);
      throw error;
    }
  }

  async appendGPSPoint(point: LocationPoint): Promise<void> {
    try {
      const points = await this.getGPSPoints();
      points.push(point);
      await this.saveGPSPoints(points);
    } catch (error) {
      console.error('Error appending GPS point to local storage:', error);
      throw error;
    }
  }

  async clearGPSPoints(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.GPS_POINTS);
    } catch (error) {
      console.error('Error clearing GPS points from local storage:', error);
      throw error;
    }
  }

  // Rated features operations
  async getRatedFeatures(): Promise<RatedFeature[]> {
    try {
      const featuresJson = await AsyncStorage.getItem(STORAGE_KEYS.RATED_FEATURES);
      if (!featuresJson) {
        return [];
      }
      return JSON.parse(featuresJson) as RatedFeature[];
    } catch (error) {
      console.error('Error getting rated features from local storage:', error);
      // Return empty array on parsing errors to prevent app crashes
      return [];
    }
  }

  async saveRatedFeature(feature: RatedFeature): Promise<void> {
    try {
      const features = await this.getRatedFeatures();
      
      // Check if feature already exists for this trip
      const existingIndex = features.findIndex(
        f => f.id === feature.id && f.tripId === feature.tripId
      );
      
      if (existingIndex >= 0) {
        // Update existing feature
        features[existingIndex] = feature;
      } else {
        // Add new feature
        features.push(feature);
      }

      const featuresJson = JSON.stringify(features);
      await AsyncStorage.setItem(STORAGE_KEYS.RATED_FEATURES, featuresJson);
    } catch (error) {
      console.error('Error saving rated feature to local storage:', error);
      throw error;
    }
  }

  async getRatedFeaturesForTrip(tripId: string): Promise<RatedFeature[]> {
    try {
      const features = await this.getRatedFeatures();
      return features.filter(f => f.tripId === tripId);
    } catch (error) {
      console.error('Error getting rated features for trip from local storage:', error);
      return [];
    }
  }

  async updateRatedFeature(
    featureId: string,
    tripId: string,
    updates: Partial<RatedFeature>
  ): Promise<void> {
    try {
      const features = await this.getRatedFeatures();
      const featureIndex = features.findIndex(
        f => f.id === featureId && f.tripId === tripId
      );

      if (featureIndex === -1) {
        throw new Error(`Rated feature with id ${featureId} and tripId ${tripId} not found`);
      }

      // Update feature while preserving timestamp
      const updatedFeature: RatedFeature = {
        ...features[featureIndex],
        ...updates,
        id: features[featureIndex].id, // Ensure id doesn't change
        tripId: features[featureIndex].tripId, // Ensure tripId doesn't change
        timestamp: features[featureIndex].timestamp, // Preserve original timestamp
      };

      features[featureIndex] = updatedFeature;

      const featuresJson = JSON.stringify(features);
      await AsyncStorage.setItem(STORAGE_KEYS.RATED_FEATURES, featuresJson);
    } catch (error) {
      console.error('Error updating rated feature in local storage:', error);
      throw error;
    }
  }

  // Sync status tracking methods
  async markTripAsSynced(tripId: string): Promise<void> {
    try {
      const trips = await this.getTrips();
      const tripIndex = trips.findIndex(t => t.id === tripId);

      if (tripIndex !== -1) {
        trips[tripIndex] = {
          ...trips[tripIndex],
          // synced_at: new Date().toISOString(), // Note: synced_at not in current Trip type
        };

        const tripsJson = JSON.stringify(trips);
        await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, tripsJson);
      }
    } catch (error) {
      console.error('Error marking trip as synced:', error);
      throw error;
    }
  }

  async getUnsyncedTrips(): Promise<Trip[]> {
    try {
      const trips = await this.getTrips();
      // Filter trips that haven't been synced yet
      // Note: synced_at field not in current Trip type, so this returns all trips for now
      return trips;
    } catch (error) {
      console.error('Error getting unsynced trips:', error);
      return [];
    }
  }
}
