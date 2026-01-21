/**
 * Debug script for sync issues
 * 
 * This script can be imported and used in the app to debug sync problems.
 * 
 * Usage in your app:
 * 
 * import { debugSyncIssues } from '../scripts/debugSync';
 * 
 * // In your component or service
 * await debugSyncIssues(syncService);
 */

import { SyncService } from '../services/SyncService';
import { SyncDebugUtils } from '../utils/syncDebug';

export async function debugSyncIssues(syncService: SyncService): Promise<void> {
  const debugUtils = new SyncDebugUtils(syncService);
  
  console.log('🔍 Starting sync debug session...');
  
  // Log current queue status
  await debugUtils.logQueueDetails();
  
  // Check for duplicate items
  const status = await debugUtils.getQueueStatus();
  const duplicates = findDuplicateItems(status.items);
  
  if (duplicates.length > 0) {
    console.log('⚠️  Found duplicate items in queue:');
    duplicates.forEach(dup => {
      console.log(`  - ${dup.type} ${dup.dataId}: ${dup.count} items`);
    });
    
    console.log('💡 Recommendation: Clear queue and retry sync');
  }
  
  // Check for items with high retry counts
  const highRetryItems = status.items.filter(item => item.retryCount >= 2);
  if (highRetryItems.length > 0) {
    console.log('🔄 Items with high retry counts:');
    highRetryItems.forEach(item => {
      console.log(`  - ${item.type} ${item.dataId}: ${item.retryCount} retries, Error: ${item.error}`);
    });
  }
  
  console.log('✅ Sync debug session complete');
}

export async function clearSyncQueueAndRetry(syncService: SyncService): Promise<void> {
  const debugUtils = new SyncDebugUtils(syncService);
  
  console.log('🧹 Clearing sync queue and retrying...');
  
  await debugUtils.clearQueue();
  
  // Wait a moment
  await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
  
  const result = await debugUtils.forceSyncNow();
  
  console.log('🔄 Sync result:', result);
}

function findDuplicateItems(items: any[]): Array<{ type: string; dataId: string; count: number }> {
  const counts = new Map<string, number>();
  
  items.forEach(item => {
    const key = `${item.type}_${item.dataId}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  
  const duplicates: Array<{ type: string; dataId: string; count: number }> = [];
  
  counts.forEach((count, key) => {
    if (count > 1) {
      const [type, dataId] = key.split('_', 2);
      duplicates.push({ type, dataId, count });
    }
  });
  
  return duplicates;
}