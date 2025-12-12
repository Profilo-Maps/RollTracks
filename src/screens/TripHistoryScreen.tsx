import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { TripCard } from '../components';
import { useToast } from '../contexts/ToastContext';
import { useServices } from '../contexts/ServicesContext';
import { Trip } from '../types';
import { handleError } from '../utils/errors';

/**
 * TripHistoryScreen displays a list of all trips
 * Fetches trips from LocalStorageAdapter ordered by start_time DESC (most recent first)
 * Includes pull-to-refresh functionality and empty state handling
 * Requirements: 3.1, 3.3
 */
export const TripHistoryScreen: React.FC = () => {
  const { showError } = useToast();
  const isFocused = useIsFocused();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get TripService from context
  const { tripService } = useServices();

  // Load trips when screen comes into focus
  useEffect(() => {
    if (isFocused) {
      loadTrips();
    }
  }, [isFocused]);

  const loadTrips = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await tripService.getTrips();
      setTrips(data);
    } catch (fetchError: any) {
      const appError = handleError(fetchError);
      setError(appError.message);
      showError(appError.message);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const data = await tripService.getTrips();
      setTrips(data);
    } catch (fetchError: any) {
      const appError = handleError(fetchError);
      setError(appError.message);
      showError(appError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Render individual trip item
  const renderTripItem = ({ item }: { item: Trip }) => (
    <TripCard trip={item} />
  );

  // Empty state component
  const renderEmptyState = () => {
    if (loading) {
      return null;
    }
    
    return (
      <View 
        style={styles.emptyContainer}
        accessibilityLabel="No trips recorded yet"
      >
        <Text 
          style={styles.emptyIcon}
          accessibilityLabel="Car icon"
          accessible={true}
        >
          🚗
        </Text>
        <Text 
          style={styles.emptyTitle}
          accessibilityRole="header"
        >
          No Trips Yet
        </Text>
        <Text style={styles.emptyMessage}>
          Start recording your first trip to see it here
        </Text>
      </View>
    );
  };

  // Error state component
  const renderErrorState = () => {
    if (!error) {
      return null;
    }
    
    return (
      <View 
        style={styles.errorContainer}
        accessibilityLabel="Error loading trips"
        accessibilityRole="alert"
      >
        <Text 
          style={styles.errorIcon}
          accessibilityLabel="Warning icon"
          accessible={true}
        >
          ⚠️
        </Text>
        <Text 
          style={styles.errorTitle}
          accessibilityRole="header"
        >
          Unable to Load Trips
        </Text>
        <Text 
          style={styles.errorMessage}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
        <Text style={styles.errorHint}>Pull down to retry</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      accessibilityLabel="Trip history screen"
    >
      <View style={styles.header}>
        <Text 
          style={styles.title}
          accessibilityRole="header"
        >
          Trip History
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityLabel={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} recorded`}
        >
          {trips.length} {trips.length === 1 ? 'trip' : 'trips'} recorded
        </Text>
      </View>
      
      {error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            trips.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
              colors={['#007AFF']}
              accessibilityLabel="Pull to refresh trip list"
            />
          }
          showsVerticalScrollIndicator={true}
          accessible={false}
          accessibilityLabel="List of recorded trips"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
