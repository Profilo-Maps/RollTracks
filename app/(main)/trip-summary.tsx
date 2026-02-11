import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Trip } from '@/adapters/DatabaseAdapter';
import { MapViewComponentRef, PolygonOutline, Polyline } from '@/components/MapViewComponent';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripHistoryCard } from '@/components/TripHistoryCard';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { HistoryService } from '@/services/HistoryService';
import { SyncService } from '@/services/SyncService';

/**
 * Trip Summary Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - Given a trip_id, displays relevant route data via History Service
 * - Trip History Card in drawer format in footer slot
 * - Map centered on trip route with appropriate zoom
 * - Back button in header to return to previous screen
 * - Shows cached raw GPS data for unsynced trips (before census block clipping)
 */
export default function TripSummaryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const mapRef = useRef<MapViewComponentRef>(null);

  // State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [polyline, setPolyline] = useState<Polyline | null>(null);
  const [blockOutlines, setBlockOutlines] = useState<PolygonOutline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'icon');

  // Fetch trip data
  useEffect(() => {
    const loadTripData = async () => {
      if (!tripId) {
        setError('No trip ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // First, check if we have cached raw GPS data for this trip
        // This allows users to see their full route immediately after ending a trip,
        // before server-side census block clipping modifies it
        const cachedTrip = await SyncService.getCachedRawTrip(tripId);

        if (cachedTrip && !cachedTrip.synced) {
          // Use cached raw GPS data for unsynced trips
          console.log('[TripSummaryScreen] Using cached raw GPS data for unsynced trip');
          setTrip(cachedTrip.trip);

          // Decode polyline string to coordinates
          console.log('[TripSummaryScreen] Cached trip geometry:', {
            hasGeometry: !!cachedTrip.trip.geometry,
            geometryType: typeof cachedTrip.trip.geometry,
            geometryLength: cachedTrip.trip.geometry?.length,
            geometrySample: cachedTrip.trip.geometry?.substring(0, 50),
          });
          
          const coordinates = HistoryService.decodePolyline(cachedTrip.trip.geometry);
          
          console.log('[TripSummaryScreen] Decoded cached coordinates:', {
            count: coordinates.length,
            first: coordinates[0],
            last: coordinates[coordinates.length - 1],
          });
          
          if (coordinates.length < 2) {
            console.warn('[TripSummaryScreen] Insufficient cached coordinates for polyline (need at least 2, got ' + coordinates.length + ')');
            setError('This trip has insufficient GPS data to display a route.');
            setIsLoading(false);
            return;
          }
          
          if (coordinates.length > 0) {
            const tripPolyline: Polyline = {
              id: cachedTrip.trip.tripId,
              coordinates,
              color: getModeColor(cachedTrip.trip.mode),
              width: 5,
            };
            setPolyline(tripPolyline);
            console.log('[TripSummaryScreen] Cached polyline set successfully');
          } else {
            console.warn('[TripSummaryScreen] No coordinates decoded from cached geometry');
          }
          
          setIsLoading(false);
          return;
        }

        // Fetch trip from server (will have clipped geometry if synced)
        const tripData = await HistoryService.getTrip(tripId);

        if (!tripData) {
          setError('Trip not found');
          setIsLoading(false);
          return;
        }

        // If we have cached data and trip is now synced, clear the cache
        if (cachedTrip && cachedTrip.synced) {
          console.log('[TripSummaryScreen] Trip synced, clearing raw GPS cache');
          await SyncService.clearCachedRawTrip(tripId);
        }

        setTrip(tripData);

        // Decode polyline string to coordinates
        console.log('[TripSummaryScreen] Trip geometry:', {
          hasGeometry: !!tripData.geometry,
          geometryType: typeof tripData.geometry,
          geometryLength: tripData.geometry?.length,
          geometrySample: tripData.geometry?.substring(0, 50),
        });
        
        const coordinates = HistoryService.decodePolyline(tripData.geometry);
        
        console.log('[TripSummaryScreen] Decoded coordinates:', {
          count: coordinates.length,
          first: coordinates[0],
          last: coordinates[coordinates.length - 1],
        });
        
        if (coordinates.length < 2) {
          console.warn('[TripSummaryScreen] Insufficient coordinates for polyline (need at least 2, got ' + coordinates.length + ')');
          setError('This trip has insufficient GPS data to display a route.');
          setIsLoading(false);
          return;
        }
        
        if (coordinates.length > 0) {
          const tripPolyline: Polyline = {
            id: tripData.tripId,
            coordinates,
            color: getModeColor(tripData.mode),
            width: 5,
          };
          setPolyline(tripPolyline);
          console.log('[TripSummaryScreen] Polyline set successfully');
        } else {
          console.warn('[TripSummaryScreen] No coordinates decoded from geometry');
        }

        // Convert block polygons to outlines for map display
        console.log('[TripSummaryScreen] Block polygon data:', {
          hasOdBlockPolygons: !!tripData.odBlockPolygons,
          odBlockPolygonsLength: tripData.odBlockPolygons?.length,
          hasOdGeoids: !!tripData.odGeoids,
          odGeoids: tripData.odGeoids,
        });
        
        if (tripData.odBlockPolygons) {
          const [originPolygon, destPolygon] = tripData.odBlockPolygons;
          const outlines: PolygonOutline[] = [];

          console.log('[TripSummaryScreen] Processing block polygons:', {
            hasOrigin: !!originPolygon,
            hasDest: !!destPolygon,
            originCoords: originPolygon?.coordinates?.length,
            destCoords: destPolygon?.coordinates?.length,
          });

          if (originPolygon) {
            outlines.push({
              id: `origin-${tripData.tripId}`,
              coordinates: originPolygon.coordinates as [number, number][][],
              color: '#FF6B6B', // Red for origin
              width: 4,
            });
            console.log('[TripSummaryScreen] Added origin polygon outline');
          }

          if (destPolygon) {
            outlines.push({
              id: `dest-${tripData.tripId}`,
              coordinates: destPolygon.coordinates as [number, number][][],
              color: '#4ECDC4', // Teal for destination
              width: 4,
            });
            console.log('[TripSummaryScreen] Added destination polygon outline');
          }

          if (outlines.length > 0) {
            setBlockOutlines(outlines);
            console.log('[TripSummaryScreen] Set ' + outlines.length + ' block outlines');
          } else {
            console.warn('[TripSummaryScreen] No valid block polygons to display');
          }
        } else {
          console.log('[TripSummaryScreen] No odBlockPolygons data available');
        }
      } catch (err) {
        console.error('[TripSummaryScreen] Failed to load trip data:', err);
        setError('Failed to load trip data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTripData();
  }, [tripId]);

  // Get color based on transport mode
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

  // Calculate map bounds for trip
  const calculateMapBounds = (): {
    centerCoordinate: [number, number];
    zoomLevel: number;
  } | undefined => {
    if (!polyline) return undefined;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    polyline.coordinates.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calculate zoom level
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

  const mapBounds = calculateMapBounds();

  // Handle back button press
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(main)');
    }
  };

  // Render header with back button
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor },
          pressed && styles.backButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={iconColor} />
      </Pressable>
    </View>
  );

  // Handle trip card press (no-op for trip summary screen)
  const handleTripCardPress = () => {
    // Already on trip summary, do nothing
  };

  // Render footer with trip history card in drawer format
  const renderFooter = () => {
    if (!trip) return null;

    return (
      <TripHistoryCard
        trip={trip}
        onPress={handleTripCardPress}
        showDataRangerStats={false}
        variant="drawer"
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <BasemapLayout
        header={renderHeader()}
        body={
          <View style={styles.centerContainer}>
            <ThemedView style={styles.loadingCard}>
              <ActivityIndicator size="large" />
              <ThemedText style={styles.loadingText}>Loading trip...</ThemedText>
            </ThemedView>
          </View>
        }
      />
    );
  }

  // Error state
  if (error || !trip) {
    return (
      <BasemapLayout
        header={renderHeader()}
        body={
          <View style={styles.centerContainer}>
            <ThemedView style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={48} color="#FF5252" />
              <ThemedText type="subtitle" style={styles.errorTitle}>
                {error || 'Trip not found'}
              </ThemedText>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.errorButton,
                  pressed && styles.errorButtonPressed,
                ]}
              >
                <ThemedText style={styles.errorButtonText}>Go Back</ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        }
      />
    );
  }

  // Main trip summary view
  return (
    <BasemapLayout
      ref={mapRef}
      polylines={polyline ? [polyline] : []}
      polygonOutlines={blockOutlines}
      centerPosition={mapBounds?.centerCoordinate}
      zoomLevel={mapBounds?.zoomLevel}
      showUserLocation={false}
      header={renderHeader()}
      footer={renderFooter()}
    />
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    opacity: 0.95,
    maxWidth: 400,
  },
  errorTitle: {
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  errorButtonPressed: {
    opacity: 0.7,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
