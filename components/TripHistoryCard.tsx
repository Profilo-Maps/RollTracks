import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Trip } from '@/adapters/DatabaseAdapter';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * TripHistoryCard Component
 * 
 * Shows trip summary information in a card format.
 * Can be styled as a drawer for the Trip Summary Screen.
 * 
 * Features:
 * - Trip start time, mode, duration, distance
 * - Click opens Trip Summary Screen for that trip
 * - In DataRanger mode: shows features rated or segments corrected count
 * - Props-based styling for card vs drawer format
 */

interface TripHistoryCardProps {
  trip: Trip;
  onPress: () => void;
  showDataRangerStats?: boolean;
  variant?: 'card' | 'drawer';
}

export function TripHistoryCard({ 
  trip, 
  onPress, 
  showDataRangerStats = false,
  variant = 'card'
}: TripHistoryCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
    return { dateStr, timeStr };
  };

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format distance to 2 decimal places
  const formatDistance = (miles: number) => {
    return miles.toFixed(2);
  };

  // Get mode icon
  const getModeIcon = (mode: string): keyof typeof Ionicons.glyphMap => {
    const modeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
      wheelchair: 'accessibility',
      skateboard: 'bicycle',
      'assisted walking': 'walk',
      walking: 'walk',
      scooter: 'bicycle',
    };
    return modeIcons[mode.toLowerCase()] ?? 'navigate';
  };

  // Get mode color
  const getModeColor = (mode: string): string => {
    const modeColors: Record<string, string> = {
      wheelchair: '#2196F3',
      skateboard: '#FF9800',
      'assisted walking': '#4CAF50',
      walking: '#9C27B0',
      scooter: '#F44336',
    };
    return modeColors[mode.toLowerCase()] ?? '#757575';
  };

  const { dateStr, timeStr } = formatDateTime(trip.startTime);
  const isDrawer = variant === 'drawer';

  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isDrawer ? styles.drawerContainer : styles.cardContainer,
        { backgroundColor },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Trip on ${dateStr} at ${timeStr}, ${trip.mode}, ${formatDuration(trip.durationS)} duration`}
    >
      <View style={styles.header}>
        <View style={styles.modeContainer}>
          <View style={[styles.modeIcon, { backgroundColor: getModeColor(trip.mode) }]}>
            <Ionicons name={getModeIcon(trip.mode)} size={20} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <ThemedText type="defaultSemiBold" style={styles.mode}>
              {trip.mode}
            </ThemedText>
            <ThemedText style={styles.dateTime}>
              {dateStr} • {timeStr}
            </ThemedText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={iconColor} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={iconColor} style={styles.statIcon} />
          <ThemedText style={styles.statText}>
            {formatDuration(trip.durationS)}
          </ThemedText>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="navigate-outline" size={16} color={iconColor} style={styles.statIcon} />
          <ThemedText style={styles.statText}>
            {formatDistance(trip.distanceMi)} mi
          </ThemedText>
        </View>

        {trip.comfort && (
          <View style={styles.statItem}>
            <Ionicons name="happy-outline" size={16} color={iconColor} style={styles.statIcon} />
            <ThemedText style={styles.statText}>
              {trip.comfort}/10
            </ThemedText>
          </View>
        )}
      </View>

      {/* DataRanger stats (if enabled) */}
      {showDataRangerStats && (trip.featuresRated || trip.segmentsCorrected) && (
        <View style={[styles.dataRangerStats, { borderTopColor: tintColor }]}>
          {trip.featuresRated !== undefined && trip.featuresRated > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="star-outline" size={16} color={tintColor} style={styles.statIcon} />
              <ThemedText style={[styles.statText, { color: tintColor }]}>
                {trip.featuresRated} rated
              </ThemedText>
            </View>
          )}
          
          {trip.segmentsCorrected !== undefined && trip.segmentsCorrected > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="create-outline" size={16} color={tintColor} style={styles.statIcon} />
              <ThemedText style={[styles.statText, { color: tintColor }]}>
                {trip.segmentsCorrected} corrected
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContainer: {
    marginBottom: 12,
    padding: 16,
  },
  drawerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  mode: {
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  dateTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 4,
  },
  statText: {
    fontSize: 14,
  },
  dataRangerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});

