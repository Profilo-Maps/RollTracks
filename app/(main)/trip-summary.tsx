import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Trip Summary Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - Given a trip_id, displays relevant route and feature data via History Service
 * - Trip History Card in drawer format in footer slot
 * - In DataRanger mode: shows rated features and corrected segments for this trip
 *
 * TODO:
 * - Integrate with History Service to fetch trip data by trip_id
 * - Pass trip polyline to MapViewComponent via props
 * - Implement Trip History Card/Drawer Component
 * - Show DataRanger contribution data if mode is on
 */
export default function TripSummaryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return (
    <View style={styles.container}>
      <ThemedView style={styles.summaryCard}>
        <ThemedText type="subtitle">Trip Summary</ThemedText>
        <ThemedText>Trip ID: {tripId ?? 'Latest Trip'}</ThemedText>
        {/* TODO: Display trip statistics */}
      </ThemedView>

      {/* TODO: Add Trip History Card/Drawer in footer slot */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    opacity: 0.95,
  },
});
