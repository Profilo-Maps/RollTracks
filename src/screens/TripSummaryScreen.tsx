import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { TripSummaryCard } from '../components/TripSummaryCard';
import { MapView } from '../components/MapView';
import { FeaturePopup } from '../components/FeaturePopup';
import { GPSService } from '../services/GPSService';
import { RatingService } from '../services/RatingService';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { obstacleService } from '../services/ObstacleService';
import { Trip, LocationPoint, RatedFeature, ObstacleFeature, ObstacleFeatureWithRating } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_PEEK_HEIGHT = 60; // Height of the tab when minimized
const DRAWER_MAX_HEIGHT = SCREEN_HEIGHT * 0.4; // Max height when expanded (40% of screen)

export const TripSummaryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { trip } = (route.params as { trip: Trip }) || {};
  
  const translateY = useRef(new Animated.Value(DRAWER_MAX_HEIGHT - DRAWER_PEEK_HEIGHT)).current;
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [ratedFeatures, setRatedFeatures] = useState<RatedFeature[]>([]);
  const [allEncounteredObstacles, setAllEncounteredObstacles] = useState<ObstacleFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<ObstacleFeatureWithRating | null>(null);
  const [showFeaturePopup, setShowFeaturePopup] = useState(false);

  // Initialize services
  const storageAdapter = new LocalStorageAdapter();
  const ratingService = new RatingService(storageAdapter);

  // Decode the trip's polyline geometry
  useEffect(() => {
    if (trip?.geometry) {
      console.log('Trip geometry found, decoding polyline...');
      const gpsService = new GPSService();
      try {
        const decodedPoints = gpsService.decodePolyline(trip.geometry);
        console.log('Decoded', decodedPoints.length, 'points from polyline');
        setRoutePoints(decodedPoints);
      } catch (error) {
        console.error('Error decoding polyline:', error);
      }
    } else {
      console.log('No trip geometry found');
    }
  }, [trip?.geometry]);

  // Load rated features and all encountered obstacles for this trip
  useEffect(() => {
    const loadObstaclesAndRatings = async () => {
      if (trip?.id && routePoints.length > 0) {
        try {
          console.log('TripSummaryScreen: Starting to load obstacles and ratings...');
          
          // Initialize obstacle service
          await obstacleService.initialize();
          console.log('TripSummaryScreen: Obstacle service initialized');
          
          // Load rated features
          const ratings = await ratingService.getRatingsForTrip(trip.id);
          setRatedFeatures(ratings);
          console.log(`TripSummaryScreen: Loaded ${ratings.length} rated features for trip`);
          
          // Query obstacles along the entire route
          const encounteredObstacles = new Map<string, ObstacleFeature>();
          
          // Sample route points (every 10th point to avoid too many queries)
          const sampleInterval = Math.max(1, Math.floor(routePoints.length / 50));
          console.log(`TripSummaryScreen: Sampling ${Math.ceil(routePoints.length / sampleInterval)} points from ${routePoints.length} total points`);
          
          for (let i = 0; i < routePoints.length; i += sampleInterval) {
            const point = routePoints[i];
            const nearbyObstacles = obstacleService.queryNearby({
              latitude: point.latitude,
              longitude: point.longitude,
              radiusMeters: 50, // 50 meter radius
            });
            
            // Add to map to avoid duplicates
            nearbyObstacles.forEach(obstacle => {
              if (!encounteredObstacles.has(obstacle.id)) {
                encounteredObstacles.set(obstacle.id, obstacle);
              }
            });
          }
          
          const allObstacles = Array.from(encounteredObstacles.values());
          setAllEncounteredObstacles(allObstacles);
          console.log(`TripSummaryScreen: Found ${allObstacles.length} total obstacles encountered during trip`);
          console.log(`TripSummaryScreen: Rated obstacles: ${ratings.length}, Total obstacles: ${allObstacles.length}`);
        } catch (error) {
          console.error('TripSummaryScreen: Error loading obstacles and ratings:', error);
        }
      } else {
        console.log(`TripSummaryScreen: Waiting for data - trip.id: ${trip?.id}, routePoints: ${routePoints.length}`);
      }
    };
    loadObstaclesAndRatings();
  }, [trip?.id, routePoints]);

  // Get the last point as current location for map centering
  const currentLocation = useMemo(() => {
    if (routePoints.length > 0) {
      return routePoints[routePoints.length - 1];
    }
    return null;
  }, [routePoints]);

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Limit the drag to valid range
        const newValue = gestureState.dy;
        if (newValue >= 0 && newValue <= DRAWER_MAX_HEIGHT - DRAWER_PEEK_HEIGHT) {
          translateY.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = DRAWER_MAX_HEIGHT / 4;
        
        if (gestureState.dy > threshold || gestureState.vy > 0.5) {
          // Swipe down - minimize
          minimizeDrawer();
        } else {
          // Swipe up or small movement - expand
          expandDrawer();
        }
      },
    })
  ).current;

  const expandDrawer = () => {
    setIsExpanded(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const minimizeDrawer = () => {
    setIsExpanded(false);
    Animated.spring(translateY, {
      toValue: DRAWER_MAX_HEIGHT - DRAWER_PEEK_HEIGHT,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const toggleDrawer = () => {
    if (isExpanded) {
      minimizeDrawer();
    } else {
      expandDrawer();
    }
  };

  // Expand drawer when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('TripSummaryScreen focused');
      expandDrawer();
      
      return () => {
        console.log('TripSummaryScreen unfocused');
      };
    }, [])
  );

  const handleClose = () => {
    (navigation as any).navigate('StartTrip');
  };

  // Handle rated feature tap
  const handleFeatureTap = (feature: ObstacleFeature) => {
    const ratedFeature = ratedFeatures.find(r => r.id === feature.id);
    if (ratedFeature) {
      const featureWithRating: ObstacleFeatureWithRating = {
        ...feature,
        rating: ratedFeature.userRating,
        isRated: true,
      };
      setSelectedFeature(featureWithRating);
      setShowFeaturePopup(true);
    }
  };

  // Handle feature popup close
  const handleFeaturePopupClose = () => {
    setShowFeaturePopup(false);
    setSelectedFeature(null);
  };

  // Get rated feature IDs and ratings for visual distinction
  const ratedFeatureIds = ratedFeatures.map(r => r.id);
  const ratedFeatureRatings = useMemo(() => {
    const ratingsMap: Record<string, number> = {};
    ratedFeatures.forEach(r => {
      ratingsMap[r.id] = r.userRating;
    });
    return ratingsMap;
  }, [ratedFeatures]);

  // Debug logging for render
  console.log('TripSummaryScreen render:', {
    routePointsCount: routePoints.length,
    obstaclesCount: allEncounteredObstacles.length,
    ratedFeaturesCount: ratedFeatures.length,
    ratedFeatureIdsCount: ratedFeatureIds.length,
    ratedFeatureRatingsCount: Object.keys(ratedFeatureRatings).length,
  });

  return (
    <View style={styles.container}>
      <MapView
        currentLocation={currentLocation}
        routePoints={routePoints}
        isPaused={false}
        obstacleFeatures={allEncounteredObstacles}
        showCompleteRoute={true}
        onFeatureTap={handleFeatureTap}
        ratedFeatureIds={ratedFeatureIds}
        ratedFeatureRatings={ratedFeatureRatings}
      />
      
      {selectedFeature && (
        <FeaturePopup
          feature={selectedFeature}
          visible={showFeaturePopup}
          onClose={handleFeaturePopupClose}
          onRate={() => {}} // No rating on summary screen
          tripId={trip?.id || ''}
        />
      )}
      <Animated.View 
        style={[
          styles.drawer,
          {
            transform: [{ translateY }],
            height: DRAWER_MAX_HEIGHT,
          },
        ]}
      >
        {/* Draggable handle */}
        <View 
          style={styles.handleContainer}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          <Text style={styles.handleText}>
            {isExpanded ? 'Swipe down to minimize' : 'Swipe up for details'}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {trip ? (
            <TripSummaryCard 
              trip={trip} 
              onClose={handleClose}
              obstacles={allEncounteredObstacles}
              ratedFeatures={ratedFeatures}
            />
          ) : (
            <TripSummaryCard 
              trip={null} 
              onClose={handleClose}
              error="Failed to load trip data"
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handleContainer: {
    height: DRAWER_PEEK_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#CCCCCC',
    borderRadius: 3,
    marginBottom: 8,
  },
  handleText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
