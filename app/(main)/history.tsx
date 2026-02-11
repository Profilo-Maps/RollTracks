import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripSummary } from '@/adapters/DatabaseAdapter';
import { BottomNavigationBarComponent } from '@/components/BottomNavigationBarComponent';
import { TripHistoryCard } from '@/components/TripHistoryCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BasemapLayout } from '@/layouts/BasemapLayout';
import { HistoryService } from '@/services/HistoryService';
import { TripService } from '@/services/TripService';

/**
 * Trip History Screen
 * Built with Basemap Layout.
 *
 * Features:
 * - List of Trip Summary Cards in body slot
 * - Profile button in right of header slot (launches Profile Screen)
 * - Map View Component is frozen and dimmed
 * - Empty state for new users with no trips
 * - Checks for orphaned trips on mount and prompts user
 */
export default function TripHistoryScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const errorColor = useThemeColor({}, 'error');
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // State
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for orphaned trip modal
  const [shouldShowOrphanedTripModal, setShouldShowOrphanedTripModal] = useState(false);

  // Check for orphaned trips when user logs in (only once per login session)
  useEffect(() => {
    const checkForOrphanedTrips = async () => {
      if (!user) return;

      try {
        const orphanedTrip = await TripService.checkForOrphanedTrip();
        if (orphanedTrip) {
          console.log('[TripHistoryScreen] Orphaned trip detected on mount, showing modal');
          setShouldShowOrphanedTripModal(true);
        }
      } catch (error) {
        console.error('[TripHistoryScreen] Failed to check for orphaned trips:', error);
      }
    };

    checkForOrphanedTrips();
  }, [user]);

  // Fetch trip summaries
  useEffect(() => {
    const loadTrips = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const tripSummaries = await HistoryService.getTripSummaries();
        setTrips(tripSummaries);
      } catch (err) {
        console.error('[TripHistoryScreen] Failed to load trips:', err);
        setError('Failed to load trip history');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrips();
  }, []);

  // Navigate to profile screen
  const handleProfilePress = () => {
    router.push('/(auth)/profile');
  };

  // Navigate to trip summary screen
  const handleTripPress = (tripId: string) => {
    router.push({
      pathname: '/(main)/trip-summary',
      params: { tripId },
    });
  };

  // Handle orphaned trip modal visibility changes
  const handleModalVisibilityChange = (visible: boolean) => {
    // When modal closes, reset the auto-open flag
    if (!visible) {
      setShouldShowOrphanedTripModal(false);
    }
  };

  // Render header with title and profile button
  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <ThemedText type="title" style={styles.headerTitle}>Trip History</ThemedText>
      <Pressable 
        style={[styles.profileButton, { backgroundColor }]}
        onPress={handleProfilePress}
        accessibilityLabel="Open profile"
        accessibilityRole="button"
      >
        <Ionicons name="person-circle-outline" size={32} color={tintColor} />
      </Pressable>
    </View>
  );

  // Render loading state
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={[styles.messageCard, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.messageText}>Loading trips...</ThemedText>
      </ThemedView>
    </View>
  );

  // Render error state
  const renderError = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={[styles.messageCard, { backgroundColor }]}>
        <Ionicons name="alert-circle-outline" size={48} color={errorColor} />
        <ThemedText type="subtitle" style={styles.errorTitle}>
          {error}
        </ThemedText>
        <Pressable
          onPress={() => {
            setIsLoading(true);
            setError(null);
            HistoryService.getTripSummaries()
              .then(setTrips)
              .catch((err) => {
                console.error('[TripHistoryScreen] Retry failed:', err);
                setError('Failed to load trip history');
              })
              .finally(() => setIsLoading(false));
          }}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: tintColor },
            pressed && styles.retryButtonPressed,
          ]}
        >
          <ThemedText style={[styles.retryButtonText, { color: buttonTextColor }]}>Retry</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );

  // Render empty state (no trips yet)
  const renderEmptyState = () => (
    <View style={styles.centerContainer}>
      <ThemedView style={[styles.messageCard, { backgroundColor }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: `${tintColor}20` }]}>
          <Ionicons name="map-outline" size={64} color={tintColor} />
        </View>
        <ThemedText type="subtitle" style={styles.emptyTitle}>
          No Trips Yet
        </ThemedText>
        <ThemedText style={styles.emptyMessage}>
          Start recording your first trip to see it appear here.
        </ThemedText>
        <ThemedText style={styles.emptyHint}>
          Tap the record button at the bottom to get started!
        </ThemedText>
      </ThemedView>
    </View>
  );

  // Render trip list
  const renderTripList = () => (
    <View style={styles.tripListContainer}>
      {trips.map((trip) => (
        <TripHistoryCard
          key={trip.tripId}
          trip={{
            ...trip,
            userId: user?.id || '',
            comfort: 5, // Default comfort, will be in trip data
            purpose: '', // Default purpose, will be in trip data
            status: 'completed' as const,
            geometry: { type: 'LineString', coordinates: [] }, // Not needed for card display
            featuresRated: trip.ratingCount,
            segmentsCorrected: trip.correctionCount,
            durationS: trip.durationS || 0,
            distanceMi: trip.distanceMi || 0,
          }}
          onPress={() => handleTripPress(trip.tripId)}
          showDataRangerStats={user?.dataRangerMode}
          variant="card"
        />
      ))}
    </View>
  );

  // Render body based on state
  const renderBody = () => (
    <View style={styles.bodyContainer}>
      {/* Semi-opaque background to dim the map */}
      <View style={styles.dimmedOverlay} />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          (isLoading || error || trips.length === 0) && styles.scrollContentCentered,
        ]}
      >
        {isLoading && renderLoading()}
        {error && !isLoading && renderError()}
        {!isLoading && !error && trips.length === 0 && renderEmptyState()}
        {!isLoading && !error && trips.length > 0 && renderTripList()}
      </ScrollView>
    </View>
  );

  return (
    <BasemapLayout
      interactionState="dimmed"
      header={renderHeader()}
      body={renderBody()}
      footer={
        <BottomNavigationBarComponent
          autoOpenModal={shouldShowOrphanedTripModal}
          onModalVisibilityChange={handleModalVisibilityChange}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
  },
  profileButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  messageCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
  },
  messageText: {
    marginTop: 12,
    textAlign: 'center',
  },
  // Empty state styles
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    marginBottom: 12,
  },
  emptyMessage: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyHint: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  // Error state styles
  errorTitle: {
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontWeight: '600',
    // Color applied dynamically via inline style
  },
  // Trip list styles
  tripListContainer: {
    paddingBottom: 16,
  },
});
