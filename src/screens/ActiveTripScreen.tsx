import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from '../contexts/ToastContext';
import { useServices } from '../contexts/ServicesContext';
import { useTour } from '../contexts/TourContext';
import { TourOverlay } from '../components/TourOverlay';
import { GPSService } from '../services/GPSService';
import { obstacleService } from '../services/ObstacleService';
import { MapView } from '../components/MapView';
import { MapViewMapbox } from '../components/MapViewMapbox';
import { FeaturePopup } from '../components/FeaturePopup';
import { RatingModal } from '../components/RatingModal';
import { Trip, LocationPoint, ObstacleFeature, ObstacleFeatureWithRating } from '../types';
import { handleError } from '../utils/errors';
import { FeatureFlags } from '../config/features';

export const ActiveTripScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { showError, showSuccess } = useToast();
  const { state: tourState, nextStep, previousStep, dismissTour, completeTour } = useTour();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
  const [nearbyObstacles, setNearbyObstacles] = useState<ObstacleFeature[]>([]);
  const [encounteredObstacles, setEncounteredObstacles] = useState<ObstacleFeature[]>([]);
  const [isObstacleServiceReady, setIsObstacleServiceReady] = useState(false);
  
  // Rating feature state
  const [selectedFeature, setSelectedFeature] = useState<ObstacleFeatureWithRating | null>(null);
  const [showFeaturePopup, setShowFeaturePopup] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratedFeatureIds, setRatedFeatureIds] = useState<string[]>([]);
  const [ratedFeatureRatings, setRatedFeatureRatings] = useState<Record<string, number>>({});

  // Get tripId from route params if provided
  const routeParams = route.params as { tripId?: string } | undefined;
  const tripIdFromRoute = routeParams?.tripId;

  // Get services from context
  const { tripService, ratingService, storageAdapter } = useServices();
  const gpsService = new GPSService();

  useEffect(() => {
    loadActiveTrip();
    
    // Initialize ObstacleService
    obstacleService.initialize()
      .then(() => {
        setIsObstacleServiceReady(true);
        console.log('ObstacleService initialized successfully');
      })
      .catch(error => {
        console.error('Failed to initialize obstacle service:', error);
        // Don't show error to user - obstacles are optional
      });
    
    // Load existing GPS points for the route
    const loadExistingPoints = async () => {
      try {
        const points = await storageAdapter.getGPSPoints();
        setRoutePoints(points);
        if (points.length > 0) {
          setCurrentLocation(points[points.length - 1]);
        }
      } catch (error) {
        console.error('Error loading GPS points:', error);
      }
    };
    loadExistingPoints();
    
    // Subscribe to GPS updates
    const handleLocationUpdate = (location: LocationPoint) => {
      setCurrentLocation(location);
      setRoutePoints(prev => [...prev, location]);
    };

    // Start GPS tracking if not already started
    gpsService.startTracking(handleLocationUpdate).catch(error => {
      console.error('Error starting GPS tracking:', error);
      showError('Failed to start GPS tracking');
    });
    
    // Cleanup on unmount
    return () => {
      // Don't stop GPS tracking on unmount - let it continue
      // Clean up obstacle service
      obstacleService.cleanup();
      // Clear encountered obstacles when leaving the screen
      setEncounteredObstacles([]);
    };
  }, []);

  // Load existing ratings when both activeTrip and obstacle service are ready
  useEffect(() => {
    const loadExistingRatings = async () => {
      if (activeTrip && isObstacleServiceReady) {
        try {
          const ratings = await ratingService.getRatingsForTrip(activeTrip.id);
          const ratedIds = ratings.map(r => r.id);
          const ratingsMap: Record<string, number> = {};
          ratings.forEach(r => {
            ratingsMap[r.id] = r.userRating;
          });
          setRatedFeatureIds(ratedIds);
          setRatedFeatureRatings(ratingsMap);
          console.log(`Loaded ${ratedIds.length} existing ratings for trip`);
          
          // Add rated features to encountered obstacles so they remain visible
          if (ratings.length > 0) {
            const ratedObstacles: ObstacleFeature[] = [];
            ratings.forEach(rating => {
              // Create obstacle feature from rating data
              // Extract coordinates from geometry (GeoJSON format: [longitude, latitude])
              const [longitude, latitude] = rating.geometry.coordinates;
              const obstacle: ObstacleFeature = {
                id: rating.id,
                latitude: latitude,
                longitude: longitude,
                attributes: rating.properties || {}
              };
              ratedObstacles.push(obstacle);
            });
            
            setEncounteredObstacles(prev => {
              const combined = [...prev];
              ratedObstacles.forEach(ratedObstacle => {
                const alreadyExists = combined.some(existing => existing.id === ratedObstacle.id);
                if (!alreadyExists) {
                  combined.push(ratedObstacle);
                }
              });
              return combined;
            });
            
            console.log(`Added ${ratedObstacles.length} rated obstacles to encountered list`);
          }
        } catch (error) {
          console.error('Error loading existing ratings:', error);
        }
      }
    };
    
    loadExistingRatings();
  }, [activeTrip, isObstacleServiceReady]);

  // Clear encountered obstacles when active trip changes (new trip started)
  useEffect(() => {
    if (activeTrip) {
      console.log(`Clearing encountered obstacles for new trip: ${activeTrip.id}`);
      setEncounteredObstacles([]);
    }
  }, [activeTrip?.id]);

  // Reload trip when screen comes into focus
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('focus', () => {
      loadActiveTrip();
    });
    return unsubscribe;
  }, [navigation]);

  // Query nearby obstacles when location updates (only if service is ready)
  useEffect(() => {
    if (currentLocation && isObstacleServiceReady) {
      try {
        console.log(`Querying obstacles at (${currentLocation.latitude}, ${currentLocation.longitude}) within 50m`);
        const newNearbyObstacles = obstacleService.queryNearby({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters: 50
        });
        console.log(`Found ${newNearbyObstacles.length} nearby obstacles`);
        
        // Update encountered obstacles by adding any new ones
        setEncounteredObstacles(prevEncountered => {
          const allEncounteredObstacles = [...prevEncountered];
          let newObstaclesCount = 0;
          
          // Add any new obstacles that haven't been encountered before
          newNearbyObstacles.forEach(newObstacle => {
            const alreadyEncountered = allEncounteredObstacles.some(
              existing => existing.id === newObstacle.id
            );
            if (!alreadyEncountered) {
              allEncounteredObstacles.push(newObstacle);
              newObstaclesCount++;
              console.log(`New obstacle encountered: ${newObstacle.id}`);
            }
          });
          
          if (newObstaclesCount > 0) {
            console.log(`Added ${newObstaclesCount} new obstacles. Total encountered: ${allEncounteredObstacles.length}`);
          }
          
          return allEncounteredObstacles;
        });
      } catch (error) {
        console.error('Error querying nearby obstacles:', error);
        // Don't show error to user - obstacles are optional
      }
    }
  }, [currentLocation, isObstacleServiceReady]);

  // Update nearby obstacles display whenever encountered obstacles change
  useEffect(() => {
    setNearbyObstacles(encounteredObstacles);
    console.log(`Total obstacles visible: ${encounteredObstacles.length}`);
  }, [encounteredObstacles]);

  const loadActiveTrip = async () => {
    setLoading(true);
    try {
      let trip: Trip | null = null;
      
      // If tripId was passed in route params, load that specific trip
      if (tripIdFromRoute) {
        console.log('Loading trip by ID:', tripIdFromRoute);
        trip = await tripService.getTrip(tripIdFromRoute);
        
        // Verify the trip is actually active
        if (trip && trip.status !== 'active') {
          console.warn('Trip found but not active:', trip.status);
          trip = null;
        }
      }
      
      // Otherwise, find any active trip
      if (!trip) {
        console.log('Loading active trip from storage');
        trip = await tripService.getActiveTrip();
      }
      
      if (trip) {
        console.log('Active trip loaded:', {
          id: trip.id,
          status: trip.status,
          mode: trip.mode,
        });
        setActiveTrip(trip);
      } else {
        console.log('No active trip found');
        showError('No active trip found');
        (navigation as any).navigate('StartTrip');
      }
    } catch (error: any) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setLoading(false);
    }
  };



  const handleEndTrip = async () => {
    if (!activeTrip) {
      return;
    }

    console.log('Attempting to end trip:', activeTrip.id, 'Current status:', activeTrip.status);
    setActionLoading(true);
    try {
      // Get GPS points and encode them
      const gpsPoints = await storageAdapter.getGPSPoints();
      console.log('GPS points collected:', gpsPoints.length);
      const encodedPolyline = gpsService.encodePolyline(gpsPoints);
      
      // Stop the trip with the encoded geometry
      const completedTrip = await tripService.stopTrip(activeTrip.id, encodedPolyline);
      console.log('Trip ended successfully, final status:', completedTrip.status);
      
      showSuccess('Trip completed');
      
      // Navigate to TripSummaryScreen
      (navigation as any).navigate('TripSummary', { trip: completedTrip });
    } catch (error: any) {
      console.error('Error ending trip:', error);
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle feature tap from map
  const handleFeatureTap = async (feature: ObstacleFeature) => {
    if (!activeTrip) {
      return;
    }

    try {
      // Check if feature is already rated
      const existingRating = await ratingService.getRatingForFeature(feature.id, activeTrip.id);
      
      const featureWithRating: ObstacleFeatureWithRating = {
        ...feature,
        rating: existingRating?.userRating,
        isRated: !!existingRating,
      };

      setSelectedFeature(featureWithRating);
      setShowFeaturePopup(true);
    } catch (error) {
      console.error('Error handling feature tap:', error);
      showError('Failed to load feature details');
    }
  };

  // Handle rate button press
  const handleRateButtonPress = () => {
    setShowFeaturePopup(false);
    setShowRatingModal(true);
  };

  // Handle rating submission
  const handleRatingSubmit = async (rating: number) => {
    if (!activeTrip || !selectedFeature) {
      return;
    }

    try {
      // Always call createRating - the service will handle existing ratings internally
      await ratingService.createRating(selectedFeature, activeTrip, rating);
      showSuccess('Feature rated successfully');

      // Update rated feature IDs and ratings
      const ratings = await ratingService.getRatingsForTrip(activeTrip.id);
      const ratedIds = ratings.map(r => r.id);
      const ratingsMap: Record<string, number> = {};
      ratings.forEach(r => {
        ratingsMap[r.id] = r.userRating;
      });
      setRatedFeatureIds(ratedIds);
      setRatedFeatureRatings(ratingsMap);

      // Close modals
      setShowRatingModal(false);
      setSelectedFeature(null);
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      const appError = handleError(error);
      showError(appError.message);
    }
  };

  // Handle rating modal cancel
  const handleRatingCancel = () => {
    setShowRatingModal(false);
    setShowFeaturePopup(true);
  };

  // Handle feature popup close
  const handleFeaturePopupClose = () => {
    setShowFeaturePopup(false);
    setSelectedFeature(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!activeTrip) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No active trip found</Text>
      </View>
    );
  }

  // Select map component based on feature flag
  const MapComponent = FeatureFlags.USE_MAPBOX_VECTOR_TILES ? MapViewMapbox : MapView;

  return (
    <View style={styles.container}>
      <MapComponent
        currentLocation={currentLocation}
        routePoints={routePoints}
        obstacleFeatures={nearbyObstacles}
        onMapError={(error) => showError(`Map error: ${error}`)}
        onFeatureTap={handleFeatureTap}
        ratedFeatureIds={ratedFeatureIds}
        ratedFeatureRatings={ratedFeatureRatings}
        enableLazyLoading={false}
      />
      
      {selectedFeature && (
        <FeaturePopup
          feature={selectedFeature}
          visible={showFeaturePopup}
          onClose={handleFeaturePopupClose}
          onRate={handleRateButtonPress}
          tripId={activeTrip?.id || ''}
        />
      )}
      
      <RatingModal
        visible={showRatingModal}
        initialRating={selectedFeature?.rating}
        onSubmit={handleRatingSubmit}
        onCancel={handleRatingCancel}
        nativeID="obstacle_grading_interface"
      />
      
      <View style={styles.overlay}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.stopButton, actionLoading && styles.buttonDisabled]}
            onPress={handleEndTrip}
            disabled={actionLoading}
            accessibilityLabel="End trip"
            accessibilityRole="button"
            accessibilityHint="Tap to stop and save your trip"
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>⏹</Text>
                <Text style={styles.buttonText}>End Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Tour Overlay removed - no longer used in ActiveTripScreen */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 20,
    pointerEvents: 'box-none',
  },
  buttonContainer: {
    gap: 16,
    pointerEvents: 'auto',
  },
  button: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 44,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
