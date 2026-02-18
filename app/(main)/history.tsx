import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripSummary } from '@/adapters/DatabaseAdapter';
import { BottomNavigationBarComponent } from '@/components/BottomNavigationBarComponent';
import { TripHistoryCard } from '@/components/TripHistoryCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useMap } from '@/contexts/MapContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { HistoryService } from '@/services/HistoryService';
import { TripService } from '@/services/TripService';
import { mediumImpact } from '@/utils/haptics';

/**
 * Trip History Screen
 * Built with persistent map background (dimmed and frozen).
 *
 * Features:
 * - List of Trip Summary Cards in body slot
 * - Profile button in header (launches Profile Screen)
 * - Map displays all completed trips (dimmed)
 * - Empty state for new users with no trips
 * - Checks for orphaned trips on mount and prompts user
 */
export default function TripHistoryScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const errorColor = useThemeColor({}, 'error');
  const { user } = useAuth();
  const mapContext = useMap();
  const insets = useSafeAreaInsets();

  // State
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for orphaned trip modal
  const [shouldShowOrphanedTripModal, setShouldShowOrphanedTripModal] = useState(false);

  // Check for orphaned trips when user logs in (only once per login session)
  useEffect(() => {
    const checkForOrphanedTrips = async () => {
      if (!user) return;

      try {
        const orphanedTrip = await TripService.checkForOrphanedTrip();
        if (orphanedTrip) {
          console.log('[TripHistoryScreen] Orphaned trip detected on mount, showing modal');
          setShouldShowOrphanedTripModal(true);
        }
      } catch (error) {
        console.error('[TripHistoryScreen] Failed to check for orphaned trips:', error);
      }
    };

    checkForOrphanedTrips();
  }, [user]);

  // Fetch trip summaries and update map
  useEffect(() => {
    const loadTrips = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const tripSummaries = await HistoryService.getTripSummaries();
        setTrips(tripSummaries);

        // Fetch full trip data for map display
        const completedTrips = await HistoryService.getUserTrips({ status: 'completed' });
        
        // Convert trips to polylines for map
        const tripPolylines: Polyline[] = completedTrips
          .map((trip) => {
            const coordinates = HistoryService.decodePolyline(trip.geometry);
            
            if (coordinates.length === 0) {
              console.warn('[TripHistoryScreen] Failed to decode polyline for trip:', trip.tripId);
              return null;
            }
            
            return {
              id: trip.tripId,
              coordinates,
              color: getModeColor(trip.mode),
              width: 4,
            };
          })
          .filter((polyline): polyline is Polyline => polyline !== null);

        // Calculate map bounds
        const mapBounds = calculateMapBounds(tripPolylines);

        // Update map context with dimmed state
        mapContext.updateMapState({
          polylines: tripPolylines,
          features: [],
          centerPosition: mapBounds?.centerCoordinate,
          zoomLevel: mapBounds?.zoomLevel ?? 15,
          interactionState: 'dimmed', // Frozen and dimmed
          showUserLocation: false, // Hide user location on history screen
        });
      } catch (err) {
        console.error('[TripHistoryScreen] Failed to load trips:', err);
        setError('Failed to load trip history');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrips();

    // Cleanup: reset map state when leaving screen
    return () => {
      mapContext.updateMapState({
        interactionState: 'interactive',
        showUserLocation: true,
      });
    };
  }, [mapContext.updateMapState]);

  // Navigate to profile screen
  const handleProfilePress = () => {
    mediumImpact();
    router.push('/(auth)/profile');
  };

  // Get color based on transport mode
  const getModeColor = (mode: string): string => {
    const modeColors: Record<string, string> = {
      wheelchair: '#2196F3', // Blue
      skateboard: '#FF9800', // Orange
      'assisted walking': '#4CAF50', // Green
      walking: '#9C27B0', // Purple
      scooter: '#F44336', // Red
    };
    return modeColors[mode.toLowerCase()] ?? '#757575'; // Gray default
  };

  // Calculate bounding box for all trips
  const calculateMapBounds = (polylines: Polyline[]): {
    centerCoordinate: [number, number];
    zoomLevel: number;
  } | undefined => {
    if (polylines.length === 0) return undefined;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    polylines.forEach((polyline) => {
      polyline.coordinates.forEach(([lng, lat]) => {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calculate appropriate zoom level
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoomLevel = 15;
    if (maxDiff > 0.1) zoomLevel = 11;
    else if (maxDiff > 0.05) zoomLevel = 12;
    else if (maxDiff > 0.02) zoomLevel = 13;
    else if (maxDiff > 0.01) zoomLevel = 14;

    return {
      centerCoordinate: [centerLng, centerLat],
      zoomLevel,
    };
  };

  // Navigate to trip summary screen
  const handleTripPress = (tripId: string) => {
    mediumImpact();
    router.push({
      pathname: '/(main)/trip-summary',
      params: { tripId },
    });
  };

  // Handle orphaned trip modal visibility changes
  const handleModalVisibilityChange = (visible: boolean) => {
    // When modal closes, reset the auto-open flag
    if (!visible) {
      setShouldShowOrphanedTripModal(false);
    }
  };

  // Render header with title and profile button
  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <ThemedText type="title" style={styles.headerTitle}>Trip History</ThemedText>
      <Pressable 
        style={[styles.profileButton, { backgroundColor }]}
        onPress={handleProfilePress}
        accessibilityLabel="Open profile"
        accessibilityRole="button"
      >
        <Ionicons name="person-circle-outline" size={32} color={tintColor} />
      </Pressable>
    </View>
  );

  // Render loading state
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={styles.messageCard}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.messageText}>Loading trips...</ThemedText>
      </ThemedView>
    </View>
  );

  // Render error state
  const renderError = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={styles.messageCard}>
        <Ionicons name="alert-circle-outline" size={48} color={errorColor} />
        <ThemedText type="subtitle" style={styles.errorTitle}>
          {error}
        </ThemedText>
        <Pressable
          onPress={() => {
            setIsLoading(true);
            setError(null);
            HistoryService.getTripSummaries()
              .then(setTrips)
              .catch((err) => {
                console.error('[TripHistoryScreen] Retry failed:', err);
                setError('Failed to load trip history');
              })
              .finally(() => setIsLoading(false));
          }}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: tintColor },
            pressed && styles.retryButtonPressed,
          ]}
        >
          <ThemedText style={[styles.retryButtonText, { color: buttonTextColor }]}>Retry</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );

  // Render empty state (no trips yet)
  const renderEmptyState = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={styles.messageCard}>
        <View style={[styles.emptyIconContainer, { backgroundColor: `${tintColor}20` }]}>
          <Ionicons name="map-outline" size={64} color={tintColor} />
        </View>
        <ThemedText type="subtitle" style={styles.emptyTitle}>
          No Trips Yet
        </ThemedText>
        <ThemedText style={styles.emptyMessage}>
          Start recording your first trip to see it appear here.
        </ThemedText>
        <ThemedText style={styles.emptyHint}>
          Tap the record button at the bottom to get started!
        </ThemedText>
      </ThemedView>
    </View>
  );

  // Render trip list
  const renderTripList = () => (
    <View style={styles.tripListContainer}>
      {trips.map((trip) => (
        <TripHistoryCard
          key={trip.tripId}
          trip={{
            ...trip,
            userId: user?.id || '',
            comfort: 5, // Default comfort, will be in trip data
            purpose: '', // Default purpose, will be in trip data
            status: 'completed' as const,
            geometry: trip.geometry || '',
            featuresRated: trip.ratingCount,
            segmentsCorrected: trip.correctionCount,
            durationS: trip.durationS || 0,
            distanceMi: trip.distanceMi || 0,
          }}
          onPress={() => handleTripPress(trip.tripId)}
          showDataRangerStats={user?.dataRangerMode}
          variant="card"
        />
      ))}
    </View>
  );

  // Render body based on state
  const renderBody = () => (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scrollContent,
        (isLoading || error || trips.length === 0) && styles.scrollContentCentered,
      ]}
    >
      {isLoading && renderLoading()}
      {error && !isLoading && renderError()}
      {!isLoading && !error && trips.length === 0 && renderEmptyState()}
      {!isLoading && !error && trips.length > 0 && renderTripList()}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderBody()}
      <BottomNavigationBarComponent
        autoOpenModal={shouldShowOrphanedTripModal}
        onModalVisibilityChange={handleModalVisibilityChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Allow map to show through
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    flex: 1,
  },
  profileButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  messageCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
    opacity: 0.95, // Semi-transparent to show map behind
  },
  messageText: {
    marginTop: 12,
    textAlign: 'center',
  },
  // Empty state styles
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    marginBottom: 12,
  },
  emptyMessage: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyHint: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  // Error state styles
  errorTitle: {
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontWeight: '800',
    // Color applied dynamically via inline style
  },
  // Trip list styles
  tripListContainer: {
    paddingBottom: 16,
  },
});
