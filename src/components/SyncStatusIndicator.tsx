import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SyncService, SyncStatus } from '../services/SyncService';

interface SyncStatusIndicatorProps {
  syncService: SyncService | null;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ syncService }) => {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    if (!syncService) {
      return;
    }

    const updateStatus = async () => {
      try {
        const currentStatus = await syncService.getSyncStatus();
        setStatus(currentStatus);
      } catch (error) {
        console.error('Error getting sync status:', error);
      }
    };

    // Update status immediately
    updateStatus();

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, [syncService]);

  if (!status || !status.isOnline) {
    return (
      <View style={styles.container}>
        <View style={[styles.dot, styles.dotOffline]} />
        <Text style={styles.text}>Offline</Text>
      </View>
    );
  }

  if (status.isSyncing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.text}>Syncing...</Text>
      </View>
    );
  }

  if (status.queueLength > 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.dot, styles.dotPending]} />
        <Text style={styles.text}>{status.queueLength} pending</Text>
      </View>
    );
  }

  const lastSyncText = status.lastSyncTime
    ? formatLastSync(status.lastSyncTime)
    : 'Never synced';

  return (
    <View style={styles.container}>
      <View style={[styles.dot, styles.dotSynced]} />
      <Text style={styles.text}>{lastSyncText}</Text>
    </View>
  );
};

function formatLastSync(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return `${days}d ago`;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOffline: {
    backgroundColor: '#999',
  },
  dotPending: {
    backgroundColor: '#FFA500',
  },
  dotSynced: {
    backgroundColor: '#34C759',
  },
  text: {
    fontSize: 12,
    color: '#666',
  },
});
