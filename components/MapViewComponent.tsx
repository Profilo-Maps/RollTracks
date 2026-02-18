import { MapBoxAdapter, MapStyles } from '@/adapters/MapBoxAdapter';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { DataRangerCallout } from './DataRangerCallout';

// Conditionally import Mapbox - will be null if not in development build
let MapboxGL: any = null;
try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    MapboxGL = require('@rnmapbox/maps').default;
    // Initialize MapBox with access token from adapter
    if (MapboxGL?.setAccessToken) {
      MapboxGL.setAccessToken(MapBoxAdapter.getAccessToken());
    }
  }
} catch {
  console.warn('MapboxGL not available - showing placeholder map');
}

// Types for polyline data (trip routes)
export interface Polyline {
  id: string;
  coordinates: [number, number][]; // [longitude, latitude][]
  color?: string;
  width?: number;
}

// Types for polygon outlines (census blocks)
export interface PolygonOutline {
  id: string;
  coordinates: [number, number][][]; // Array of rings (outer ring + holes)
  color?: string;
  width?: number;
}

// Types for feature markers (curb ramps, obstacles)
export interface Feature {
  id: string;
  coordinate: [number, number]; // [longitude, latitude]
  type: 'curb_ramp' | 'obstacle' | 'segment';
  properties?: {
    location_description?: string;
    condition_score?: number;
    location_in_intersection?: string;
    position_on_curb?: string;
    to_st?: string;
    from_st?: string;
    side_of_road?: string;
    flag_status?: boolean;
    rated?: boolean;
    userRating?: number; // 1-10 scale for rated features
  };
}

// Callback for rating submission from callout
export interface RatingSubmitParams {
  feature: Feature;
  rating: number;
  imageUri?: string;
}

// Interaction state for the map
export type InteractionState = 'interactive' | 'dimmed';

// Ref methods exposed by MapViewComponent
export interface MapViewComponentRef {
  recenter: () => void;
}

// Props for MapViewComponent
export interface MapViewComponentProps {
  polylines?: Polyline[];
  polygonOutlines?: PolygonOutline[];
  features?: Feature[];
  centerPosition?: [number, number]; // [longitude, latitude]
  interactionState?: InteractionState;
  onFeaturePress?: (feature: Feature) => void;
  onRatingSubmit?: (params: RatingSubmitParams) => Promise<void>; // Callback for rating submission
  onRecenter?: () => void;
  userPosition?: [number, number] | null; // [longitude, latitude] from GPS Adapter
  zoomLevel?: number;
  showUserLocation?: boolean;
  mapStyle?: typeof MapStyles[keyof typeof MapStyles]; // MapBox style from adapter
  gpsError?: boolean; // Indicates GPS permission denied or other error
  /** Timestamp when features were encountered (for 6-hour rating window) */
  featureEncounterTimestamp?: string;
  /** Force read-only mode for all features */
  readOnlyFeatures?: boolean;
}

// Default center (can be overridden by userPosition or centerPosition)
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco
const DEFAULT_ZOOM = 15;

