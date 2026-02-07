import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Active Trip Screen
 * Built with Basemap Layout. Triggered by Start Trip Modal Component.
 *
 * Features:
 * - Trip Pause and Stop buttons in footer slot
 * - When trip ends, navigates to Trip Summary Screen
 * - In DataRanger mode:
 *   - Displays features and segments from Active Trip Service
 *   - Clicking feature/segment opens Active Trip Modal
 *   - After segment correction activation, shows End Correction button in secondary footer
 *   - Recenter button moves to bottom right of body slot during correction
 *
 * TODO:
 * - Integrate with Trip Service for GPS tracking
 * - Pass GPS polyline to MapViewComponent via props
 * - Implement pause/stop functionality
 * - Add DataRanger feature/segment display
 * - Implement Active Trip Modal hook
 */
export default function ActiveTripScreen() {
  return (
    <View style={styles.container}>
      <ThemedView style={styles.tripCard}>
        <ThemedText type="subtitle">Trip in Progress</ThemedText>
        <ThemedText>Recording your route...</ThemedText>
      </ThemedView>

      {/* TODO: Add trip controls (pause/stop) in footer via Basemap Layout */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tripCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    opacity: 0.95,
  },
});
