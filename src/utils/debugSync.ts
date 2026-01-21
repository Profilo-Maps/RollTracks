import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_QUEUE_KEY = '@rolltracks:sync_queue';

/**
 * Debug utility to inspect and manage sync queue
 */
export class SyncDebugger {
  /**
   * Get current sync queue items
   */
  static async getQueueItems() {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!queueJson) {
        console.log('Sync queue is empty');
        return [];
      }
      const queue = JSON.parse(queueJson);
      console.log(`Sync queue has ${queue.length} items:`);
      queue.forEach((item: any, index: number) => {
        console.log(`${index + 1}. ${item.type} ${item.operation} (retries: ${item.retryCount}/${3})`);
        if (item.error) {
          console.log(`   Error: ${item.error}`);
        }
      });
      return queue;
    } catch (error) {
      console.error('Error reading sync queue:', error);
      return [];
    }
  }

  /**
   * Clear sync queue
   */
  static async clearQueue() {
    try {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      console.log('Sync queue cleared');
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  /**
   * Remove failed items from queue
   */
  static async removeFailedItems() {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!queueJson) {
        console.log('Sync queue is empty');
        return;
      }
      
      const queue = JSON.parse(queueJson);
      const filteredQueue = queue.filter((item: any) => item.retryCount < 3);
      
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
      console.log(`Removed ${queue.length - filteredQueue.length} failed items from sync queue`);
    } catch (error) {
      console.error('Error removing failed items:', error);
    }
  }
}