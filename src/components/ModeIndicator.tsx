import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMode } from '../contexts/ModeContext';

interface ModeIndicatorProps {
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export const ModeIndicator: React.FC<ModeIndicatorProps> = ({ syncStatus = 'idle' }) => {
  const { mode, authenticated } = useMode();

  if (mode === 'demo') {
    return (
      <View style={styles.container}>
        <View 
          style={[styles.badge, styles.demoBadge]}
          accessible={true}
          accessibilityLabel="Application is running in demo mode with local storage only"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.badgeText}>Demo Mode</Text>
        </View>
      </View>
    );
  }

  // Cloud mode - show sync status
  if (mode === 'cloud' && authenticated) {
    const getSyncStatusText = () => {
      switch (syncStatus) {
        case 'syncing':
          return 'Syncing...';
        case 'synced':
          return 'Synced';
        case 'error':
          return 'Sync Error';
        default:
          return 'Cloud Mode';
      }
    };

    const getSyncStatusStyle = () => {
      switch (syncStatus) {
        case 'syncing':
          return styles.syncingBadge;
        case 'synced':
          return styles.syncedBadge;
        case 'error':
          return styles.errorBadge;
        default:
          return styles.cloudBadge;
      }
    };

    const getAccessibilityLabel = () => {
      switch (syncStatus) {
        case 'syncing':
          return 'Cloud mode: Currently syncing data';
        case 'synced':
          return 'Cloud mode: Data synced successfully';
        case 'error':
          return 'Cloud mode: Sync error occurred';
        default:
          return 'Cloud mode: Connected';
      }
    };

    return (
      <View style={styles.container}>
        <View 
          style={[styles.badge, getSyncStatusStyle()]}
          accessible={true}
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityLiveRegion={syncStatus === 'syncing' || syncStatus === 'error' ? 'polite' : 'none'}
        >
          <Text style={styles.badgeText}>{getSyncStatusText()}</Text>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 100,
    minHeight: 32, // Ensure adequate touch target for status indicator
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBadge: {
    backgroundColor: '#FFA500',
  },
  cloudBadge: {
    backgroundColor: '#4A90E2',
  },
  syncingBadge: {
    backgroundColor: '#FFD700',
  },
  syncedBadge: {
    backgroundColor: '#4CAF50',
  },
  errorBadge: {
    backgroundColor: '#F44336',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
