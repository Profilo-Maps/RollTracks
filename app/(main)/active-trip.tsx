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
 * - Integrates with TripService for GPS tracking and SyncService for data persistence
 * - DataRanger mode: displays nearby curb ramp features and rating modal
 */

import { NativeAdapter } from '@/adapters/NativeAdapter';
import { Feature, MapViewComponentRef, Polyline } from '@/components/MapViewComponent';
import { RecenterButton } from '@/components/RecenterButton';
import { PostTripResult, TripModal } from '@/components/TripModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { DataRangerService } from '@/services/DataRangerService';
import { SyncService } from '@/services/SyncService';
import { ActiveTripData, TripService } from '@/services/TripService';
import { mediumImpact, warningNotification } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActiveTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    comfort?: string;
    purpose?: string;
  }>();
  const { user } = useAuth();
  const mapRef = useRef<MapViewComponentRef>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const errorColor = colors.error;
  const insets = useSafeAreaInsets();

  // Trip state
  const [tripData, setTripData] = useState<ActiveTripData | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [distance, setDistance] = useState(0); // miles
  const [currentPolyline, setCurrentPolyline] = useState<Polyline>({
    id: 'active-trip',
    coordinates: [],
    color: '#007AFF', // Blue for active trip
    width: 5,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Post-trip survey state
  const [showPostTripModal, setShowPostTripModal] = useState(false);

  // User location from GPS Adapter
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  // DataRanger state (only active when user.dataRangerMode is true)
  const isDataRanger = user?.dataRangerMode ?? false;
  const [nearbyFeatures, setNearbyFeatures] = useState<Feature[]>([]);
  const [ratedCount, setRatedCount] = useState(0);

  // Initialize SyncService on mount
  useEffect(() => {
    SyncService.initialize();
  }, []);

  // Start trip on component mount
  useEffect(() => {
    const initializeTrip = async () => {
      if (!user) {
        setError('User not authenticated');
        setIsLoading(false);
        return;
      }

      // Check if there's already an active trip (e.g., navigated back)
      const existingTrip = TripService.getCurrentTripData();
      if (existingTrip) {
        console.log('[ActiveTripScreen] Resuming existing trip');
        setTripData(existingTrip);
        setIsPaused(existingTrip.metadata.status === 'paused');

        // Initialize DataRanger for resumed trip
        // Load all user ratings to show previously rated features
        if (isDataRanger) {
          await DataRangerService.initialize();
          DataRangerService.startTrip(existingTrip.metadata.tripId);
          await DataRangerService.loadAllUserRatings(user.id);
          setRatedCount(DataRangerService.getRatedCountForCurrentTrip());
        }

        setIsLoading(false);
        return;
      }

      // Get trip parameters from route params
      const mode = params.mode ?? 'walking';
      const comfort = parseInt(params.comfort ?? '5', 10);
      const purpose = params.purpose ?? 'Other';

      console.log('[ActiveTripScreen] Starting new trip:', { mode, comfort, purpose });

      try {
        // Start trip via TripService
        const tripId = await TripService.startTrip(user.id, mode, comfort, purpose);
        console.log('[ActiveTripScreen] Trip started:', tripId);

        // Initialize DataRanger for new trip
        // Load all user ratings to show previously rated features
        if (isDataRanger) {
          await DataRangerService.initialize();
          DataRangerService.startTrip(tripId);
          await DataRangerService.loadAllUserRatings(user.id);
        }

        // Get trip data
        const newTripData = TripService.getCurrentTripData();
        if (newTripData) {
          setTripData(newTripData);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('[ActiveTripScreen] Failed to start trip:', err);
        setError(err instanceof Error ? err.message : 'Failed to start trip');
        setIsLoading(false);

        // Show error alert and navigate back
        Alert.alert(
          'Failed to Start Trip',
          err instanceof Error ? err.message : 'An error occurred',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    };

    initializeTrip();
  }, [user, params, router]);

  // Poll for trip updates (GPS coordinates, distance, duration)
  useEffect(() => {
    let lastCoordinateCount = 0;
    let cachedDistance = 0;

    const interval = setInterval(() => {
      const currentTrip = TripService.getCurrentTripData();
      if (currentTrip) {
        setTripData(currentTrip);

        // Calculate duration
        const startTime = new Date(currentTrip.metadata.startTime).getTime();
        const now = Date.now();
        const durationSeconds = Math.floor((now - startTime) / 1000);
        setDuration(durationSeconds);

        // Optimized distance calculation - only calculate new segments
        if (currentTrip.coordinates.length >= 2) {
          // If new coordinates were added, only calculate distance for new segments
          if (currentTrip.coordinates.length > lastCoordinateCount) {
            const startIdx = Math.max(0, lastCoordinateCount - 1);
            for (let i = startIdx; i < currentTrip.coordinates.length - 1; i++) {
              const [lon1, lat1] = currentTrip.coordinates[i];
              const [lon2, lat2] = currentTrip.coordinates[i + 1];
              cachedDistance += calculateDistance(
                { latitude: lat1, longitude: lon1 },
                { latitude: lat2, longitude: lon2 }
              );
            }
            lastCoordinateCount = currentTrip.coordinates.length;
          }
          setDistance(cachedDistance / 1609.34); // Convert to miles
        }

        // Update polyline
        if (currentTrip.coordinates.length > 0) {
          console.log('[ActiveTripScreen] Updating polyline with', currentTrip.coordinates.length, 'points');
          setCurrentPolyline({
            id: 'active-trip',
            coordinates: currentTrip.coordinates, // Already in [lon, lat] format
            color: currentTrip.metadata.status === 'paused' ? '#FFA500' : '#007AFF',
            width: 5,
          });
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Track user location from GPS Adapter
  useEffect(() => {
    let isSubscribed = true;

    const updateUserLocation = async () => {
      try {
        const { granted } = await NativeAdapter.checkPermissions();
        if (!granted) {
          return;
        }

        const position = await NativeAdapter.getCurrentPosition();
        if (isSubscribed) {
          setUserPosition([position.longitude, position.latitude]);
        }
      } catch (error) {
        console.error('[ActiveTripScreen] Failed to get user position:', error);
      }
    };

    // Get initial position
    updateUserLocation();

    // Update position every 1 second (synced with polyline updates)
    const intervalId = setInterval(updateUserLocation, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, []);

  // DataRanger: query nearby features when user position changes
  useEffect(() => {
    if (!isDataRanger || !userPosition || !tripData) return;

    const [lon, lat] = userPosition;
    const features = DataRangerService.queryNearbyFeatures(lat, lon);
    setNearbyFeatures(features);
  }, [userPosition, isDataRanger, tripData]);

  // DataRanger: handle rating submission from callout
  const handleRatingSubmit = async (params: { feature: Feature; rating: number; imageUri?: string }) => {
    if (!tripData || !user) return;

    try {
      // Active trips always have 'active' status - no time window restriction
      await DataRangerService.rateFeature(
        params.feature,
        tripData.metadata.tripId,
        user.id,
        params.rating,
        'active',
        params.imageUri
      );
      
      setRatedCount(DataRangerService.getRatedCountForCurrentTrip());

      // Re-query to update rated status of markers
      if (userPosition) {
        const [lon, lat] = userPosition;
        setNearbyFeatures(DataRangerService.queryNearbyFeatures(lat, lon));
      }
    } catch (error) {
      console.error('[ActiveTripScreen] Failed to submit rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    }
  };

  // Helper: Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

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
  const handlePauseResume = async () => {
    mediumImpact();
    try {
      if (isPaused) {
        await TripService.resumeTrip();
        setIsPaused(false);
        console.log('[ActiveTripScreen] Trip resumed');
      } else {
        await TripService.pauseTrip();
        setIsPaused(true);
        console.log('[ActiveTripScreen] Trip paused');
      }
    } catch (err) {
      console.error('[ActiveTripScreen] Failed to pause/resume trip:', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to pause/resume trip'
      );
    }
  };

  // Handle stop trip - show confirmation, then post-trip survey
  const handleStopTrip = () => {
    warningNotification();
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: () => {
            // Show the post-trip survey modal
            setShowPostTripModal(true);
          },
        },
      ]
    );
  };

  // Handle post-trip survey completion - end trip with reached_dest and navigate
  const handlePostTripComplete = async (result: PostTripResult) => {
    setShowPostTripModal(false);

    // Clean up DataRanger state
    if (isDataRanger) {
      DataRangerService.endTrip();
      setNearbyFeatures([]);
    }

    try {
      const summary = await TripService.endTrip(result.reachedDest);
      console.log('[ActiveTripScreen] Trip ended:', summary);

      // Validate tripId before navigation
      if (!summary.tripId) {
        Alert.alert(
          'Error',
          'Failed to save trip. Please check your connection and try again.'
        );
        return;
      }

      // Check sync status
      const syncStatus = SyncService.getSyncStatus();
      if (syncStatus.isPending) {
        Alert.alert(
          'Trip Saved',
          'Your trip has been saved locally and will sync when you have internet connection.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace({
                  pathname: '/(main)/trip-summary',
                  params: { tripId: summary.tripId },
                });
              },
            },
          ]
        );
      } else {
        // Navigate to trip summary
        router.replace({
          pathname: '/(main)/trip-summary',
          params: { tripId: summary.tripId },
        });
      }
    } catch (err) {
      console.error('[ActiveTripScreen] Failed to end trip:', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to end trip'
      );
    }
  };

  // Handle recenter
  const handleRecenter = () => {
    mediumImpact();
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

  // Show loading state
  if (isLoading) {
    return (
      <BasemapLayout
        ref={mapRef}
        polylines={[]}
        userPosition={userPosition}
        showUserLocation={true}
        zoomLevel={16}
        body={
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Starting trip...</ThemedText>
          </View>
        }
      />
    );
  }

  // Show error state
  if (error || !tripData) {
    return (
      <BasemapLayout
        ref={mapRef}
        polylines={[]}
        userPosition={userPosition}
        showUserLocation={true}
        zoomLevel={16}
        body={
          <View style={styles.loadingContainer}>
            <ThemedText style={[styles.errorText, { color: errorColor }]}>
              {error || 'No trip data available'}
            </ThemedText>
          </View>
        }
      />
    );
  }

  // Render trip stats card in body slot
  const renderBody = () => (
    <View style={[styles.bodyContainer, { paddingTop: insets.top + 16 }]}>
      <ThemedView style={[styles.statsCard, { backgroundColor: colors.background }]}>
        {/* Mode */}
        <View style={styles.modeContainer}>
          <Ionicons
            name={getModeIcon(tripData.metadata.mode)}
            size={20}
            color={colors.tint}
          />
          <ThemedText style={styles.modeText}>
            {tripData.metadata.mode.charAt(0).toUpperCase() + tripData.metadata.mode.slice(1)}
          </ThemedText>
        </View>

        {/* Trip Stats - Duration and Distance Only */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={18} color={colors.icon} />
            <ThemedText style={styles.statLabel}>Duration</ThemedText>
            <ThemedText style={styles.statValue}>{formatDuration(duration)}</ThemedText>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={18} color={colors.icon} />
            <ThemedText style={styles.statLabel}>Distance</ThemedText>
            <ThemedText style={styles.statValue}>{formatDistance(distance)}</ThemedText>
          </View>

          {isDataRanger && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="star-outline" size={18} color={colors.icon} />
                <ThemedText style={styles.statLabel}>Rated</ThemedText>
                <ThemedText style={styles.statValue}>{ratedCount}</ThemedText>
              </View>
            </>
          )}
        </View>
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
        <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color={colors.buttonText} />
        <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
          {isPaused ? 'Resume' : 'Pause'}
        </ThemedText>
      </TouchableOpacity>

      {/* Stop Button */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          styles.stopButton,
          { backgroundColor: colors.buttonDanger },
        ]}
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
    <>
      <BasemapLayout
        ref={mapRef}
        polylines={[currentPolyline]}
        features={isDataRanger ? nearbyFeatures : undefined}
        onRatingSubmit={isDataRanger ? handleRatingSubmit : undefined}
        userPosition={userPosition}
        showUserLocation={true}
        zoomLevel={16}
        body={renderBody()}
        secondaryFooter={renderSecondaryFooter()}
        footer={renderFooter()}
      />
      <TripModal
        visible={showPostTripModal}
        postTripMode={true}
        onClose={() => setShowPostTripModal(false)}
        onStartTrip={() => {}}
        onPostTripComplete={handlePostTripComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bodyContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    // paddingTop applied dynamically with safe area insets
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    // color applied dynamically
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    opacity: 0.95,
  },
  modeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  footerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.3)',
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
    fontWeight: '800',
  },
});
