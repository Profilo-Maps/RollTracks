import { SyncService } from '../services/SyncService';

/**
 * Debug utilities for sync issues
 */
export class SyncDebugUtils {
  private syncService: SyncService;

  constructor(syncService: SyncService) {
    this.syncService = syncService;
  }

  /**
   * Get current sync queue for debugging
   */
  async getQueueStatus(): Promise<{
    queueLength: number;
    items: any[];
    status: any;
  }> {
    const items = await this.syncService.getQueueItems();
    const status = await this.syncService.getSyncStatus();
    
    return {
      queueLength: items.length,
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        operation: item.operation,
        retryCount: item.retryCount,
        error: item.error,
        dataId: item.type === 'trip' ? item.data.id : 
                item.type === 'rated_feature' ? `${item.data.id}_${item.data.tripId}` : 
                'profile',
      })),
      status,
    };
  }

  /**
   * Clear sync queue (for debugging)
   */
  async clearQueue(): Promise<void> {
    await this.syncService.clearQueue();
    console.log('🧹 Sync queue cleared for debugging');
  }

  /**
   * Force sync now (for debugging)
   */
  async forceSyncNow(): Promise<any> {
    console.log('🔄 Forcing sync now for debugging');
    return await this.syncService.syncNow();
  }

  /**
   * Log detailed queue information
   */
  async logQueueDetails(): Promise<void> {
    const status = await this.getQueueStatus();
    
    console.log('📊 Sync Queue Debug Info:');
    console.log(`  Queue Length: ${status.queueLength}`);
    console.log(`  Is Online: ${status.status.isOnline}`);
    console.log(`  Is Syncing: ${status.status.isSyncing}`);
    console.log(`  Last Sync: ${status.status.lastSyncTime ? new Date(status.status.lastSyncTime).toISOString() : 'Never'}`);
    
    if (status.items.length > 0) {
      console.log('  Queue Items:');
      status.items.forEach((item, index) => {
        console.log(`    ${index + 1}. ${item.type} ${item.operation} (${item.dataId})`);
        console.log(`       Retries: ${item.retryCount}, Error: ${item.error || 'None'}`);
      });
    } else {
      console.log('  Queue is empty');
    }
  }
}