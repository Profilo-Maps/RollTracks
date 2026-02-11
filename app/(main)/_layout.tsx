import { Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Basemap Layout
 * Displays all user route and feature data with a persistent map background.
 *
 * Structure:
 * - Map View Component: Full screen background layer (persistent across screens)
 * - Header Slot: Top of screen (transparent by default)
 * - Body Slot: Screen-specific content that overlays the map
 * - Secondary Footer Slot: Above the footer (for recenter button, etc.)
 * - Footer Slot: Bottom of screen (for Bottom Navigation Bar)
 *
 * All slots are transparent by default, allowing the map to show through
 * unless a screen adds opaque content.
 */
export default function BasemapLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      {/* Map View Component - Persistent Background Layer */}
      {/* TODO: Replace with MapViewComponent once MapBox Adapter is implemented */}
      <View
        style={[
          styles.mapContainer,
          { backgroundColor: Colors[colorScheme ?? 'light'].background },
        ]}
      >
        {/* Placeholder for MapViewComponent */}
        <View style={styles.mapPlaceholder} />
      </View>

      {/* Screen Content Overlay */}
      <View style={styles.overlay}>
        {/* Header Slot - screens can add header content */}
        <View style={styles.headerSlot} />

        {/* Body Slot - screen-specific content via Slot */}
        <View style={styles.bodySlot}>
          <Slot />
        </View>

        {/* Secondary Footer Slot - for recenter button, end correction button, etc. */}
        <View style={styles.secondaryFooterSlot} />

        {/* Footer Slot - for Bottom Navigation Bar */}
        <View style={styles.footerSlot}>
          {/* TODO: Add BottomNavigationBarComponent here */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e0e0e0', // Light gray placeholder for map
  },
  overlay: {
    flex: 1,
  },
  headerSlot: {
    // Transparent header area - screens can add content
    paddingTop: 0, // No padding - screens handle their own safe area
    paddingHorizontal: 0,
  },
  bodySlot: {
    flex: 1,
    // Transparent by default - screen content overlays map
  },
  secondaryFooterSlot: {
    // Above the footer - for floating buttons like recenter
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  footerSlot: {
    // Bottom navigation bar area
    paddingBottom: 0, // No padding - BottomNavigationBarComponent handles safe area
    paddingHorizontal: 0,
  },
});
