import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { SyncService } from '../services/SyncService';

const MIGRATION_KEY = '@rolltracks:cloud_migration_complete';

/**
 * Check if cloud migration is needed
 * @returns true if migration is needed, false otherwise
 */
export async function needsCloudMigration(): Promise<boolean> {
  try {
    const migrationComplete = await AsyncStorage.getItem(MIGRATION_KEY);
    return migrationComplete !== 'true';
  } catch (error) {
    console.error('Error checking cloud migration status:', error);
    return false;
  }
}

/**
 * Migrate existing local data to cloud
 * This should be called after first login when Supabase integration is enabled
 * @param syncService - SyncService instance
 */
export async function migrateLocalDataToCloud(syncService: SyncService): Promise<void> {
  try {
    console.log('Starting cloud migration...');

    const storageAdapter = new LocalStorageAdapter();

    // Get all local data
    const profile = await storageAdapter.getProfile();
    const trips = await storageAdapter.getTrips();
    const ratedFeatures = await storageAdapter.getRatedFeatures();

    console.log(`Found ${trips.length} trips and ${ratedFeatures.length} rated features to migrate`);

    // Queue profile for sync
    if (profile) {
      await syncService.queueForSync({
        type: 'profile',
        operation: 'insert',
        data: profile,
        timestamp: Date.now(),
      });
      console.log('Profile queued for sync');
    }

    // Queue all trips for sync
    for (const trip of trips) {
      await syncService.queueForSync({
        type: 'trip',
        operation: 'insert',
        data: trip,
        timestamp: Date.now(),
      });
    }
    console.log(`${trips.length} trips queued for sync`);

    // Queue all rated features for sync
    for (const feature of ratedFeatures) {
      await syncService.queueForSync({
        type: 'rated_feature',
        operation: 'insert',
        data: feature,
        timestamp: Date.now(),
      });
    }
    console.log(`${ratedFeatures.length} rated features queued for sync`);

    // Trigger sync immediately
    console.log('Triggering immediate sync...');
    const result = await syncService.syncNow();

    if (result.success) {
      console.log(`Cloud migration successful: ${result.itemsSynced} items synced`);
      // Mark migration as complete
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    } else {
      console.log(`Cloud migration partially complete: ${result.itemsSynced} synced, ${result.itemsFailed} failed`);
      // Don't mark as complete if there were failures - will retry on next sync
    }
  } catch (error) {
    console.error('Error during cloud migration:', error);
    throw error;
  }
}

/**
 * Reset migration status (for testing)
 */
export async function resetCloudMigration(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_KEY);
  console.log('Cloud migration status reset');
}
