import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { DataService, Trip } from '../adapters/DatabaseAdapter';

// ═══════════════════════════════════════════════════════════
// SYNC SERVICE
// ═══════════════════════════════════════════════════════════
// Receives data from Trip Service and hands it to Supabase Adapter.
// Provides write buffer for interrupted trips - if connectivity is lost
// mid-trip, stores data locally until sync is possible.

// --- Constants ---

const STORAGE_KEY_SYNC_QUEUE = '@rolltracks/sync_queue';
const SYNC_RETRY_DELAY_MS = 30000; // 30 seconds between retry attempts (increased from 5s)
const MAX_RETRY_ATTEMPTS = 10; // Max retries before marking as failed (increased from 3)

// --- Types ---

export interface QueuedTrip {
  queueId: string; // Unique ID for this queue item
  tripData: Omit<Trip, 'tripId'>; // Trip data to be uploaded
  attempts: number; // Number of upload attempts
  lastAttempt: string | null; // Timestamp of last attempt
  error: string | null; // Last error message
}

export interface SyncStatus {
  isPending: boolean; // Are there trips waiting to sync?
  queueLength: number; // Number of trips in queue
  isSyncing: boolean; // Is a sync currently in progress?
  lastSyncAttempt: string | null; // Timestamp of last sync attempt
  lastSuccessfulSync: string | null; // Timestamp of last successful sync
}

/**
 * Cached raw trip data for the initial trip summary screen display.
 * Preserves the original unclipped GPS geometry so the user can see
 * their full route immediately after ending a trip, before server-side
 * anonymization (census block clipping) modifies it.
 */
export interface CachedRawTrip {
  tripId: string; // Server trip ID if synced, temporary queue ID if not
  trip: Trip; // Complete trip data with raw (unclipped) geometry
  synced: boolean; // Whether this trip has been successfully synced to server
}

// --- Sync Service Class ---

class SyncServiceClass {
  private syncQueue: QueuedTrip[] = [];
  private isSyncing: boolean = false;
  private lastSyncAttempt: string | null = null;
  private lastSuccessfulSync: string | null = null;
  private isInitialized: boolean = false;
  private netInfoUnsubscribe: NetInfoSubscription | null = null;
  private wasDisconnected: boolean = false;

  // ═══════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize the sync service by loading the queue from storage.
   * Should be called when the app starts.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.loadQueueFromStorage();
    
    // One-time cleanup: Remove any items with parse errors or invalid geometry
    // This handles migrations and format changes
    const itemsToClean = this.syncQueue.filter(
      item => (
        (item.error?.includes('invalid geometry') || 
         item.error?.includes('parse error')) &&
        item.attempts >= MAX_RETRY_ATTEMPTS
      )
    );
    
    if (itemsToClean.length > 0) {
      console.log(`[SyncService] Cleaning up ${itemsToClean.length} failed items from queue`);
      for (const item of itemsToClean) {
        console.log(`[SyncService] Removing: ${item.queueId} - ${item.error}`);
        await this.removeFromQueue(item.queueId);
      }
    }
    
    this.isInitialized = true;

    // Set up network state listener for automatic retry on connectivity restore
    this.setupNetworkListener();

