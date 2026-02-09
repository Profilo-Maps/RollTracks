import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { BottomNavigationBarComponent } from '@/components/BottomNavigationBarComponent';
import { RecenterButton } from '@/components/RecenterButton';
import { MapViewComponentRef, Polyline, Feature } from '@/components/MapViewComponent';
import { HistoryService } from '@/services/HistoryService';
import { useAuth } from '@/contexts/AuthContext';
import { Trip, RatedFeature, CorrectedSegment } from '@/adapters/DatabaseAdapter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Home Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - Bottom Navigation Bar in footer slot
 * - Recenter button in secondary footer slot (right side)
 * - Displays all trip polyline data using History Service
 * - In DataRanger mode: shows rated features, unrated features along routes, recorded segments
 * - Map zoom automatically fits all trip data
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const mapRef = useRef<MapViewComponentRef>(null);

  // State for trip data
  const [trips, setTrips] = useState<Trip[]>([]);
  const [polylines, setPolylines] = useState<Polyline[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trip data and convert to polylines/features for map display
  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch completed trips for map display
        const completedTrips = await HistoryService.getCompletedTripsForMap();
        setTrips(completedTrips);

        // Convert trips to polylines for MapView
        const tripPolylines: Polyline[] = completedTrips.map((trip) => ({
          id: trip.tripId,
          coordinates: trip.geometry.coordinates as [number, number][],
          color: getModeColor(trip.mode),
          width: 4,
        }));
        setPolylines(tripPolylines);

        // If DataRanger mode is on, fetch and display rated features and corrections
        if (user?.dataRangerMode) {
          const [ratings, corrections] = await Promise.all([
            HistoryService.getUserRatings(),
            HistoryService.getUserCorrections(),
          ]);

          // Convert ratings to feature markers
          const ratingFeatures: Feature[] = ratings.map((rating) => ({
            id: `rating-${rating.id}`,
            coordinate: [rating.long, rating.lat],
            type: 'curb_ramp',
            properties: {
              rated: true,
              condition_score: rating.conditionScore,
              location_description: rating.crisId,
            },
          }));

          // Convert corrections to feature markers (using first coordinate of line)
          const correctionFeatures: Feature[] = corrections.map((correction) => ({
            id: `correction-${correction.id}`,
            coordinate: correction.geometry.coordinates[0] as [number, number],
            type: 'segment',
            properties: {
              flag_status: true,
              from_st: correction.correctedSegmentId,
            },
          }));

          setFeatures([...ratingFeatures, ...correctionFeatures]);
        } else {
          setFeatures([]);
        }
      } catch (err) {
        console.error('[HomeScreen] Failed to load trip data:', err);
        setError('Failed to load trip data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTripData();
  }, [user?.dataRangerMode]);

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
  const calculateMapBounds = (): {
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

  const mapBounds = calculateMapBounds();

  // Handle recenter button press
  const handleRecenter = () => {
    mapRef.current?.recenter();
  };

  // Render secondary footer with recenter button
  const renderSecondaryFooter = () => (
    <RecenterButton onPress={handleRecenter} position="secondary-footer" />
  );

  // Render footer with bottom navigation bar
  const renderFooter = () => (
    <BottomNavigationBarComponent />
  );

  // Render loading state
  if (isLoading) {
    return (
      <BasemapLayout
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
      showUserLocation={true}
      footer={renderFooter()}
      secondaryFooter={renderSecondaryFooter()}
    />
  );
}

const styles = StyleSheet.create({
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
