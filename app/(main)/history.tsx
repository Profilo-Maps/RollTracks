import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BasemapLayout } from '@/layouts/BasemapLayout';

/**
 * Trip History Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - List of Trip Summary Cards in body slot (TODO)
 * - Profile button in right of header slot (launches Profile Screen)
 * - Map View Component is frozen and dimmed
 */
export default function TripHistoryScreen() {
  const iconColor = useThemeColor({}, 'icon');
  const backgroundColor = useThemeColor({}, 'background');

  // Navigate to profile screen
  const handleProfilePress = () => {
    router.push('/(auth)/profile');
  };

  // Render header with title and profile button
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ThemedText type="title" style={styles.headerTitle}>Trip History</ThemedText>
      <Pressable 
        style={styles.profileButton}
        onPress={handleProfilePress}
        accessibilityLabel="Open profile"
        accessibilityRole="button"
      >
        <Ionicons name="person-circle-outline" size={32} color={iconColor} />
      </Pressable>
    </View>
  );

  // Render body with placeholder for trip cards
  const renderBody = () => (
    <View style={styles.bodyContainer}>
      {/* Semi-opaque background to dim the map */}
      <View style={styles.dimmedOverlay} />

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.centerContainer}>
          <ThemedView style={[styles.messageCard, { backgroundColor }]}>
            <ThemedText type="subtitle">Trip History</ThemedText>
            <ThemedText style={styles.messageText}>
              Trip cards will be displayed here.
            </ThemedText>
          </ThemedView>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <BasemapLayout
      interactionState="dimmed"
      header={renderHeader()}
      body={renderBody()}
    />
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    flex: 1,
  },
  profileButton: {
    padding: 8,
    marginLeft: 8,
  },
  bodyContainer: {
    flex: 1,
  },
  dimmedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  messageCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
    opacity: 0.95,
  },
  messageText: {
    marginTop: 12,
    textAlign: 'center',
  },
});
