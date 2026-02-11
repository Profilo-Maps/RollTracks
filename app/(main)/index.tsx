import { Trip } from '@/adapters/DatabaseAdapter';
import { NativeAdapter } from '@/adapters/NativeAdapter';
import { BottomNavigationBarComponent } from '@/components/BottomNavigationBarComponent';
import { Feature, MapViewComponentRef, Polyline } from '@/components/MapViewComponent';
import { RecenterButton } from '@/components/RecenterButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { HistoryService } from '@/services/HistoryService';
import { TripService } from '@/services/TripService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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
  const mapRef = useRef<MapViewComponentRef>(null);
  const insets = useSafeAreaInsets();

  // Theme colors
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  // State for trip data
  const [trips, setTrips] = useState<Trip[]>([]);
  const [polylines, setPolylines] = useState<Polyline[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for user location from GPS Adapter
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

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

  // Get user's current location from GPS Adapter and update periodically
  useEffect(() => {
    let isSubscribed = true;

    const updateUserLocation = async () => {
      try {
        // Check if permissions are granted
        const { granted } = await NativeAdapter.checkPermissions();
        if (!granted) {
          console.log('[HomeScreen] GPS permissions not granted, skipping location update');
          return;
        }

        // Get current position
        const position = await NativeAdapter.getCurrentPosition();
        if (isSubscribed) {
          setUserPosition([position.longitude, position.latitude]);
          console.log('[HomeScreen] User position updated:', position.latitude, position.longitude);
        }
      } catch (error) {
        console.error('[HomeScreen] Failed to get user position:', error);
        // Don't set error state - just log it
      }
    };

    // Get initial position
    updateUserLocation();

    // Update position every 10 seconds
    const intervalId = setInterval(updateUserLocation, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, []);

  // Fetch trip data and convert to polylines for map display
  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch completed trips for map display
        const completedTrips = await HistoryService.getUserTrips({ status: 'completed' });
        setTrips(completedTrips);

        // Convert trips to polylines for MapView
        const tripPolylines: Polyline[] = completedTrips.map((trip) => ({
          id: trip.tripId,
          coordinates: trip.geometry.coordinates as [number, number][],
          color: getModeColor(trip.mode),
          width: 4,
        }));
        setPolylines(tripPolylines);

        // Clear features (DataRanger functionality removed)
        setFeatures([]);
      } catch (err) {
        console.error('[HomeScreen] Failed to load trip data:', err);
        setError('Failed to load trip data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTripData();
  }, []);

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
  // If no trips, return undefined so map uses userPosition
  const calculateMapBounds = (): {
    centerCoordinate: [number, number];
    zoomLevel: number;
  } | undefined => {
    if (polylines.length === 0) return undefined; // Let map use userPosition

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

  const mapBounds = calculateMapBounds();

  // Navigate to profile screen
  const handleProfilePress = () => {
    router.push('/(auth)/profile');
  };

  // Handle recenter button press
  const handleRecenter = () => {
    mapRef.current?.recenter();
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

  // Render loading state
  if (isLoading) {
    return (
      <BasemapLayout
        userPosition={userPosition}
        showUserLocation={true}
        header={renderHeader()}
        footer={renderFooter()}
        secondaryFooter={renderSecondaryFooter()}
      >
        <View style={styles.centerContainer}>
          <ThemedView style={styles.loadingCard}>
            <ActivityIndicator size="large" />
            <ThemedText style={styles.loadingText}>Loading your trips...</ThemedText>
          </ThemedView>
        </View>
      </BasemapLayout>
    );
  }

  // Render error state
  if (error) {
    return (
      <BasemapLayout
        userPosition={userPosition}
        showUserLocation={true}
        header={renderHeader()}
        footer={renderFooter()}
        secondaryFooter={renderSecondaryFooter()}
      >
        <View style={styles.centerContainer}>
          <ThemedView style={styles.errorCard}>
            <ThemedText type="subtitle">Error</ThemedText>
            <ThemedText>{error}</ThemedText>
          </ThemedView>
        </View>
      </BasemapLayout>
    );
  }

  // Render empty state (no trips yet)
  if (trips.length === 0) {
    return (
      <BasemapLayout
        userPosition={userPosition}
        showUserLocation={true}
        header={renderHeader()}
        footer={renderFooter()}
        secondaryFooter={renderSecondaryFooter()}
      >
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
      </BasemapLayout>
    );
  }

  // Render main map view with trips
  return (
    <BasemapLayout
      ref={mapRef}
      polylines={polylines}
      features={features}
      centerPosition={mapBounds?.centerCoordinate}
      zoomLevel={mapBounds?.zoomLevel}
      userPosition={userPosition}
      showUserLocation={true}
      header={renderHeader()}
      footer={renderFooter()}
      secondaryFooter={renderSecondaryFooter()}
    />
  );
}

const styles = StyleSheet.create({
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
