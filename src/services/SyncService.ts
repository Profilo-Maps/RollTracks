import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../utils/supabase';

const SYNC_QUEUE_KEY = '@rolltracks:sync_queue';
const LAST_SYNC_KEY = '@rolltracks:last_sync';

export interface SyncItem {
  id: string;
  type: 'profile' | 'trip' | 'rated_feature';
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  lastAttempt: number | null;
  error: string | null;
  userId?: string; // User ID for items that need it
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: SyncError[];
}

export interface SyncError {
  itemId: string;
  error: string;
  retryable: boolean;
}

export interface SyncStatus {
  queueLength: number;
  lastSyncTime: number | null;
  isOnline: boolean;
  isSyncing: boolean;
}

export class SyncService {
  private isSyncing: boolean = false;
  private isOnline: boolean = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private maxRetries: number = 3;
  private batchSize: number = 10;
  private periodicSyncInterval: ReturnType<typeof setInterval> | null = null;
  private periodicSyncIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize sync service with network listener and periodic sync
   */
  async initialize(): Promise<void> {
    // Check initial network state
    const netInfoState = await NetInfo.fetch();
    this.isOnline = netInfoState.isConnected ?? false;

    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // Trigger sync when coming online
      if (wasOffline && this.isOnline) {
        console.log('Network connected, triggering sync');
        this.syncNow().catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
    });

    // Start periodic sync (every 5 minutes)
    this.startPeriodicSync();

