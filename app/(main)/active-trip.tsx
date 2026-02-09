/**
 * Active Trip Screen
 * Built with Basemap Layout. Triggered by Start Trip Modal Component.
 *
 * Features:
 * - Displays active trip polyline on map as it's being recorded
 * - Trip stats card showing mode, duration, distance, comfort level
 * - Pause and Stop buttons in footer slot
 * - Recenter button in secondary footer slot
 * - When trip ends, navigates to Trip Summary Screen
 *
 * TODO:
 * - Integrate with Trip Service for GPS tracking
 * - Implement actual pause/resume/stop functionality
 * - Calculate real-time distance and duration
 * - Navigate to trip summary on stop
 */

import { MapViewComponentRef, Polyline } from '@/components/MapViewComponent';
import { RecenterButton } from '@/components/RecenterButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';

export default function ActiveTripScreen() {
  const router = useRouter();
  const mapRef = useRef<MapViewComponentRef>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Trip state (will be replaced with Trip Service data)
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [distance, setDistance] = useState(0); // miles
  const [currentPolyline, setCurrentPolyline] = useState<Polyline>({
    id: 'active-trip',
    coordinates: [], // Will be populated by GPS data from Trip Service
    color: '#FF3B30', // Red for active trip
    width: 5,
  });

  // Mock trip parameters (will come from Start Trip Modal via Trip Service)
  const [tripParams] = useState({
    mode: 'wheelchair',
    comfort: 7,
    purpose: 'Commute',
  });

  // Timer for duration (will be managed by Trip Service)
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPaused]);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance
  const formatDistance = (miles: number): string => {
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  };

  // Handle pause/resume
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    // TODO: Call Trip Service to pause/resume recording
  };

  // Handle stop trip
  const handleStopTrip = () => {
    // TODO: Call Trip Service to stop recording and save trip
    // TODO: Navigate to trip summary screen with trip ID
    console.log('Stopping trip...');
    router.push('/(main)/trip-summary');
  };

  // Handle recenter
  const handleRecenter = () => {
    mapRef.current?.recenter();
  };

  // Get mode icon
  const getModeIcon = (mode: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      wheelchair: 'accessibility',
      skateboard: 'bicycle',
      'assisted walking': 'walk',
      walking: 'walk',
      scooter: 'bicycle',
    };
    return icons[mode.toLowerCase()] ?? 'navigate';
  };

  // Render trip stats card in body slot
  const renderBody = () => (
    <View style={styles.bodyContainer}>
      <ThemedView style={[styles.statsCard, { backgroundColor: colors.background }]}>
        {/* Mode and Status */}
        <View style={styles.statusRow}>
          <View style={styles.modeContainer}>
            <Ionicons
              name={getModeIcon(tripParams.mode)}
              size={24}
              color={colors.tint}
            />
            <ThemedText style={styles.modeText}>
              {tripParams.mode.charAt(0).toUpperCase() + tripParams.mode.slice(1)}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isPaused ? colors.icon : '#4CAF50' }]}>
            <ThemedText style={[styles.statusText, { color: colors.buttonText }]}>
              {isPaused ? 'PAUSED' : 'RECORDING'}
            </ThemedText>
          </View>
        </View>

        {/* Trip Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color={colors.icon} />
            <ThemedText style={styles.statLabel}>Duration</ThemedText>
            <ThemedText style={styles.statValue}>{formatDuration(duration)}</ThemedText>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={20} color={colors.icon} />
            <ThemedText style={styles.statLabel}>Distance</ThemedText>
            <ThemedText style={styles.statValue}>{formatDistance(distance)}</ThemedText>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Ionicons name="happy-outline" size={20} color={colors.icon} />
            <ThemedText style={styles.statLabel}>Comfort</ThemedText>
            <ThemedText style={styles.statValue}>{tripParams.comfort}/10</ThemedText>
          </View>
        </View>

        {/* Trip Purpose */}
        {tripParams.purpose && (
          <View style={styles.purposeContainer}>
            <ThemedText style={[styles.purposeLabel, { color: colors.icon }]}>
              Purpose:
            </ThemedText>
            <ThemedText style={styles.purposeText}>{tripParams.purpose}</ThemedText>
          </View>
        )}
      </ThemedView>
    </View>
  );

  // Render secondary footer with recenter button
  const renderSecondaryFooter = () => (
    <RecenterButton onPress={handleRecenter} position="secondary-footer" />
  );

  // Render footer with trip controls
  const renderFooter = () => (
    <View style={[styles.footerContainer, { backgroundColor: colors.background }]}>
      {/* Pause/Resume Button */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          styles.pauseButton,
          { backgroundColor: isPaused ? colors.buttonPrimary : colors.icon },
        ]}
        onPress={handlePauseResume}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isPaused ? 'play' : 'pause'}
          size={28}
          color={colors.buttonText}
        />
        <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
          {isPaused ? 'Resume' : 'Pause'}
        </ThemedText>
      </TouchableOpacity>

      {/* Stop Button */}
      <TouchableOpacity
        style={[styles.controlButton, styles.stopButton, { backgroundColor: colors.buttonDanger }]}
        onPress={handleStopTrip}
        activeOpacity={0.8}
      >
        <Ionicons name="stop" size={28} color={colors.buttonText} />
        <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
          Stop Trip
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  return (
    <BasemapLayout
      ref={mapRef}
      polylines={[currentPolyline]}
      showUserLocation={true}
      zoomLevel={16}
      body={renderBody()}
      secondaryFooter={renderSecondaryFooter()}
      footer={renderFooter()}
    />
  );
}

const styles = StyleSheet.create({
  bodyContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingHorizontal: 16,
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    opacity: 0.97,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  purposeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  purposeLabel: {
    fontSize: 14,
  },
  purposeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  pauseButton: {
    // Styles applied via backgroundColor prop
  },
  stopButton: {
    // Styles applied via backgroundColor prop
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