export const MapViewComponent = forwardRef<MapViewComponentRef, MapViewComponentProps>(
  ({
    polylines = [],
    polygonOutlines = [],
    features = [],
    centerPosition,
    interactionState = 'interactive',
    onFeaturePress,
    onRatingSubmit,
    onRecenter,
    userPosition,
    zoomLevel = DEFAULT_ZOOM,
    showUserLocation = true,
    mapStyle = MapStyles.STREETS,
    gpsError = false,
    featureEncounterTimestamp,
    readOnlyFeatures = false,
  }, ref) => {
    const mapRef = useRef<any>(null);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [showCallout, setShowCallout] = useState(false);
    const cameraRef = useRef<any>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const tintColor = useThemeColor({}, 'tint');

    // Validate MapBox configuration on mount
    useEffect(() => {
      if (!MapBoxAdapter.isConfigured()) {
        console.error('MapBox is not properly configured. Check EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env');
      }
    }, []);

    // Determine if map should be shown
    // Show map when: centerPosition is provided, OR userPosition is available, OR there's a GPS error (fallback to default)
    useEffect(() => {
      if (centerPosition || userPosition || gpsError) {
        setIsMapReady(true);
      }
    }, [centerPosition, userPosition, gpsError]);

    // Update camera when user position changes (only if no explicit centerPosition)
    useEffect(() => {
      if (cameraRef.current && userPosition && !centerPosition && isMapReady) {
        console.log('[MapViewComponent] Updating camera to user position:', userPosition);
        cameraRef.current.setCamera({
          centerCoordinate: userPosition,
          zoomLevel: zoomLevel,
          animationDuration: 1000,
        });
      }
    }, [userPosition, centerPosition, zoomLevel, isMapReady]);

    // Determine the center: props centerPosition > userPosition > default (only if GPS error)
    const mapCenter = centerPosition ?? userPosition ?? (gpsError ? DEFAULT_CENTER : null);

    // Handle recentering to user position
    const handleRecenter = () => {
      if (cameraRef.current && userPosition) {
        cameraRef.current.setCamera({
          centerCoordinate: userPosition,
          zoomLevel: zoomLevel,
          animationDuration: 500,
        });
      }
      onRecenter?.();
    };

    // Expose recenter method via ref
    useImperativeHandle(ref, () => ({
      recenter: handleRecenter,
    }));

  // Render feature marker color based on type and rated status
  const getFeatureColor = (feature: Feature): string => {
    // Rated features will be rendered as stars, not circles
    if (feature.properties?.rated) {
      return '#4CAF50'; // Green (fallback, shouldn't be used)
    }
    
    // Unrated features: color by condition score (matching old implementation)
    const score = feature.properties?.condition_score ?? -1;
    if (score >= 50) return '#4CAF50';   // Green - good condition
    if (score >= 0) return '#FF9500';    // Orange - fair condition
    return '#9C27B0';                     // Purple - poor/unknown condition
  };

  // Get star color based on rating (1-10 scale) - matching old implementation
  const getStarColor = (rating: number): string => {
    if (rating <= 2) return '#FF0000';      // Red
    if (rating <= 4) return '#FF6B00';      // Orange-red
    if (rating <= 6) return '#FFE600';      // Yellow
    if (rating <= 8) return '#65D602';      // Yellow-green
    return '#009100';                        // Green
  };

  const isDimmed = interactionState === 'dimmed';

  // Show placeholder if Mapbox is not available
  if (!MapboxGL) {
    return (
      <View style={[styles.container, styles.placeholderContainer, { backgroundColor }]}>
        <Text style={[styles.placeholderTitle, { color: textColor }]}>Map Not Available</Text>
        <Text style={[styles.placeholderText, { color: iconColor }]}>
          Mapbox requires a development build.{'\n'}
          Run: npx expo run:android or npx expo run:ios
        </Text>
      </View>
    );
  }

  // Show loading state while waiting for position (unless there's a GPS error or explicit centerPosition)
  if (!isMapReady) {
    return (
      <View style={[styles.container, styles.placeholderContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={[styles.loadingText, { color: iconColor }]}>Loading map...</Text>
      </View>
    );
  }

  // Safety check - should not happen due to isMapReady logic, but TypeScript needs it
  if (!mapCenter) {
    return (
      <View style={[styles.container, styles.placeholderContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={[styles.loadingText, { color: iconColor }]}>Waiting for location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapBoxAdapter.getMapStyle(mapStyle)}
        scrollEnabled={!isDimmed}
        pitchEnabled={!isDimmed}
        rotateEnabled={!isDimmed}
        zoomEnabled={!isDimmed}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={mapCenter}
          zoomLevel={zoomLevel}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Render polylines (trip routes) - render FIRST so they appear at the bottom */}
        {polylines.map((polyline) => (
          <MapboxGL.ShapeSource
            key={`polyline-${polyline.id}`}
            id={`polyline-source-${polyline.id}`}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: polyline.coordinates,
              },
            }}
          >
            <MapboxGL.LineLayer
              id={`polyline-layer-${polyline.id}`}
              style={{
                lineColor: polyline.color ?? '#007AFF',
                lineWidth: polyline.width ?? 4,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.8,
              }}
            />
          </MapboxGL.ShapeSource>
        ))}

        {/* Render polygon outlines (census blocks) */}
        {polygonOutlines.map((polygon) => (
          <MapboxGL.ShapeSource
            key={`polygon-${polygon.id}`}
            id={`polygon-source-${polygon.id}`}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: polygon.coordinates,
              },
            }}
          >
            <MapboxGL.LineLayer
              id={`polygon-layer-${polygon.id}`}
              style={{
                lineColor: polygon.color ?? '#FF6B6B',
                lineWidth: polygon.width ?? 2,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: [2, 2], // Dashed line for block outlines
              }}
            />
          </MapboxGL.ShapeSource>
        ))}

        {/* User location puck - render BEFORE features so features appear on top */}
        {showUserLocation && userPosition && (
          <MapboxGL.PointAnnotation
            id="user-location"
            coordinate={userPosition}
          >
            <View style={styles.userLocationMarker}>
              <View style={[styles.userLocationDot, { backgroundColor: tintColor, borderColor: backgroundColor }]} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Render feature markers - deduplicate by ID first, render AFTER puck so they appear on top */}
        {Array.from(new Map(features.map(f => [f.id, f])).values()).map((feature) => {
          const isRated = feature.properties?.rated ?? false;
          const rating = feature.properties?.userRating ?? 5;
          
          // Debug: Log first few features to see their properties
          if (features.indexOf(feature) < 3) {
            console.log('[MapViewComponent] Rendering feature:', {
              id: feature.id,
              rated: isRated,
              userRating: rating,
              properties: feature.properties,
            });
          }
          
          return (
            <MapboxGL.PointAnnotation
              key={`feature-${feature.id}`}
              id={`feature-${feature.id}`}
              coordinate={feature.coordinate}
              onSelected={() => {
                console.log('[MapViewComponent] Feature selected:', feature.id);
                setSelectedFeature(feature);
                setShowCallout(true);
                
                // Center map on selected feature
                if (cameraRef.current) {
                  cameraRef.current.setCamera({
                    centerCoordinate: feature.coordinate,
                    zoomLevel: zoomLevel + 1, // Zoom in slightly
                    animationDuration: 500,
                  });
                }
                
                onFeaturePress?.(feature);
              }}
            >
              {isRated ? (
                // Rated feature: star marker
                <View style={styles.starMarker}>
                  <View style={[styles.starShape, { backgroundColor: getStarColor(rating) }]}>
                    <Text style={styles.starText}>★</Text>
                  </View>
                </View>
              ) : (
                // Unrated feature: circle marker
                <View
                  style={[
                    styles.featureMarker,
                    { backgroundColor: getFeatureColor(feature), borderColor: backgroundColor },
                  ]}
                />
              )}
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>

      {/* Dimmed overlay when not interactive */}
      {isDimmed && <View style={styles.dimmedOverlay} />}
      
      {/* DataRanger Callout Modal */}
      {onRatingSubmit && selectedFeature && (
        <DataRangerCallout
          visible={showCallout}
          feature={selectedFeature}
          existingRating={selectedFeature.properties?.userRating ?? null}
          encounterTimestamp={featureEncounterTimestamp}
          readOnly={readOnlyFeatures}
          onClose={() => {
            setShowCallout(false);
            setSelectedFeature(null);
          }}
          onSubmit={async (newRating, imageUri) => {
            await onRatingSubmit({
              feature: selectedFeature,
              rating: newRating,
              imageUri,
            });
            setShowCallout(false);
            setSelectedFeature(null);
          }}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  userLocationMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    // backgroundColor and borderColor applied dynamically
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  featureMarker: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    // borderColor applied dynamically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  starMarker: {
    width: 19,
    height: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starShape: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  starText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  dimmedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor applied dynamically
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    // color applied dynamically
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    // color applied dynamically
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    // color applied dynamically
    marginTop: 12,
    textAlign: 'center',
  },
});

// Add display name for debugging
MapViewComponent.displayName = 'MapViewComponent';

export default MapViewComponent;