    console.log('SyncService initialized with periodic sync');
  }

  /**
   * Start periodic sync timer
   */
  private startPeriodicSync(): void {
    if (this.periodicSyncInterval) {
      return; // Already running
    }

    this.periodicSyncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        console.log('Periodic sync triggered');
        this.syncNow().catch(error => {
          console.error('Periodic sync failed:', error);
        });
      }
    }, this.periodicSyncIntervalMs);
  }

  /**
   * Stop periodic sync timer
   */
  private stopPeriodicSync(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
  }

  /**
   * Cleanup sync service
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.stopPeriodicSync();
  }

  /**
   * Manually trigger sync
   */
  async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [{ itemId: 'sync', error: 'Sync already in progress', retryable: true }],
      };
    }

    if (!this.isOnline) {
      console.log('Cannot sync: offline');
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [{ itemId: 'sync', error: 'Device is offline', retryable: true }],
      };
    }

    if (!supabase) {
      console.log('Cannot sync: Supabase not configured');
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [{ itemId: 'sync', error: 'Supabase not configured', retryable: false }],
      };
    }

    this.isSyncing = true;
    const errors: SyncError[] = [];
    let itemsSynced = 0;
    let itemsFailed = 0;

    try {
      const queue = await this.getQueue();
      console.log(`Starting sync: ${queue.length} items in queue`);

      // Process queue in batches
      for (let i = 0; i < queue.length; i += this.batchSize) {
        const batch = queue.slice(i, i + this.batchSize);

        for (const item of batch) {
          try {
            await this.syncItem(item);
            itemsSynced++;
            // Remove from queue on success
            await this.removeFromQueue(item.id);
          } catch (error) {
            itemsFailed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Update retry count
            item.retryCount++;
            item.lastAttempt = Date.now();
            item.error = errorMessage;

            if (item.retryCount >= this.maxRetries) {
              console.error(`Item ${item.id} failed after ${this.maxRetries} retries:`, errorMessage);
              // Log more details for debugging
              console.error('Failed item details:', {
                type: item.type,
                operation: item.operation,
                userId: item.userId,
                dataKeys: Object.keys(item.data || {}),
              });
              errors.push({
                itemId: item.id,
                error: errorMessage,
                retryable: false,
              });
              // Remove from queue after max retries
              await this.removeFromQueue(item.id);
            } else {
              console.log(`Item ${item.id} failed (retry ${item.retryCount}/${this.maxRetries}):`, errorMessage);
              errors.push({
                itemId: item.id,
                error: errorMessage,
                retryable: true,
              });
              // Update item in queue
              await this.updateQueueItem(item);
            }
          }
        }
      }

      // Update last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

      console.log(`Sync complete: ${itemsSynced} synced, ${itemsFailed} failed`);

      return {
        success: itemsFailed === 0,
        itemsSynced,
        itemsFailed,
        errors,
      };
    } catch (error) {
      console.error('Sync error:', error);
      return {
        success: false,
        itemsSynced,
        itemsFailed,
        errors: [
          ...errors,
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
            retryable: true,
          },
        ],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch user's data from server and merge with local storage
   * This should be called when user logs in to get their existing data
   */
  async fetchUserDataFromServer(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isOnline) {
      return { success: false, error: 'Device is offline' };
    }

    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      console.log(`Fetching user data from server for user: ${userId}`);

      // Fetch trips from server
      const { data: serverTrips, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false });

      if (tripsError) {
        console.error('Error fetching trips from server:', tripsError);
        return { success: false, error: `Failed to fetch trips: ${tripsError.message}` };
      }

      // Fetch rated features from server
      const { data: serverRatedFeatures, error: ratingsError } = await supabase
        .from('rated_features')
        .select('*')
        .eq('user_id', userId);

      if (ratingsError) {
        console.error('Error fetching rated features from server:', ratingsError);
        return { success: false, error: `Failed to fetch rated features: ${ratingsError.message}` };
      }

      // Get local storage adapters to merge data
      const localAdapter = await import('../storage/LocalStorageAdapter');
      const adapter = new localAdapter.LocalStorageAdapter();

      // Get existing local trips
      const localTrips = await adapter.getTrips();
      const localTripIds = new Set(localTrips.map(trip => trip.id));

      // Merge server trips with local trips (avoid duplicates)
      let newTripsCount = 0;
      if (serverTrips) {
        for (const serverTrip of serverTrips) {
          if (!localTripIds.has(serverTrip.id)) {
            // Transform server trip format to local format
            const localTrip = {
              id: serverTrip.id,
              user_id: serverTrip.user_id,
              mode: serverTrip.mode,
              boldness: serverTrip.boldness,
              purpose: serverTrip.purpose,
              start_time: serverTrip.start_time,
              end_time: serverTrip.end_time,
              duration_seconds: serverTrip.duration_seconds,
              distance_miles: serverTrip.distance_miles,
              geometry: serverTrip.geometry,
              status: serverTrip.status,
              created_at: serverTrip.created_at,
              updated_at: serverTrip.updated_at,
              synced_at: serverTrip.synced_at,
            };
            await adapter.saveTrip(localTrip);
            newTripsCount++;
          }
        }
      }

      // Get existing local rated features
      const localRatedFeatures = await adapter.getRatedFeatures();
      const localRatedFeatureKeys = new Set(
        localRatedFeatures.map(rf => `${rf.id}_${rf.tripId}`)
      );

      // Merge server rated features with local rated features (avoid duplicates)
      let newRatedFeaturesCount = 0;
      if (serverRatedFeatures) {
        for (const serverRatedFeature of serverRatedFeatures) {
          const key = `${serverRatedFeature.feature_id}_${serverRatedFeature.trip_id}`;
          if (!localRatedFeatureKeys.has(key)) {
            // Transform server rated feature format to local format
            const localRatedFeature = {
              id: serverRatedFeature.feature_id,
              tripId: serverRatedFeature.trip_id,
              userRating: serverRatedFeature.user_rating,
              timestamp: serverRatedFeature.timestamp,
              geometry: {
                type: 'Point' as const,
                coordinates: [serverRatedFeature.longitude, serverRatedFeature.latitude] as [number, number],
              },
              properties: serverRatedFeature.properties || {},
            };
            await adapter.saveRatedFeature(localRatedFeature);
            newRatedFeaturesCount++;
          }
        }
      }

      console.log(`Data fetch complete: ${newTripsCount} new trips, ${newRatedFeaturesCount} new rated features`);

      return { success: true };
    } catch (error) {
      console.error('Error fetching user data from server:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Add item to sync queue
   */
  async queueForSync(item: Omit<SyncItem, 'id' | 'retryCount' | 'lastAttempt' | 'error'>, userId?: string): Promise<void> {
    const queue = await this.getQueue();
    
    // For trips and rated features, check for existing items with same data ID
    if (item.type === 'trip' || item.type === 'rated_feature') {
      const dataId = item.type === 'trip' ? item.data.id : `${item.data.id}_${item.data.tripId}`;
      
      // Remove any existing items for the same data ID to prevent duplicates
      const filteredQueue = queue.filter(existingItem => {
        if (existingItem.type !== item.type) return true;
        
        const existingDataId = existingItem.type === 'trip' 
          ? existingItem.data.id 
          : `${existingItem.data.id}_${existingItem.data.tripId}`;
          
        return existingDataId !== dataId;
      });
      
      // If we removed items, log it
      if (filteredQueue.length < queue.length) {
        console.log(`Removed ${queue.length - filteredQueue.length} duplicate sync items for ${item.type} ${dataId}`);
      }
      
      // Use the filtered queue
      queue.length = 0;
      queue.push(...filteredQueue);
    }

    const syncItem: SyncItem = {
      ...item,
      id: `${item.type}_${item.operation}_${Date.now()}_${Math.random()}`,
      retryCount: 0,
      lastAttempt: null,
      error: null,
      userId: userId || item.userId, // Store userId if provided
    };

    queue.push(syncItem);
    await this.saveQueue(queue);

    console.log(`Queued for sync: ${syncItem.type} ${syncItem.operation}`);

    // Trigger sync if online
    if (this.isOnline && !this.isSyncing) {
      this.syncNow().catch(error => {
        console.error('Auto-sync failed:', error);
      });
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const queue = await this.getQueue();
    const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr, 10) : null;

    return {
      queueLength: queue.length,
      lastSyncTime,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Clear sync queue (for testing and debugging)
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    console.log('Sync queue cleared');
  }

  /**
   * Get current sync queue for debugging
   */
  async getQueueItems(): Promise<SyncItem[]> {
    return await this.getQueue();
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get sync queue from storage
   */
  private async getQueue(): Promise<SyncItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!queueJson) {
        return [];
      }
      return JSON.parse(queueJson);
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveQueue(queue: SyncItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
      throw error;
    }
  }

  /**
   * Remove item from queue
   */
  private async removeFromQueue(itemId: string): Promise<void> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter(item => item.id !== itemId);
    await this.saveQueue(filteredQueue);
  }

  /**
   * Update item in queue
   */
  private async updateQueueItem(updatedItem: SyncItem): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      queue[index] = updatedItem;
      await this.saveQueue(queue);
    }
  }

  /**
   * Sync a single item to Supabase
   */
  private async syncItem(item: SyncItem): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    switch (item.type) {
      case 'profile':
        await this.syncProfile(item);
        break;
      case 'trip':
        await this.syncTrip(item);
        break;
      case 'rated_feature':
        await this.syncRatedFeature(item);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  /**
   * Sync profile to Supabase
   * Note: Profiles are stored in user_accounts table, not a separate profiles table
   */
  private async syncProfile(item: SyncItem): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    // Profiles are stored in user_accounts table
    const table = 'user_accounts';

    switch (item.operation) {
      case 'insert':
      case 'update':
        // For profiles, both insert and update operations should use UPDATE
        // because the user account already exists from authentication
        
        // Get user ID from item (stored when queued), data, or AsyncStorage
        let userId = item.userId || item.data.user_id;
        
        if (!userId) {
          // Try to get from AsyncStorage (where AuthContext stores it)
          const userJson = await AsyncStorage.getItem('@rolltracks:user');
          if (userJson) {
            const user = JSON.parse(userJson);
            userId = user.id;
          }
        }
        
        if (!userId) {
          throw new Error('User ID not available for profile sync');
        }

        // Transform local UserProfile to database format for user_accounts table
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        
        if (item.data.age !== undefined) updateData.age = item.data.age;
        if (item.data.mode_list !== undefined) updateData.mode_list = item.data.mode_list;
        if (item.data.trip_history_ids !== undefined) updateData.trip_history_ids = item.data.trip_history_ids;

        const { error: updateError } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', userId); // Use id (not user_id) for user_accounts table
        
        if (updateError) throw updateError;
        break;

      case 'delete':
        // For profile deletion, we don't actually delete the user account
        // Instead, we clear the profile fields
        let deleteUserId = item.userId || item.data.user_id;
        
        if (!deleteUserId) {
          // Try to get from AsyncStorage (where AuthContext stores it)
          const userJson = await AsyncStorage.getItem('@rolltracks:user');
          if (userJson) {
            const user = JSON.parse(userJson);
            deleteUserId = user.id;
          }
        }
        
        if (!deleteUserId) {
          throw new Error('User ID not available for profile sync');
        }

        const { error: deleteError } = await supabase
          .from(table)
          .update({
            age: null,
            mode_list: null,
            trip_history_ids: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deleteUserId);
        
        if (deleteError) throw deleteError;
        break;
    }
  }

  /**
   * Sync trip to Supabase
   */
  private async syncTrip(item: SyncItem): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const table = 'trips';

    console.log(`Syncing trip ${item.operation}:`, item.data.id);

    switch (item.operation) {
      case 'insert':
        // Get user ID from item (stored when queued), data, or AsyncStorage
        let userId = item.userId || item.data.user_id;
        
        if (!userId) {
          // Try to get from AsyncStorage (where AuthContext stores it)
          const userJson = await AsyncStorage.getItem('@rolltracks:user');
          if (userJson) {
            const user = JSON.parse(userJson);
            userId = user.id;
          }
        }
        
        if (!userId) {
          throw new Error('User ID not available for trip sync');
        }

        // Transform local Trip to database TripInsert format
        const insertData = {
          id: item.data.id,
          user_id: userId,
          mode: item.data.mode,
          boldness: item.data.boldness,
          purpose: item.data.purpose || null,
          start_time: item.data.start_time,
          end_time: item.data.end_time,
          duration_seconds: item.data.duration_seconds,
          distance_miles: item.data.distance_miles,
          geometry: item.data.geometry,
          status: item.data.status,
          created_at: item.data.created_at,
          updated_at: item.data.updated_at,
          synced_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from(table)
          .insert(insertData);
        
        if (insertError) {
          // Handle duplicate key constraint violation
          if (insertError.code === '23505' && insertError.message?.includes('trips_pkey')) {
            console.log(`Trip ${item.data.id} already exists, converting to update operation`);
            
            // Convert to update operation by removing fields that shouldn't be updated
            const updateData: any = {
              synced_at: new Date().toISOString(),
            };
            
            // Only include fields that can be updated
            if (item.data.mode !== undefined) updateData.mode = item.data.mode;
            if (item.data.boldness !== undefined) updateData.boldness = item.data.boldness;
            if (item.data.purpose !== undefined) updateData.purpose = item.data.purpose;
            if (item.data.end_time !== undefined) updateData.end_time = item.data.end_time;
            if (item.data.duration_seconds !== undefined) updateData.duration_seconds = item.data.duration_seconds;
            if (item.data.distance_miles !== undefined) updateData.distance_miles = item.data.distance_miles;
            if (item.data.geometry !== undefined) updateData.geometry = item.data.geometry;
            if (item.data.status !== undefined) updateData.status = item.data.status;
            if (item.data.updated_at !== undefined) updateData.updated_at = item.data.updated_at;

            const { error: updateError } = await supabase
              .from(table)
              .update(updateData)
              .eq('id', item.data.id);
              
            if (updateError) {
              console.error('Trip update after duplicate error:', updateError);
              throw updateError;
            }
            console.log('Trip updated successfully (was duplicate)');
          } else {
            console.error('Trip insert error:', insertError);
            throw insertError;
          }
        } else {
          console.log('Trip inserted successfully');
        }
        break;

      case 'update':
        // Get user ID for the update query
        let updateUserId = item.userId || item.data.user_id;
        
        if (!updateUserId) {
          // Try to get from AsyncStorage (where AuthContext stores it)
          const userJson = await AsyncStorage.getItem('@rolltracks:user');
          if (userJson) {
            const user = JSON.parse(userJson);
            updateUserId = user.id;
          }
        }
        
        if (!updateUserId) {
          throw new Error('User ID not available for trip sync');
        }

        // Transform local Trip to database TripUpdate format
        const updateData: any = {
          synced_at: new Date().toISOString(),
        };
        
        // Only include fields that are defined in the update
        if (item.data.mode !== undefined) updateData.mode = item.data.mode;
        if (item.data.boldness !== undefined) updateData.boldness = item.data.boldness;
        if (item.data.purpose !== undefined) updateData.purpose = item.data.purpose;
        if (item.data.start_time !== undefined) updateData.start_time = item.data.start_time;
        if (item.data.end_time !== undefined) updateData.end_time = item.data.end_time;
        if (item.data.duration_seconds !== undefined) updateData.duration_seconds = item.data.duration_seconds;
        if (item.data.distance_miles !== undefined) updateData.distance_miles = item.data.distance_miles;
        if (item.data.geometry !== undefined) updateData.geometry = item.data.geometry;
        if (item.data.status !== undefined) updateData.status = item.data.status;
        if (item.data.updated_at !== undefined) updateData.updated_at = item.data.updated_at;

        const { error: updateError } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', item.data.id);
        if (updateError) {
          console.error('Trip update error:', updateError);
          throw updateError;
        }
        console.log('Trip updated successfully');
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', item.data.id);
        if (deleteError) {
          console.error('Trip delete error:', deleteError);
          throw deleteError;
        }
        console.log('Trip deleted successfully');
        break;
    }
  }

  /**
   * Sync rated feature to Supabase
   */
  private async syncRatedFeature(item: SyncItem): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const table = 'rated_features';

    switch (item.operation) {
      case 'insert':
        // Get user ID from item (stored when queued), data, or AsyncStorage
        let userId = item.userId || item.data.user_id;
        
        if (!userId) {
          // Try to get from AsyncStorage (where AuthContext stores it)
          const userJson = await AsyncStorage.getItem('@rolltracks:user');
          if (userJson) {
            const user = JSON.parse(userJson);
            userId = user.id;
          }
        }
        
        if (!userId) {
          throw new Error('User ID not available for rated feature sync');
        }

        // Transform local data format to database schema
        const insertData = {
          feature_id: item.data.id, // Original feature ID
          user_id: userId,
          trip_id: item.data.tripId,
          user_rating: item.data.userRating,
          latitude: item.data.geometry.coordinates[1], // GeoJSON is [lon, lat]
          longitude: item.data.geometry.coordinates[0],
          properties: item.data.properties,
          timestamp: item.data.timestamp,
        };

        const { error: insertError } = await supabase
          .from(table)
          .insert(insertData);
        
        if (insertError) {
          // Handle duplicate key constraint violation
          if (insertError.code === '23505') {
            console.log(`Rated feature ${item.data.id} for trip ${item.data.tripId} already exists, converting to update operation`);
            
            // Convert to update operation
            const updateData: any = {};
            if (item.data.userRating !== undefined) {
              updateData.user_rating = item.data.userRating;
            }
            if (item.data.properties !== undefined) {
              updateData.properties = item.data.properties;
            }

            const { error: updateError } = await supabase
              .from(table)
              .update(updateData)
              .eq('feature_id', item.data.id)
              .eq('trip_id', item.data.tripId);
              
            if (updateError) {
              console.error('Rated feature update after duplicate error:', updateError);
              throw updateError;
            }
            console.log('Rated feature updated successfully (was duplicate)');
          } else {
            console.error('Rated feature insert error:', insertError);
            throw insertError;
          }
        } else {
          console.log('Rated feature inserted successfully');
        }
        break;

      case 'update':
        // Transform local data format to database schema
        const updateData: any = {};
        if (item.data.userRating !== undefined) {
          updateData.user_rating = item.data.userRating;
        }
        if (item.data.properties !== undefined) {
          updateData.properties = item.data.properties;
        }

        const { error: updateError } = await supabase
          .from(table)
          .update(updateData)
          .eq('feature_id', item.data.id)
          .eq('trip_id', item.data.tripId);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('feature_id', item.data.id)
          .eq('trip_id', item.data.tripId);
        if (deleteError) throw deleteError;
        break;
    }
  }



  /**
   * Resolve conflicts between local and cloud data
   * Strategy: Local data always takes precedence (last-write-wins based on local timestamp)
   * @param localData - Data from local storage
   * @param cloudData - Data from Supabase
   * @returns The data to keep (always local data in this implementation)
   */
  private resolveConflict(localData: any, cloudData: any): any {
    // Compare timestamps
    const localTimestamp = new Date(localData.updated_at || localData.created_at).getTime();
    const cloudTimestamp = new Date(cloudData.updated_at || cloudData.created_at).getTime();

    // Local data takes precedence if timestamps are equal or local is newer
    if (localTimestamp >= cloudTimestamp) {
      console.log('Conflict resolved: keeping local data (newer or equal timestamp)');
      return localData;
    }

    // This should rarely happen in offline-first architecture
    // but if cloud data is somehow newer, we still keep local data
    // to prevent user's recent changes from being overwritten
    console.log('Conflict resolved: keeping local data (local-first policy)');
    return localData;
  }
}

// TODO: Implement data retention policy
// Location: src/services/SyncService.ts
// Requirements:
// - Automatically delete cloud data older than configurable threshold (e.g., 2 years)
// - Preserve local data based on user preference
// - Run retention check during background sync
// - Log retention actions for audit
// - Allow users to opt-out of automatic deletion
