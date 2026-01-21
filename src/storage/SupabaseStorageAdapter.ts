import { supabase } from '../utils/supabase';
import { StorageAdapter } from './types';
import { UserProfile, Trip, LocationPoint, RatedFeature } from '../types';

export class SupabaseStorageAdapter implements StorageAdapter {
  // Profile operations
  // Note: Profiles are now part of user_accounts table
  async getProfile(): Promise<UserProfile | null> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      // Get current user from AsyncStorage
      const userJson = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('@rolltracks:user'));
      if (!userJson) {
        return null;
      }
      const user = JSON.parse(userJson);

      const { data, error } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return this.mapProfileFromDb(data);
    } catch (error) {
      console.error('Error getting profile from Supabase:', error);
      throw error;
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      // Get current user from AsyncStorage
      const userJson = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('@rolltracks:user'));
      if (!userJson) {
        throw new Error('No user logged in');
      }
      const user = JSON.parse(userJson);

      const { error } = await supabase
        .from('user_accounts')
        .update({
          age: profile.age,
          mode_list: profile.mode_list,
          trip_history_ids: profile.trip_history_ids,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving profile to Supabase:', error);
      throw error;
    }
  }

  async updateProfile(id: string, updates: Partial<UserProfile>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (updates.age !== undefined) updateData.age = updates.age;
      if (updates.mode_list !== undefined) updateData.mode_list = updates.mode_list;
      if (updates.trip_history_ids !== undefined) updateData.trip_history_ids = updates.trip_history_ids;

      const { error } = await supabase
        .from('user_accounts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating profile in Supabase:', error);
      throw error;
    }
  }

  // Trip operations
  async getTrips(): Promise<Trip[]> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(trip => this.mapTripFromDb(trip));
    } catch (error) {
      console.error('Error getting trips from Supabase:', error);
      throw error;
    }
  }

  async getTrip(id: string): Promise<Trip | null> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return this.mapTripFromDb(data);
    } catch (error) {
      console.error('Error getting trip from Supabase:', error);
      throw error;
    }
  }

  async saveTrip(trip: Trip): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const dbTrip = this.mapTripToDb(trip);
      const { error } = await supabase
        .from('trips')
        .upsert(dbTrip);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving trip to Supabase:', error);
      throw error;
    }
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const dbUpdates = this.mapTripToDb(updates as Trip);
      const { error } = await supabase
        .from('trips')
        .update({
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating trip in Supabase:', error);
      throw error;
    }
  }

  async deleteTrip(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting trip from Supabase:', error);
      throw error;
    }
  }

  // GPS points operations (not stored in cloud, only local)
  async getGPSPoints(): Promise<LocationPoint[]> {
    // GPS points are only stored locally during active trip
    return [];
  }

  async saveGPSPoints(points: LocationPoint[]): Promise<void> {
    // GPS points are only stored locally during active trip
    // They are encoded into geometry field when trip is completed
  }

  async appendGPSPoint(point: LocationPoint): Promise<void> {
    // GPS points are only stored locally during active trip
  }

  async clearGPSPoints(): Promise<void> {
    // GPS points are only stored locally during active trip
  }

  // Rated features operations
  async getRatedFeatures(): Promise<RatedFeature[]> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { data, error } = await supabase
        .from('rated_features')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(feature => this.mapRatedFeatureFromDb(feature));
    } catch (error) {
      console.error('Error getting rated features from Supabase:', error);
      throw error;
    }
  }

  async saveRatedFeature(feature: RatedFeature): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const dbFeature = this.mapRatedFeatureToDb(feature);
      const { error } = await supabase
        .from('rated_features')
        .upsert(dbFeature);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving rated feature to Supabase:', error);
      throw error;
    }
  }

  async getRatedFeaturesForTrip(tripId: string): Promise<RatedFeature[]> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { data, error } = await supabase
        .from('rated_features')
        .select('*')
        .eq('trip_id', tripId);

      if (error) throw error;

      return (data || []).map(item => this.mapRatedFeatureFromDb(item));
    } catch (error) {
      console.error('Error getting rated features for trip from Supabase:', error);
      throw error;
    }
  }

  async updateRatedFeature(
    featureId: string,
    tripId: string,
    updates: Partial<RatedFeature>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const updateData: any = {};
      
      if (updates.userRating !== undefined) {
        updateData.user_rating = updates.userRating;
      }
      if (updates.properties !== undefined) {
        updateData.properties = updates.properties;
      }
      if (updates.timestamp !== undefined) {
        updateData.timestamp = updates.timestamp;
      }

      const { error } = await supabase
        .from('rated_features')
        .update(updateData)
        .eq('feature_id', featureId)
        .eq('trip_id', tripId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating rated feature in Supabase:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE MAPPING METHODS
  // ============================================================================

  private mapProfileFromDb(data: any): UserProfile {
    return {
      id: data.id,
      user_id: data.user_id,
      age: data.age,
      mode_list: data.mode_list || [],
      trip_history_ids: data.trip_history_ids || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  private mapProfileToDb(profile: UserProfile): any {
    return {
      id: profile.id,
      user_id: profile.user_id,
      age: profile.age,
      mode_list: profile.mode_list,
      trip_history_ids: profile.trip_history_ids || [],
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  private mapTripFromDb(data: any): Trip {
    return {
      id: data.id,
      user_id: data.user_id,
      mode: data.mode,
      boldness: data.boldness,
      purpose: data.purpose,
      start_time: data.start_time,
      end_time: data.end_time,
      duration_seconds: data.duration_seconds,
      distance_miles: data.distance_miles ? parseFloat(data.distance_miles) : null,
      geometry: data.geometry,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  private mapTripToDb(trip: Trip): any {
    return {
      id: trip.id,
      user_id: trip.user_id,
      mode: trip.mode,
      boldness: trip.boldness,
      purpose: trip.purpose,
      start_time: trip.start_time,
      end_time: trip.end_time,
      duration_seconds: trip.duration_seconds,
      distance_miles: trip.distance_miles,
      geometry: trip.geometry,
      status: trip.status,
      created_at: trip.created_at,
      updated_at: trip.updated_at,
    };
  }

  private mapRatedFeatureFromDb(data: any): RatedFeature {
    return {
      id: data.feature_id, // Use feature_id as id for consistency with local storage
      tripId: data.trip_id,
      userRating: data.user_rating,
      timestamp: data.timestamp,
      geometry: {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
      },
      properties: data.properties || {},
    };
  }

  private mapRatedFeatureToDb(feature: RatedFeature): any {
    return {
      feature_id: feature.id,
      trip_id: feature.tripId,
      user_rating: feature.userRating,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      properties: feature.properties,
      timestamp: feature.timestamp,
    };
  }
}
