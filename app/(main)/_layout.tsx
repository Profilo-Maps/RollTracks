import { NativeAdapter } from '@/adapters/NativeAdapter';
import { MapViewComponent } from '@/components/MapViewComponent';
import { MapProvider, useMap } from '@/contexts/MapContext';
import { Slot } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Main Layout with Persistent Map
 * 
 * This layout provides a PERSISTENT MapViewComponent that stays mounted
 * across all screens in the (main) stack. The map will NOT re-render when
 * navigating between screens.
 * 
 * Screens use MapContext to update what's displayed on the map without
 * causing re-renders. They render their UI content on top of the persistent
 * map background.
 * 
 * Structure:
 * - Map View Component: Full screen background layer (PERSISTENT)
 * - Screen Content: Rendered via Slot, overlays the map
 * 
 * Note: Screens are responsible for their own layout structure (header, body, footer slots)
 */
export default function MainLayout() {
  return (
    <MapProvider>
      <MainLayoutContent />
    </MapProvider>
  );
}

function MainLayoutContent() {
  const mapContext = useMap();
  const mapRef = useRef<any>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Wait a tick before initializing to ensure auth is ready
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Track user position and update context
  useEffect(() => {
    if (!isReady) return;

    let isSubscribed = true;

    const updateUserLocation = async () => {
      try {
        const { granted } = await NativeAdapter.checkPermissions();
        if (!granted) return;

        const position = await NativeAdapter.getCurrentPosition();
        if (isSubscribed) {
          setUserPosition([position.longitude, position.latitude]);
        }
      } catch (error) {
        console.error('[MainLayout] Failed to get user position:', error);
      }
    };

    updateUserLocation();
    const intervalId = setInterval(updateUserLocation, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [isReady]);

  // Handle recenter trigger from context
  useEffect(() => {
    if (mapContext.recenterTrigger > 0 && mapRef.current && userPosition) {
      // Recenter map to user position
      mapRef.current.setCamera?.({
        centerCoordinate: userPosition,
        zoomLevel: mapContext.zoomLevel ?? 15,
        animationDuration: 500,
      });
    }
  }, [mapContext.recenterTrigger, userPosition, mapContext.zoomLevel]);

  return (
    <View style={styles.container}>
      {/* Persistent Map Background - stays mounted across all screens */}
      <View style={styles.mapBackground}>
        <MapViewComponent
          polylines={mapContext.polylines}
          polygonOutlines={mapContext.polygonOutlines}
          features={mapContext.features}
          centerPosition={mapContext.centerPosition}
          zoomLevel={mapContext.zoomLevel}
          interactionState={mapContext.interactionState}
          showUserLocation={mapContext.showUserLocation}
          onFeaturePress={mapContext.onFeaturePress}
          userPosition={userPosition}
        />
      </View>

      {/* Screen Content Overlay - changes with navigation */}
      <View style={styles.screenOverlay}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  screenOverlay: {
    flex: 1,
    pointerEvents: 'box-none', // Allow touches to pass through to map
  },
});
