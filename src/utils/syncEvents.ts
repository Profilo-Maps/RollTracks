/**
 * Simple event emitter for sync notifications
 */

type SyncEventListener = (type: 'success' | 'error', message: string) => void;

class SyncEventEmitter {
  private listeners: SyncEventListener[] = [];

  subscribe(listener: SyncEventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(type: 'success' | 'error', message: string) {
    this.listeners.forEach(listener => listener(type, message));
  }
}

export const syncEvents = new SyncEventEmitter();
