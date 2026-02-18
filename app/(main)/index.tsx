import { Trip } from '@/adapters/DatabaseAdapter';
import { BottomNavigationBarComponent } from '@/components/BottomNavigationBarComponent';
import { Polyline } from '@/components/MapViewComponent';
import { RecenterButton } from '@/components/RecenterButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useMap } from '@/contexts/MapContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { HistoryService } from '@/services/HistoryService';
import { TripService } from '@/services/TripService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Home Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - Profile button in header slot (right side)
 * - Bottom Navigation Bar in footer slot
 * - Recenter button in secondary footer slot (right side)
 * - Displays all trip polyline data using History Service
 * - In DataRanger mode: shows rated features, unrated features along routes, recorded segments
 * - Map zoom automatically fits all trip data
 * - Checks for orphaned trips on mount and prompts user
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const mapContext = useMap();
  const insets = useSafeAreaInsets();

  // Theme colors
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  // State for trip data
  const [trips, setTrips] = useState<Trip[]>([]);
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
          console.log('[HomeScreen] Orphaned trip detected on mount, showing modal');
          setShouldShowOrphanedTripModal(true);
        }
      } catch (error) {
        console.error('[HomeScreen] Failed to check for orphaned trips:', error);
      }
    };

    checkForOrphanedTrips();
  }, [user]);

  // Fetch trip data and update map context
  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch completed trips for map display
        const completedTrips = await HistoryService.getUserTrips({ status: 'completed' });
        setTrips(completedTrips);

        // Convert trips to polylines for MapView
        const tripPolylines: Polyline[] = completedTrips
          .map((trip) => {
            // Decode polyline string to coordinates
            const coordinates = HistoryService.decodePolyline(trip.geometry);
            
            if (coordinates.length === 0) {
              console.warn('[HomeScreen] Failed to decode polyline for trip:', trip.tripId);
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

        // Calculate map bounds for trips
        const mapBounds = calculateMapBounds(tripPolylines);

        // Update map context with trip data
        mapContext.updateMapState({
          polylines: tripPolylines,
          features: [],
          centerPosition: mapBounds?.centerCoordinate,
          zoomLevel: mapBounds?.zoomLevel ?? 15,
          interactionState: 'interactive',
          showUserLocation: true,
        });
      } catch (err) {
        console.error('[HomeScreen] Failed to load trip data:', err);
        setError('Failed to load trip data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTripData();
  }, [mapContext]);

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

  // Calculate bounding box for all trips to set initial map view
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

    // Calculate appropriate zoom level based on bounds
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    // Rough zoom level calculation (adjust as needed)
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

  // Navigate to profile screen
  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/profile');
  };

  // Handle recenter button press
  const handleRecenter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mapContext.recenterToUser();
  };

  // Handle orphaned trip modal visibility changes
  const handleModalVisibilityChange = (visible: boolean) => {
    // When modal closes, reset the auto-open flag
    if (!visible) {
      setShouldShowOrphanedTripModal(false);
    }
  };

  // Render header with profile button
  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <Pressable 
        style={[styles.profileButton, { backgroundColor }]}
        onPress={handleProfilePress}
        accessibilityLabel="Open profile"
        accessibilityHint="Navigate to your profile settings"
        accessibilityRole="button"
      >
        <Ionicons name="person-circle-outline" size={32} color={tintColor} />
      </Pressable>
    </View>
  );

  // Render secondary footer with recenter button
  const renderSecondaryFooter = () => (
    <RecenterButton onPress={handleRecenter} position="secondary-footer" />
  );

  // Render footer with bottom navigation bar
  const renderFooter = () => (
    <BottomNavigationBarComponent
      autoOpenModal={shouldShowOrphanedTripModal}
      onModalVisibilityChange={handleModalVisibilityChange}
    />
  );

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ThemedView style={styles.errorCard}>
            <ThemedText type="subtitle">Error</ThemedText>
            <ThemedText>{error}</ThemedText>
          </ThemedView>
        </View>
        <View style={styles.spacer} />
        {renderSecondaryFooter()}
        {renderFooter()}
      </View>
    );
  }

  // Render empty state (no trips yet)
  if (trips.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ThemedView style={styles.welcomeCard}>
            <ThemedText type="subtitle">Welcome to RollTracks</ThemedText>
            <ThemedText style={styles.welcomeText}>
              Start recording your first trip to see it on the map.
            </ThemedText>
            <ThemedText style={styles.hintText}>
              Tap the record button below to get started.
            </ThemedText>
          </ThemedView>
        </View>
        <View style={styles.spacer} />
        {renderSecondaryFooter()}
        {renderFooter()}
      </View>
    );
  }

  // Render main view with trips displayed on map
  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.spacer} />
      {renderSecondaryFooter()}
      {renderFooter()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  spacer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
    opacity: 0.95,
  },
  welcomeText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
  },
  hintText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.7,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    opacity: 0.95,
  },
  loadingText: {
    marginTop: 12,
  },
  errorCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    opacity: 0.95,
  },
});
