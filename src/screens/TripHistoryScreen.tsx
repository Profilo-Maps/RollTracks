import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { TripCard } from '../components';
import { useToast } from '../contexts/ToastContext';
import { useServices } from '../contexts/ServicesContext';
import { useAuth } from '../contexts/AuthContext';
import { Trip } from '../types';
import { handleError } from '../utils/errors';

// Define route params type
type TripHistoryScreenRouteProp = RouteProp<{
  History: { highlightTripId?: string };
}, 'History'>;

interface TripHistoryScreenProps {
  route: TripHistoryScreenRouteProp;
}

/**
 * TripHistoryScreen displays a list of all trips
 * Fetches trips from LocalStorageAdapter ordered by start_time DESC (most recent first)
 * Includes pull-to-refresh functionality and empty state handling
 * Supports highlighting a specific trip when navigated from HomeScreen
 * Requirements: 3.1, 3.3, 4.4
 */
export const TripHistoryScreen: React.FC<TripHistoryScreenProps> = ({ route }) => {
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null);
  
  // Ref for FlatList to enable scrolling to specific trip
  const flatListRef = useRef<FlatList<Trip>>(null);

  // Get services from context
  const { tripService, storageAdapter } = useServices();

  // Extract highlightTripId from route params
  const { highlightTripId } = route.params || {};

  // Handle trip highlighting when navigated from HomeScreen
  // Requirement: 4.4
  useEffect(() => {
    if (highlightTripId && trips.length > 0) {
      // Find the index of the trip to highlight
      const tripIndex = trips.findIndex(trip => trip.id === highlightTripId);
      
      if (tripIndex !== -1) {
        // Set highlighted trip ID for visual feedback
        setHighlightedTripId(highlightTripId);
        
        // Scroll to the trip after a short delay to ensure list is rendered
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: tripIndex,
            animated: true,
            viewPosition: 0.5, // Center the item in the viewport
          });
        }, 300);
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedTripId(null);
        }, 3000);
      }
    }
  }, [highlightTripId, trips]);

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
      // First, try to fetch data from server if user is logged in
      if (user && storageAdapter.fetchUserDataFromServer) {
        try {
          const result = await storageAdapter.fetchUserDataFromServer(user.id);
          if (result.success) {
            showSuccess('Synced with server');
          } else {
            console.warn('Server sync failed:', result.error);
            // Continue with local data even if server sync fails
          }
        } catch (syncError) {
          console.error('Error syncing with server:', syncError);
          // Continue with local data even if server sync fails
        }
      }

      // Load trips from local storage (which now includes server data if sync succeeded)
      const data = await tripService.getTrips();
      setTrips(data);
    } catch (fetchError: any) {
      const appError = handleError(fetchError);
      setError(appError.message);
      showError(appError.message);
    } finally {
      setRefreshing(false);
    }
  }, [user, storageAdapter, tripService, showError, showSuccess]);

  // Render individual trip item
  const renderTripItem = ({ item }: { item: Trip }) => {
    const isHighlighted = item.id === highlightedTripId;
    return (
      <View style={isHighlighted ? styles.highlightedTripContainer : undefined}>
        <TripCard 
          trip={item} 
          onTripEnded={loadTrips} 
          onTripDeleted={loadTrips}
          isHighlighted={isHighlighted}
        />
      </View>
    );
  };

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
          ref={flatListRef}
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
          onScrollToIndexFailed={(info) => {
            // Handle scroll failure gracefully
            console.warn('Failed to scroll to trip:', info);
            // Try scrolling to offset instead
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            });
          }}
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
  highlightedTripContainer: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 4,
    marginBottom: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
