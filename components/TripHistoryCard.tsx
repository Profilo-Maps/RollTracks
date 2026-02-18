import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';

import { Trip } from '@/adapters/DatabaseAdapter';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { HistoryService } from '@/services/HistoryService';

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
 * - Card variant shows polyline route preview in bottom half
 */

const POLYLINE_HEIGHT = 80;
const POLYLINE_PADDING = 8;

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
  const buttonTextColor = useThemeColor({}, 'buttonText');

  // Format time of day bin to readable text
  const formatTimeOfDay = (timeOfDay: string): string => {
    const timeLabels: Record<string, string> = {
      late_night: 'Late Night',
      early_morning: 'Early Morning',
      morning_rush: 'Morning Rush',
      midday: 'Midday',
      evening_rush: 'Evening Rush',
      evening: 'Evening',
      night: 'Night',
    };
    return timeLabels[timeOfDay] || timeOfDay;
  };

  // Format weekday indicator
  const formatDayType = (weekday: number): string => {
    return weekday === 1 ? 'Weekday' : 'Weekend';
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

  // Decode and normalize polyline coordinates to SVG points string
  // Uses HistoryService which returns [lng, lat] (GeoJSON order)
  const svgPoints = useMemo(() => {
    if (variant === 'drawer' || !trip.geometry) return null;

    try {
      const coords = HistoryService.decodePolyline(trip.geometry);
      if (coords.length < 2) return null;

      // Find bounds ([lng, lat] order)
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      for (const [lng, lat] of coords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }

      const latRange = maxLat - minLat || 0.0001;
      const lngRange = maxLng - minLng || 0.0001;

      // Map to viewBox coordinates (0-100) with padding
      const drawW = 100 - POLYLINE_PADDING * 2;
      const drawH = 100 - POLYLINE_PADDING * 2;

      // Maintain aspect ratio
      const aspectRatio = lngRange / latRange;
      let scaleX: number, scaleY: number, offsetX: number, offsetY: number;

      if (aspectRatio > (drawW / drawH)) {
        scaleX = drawW;
        scaleY = drawW / aspectRatio;
        offsetX = POLYLINE_PADDING;
        offsetY = POLYLINE_PADDING + (drawH - scaleY) / 2;
      } else {
        scaleY = drawH;
        scaleX = drawH * aspectRatio;
        offsetX = POLYLINE_PADDING + (drawW - scaleX) / 2;
        offsetY = POLYLINE_PADDING;
      }

      return coords
        .map(([lng, lat]) => {
          const x = offsetX + ((lng - minLng) / lngRange) * scaleX;
          // Flip Y since lat increases upward but SVG Y increases downward
          const y = offsetY + ((maxLat - lat) / latRange) * scaleY;
          return `${x},${y}`;
        })
        .join(' ');
    } catch {
      return null;
    }
  }, [trip.geometry, variant]);

  const timeOfDayLabel = formatTimeOfDay(trip.timeOfDay);
  const dayTypeLabel = formatDayType(trip.weekday);
  const isDrawer = variant === 'drawer';
  const modeColor = getModeColor(trip.mode);

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
      accessibilityLabel={`${trip.purpose} trip, ${trip.mode}, ${timeOfDayLabel} on ${dayTypeLabel}, ${formatDuration(trip.durationS ?? 0)} duration`}
    >
      <View style={styles.header}>
        <View style={styles.modeContainer}>
          <View style={[styles.modeIcon, { backgroundColor: modeColor }]}>
            <Ionicons name={getModeIcon(trip.mode)} size={20} color={buttonTextColor} />
          </View>
          <View style={styles.headerText}>
            <ThemedText type="defaultSemiBold" style={styles.mode}>
              {trip.mode} • {trip.purpose}
            </ThemedText>
            <ThemedText style={styles.dateTime}>
              {timeOfDayLabel} • {dayTypeLabel}
            </ThemedText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={iconColor} />
      </View>

      <View style={styles.statsContainer}>
        {trip.durationS !== undefined && trip.durationS > 0 && (
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color={iconColor} style={styles.statIcon} />
            <ThemedText style={styles.statText}>
              {formatDuration(trip.durationS)}
            </ThemedText>
          </View>
        )}

        {trip.distanceMi !== undefined && trip.distanceMi > 0 && (
          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={16} color={iconColor} style={styles.statIcon} />
            <ThemedText style={styles.statText}>
              {formatDistance(trip.distanceMi)} mi
            </ThemedText>
          </View>
        )}

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
      {showDataRangerStats && (
        (trip.featuresRated !== undefined && trip.featuresRated > 0) ||
        (trip.segmentsCorrected !== undefined && trip.segmentsCorrected > 0)
      ) && (
        <View style={[styles.dataRangerStats, { borderTopColor: tintColor }]}>
          {trip.featuresRated !== undefined && trip.featuresRated > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="star-outline" size={16} color={tintColor} style={styles.statIcon} />
              <ThemedText style={[styles.statText, { color: tintColor }]}>
                {`${trip.featuresRated} rated`}
              </ThemedText>
            </View>
          )}

          {trip.segmentsCorrected !== undefined && trip.segmentsCorrected > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="create-outline" size={16} color={tintColor} style={styles.statIcon} />
              <ThemedText style={[styles.statText, { color: tintColor }]}>
                {`${trip.segmentsCorrected} corrected`}
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {/* Polyline route preview (card variant only) */}
      {svgPoints && (
        <View style={styles.polylineContainer}>
          <Svg
            width="100%"
            height={POLYLINE_HEIGHT}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <SvgPolyline
              points={svgPoints}
              fill="none"
              stroke={modeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
          </Svg>
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
  },
  dataRangerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  polylineContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
