// Storage adapter interface types
import { UserProfile, Trip, LocationPoint, RatedFeature } from '../types';

export interface StorageAdapter {
  // Profile operations
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
  updateProfile(id: string, updates: Partial<UserProfile>): Promise<void>;

  // Trip operations
  getTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | null>;
  saveTrip(trip: Trip): Promise<void>;
  updateTrip(id: string, updates: Partial<Trip>): Promise<void>;
  deleteTrip(id: string): Promise<void>;

  // GPS points operations (temporary storage during active trip)
  getGPSPoints(): Promise<LocationPoint[]>;
  saveGPSPoints(points: LocationPoint[]): Promise<void>;
  appendGPSPoint(point: LocationPoint): Promise<void>;
  clearGPSPoints(): Promise<void>;

  // Rated features operations
  getRatedFeatures(): Promise<RatedFeature[]>;
  saveRatedFeature(feature: RatedFeature): Promise<void>;
  getRatedFeaturesForTrip(tripId: string): Promise<RatedFeature[]>;
  updateRatedFeature(featureId: string, tripId: string, updates: Partial<RatedFeature>): Promise<void>;

  // Sync operations (only available in HybridStorageAdapter)
  fetchUserDataFromServer?(userId: string): Promise<{ success: boolean; error?: string }>;
}
