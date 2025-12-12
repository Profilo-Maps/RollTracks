import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, Trip, Mode } from '../types';
import { GPSService } from '../services/GPSService';

const OLD_STORAGE_KEYS = {
  PROFILE: '@mobility_tracker:profile',
  TRIPS: '@mobility_tracker:trips',
};

const NEW_STORAGE_KEYS = {
  PROFILE: '@rolltracks:profile',
  TRIPS: '@rolltracks:trips',
};

/**
 * Migrate data from old MobilityTripTracker format to new RollTracks format
 */
export async function migrateData(): Promise<void> {
  try {
    console.log('Starting data migration...');

    // Check if migration is needed
    const oldProfile = await AsyncStorage.getItem(OLD_STORAGE_KEYS.PROFILE);
    const newProfile = await AsyncStorage.getItem(NEW_STORAGE_KEYS.PROFILE);

    // If new profile exists, migration already done
    if (newProfile) {
      console.log('Migration already completed');
      return;
    }

    // If no old profile, nothing to migrate
    if (!oldProfile) {
      console.log('No old data to migrate');
      return;
    }

    // Migrate profile
    await migrateProfile();

    // Migrate trips
    await migrateTrips();

    console.log('Data migration completed successfully');
  } catch (error) {
    console.error('Error during data migration:', error);
    throw error;
  }
}

/**
 * Migrate profile from old format to new format
 */
async function migrateProfile(): Promise<void> {
  try {
    const oldProfileJson = await AsyncStorage.getItem(OLD_STORAGE_KEYS.PROFILE);
    if (!oldProfileJson) {
      return;
    }

    const oldProfile = JSON.parse(oldProfileJson);

    // Convert vehicle_type to mode_list
    let modeList: Mode[] = [];
    if (oldProfile.vehicle_type) {
      // Map old vehicle_type to new mode
      const vehicleTypeToMode: Record<string, Mode> = {
        wheelchair: 'wheelchair',
        'assisted walking': 'assisted_walking',
        skateboard: 'skateboard',
        scooter: 'scooter',
        walking: 'walking',
      };

      const mode = vehicleTypeToMode[oldProfile.vehicle_type.toLowerCase()];
      if (mode) {
        modeList = [mode];
      } else {
        // Default to walking if unknown
        modeList = ['walking'];
      }
    } else {
      // Default to walking if no vehicle_type
      modeList = ['walking'];
    }

    const newProfile: UserProfile = {
      id: oldProfile.id || `profile_${Date.now()}`,
      user_id: oldProfile.user_id,
      age: oldProfile.age || 25,
      mode_list: modeList,
      trip_history_ids: oldProfile.trip_history_ids || [],
      created_at: oldProfile.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(NEW_STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    console.log('Profile migrated successfully');
  } catch (error) {
    console.error('Error migrating profile:', error);
    throw error;
  }
}

/**
 * Migrate trips from old format to new format
 */
async function migrateTrips(): Promise<void> {
  try {
    const oldTripsJson = await AsyncStorage.getItem(OLD_STORAGE_KEYS.TRIPS);
    if (!oldTripsJson) {
      return;
    }

    const oldTrips = JSON.parse(oldTripsJson);
    const gpsService = new GPSService();

    const newTrips: Trip[] = oldTrips.map((oldTrip: any) => {
      // Add default boldness (5) if not present
      const boldness = oldTrip.boldness || 5;

      // Calculate distance if geometry exists but distance doesn't
      let distanceMiles = oldTrip.distance_miles;
      if (!distanceMiles && oldTrip.geometry) {
        try {
          const points = gpsService.decodePolyline(oldTrip.geometry);
          distanceMiles = gpsService.calculateDistance(points);
        } catch (error) {
          console.warn('Failed to calculate distance for trip:', oldTrip.id, error);
          distanceMiles = null;
        }
      }

      // Determine mode from vehicle_type or default to walking
      let mode: Mode = 'walking';
      if (oldTrip.vehicle_type) {
        const vehicleTypeToMode: Record<string, Mode> = {
          wheelchair: 'wheelchair',
          'assisted walking': 'assisted_walking',
          skateboard: 'skateboard',
          scooter: 'scooter',
          walking: 'walking',
        };
        mode = vehicleTypeToMode[oldTrip.vehicle_type.toLowerCase()] || 'walking';
      } else if (oldTrip.mode) {
        mode = oldTrip.mode;
      }

      const newTrip: Trip = {
        id: oldTrip.id || `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: oldTrip.user_id,
        mode: mode,
        boldness: boldness,
        purpose: oldTrip.purpose || undefined,
        start_time: oldTrip.start_time,
        end_time: oldTrip.end_time,
        duration_seconds: oldTrip.duration_seconds,
        distance_miles: distanceMiles,
        geometry: oldTrip.geometry,
        status: oldTrip.status || 'completed',
        created_at: oldTrip.created_at || oldTrip.start_time,
        updated_at: new Date().toISOString(),
      };

      return newTrip;
    });

    await AsyncStorage.setItem(NEW_STORAGE_KEYS.TRIPS, JSON.stringify(newTrips));
    console.log(`Migrated ${newTrips.length} trips successfully`);
  } catch (error) {
    console.error('Error migrating trips:', error);
    throw error;
  }
}

/**
 * Check if migration is needed
 */
export async function needsMigration(): Promise<boolean> {
  try {
    const oldProfile = await AsyncStorage.getItem(OLD_STORAGE_KEYS.PROFILE);
    const newProfile = await AsyncStorage.getItem(NEW_STORAGE_KEYS.PROFILE);

    // Migration needed if old profile exists but new profile doesn't
    return oldProfile !== null && newProfile === null;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}