    // Attempt initial sync if there are items in queue
    if (this.syncQueue.length > 0) {
      console.log(`[SyncService] Initialized with ${this.syncQueue.length} queued trip(s)`);
      // Don't await - let it run in background
      this.processSyncQueue();
    } else {
      console.log('[SyncService] Initialized with empty queue');
    }
  }

  /**
   * Clean up resources (unsubscribe from network listener).
   * Call this when the service is no longer needed.
   */
  cleanup(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
      console.log('[SyncService] Network listener unsubscribed');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Queue Management
  // ═══════════════════════════════════════════════════════════

  /**
   * Load the sync queue from persistent storage.
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_SYNC_QUEUE);
      if (data) {
        this.syncQueue = JSON.parse(data) as QueuedTrip[];
        console.log(`[SyncService] Loaded ${this.syncQueue.length} item(s) from storage`);
      } else {
        this.syncQueue = [];
      }
    } catch (error) {
      console.error('[SyncService] Failed to load queue from storage:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save the sync queue to persistent storage.
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_SYNC_QUEUE,
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('[SyncService] Failed to save queue to storage:', error);
      throw new Error('Failed to save sync queue to storage');
    }
  }

  /**
   * Add a trip to the sync queue.
   * This is called by TripService when a trip ends.
   */
  private async addToQueue(tripData: Omit<Trip, 'tripId'>): Promise<string> {
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const queuedTrip: QueuedTrip = {
      queueId,
      tripData,
      attempts: 0,
      lastAttempt: null,
      error: null,
    };

    this.syncQueue.push(queuedTrip);
    await this.saveQueueToStorage();

    console.log('[SyncService] Added trip to sync queue:', queueId);
    return queueId;
  }

  /**
   * Remove a trip from the sync queue after successful upload.
   */
  private async removeFromQueue(queueId: string): Promise<void> {
    this.syncQueue = this.syncQueue.filter(item => item.queueId !== queueId);
    await this.saveQueueToStorage();
    console.log('[SyncService] Removed from sync queue:', queueId);
  }

  /**
   * Update a queued trip's attempt metadata.
   */
  private async updateQueueItem(
    queueId: string,
    updates: Partial<Pick<QueuedTrip, 'attempts' | 'lastAttempt' | 'error'>>
  ): Promise<void> {
    const item = this.syncQueue.find(q => q.queueId === queueId);
    if (item) {
      if (updates.attempts !== undefined) item.attempts = updates.attempts;
      if (updates.lastAttempt !== undefined) item.lastAttempt = updates.lastAttempt;
      if (updates.error !== undefined) item.error = updates.error;
      await this.saveQueueToStorage();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Public API - Called by TripService
  // ═══════════════════════════════════════════════════════════

  /**
   * Queue a trip for sync and attempt immediate upload.
   * If upload fails, trip remains in queue for later retry.
   *
   * @param tripData - Trip data to be synced
   * @returns The saved Trip with database-generated tripId, or null if queued for later
   */
  async syncTrip(tripData: Omit<Trip, 'tripId'>): Promise<Trip | null> {
    // Ensure service is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Add to queue first (for safety in case upload fails)
    const queueId = await this.addToQueue(tripData);

    // Attempt immediate upload
    try {
      const savedTrip = await this.uploadTrip(queueId, tripData);

      // Success - remove from queue
      await this.removeFromQueue(queueId);
      this.lastSuccessfulSync = new Date().toISOString();

      console.log('[SyncService] Trip synced successfully:', savedTrip.tripId);
      
      // Cache the raw trip data for immediate display
      await this.cacheRawTrip(savedTrip.tripId, savedTrip, true);
      
      return savedTrip;
    } catch (error) {
      // Upload failed - update queue item with error
      await this.updateQueueItem(queueId, {
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Upload failed',
      });

      console.warn('[SyncService] Upload failed, trip queued for retry:', error);

      // Cache with queue ID for display even though not synced
      const tempTrip: Trip = {
        ...tripData,
        tripId: queueId, // Use queue ID as temporary trip ID
      };
      await this.cacheRawTrip(queueId, tempTrip, false);

      // Schedule retry
      this.scheduleRetry();

      return null; // Indicates trip is queued, not yet synced
    }
  }

  /**
   * Manually trigger a sync attempt for all queued trips.
   * Useful for retry buttons or when connectivity is restored.
   * Optionally resets retry counts for failed items.
   */
  async retrySync(resetFailedItems: boolean = false): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Reset retry counts for failed items if requested
    if (resetFailedItems) {
      const failedItems = this.syncQueue.filter(item => item.attempts >= MAX_RETRY_ATTEMPTS);
      if (failedItems.length > 0) {
        console.log(`[SyncService] Resetting retry counts for ${failedItems.length} failed item(s)`);
        for (const item of failedItems) {
          await this.updateQueueItem(item.queueId, {
            attempts: 0,
            error: null,
          });
        }
      }
    }

    await this.processSyncQueue();
  }

  /**
   * Get the current sync status.
   */
  getSyncStatus(): SyncStatus {
    return {
      isPending: this.syncQueue.length > 0,
      queueLength: this.syncQueue.length,
      isSyncing: this.isSyncing,
      lastSyncAttempt: this.lastSyncAttempt,
      lastSuccessfulSync: this.lastSuccessfulSync,
    };
  }

  /**
   * Get the list of trips currently in the sync queue.
   * Useful for displaying "pending sync" indicators in UI.
   */
  getQueuedTrips(): QueuedTrip[] {
    return [...this.syncQueue]; // Return copy to prevent external mutation
  }

  /**
   * Get detailed information about queued trips for debugging.
   * Returns queue items with their error messages and attempt counts.
   */
  getQueueDebugInfo(): Array<{
    queueId: string;
    attempts: number;
    maxRetries: number;
    lastAttempt: string | null;
    error: string | null;
    tripInfo: {
      mode: string;
      userId: string;
      hasGeometry: boolean;
      coordinateCount: number;
    };
  }> {
    return this.syncQueue.map(item => ({
      queueId: item.queueId,
      attempts: item.attempts,
      maxRetries: MAX_RETRY_ATTEMPTS,
      lastAttempt: item.lastAttempt,
      error: item.error,
      tripInfo: {
        mode: item.tripData.mode,
        userId: item.tripData.userId,
        hasGeometry: !!item.tripData.geometry,
        coordinateCount: Array.isArray((item.tripData.geometry as any)?.coordinates)
          ? (item.tripData.geometry as any).coordinates.length
          : 0,
      },
    }));
  }

  /**
   * Clear the entire sync queue.
   * WARNING: This will permanently delete all unsent trips!
   * Only use this for testing or explicit user action.
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveQueueToStorage();
    console.log('[SyncService] Queue cleared');
  }

  /**
   * Remove failed items from the queue (items that have reached max retries).
   * This is useful for cleaning up the queue without deleting items that might still succeed.
   */
  async clearFailedItems(): Promise<void> {
    const failedItems = this.syncQueue.filter(item => item.attempts >= MAX_RETRY_ATTEMPTS);
    
    if (failedItems.length === 0) {
      console.log('[SyncService] No failed items to clear');
      return;
    }

    console.log(`[SyncService] Clearing ${failedItems.length} failed item(s)`);
    
    for (const item of failedItems) {
      console.error(`[SyncService] Removing failed item ${item.queueId}: ${item.error}`);
      await this.removeFromQueue(item.queueId);
    }
    
    console.log('[SyncService] Failed items cleared');
  }

  // ═══════════════════════════════════════════════════════════
  // Raw GPS Cache Management
  // ═══════════════════════════════════════════════════════════

  /**
   * Cache raw GPS data for a trip on first view of trip summary screen.
   * This preserves the original unclipped geometry so users can see their
   * full route immediately after ending a trip, before server-side
   * anonymization (census block clipping) modifies it.
   *
   * @param tripId - Server trip ID or temporary queue ID
   * @param trip - Complete trip data with raw (unclipped) geometry
   * @param synced - Whether this trip has been successfully synced to server
   */
  async cacheRawTrip(tripId: string, trip: Trip, synced: boolean): Promise<void> {
    const cacheKey = `@rolltracks/raw_trip_${tripId}`;
    
    const cachedData: CachedRawTrip = {
      tripId,
      trip,
      synced,
    };

    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
      console.log(`[SyncService] Cached raw trip data for ${tripId}`);
    } catch (error) {
      console.error('[SyncService] Failed to cache raw trip:', error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Retrieve cached raw GPS data for a trip.
   * Returns null if no cache exists.
   *
   * @param tripId - Server trip ID or temporary queue ID
   * @returns Cached trip data or null
   */
  async getCachedRawTrip(tripId: string): Promise<CachedRawTrip | null> {
    const cacheKey = `@rolltracks/raw_trip_${tripId}`;

    try {
      const data = await AsyncStorage.getItem(cacheKey);
      if (data) {
        const cached = JSON.parse(data) as CachedRawTrip;
        console.log(`[SyncService] Retrieved cached raw trip for ${tripId}`);
        return cached;
      }
      return null;
    } catch (error) {
      console.error('[SyncService] Failed to retrieve cached trip:', error);
      return null;
    }
  }

  /**
   * Clear cached raw GPS data for a trip after successful sync.
   * This removes all locally stored raw GPS data once the trip has been
   * uploaded and anonymized on the server.
   *
   * @param tripId - Server trip ID
   */
  async clearCachedRawTrip(tripId: string): Promise<void> {
    const cacheKey = `@rolltracks/raw_trip_${tripId}`;

    try {
      await AsyncStorage.removeItem(cacheKey);
      console.log(`[SyncService] Cleared cached raw trip for ${tripId}`);
    } catch (error) {
      console.error('[SyncService] Failed to clear cached trip:', error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Clear all cached raw trip data.
   * Useful for cleanup or when user deletes their account.
   */
  async clearAllCachedTrips(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const tripCacheKeys = keys.filter(key => key.startsWith('@rolltracks/raw_trip_'));
      
      if (tripCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(tripCacheKeys);
        console.log(`[SyncService] Cleared ${tripCacheKeys.length} cached trip(s)`);
      }
    } catch (error) {
      console.error('[SyncService] Failed to clear all cached trips:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Upload & Retry Logic
  // ═══════════════════════════════════════════════════════════

  /**
   * Upload a single trip to the database via DataService.
   */
  private async uploadTrip(
    queueId: string,
    tripData: Omit<Trip, 'tripId'>
  ): Promise<Trip> {
    try {
      console.log(`[SyncService] Attempting upload for ${queueId}`);
      console.log(`[SyncService] Trip data:`, {
        userId: tripData.userId,
        mode: tripData.mode,
        geometryType: tripData.geometry?.type,
        coordinateCount: Array.isArray((tripData.geometry as any)?.coordinates) 
          ? (tripData.geometry as any).coordinates.length 
          : 0,
      });
      
      // Call DataService to write to Supabase
      const savedTrip = await DataService.writeTrip(tripData);
      
      console.log(`[SyncService] Upload successful for ${queueId}, server trip_id: ${savedTrip.tripId}`);
      return savedTrip;
    } catch (error) {
      console.error(`[SyncService] Upload failed for ${queueId}:`, error);
      
      // Log more details about the error
      if (error instanceof Error) {
        console.error(`[SyncService] Error message: ${error.message}`);
        console.error(`[SyncService] Error stack:`, error.stack);
      }
      
      throw error;
    }
  }

  /**
   * Process the sync queue, attempting to upload all queued trips.
   * Runs until queue is empty or max retries reached for all items.
   */
  private async processSyncQueue(): Promise<void> {
    // Prevent concurrent sync operations
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress, skipping');
      return;
    }

    if (this.syncQueue.length === 0) {
      console.log('[SyncService] Queue is empty, nothing to sync');
      return;
    }

    this.isSyncing = true;
    this.lastSyncAttempt = new Date().toISOString();

    console.log(`[SyncService] Processing sync queue (${this.syncQueue.length} item(s))`);

    // Process each item in queue
    const itemsToProcess = [...this.syncQueue]; // Copy to avoid mutation during iteration
    const itemsToRemove: string[] = []; // Track items to remove after processing

    for (const item of itemsToProcess) {
      // Skip if already attempted too many times (but don't remove - keep for manual retry)
      if (item.attempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(
          `[SyncService] Skipping ${item.queueId} - max retries (${MAX_RETRY_ATTEMPTS}) reached. Last error: ${item.error}`
        );
        continue;
      }

      try {
        console.log(`[SyncService] Uploading ${item.queueId} (attempt ${item.attempts + 1}/${MAX_RETRY_ATTEMPTS})`);

        // Validate geometry before upload
        if (!this.isValidGeometry(item.tripData.geometry)) {
          throw new Error('Invalid geometry format - must be valid GeoJSON LineString');
        }

        const savedTrip = await this.uploadTrip(item.queueId, item.tripData);

        // Success - remove from queue
        itemsToRemove.push(item.queueId);
        this.lastSuccessfulSync = new Date().toISOString();

        console.log('[SyncService] Successfully uploaded:', savedTrip.tripId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        const newAttemptCount = item.attempts + 1;
        
        // Upload failed - update attempt count
        await this.updateQueueItem(item.queueId, {
          attempts: newAttemptCount,
          lastAttempt: new Date().toISOString(),
          error: errorMsg,
        });

        console.error(
          `[SyncService] Upload failed for ${item.queueId} (attempt ${newAttemptCount}/${MAX_RETRY_ATTEMPTS}):`,
          errorMsg
        );
      }
    }

    // Remove only successful items
    for (const queueId of itemsToRemove) {
      await this.removeFromQueue(queueId);
    }

    this.isSyncing = false;

    // Schedule retry if there are items remaining that haven't hit max retries
    const remainingItems = this.syncQueue.filter(item => item.attempts < MAX_RETRY_ATTEMPTS);
    if (remainingItems.length > 0) {
      console.log(
        `[SyncService] ${remainingItems.length} item(s) remaining in queue, scheduling retry`
      );
      this.scheduleRetry();
    } else if (this.syncQueue.length > 0) {
      console.warn(
        `[SyncService] ${this.syncQueue.length} item(s) in queue have reached max retries. Use clearFailedItems() or retrySync() to retry.`
      );
    } else {
      console.log('[SyncService] Queue processing complete');
    }
  }

  /**
   * Validate that geometry is a valid encoded polyline string.
   * Polylines should be non-empty strings.
   */
  private isValidGeometry(geometry: unknown): boolean {
    if (!geometry) {
      console.error('[SyncService] Geometry validation failed: geometry is null or undefined');
      return false;
    }

    if (typeof geometry !== 'string') {
      console.error('[SyncService] Geometry validation failed: geometry is not a string, got:', typeof geometry);
      return false;
    }

    if (geometry.length === 0) {
      console.error('[SyncService] Geometry validation failed: geometry string is empty');
      return false;
    }

    // Basic validation: polyline strings should be ASCII characters
    // and typically contain letters, numbers, and special characters
    if (geometry.length < 10) {
      console.error('[SyncService] Geometry validation failed: polyline string too short (< 10 chars):', geometry.length);
      return false;
    }

    console.log('[SyncService] Geometry validation passed: polyline string length:', geometry.length);
    return true;
  }

  /**
   * Schedule a retry attempt after a delay.
   */
  private scheduleRetry(): void {
    setTimeout(() => {
      console.log('[SyncService] Retry scheduled, attempting sync...');
      this.processSyncQueue();
    }, SYNC_RETRY_DELAY_MS);
  }

  /**
   * Helper: delay for a specified duration.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════
  // Connectivity & Background Sync
  // ═══════════════════════════════════════════════════════════

  /**
   * Set up network state listener to automatically retry when connectivity is restored.
   */
  private setupNetworkListener(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable ?? false;
      const hasInternet = isConnected && (isInternetReachable === null || isInternetReachable);

      console.log('[SyncService] Network state changed:', {
        isConnected,
        isInternetReachable,
        type: state.type,
        hasInternet,
      });

      // If we just regained connectivity and have items in queue, trigger sync
      if (hasInternet && this.wasDisconnected && this.syncQueue.length > 0) {
        console.log('[SyncService] Connectivity restored, triggering auto-sync');
        this.onConnectivityRestored();
      }

      // Track disconnection state
      this.wasDisconnected = !hasInternet;
    });

    console.log('[SyncService] Network listener set up');
  }

  /**
   * Called when connectivity is restored.
   * Triggers a sync attempt for queued trips.
   */
  private async onConnectivityRestored(): Promise<void> {
    console.log('[SyncService] Connectivity restored, attempting sync');
    await this.retrySync();
  }

  /**
   * Call this when app comes to foreground.
   * Triggers a sync attempt for queued trips.
   */
  async onAppForeground(): Promise<void> {
    console.log('[SyncService] App in foreground, attempting sync');
    await this.retrySync();
  }
}

// Export singleton instance
export const SyncService = new SyncServiceClass();
