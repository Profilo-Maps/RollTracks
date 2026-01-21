import { StorageAdapter } from './types';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { SupabaseStorageAdapter } from './SupabaseStorageAdapter';
import { SyncService } from '../services/SyncService';
import { UserProfile, Trip, LocationPoint, RatedFeature } from '../types';
import { syncEvents } from '../utils/syncEvents';

/**
 * HybridStorageAdapter coordinates between local and cloud storage
 * Strategy: Write to local first, then queue for cloud sync
 * Read from local primarily (offline-first)
 */
export class HybridStorageAdapter implements StorageAdapter {
  private localAdapter: LocalStorageAdapter;
  private cloudAdapter: SupabaseStorageAdapter;
  private syncService: SyncService;

  constructor(syncService: SyncService) {
    this.localAdapter = new LocalStorageAdapter();
    this.cloudAdapter = new SupabaseStorageAdapter();
    this.syncService = syncService;
  }

  // ============================================================================
  // PROFILE OPERATIONS
  // ============================================================================

  async getProfile(): Promise<UserProfile | null> {
    // Always read from local storage (offline-first)
    return await this.localAdapter.getProfile();
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    // Write to local storage first
    await this.localAdapter.saveProfile(profile);

    // Always queue for cloud sync in cloud mode
    await this.syncService.queueForSync({
      type: 'profile',
      operation: 'insert',
      data: profile,
      timestamp: Date.now(),
    }, profile.user_id);
  }

  async updateProfile(id: string, updates: Partial<UserProfile>): Promise<void> {
    // Update local storage first
    await this.localAdapter.updateProfile(id, updates);

    // Get updated profile for sync
    const updatedProfile = await this.localAdapter.getProfile();
    if (updatedProfile) {
      // Always queue for cloud sync in cloud mode
      await this.syncService.queueForSync({
        type: 'profile',
        operation: 'update',
        data: updatedProfile,
        timestamp: Date.now(),
      }, updatedProfile.user_id);
    }
  }

  // ============================================================================
  // TRIP OPERATIONS
  // ============================================================================

  async getTrips(): Promise<Trip[]> {
    // Always read from local storage (offline-first)
    return await this.localAdapter.getTrips();
  }

  async getTrip(id: string): Promise<Trip | null> {
    // Always read from local storage (offline-first)
    return await this.localAdapter.getTrip(id);
  }

  async saveTrip(trip: Trip): Promise<void> {
    // Write to local storage first
    await this.localAdapter.saveTrip(trip);

    // Always queue for cloud sync in cloud mode
    // Use 'insert' operation, but the sync service will handle duplicates gracefully
    await this.syncService.queueForSync({
      type: 'trip',
      operation: 'insert',
      data: trip,
      timestamp: Date.now(),
    }, trip.user_id);
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    // Update local storage first
    await this.localAdapter.updateTrip(id, updates);

    // Get updated trip for sync
    const updatedTrip = await this.localAdapter.getTrip(id);
    if (updatedTrip) {
      // Always queue for cloud sync in cloud mode
      // Use 'insert' operation since the sync service will handle it as upsert
      await this.syncService.queueForSync({
        type: 'trip',
        operation: 'insert',
        data: updatedTrip,
        timestamp: Date.now(),
      }, updatedTrip.user_id);

      // If trip is completed, trigger immediate sync
      if (updatedTrip.status === 'completed') {
        console.log('🚀 Trip completed, triggering immediate sync');
        this.syncService.syncNow().then(result => {
          if (result.success && result.itemsSynced > 0) {
            console.log(`✅ Trip uploaded successfully (${result.itemsSynced} items synced)`);
            syncEvents.emit('success', 'Trip uploaded successfully');
          } else if (result.itemsFailed > 0) {
            console.log(`❌ Trip upload failed (${result.itemsFailed} items failed), will retry in 5 minutes`);
            syncEvents.emit('error', 'Trip upload failed, retrying in 5 min');
          }
        }).catch(error => {
          console.error('❌ Immediate sync after trip completion failed:', error);
          syncEvents.emit('error', 'Trip upload failed, will retry soon');
        });
      }
    }
  }

