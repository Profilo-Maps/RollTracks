import { MapBoxAdapter, MapStyles } from '@/adapters/MapBoxAdapter';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

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
  };
}

// Interaction state for the map
export type InteractionState = 'interactive' | 'dimmed';

// Ref methods exposed by MapViewComponent
export interface MapViewComponentRef {
  recenter: () => void;
}

// Props interface following the architecture spec
export interface MapViewComponentProps {
  polylines?: Polyline[];
  polygonOutlines?: PolygonOutline[];
  features?: Feature[];
  centerPosition?: [number, number]; // [longitude, latitude]
  interactionState?: InteractionState;
  onFeaturePress?: (feature: Feature) => void;
  onRecenter?: () => void;
  userPosition?: [number, number] | null; // [longitude, latitude] from GPS Adapter
  zoomLevel?: number;
  showUserLocation?: boolean;
  mapStyle?: typeof MapStyles[keyof typeof MapStyles]; // MapBox style from adapter
  gpsError?: boolean; // Indicates GPS permission denied or other error
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
    onRecenter,
    userPosition,
    zoomLevel = DEFAULT_ZOOM,
    showUserLocation = true,
    mapStyle = MapStyles.STREETS,
    gpsError = false,
  }, ref) => {
    const mapRef = useRef<MapboxGL.MapView>(null);
    const cameraRef = useRef<MapboxGL.Camera>(null);
    const [isMapReady, setIsMapReady] = useState(false);

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
    if (feature.properties?.rated) {
      return '#4CAF50'; // Green for rated
    }
    switch (feature.type) {
      case 'curb_ramp':
        return '#2196F3'; // Blue
      case 'obstacle':
        return '#FF9800'; // Orange
      case 'segment':
        return '#9C27B0'; // Purple
      default:
        return '#757575'; // Gray
    }
  };

  const isDimmed = interactionState === 'dimmed';

  // Show placeholder if Mapbox is not available
  if (!MapboxGL) {
    return (
      <View style={[styles.container, styles.placeholderContainer]}>
        <Text style={styles.placeholderTitle}>Map Not Available</Text>
        <Text style={styles.placeholderText}>
          Mapbox requires a development build.{'\n'}
          Run: npx expo run:android or npx expo run:ios
        </Text>
      </View>
    );
  }

  // Show loading state while waiting for position (unless there's a GPS error or explicit centerPosition)
  if (!isMapReady) {
    return (
      <View style={[styles.container, styles.placeholderContainer]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  // Safety check - should not happen due to isMapReady logic, but TypeScript needs it
  if (!mapCenter) {
    return (
      <View style={[styles.container, styles.placeholderContainer]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Waiting for location...</Text>
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

        {/* User location indicator - custom marker using GPS Adapter data */}
        {showUserLocation && userPosition && (
          <MapboxGL.PointAnnotation
            id="user-location"
            coordinate={userPosition}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Render polylines (trip routes) */}
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
                lineColor: polyline.color ?? '#3B82F6',
                lineWidth: polyline.width ?? 4,
                lineCap: 'round',
                lineJoin: 'round',
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

        {/* Render feature markers */}
        {features.map((feature) => (
          <MapboxGL.PointAnnotation
            key={`feature-${feature.id}`}
            id={`feature-${feature.id}`}
            coordinate={feature.coordinate}
            onSelected={() => onFeaturePress?.(feature)}
          >
            <View
              style={[
                styles.featureMarker,
                { backgroundColor: getFeatureColor(feature) },
              ]}
            />
            <MapboxGL.Callout title={feature.properties?.location_description ?? feature.type} />
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* Dimmed overlay when not interactive */}
      {isDimmed && <View style={styles.dimmedOverlay} />}
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
    backgroundColor: '#4285F4', // Google Maps blue
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  featureMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dimmedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
});

// Add display name for debugging
MapViewComponent.displayName = 'MapViewComponent';

export default MapViewComponent;
