import { Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MapViewComponent } from '@/components/MapViewComponent';
import { MapProvider, useMap } from '@/contexts/MapContext';

/**
 * Basemap Layout
 * Displays all user route and feature data with a persistent map background.
 *
 * Structure:
 * - Map View Component: Full screen background layer (persistent across screens)
 * - Screen Content Overlay: Screens render via Slot and contribute data to shared map
 *
 * The MapView instance persists across navigation, preventing tile reloading.
 * Screens use the useMap() hook to update map data (polylines, features, position, etc.)
 */
function BasemapLayoutContent() {
  const {
    polylines,
    polygonOutlines,
    features,
    userPosition,
    centerPosition,
    zoomLevel,
    mapStyle,
    gpsError,
  } = useMap();

  return (
    <View style={styles.container}>
      {/* Map View Component - Persistent Background Layer */}
      <View style={styles.mapContainer}>
        <MapViewComponent
          polylines={polylines}
          polygonOutlines={polygonOutlines}
          features={features}
          userPosition={userPosition}
          centerPosition={centerPosition}
          zoomLevel={zoomLevel}
          mapStyle={mapStyle}
          gpsError={gpsError}
          showUserLocation={true}
        />
      </View>

      {/* Screen Content Overlay */}
      <View style={styles.overlay}>
        <Slot />
      </View>
    </View>
  );
}

export default function BasemapLayout() {
  return (
    <MapProvider>
      <BasemapLayoutContent />
    </MapProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    pointerEvents: 'box-none', // Allow touches to pass through to map
  },
});