  async deleteTrip(id: string): Promise<void> {
    // Get the trip first to get the user_id
    const trip = await this.localAdapter.getTrip(id);
    
    // Delete from local storage first
    await this.localAdapter.deleteTrip(id);

    // Always queue for cloud sync in cloud mode
    if (trip) {
      await this.syncService.queueForSync({
        type: 'trip',
        operation: 'delete',
        data: { id },
        timestamp: Date.now(),
      }, trip.user_id);
    }
  }

  // ============================================================================
  // GPS POINTS OPERATIONS (Local only during active trip)
  // ============================================================================

  async getGPSPoints(): Promise<LocationPoint[]> {
    // GPS points are only stored locally during active trip
    return await this.localAdapter.getGPSPoints();
  }

  async saveGPSPoints(points: LocationPoint[]): Promise<void> {
    // GPS points are only stored locally during active trip
    await this.localAdapter.saveGPSPoints(points);
  }

  async appendGPSPoint(point: LocationPoint): Promise<void> {
    // GPS points are only stored locally during active trip
    await this.localAdapter.appendGPSPoint(point);
  }

  async clearGPSPoints(): Promise<void> {
    // GPS points are only stored locally during active trip
    await this.localAdapter.clearGPSPoints();
  }

  // ============================================================================
  // RATED FEATURES OPERATIONS
  // ============================================================================

  async getRatedFeatures(): Promise<RatedFeature[]> {
    // Always read from local storage (offline-first)
    return await this.localAdapter.getRatedFeatures();
  }

  async saveRatedFeature(feature: RatedFeature): Promise<void> {
    // Write to local storage first
    await this.localAdapter.saveRatedFeature(feature);

    // Get the associated trip to get the user_id
    const trip = await this.localAdapter.getTrip(feature.tripId);
    
    // Always queue for cloud sync in cloud mode
    if (trip) {
      await this.syncService.queueForSync({
        type: 'rated_feature',
        operation: 'insert',
        data: feature,
        timestamp: Date.now(),
      }, trip.user_id);

      // Trigger immediate sync for rated features (they're created during/after trips)
      console.log('Rated feature saved, triggering immediate sync');
      this.syncService.syncNow().catch(error => {
        console.error('Immediate sync after rated feature save failed:', error);
      });
    }
  }

  async getRatedFeaturesForTrip(tripId: string): Promise<RatedFeature[]> {
    // Always read from local storage (offline-first)
    return await this.localAdapter.getRatedFeaturesForTrip(tripId);
  }

  async updateRatedFeature(
    featureId: string,
    tripId: string,
    updates: Partial<RatedFeature>
  ): Promise<void> {
    // Update local storage first
    await this.localAdapter.updateRatedFeature(featureId, tripId, updates);

    // Get updated feature for sync
    const features = await this.localAdapter.getRatedFeaturesForTrip(tripId);
    const updatedFeature = features.find(f => f.id === featureId);

    if (updatedFeature) {
      // Get the associated trip to get the user_id
      const trip = await this.localAdapter.getTrip(tripId);
      
      // Always queue for cloud sync in cloud mode
      if (trip) {
        await this.syncService.queueForSync({
          type: 'rated_feature',
          operation: 'update',
          data: updatedFeature,
          timestamp: Date.now(),
        }, trip.user_id);
      }
    }
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  /**
   * Fetch user's data from server and merge with local storage
   * @param userId - The user ID to fetch data for
   * @returns Promise with success status and optional error message
   */
  async fetchUserDataFromServer(userId: string): Promise<{ success: boolean; error?: string }> {
    return await this.syncService.fetchUserDataFromServer(userId);
  }
}
