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
  private periodicSyncInterval: NodeJS.Timeout | null = null;
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
   * Add item to sync queue
   */
  async queueForSync(item: Omit<SyncItem, 'id' | 'retryCount' | 'lastAttempt' | 'error'>, userId?: string): Promise<void> {
    const syncItem: SyncItem = {
      ...item,
      id: `${item.type}_${item.operation}_${Date.now()}_${Math.random()}`,
      retryCount: 0,
      lastAttempt: null,
      error: null,
      userId: userId || item.userId, // Store userId if provided
    };

    const queue = await this.getQueue();
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
   * Clear sync queue (for testing)
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    console.log('Sync queue cleared');
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
   */
  private async syncProfile(item: SyncItem): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const table = 'profiles';

    switch (item.operation) {
      case 'insert':
        const { error: insertError } = await supabase
          .from(table)
          .insert(item.data);
        if (insertError) throw insertError;
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from(table)
          .update(item.data)
          .eq('id', item.data.id);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', item.data.id);
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
        const { error: insertError } = await supabase
          .from(table)
          .insert({
            ...item.data,
            synced_at: new Date().toISOString(),
          });
        if (insertError) {
          console.error('Trip insert error:', insertError);
          throw insertError;
        }
        console.log('Trip inserted successfully');
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from(table)
          .update({
            ...item.data,
            synced_at: new Date().toISOString(),
          })
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
        if (insertError) throw insertError;
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
