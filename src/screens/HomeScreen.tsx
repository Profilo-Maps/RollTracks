import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationProp, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useServices } from '../contexts/ServicesContext';
import { useTour } from '../contexts/TourContext';
import { TourOverlay } from '../components/TourOverlay';
import { processRatings, ProcessedRatedFeature, calculateMapRegion } from '../utils/homeScreenUtils';
import { MapViewMapbox } from '../components/MapViewMapbox';
import { ObstacleFeature } from '../types';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
  route: RouteProp<any, 'Home'>;
}

/**
 * HomeScreen - Central hub displaying all user-rated accessibility features on a map
 * 
 * This screen serves as the main navigation tab between Record and History screens,
 * providing users with a visual overview of all features they have rated across all trips.
 * 
 * Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.5, 2.6, 5.1, 6.3, 6.4, 7.1, 7.2
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { ratingService } = useServices();
  const { state: tourState, nextStep, previousStep, dismissTour, completeTour } = useTour();
  
  // State management
  const [ratedFeatures, setRatedFeatures] = useState<ProcessedRatedFeature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Default region (San Francisco) when no rated features exist
  // Requirement: 2.6
  const DEFAULT_REGION = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  /**
   * Fetch all rated features from RatingService and process them
   * Requirements: 2.2, 5.1
   */
  const fetchRatedFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all ratings from RatingService
      const allRatings = await ratingService.getAllRatings();
      
      // Process ratings to get unique features with most recent ratings
      const processed = processRatings(allRatings);
      
      setRatedFeatures(processed);
    } catch (err) {
      console.error('Failed to fetch rated features:', err);
      setError('Unable to load rated features. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [ratingService]);

  // Fetch data on component mount
  // Requirement: 6.3
  useEffect(() => {
    fetchRatedFeatures();
  }, [fetchRatedFeatures]);

  // Refetch data when screen gains focus
  // Requirement: 6.4
  useFocusEffect(
    useCallback(() => {
      fetchRatedFeatures();
    }, [fetchRatedFeatures])
  );

  // Calculate map region based on rated features
  // Requirement: 2.5
  const mapRegion = useMemo(() => {
    const calculatedRegion = calculateMapRegion(ratedFeatures);
    return calculatedRegion || DEFAULT_REGION;
  }, [ratedFeatures]);

  // Convert ProcessedRatedFeatures to ObstacleFeatures for MapViewMapbox
  // Requirement: 2.3, 2.4
  const obstacleFeatures = useMemo<ObstacleFeature[]>(() => {
    return ratedFeatures.map(feature => ({
      id: feature.feature_id,
      latitude: feature.latitude,
      longitude: feature.longitude,
      attributes: feature.properties,
    }));
  }, [ratedFeatures]);

  // Empty route points - HomeScreen should not show any paths
  const routePointsForBounds = useMemo(() => {
    return [];
  }, []);

  // Fit map to rated features when they change
  useEffect(() => {
    if (mapReady && ratedFeatures.length > 0) {
      // The map will automatically fit to the obstacle features
      console.log('Map ready with', ratedFeatures.length, 'rated features');
    }
  }, [mapReady, ratedFeatures]);

  // Extract rated feature IDs and ratings for MapViewMapbox
  // Requirement: 3.1, 3.2, 3.4
  const ratedFeatureIds = useMemo(() => {
    return ratedFeatures.map(f => f.feature_id);
  }, [ratedFeatures]);

  const ratedFeatureRatings = useMemo(() => {
    const ratings: Record<string, number> = {};
    ratedFeatures.forEach(f => {
      ratings[f.feature_id] = f.rating;
    });
    return ratings;
  }, [ratedFeatures]);

  // Handle feature tap - navigate to TripHistoryScreen with trip_id
  // Requirement: 4.1, 4.2, 4.3
  const handleFeatureTap = useCallback((feature: ObstacleFeature) => {
    const ratedFeature = ratedFeatures.find(f => f.feature_id === feature.id);
    if (ratedFeature) {
      navigation.navigate('History', { highlightTripId: ratedFeature.trip_id });
    }
  }, [ratedFeatures, navigation]);

  // Handle map ready callback
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    console.log('HomeScreen: Map is ready');
  }, []);

  // Handle map error callback
  const handleMapError = useCallback((errorMessage: string) => {
    console.error('HomeScreen: Map error:', errorMessage);
    setError(`Map error: ${errorMessage}`);
  }, []);

  return (
    <View style={styles.container}>
      {/* Map View - Requirements: 2.1, 2.5, 2.6, 7.1, 7.2 */}
      <MapViewMapbox
        currentLocation={null}
        routePoints={routePointsForBounds}
        showCompleteRoute={false}
        obstacleFeatures={obstacleFeatures}
        ratedFeatureIds={ratedFeatureIds}
        ratedFeatureRatings={ratedFeatureRatings}
        onMapReady={handleMapReady}
        onMapError={handleMapError}
        onFeatureTap={handleFeatureTap}
        enableLazyLoading={true}
      />
      
      {/* Loading overlay - Requirement: 5.1 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading rated features...</Text>
        </View>
      )}
      
      {/* Error overlay - Requirements: 5.3, 5.4 */}
      {error && !loading && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchRatedFeatures}
            accessibilityLabel="Retry loading rated features"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Empty state - Requirement: 5.2 */}
      {!loading && !error && ratedFeatures.length === 0 && mapReady && (
        <View style={styles.emptyStateOverlay}>
          <Text style={styles.emptyStateText}>No rated features yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Start a trip and rate accessibility features to see them here
          </Text>
        </View>
      )}
      
      {/* Tour Overlay - Onboarding Tutorial */}
      {tourState.isActive && tourState.currentStep === 0 && (
        <TourOverlay
          step={{
            id: 'home_profile_nav',
            screen: 'Home',
            title: 'Welcome to Your App!',
            description: "Let's start by exploring your profile. Tap the profile icon to customize your settings.",
            highlightElement: 'profile_nav_button',
            position: 'bottom',
          }}
          currentStep={tourState.currentStep}
          totalSteps={tourState.totalSteps}
          onNext={nextStep}
          onPrevious={previousStep}
          onDismiss={dismissTour}
          onComplete={completeTour}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF4444',
    padding: 16,
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4444',
    textAlign: 'center',
  },
  emptyStateOverlay: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
