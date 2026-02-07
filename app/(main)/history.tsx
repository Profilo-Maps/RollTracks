import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Trip History Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - List of Trip Summary Cards in body slot
 * - Profile button in right of header slot (launches Profile Screen)
 * - Map View Component is frozen and dimmed
 *
 * TODO:
 * - Integrate with History Service to fetch all user trips
 * - Implement Trip History Card Component for each trip
 * - Add dimmed/frozen state to MapViewComponent
 * - Add profile button to header
 */
export default function TripHistoryScreen() {
  return (
    <View style={styles.container}>
      {/* Semi-opaque background to dim the map */}
      <View style={styles.dimmedOverlay} />

      <ScrollView style={styles.scrollContainer}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Trip History</ThemedText>
          {/* TODO: Add profile button */}
        </ThemedView>

        {/* TODO: Replace with Trip History Card Components from History Service */}
        <ThemedView style={styles.tripCard}>
          <ThemedText type="defaultSemiBold">Sample Trip</ThemedText>
          <ThemedText>Duration: 15 min | Distance: 0.8 mi</ThemedText>
        </ThemedView>

        <ThemedView style={styles.tripCard}>
          <ThemedText type="defaultSemiBold">Sample Trip 2</ThemedText>
          <ThemedText>Duration: 22 min | Distance: 1.2 mi</ThemedText>
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dimmedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: 'transparent',
  },
  tripCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
});
