import React from 'react';
import { StyleSheet, View } from 'react-native';

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
 *
 * TODO:
 * - Integrate with History Service to fetch trip polylines
 * - Pass polyline data to MapViewComponent via Basemap Layout
 * - Add recenter button to secondary footer slot
 * - Implement DataRanger mode feature display
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      {/* Content overlays the map - transparent background */}
      <ThemedView style={styles.welcomeCard}>
        <ThemedText type="subtitle">Welcome to RollTracks</ThemedText>
        <ThemedText>Your trips will appear on the map.</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent to show map behind
  },
  welcomeCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    // Semi-transparent card overlaying the map
    opacity: 0.95,
  },
});
