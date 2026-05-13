import { MapBoxAdapter, MapStyles } from '@/adapters/MapBoxAdapter';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createRnMapboxAdapter, type RnMapboxAdapterInstance } from '@/services/rnMapboxAdapter';
import type { NetworkSegment, FacilityType } from '@/services/types/NetworkSegment';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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

// Types for feature markers (curb ramps, obstacles, traffic calming)
export interface Feature {
  id: string;
  coordinate: [number, number]; // [longitude, latitude]
  type: 'curb_ramp' | 'obstacle' | 'segment' | 'traffic_calming';
  geometry?: GeoJSON.Geometry;
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
    // Traffic calming
    type?: string;
    streetGridId?: string;
    featureIndex?: number;
    [key: string]: unknown; // allow spread attributes
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
  /** Returns the RnMapboxAdapter instance once the map is ready (null before ready). */
  getAdapter: () => RnMapboxAdapterInstance | null;
}

// Props for MapViewComponent
export interface MapViewComponentProps {
  polylines?: Polyline[];
  polygonOutlines?: PolygonOutline[];
  features?: Feature[];
  segments?: NetworkSegment[];
  centerPosition?: [number, number]; // [longitude, latitude]
  interactionState?: InteractionState;
  onFeaturePress?: (feature: Feature) => void;
  onSegmentPress?: (segment: NetworkSegment, facilityType: FacilityType) => void;
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
  /** Called when the map viewport changes (pan/zoom) with the new visible bounds */
  onRegionDidChange?: (bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }) => void;
  /** Forward raw map tap coordinates to tool gesture handlers */
  onMapTap?: (coords: { longitude: number; latitude: number }) => void;
  /** Forward raw map long-press coordinates to tool gesture handlers */
  onMapLongPress?: (coords: { longitude: number; latitude: number }) => void;
  /** GeoJSON point features to render as edit previews (e.g. pending add_node placement). */
  previewFeatures?: GeoJSON.Feature[];
}

// Default center (can be overridden by userPosition or centerPosition)
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco
const DEFAULT_ZOOM = 15;

export const MapViewComponent = forwardRef<MapViewComponentRef, MapViewComponentProps>(
  ({
    polylines = [],
    polygonOutlines = [],
    features = [],
    segments = [],
    centerPosition,
    interactionState = 'interactive',
    onFeaturePress,
    onSegmentPress,
    onRatingSubmit,
    onRecenter,
    userPosition,
    zoomLevel = DEFAULT_ZOOM,
    showUserLocation = true,
    mapStyle = MapStyles.STREETS,
    gpsError = false,
    featureEncounterTimestamp,
    readOnlyFeatures = false,
    onRegionDidChange,
    onMapTap,
    onMapLongPress,
    previewFeatures,
  }, ref) => {
    const mapRef = useRef<any>(null);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [showCallout, setShowCallout] = useState(false);
    const cameraRef = useRef<any>(null);
    // Create the RnMapboxAdapter backed by the internal mapRef
    const adapterRef = useRef<RnMapboxAdapterInstance | null>(null);
    if (adapterRef.current === null) {
      adapterRef.current = createRnMapboxAdapter(mapRef);
    }

    // Delay Mapbox GL mount until we have a center or a 3 s timeout expires.
    // Mounting immediately at startup causes a native GL context crash on
    // memory-constrained devices (emulators) before auth/map state settles.
    const [isMapReady, setIsMapReady] = useState(false);
    const readyRef = useRef(false);
    const markReady = useCallback(() => {
      if (!readyRef.current) { readyRef.current = true; setIsMapReady(true); }
    }, []);

    useEffect(() => {
      if (centerPosition || userPosition || gpsError) markReady();
    }, [centerPosition, userPosition, gpsError, markReady]);

    // Fallback: show at DEFAULT_CENTER after 3 s so GPS-less devices don't spin forever
    useEffect(() => {
      const id = setTimeout(markReady, 3000);
      return () => clearTimeout(id);
    }, [markReady]);

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

    // Determine the center: props centerPosition > userPosition > default
    const mapCenter = centerPosition ?? userPosition ?? DEFAULT_CENTER;

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

    // Expose recenter and adapter via ref
    useImperativeHandle(ref, () => ({
      recenter: handleRecenter,
      getAdapter: () => adapterRef.current,
    }));

  const isDimmed = interactionState === 'dimmed';

  // Build GeoJSON FeatureCollections from NetworkSegments for map rendering
  const segmentLayers = useMemo(() => {
    if (segments.length === 0) {
      return { streets: null, sidewalks: null, bikeways: null, crosswalks: null, curbRamps: null, trafficCalming: null };
    }

    const streetFeatures: GeoJSON.Feature[] = [];
    const sidewalkFeatures: GeoJSON.Feature[] = [];
    const bikewayFeatures: GeoJSON.Feature[] = [];
    const crosswalkFeatures: GeoJSON.Feature[] = [];
    const curbRampFeatures: GeoJSON.Feature[] = [];
    const trafficCalmingFeatures: GeoJSON.Feature[] = [];

    for (const seg of segments) {
      // Street centerline
      if (seg.street.geometry) {
        streetFeatures.push({
          type: 'Feature',
          properties: { streetGridId: seg.streetGridId, facilityType: 'street', name: seg.street.name },
          geometry: seg.street.geometry,
        });
      }

      // Sidewalks (color by offset vs separate geometry quality)
      for (const [side, sw] of [['left', seg.sidewalkLeft], ['right', seg.sidewalkRight]] as const) {
        if (sw?.geometry) {
          // Match reference map: offset (buffered) = light blue, separate = dark blue
          const color = sw.buffered === 'yes' ? '#add8e6' : '#00008b';
          sidewalkFeatures.push({
            type: 'Feature',
            properties: {
              streetGridId: seg.streetGridId,
              facilityType: `sidewalk_${side}`,
              color,
              presence: sw.presence,
            },
            geometry: sw.geometry,
          });
        }

        // Curb ramps from this sidewalk
        if (sw?.curbRamps) {
          for (const ramp of sw.curbRamps) {
            if (ramp.geometry) {
              curbRampFeatures.push({
                type: 'Feature',
                properties: {
                  streetGridId: seg.streetGridId,
                  facilityType: `sidewalk_${side}`,
                  rampId: ramp.id,
                  conditionScore: ramp.conditionScore,
                  position: ramp.position,
                  slotNumber: ramp.slotNumber,
                  returnloc: ramp.returnloc,
                  returnposition: ramp.returnposition,
                },
                geometry: ramp.geometry,
              });
            }
          }
        }
      }

      // Bikeways (color by offset vs separate geometry quality)
      for (const [key, bw] of [
        ['bikeway_left_1', seg.bikewayLeft1],
        ['bikeway_left_2', seg.bikewayLeft2],
        ['bikeway_right_1', seg.bikewayRight1],
        ['bikeway_right_2', seg.bikewayRight2],
      ] as const) {
        if (bw?.geometry) {
          // Match reference map: offset (buffered) = light green, separate = dark green
          const color = bw.buffered === 'yes' ? '#90ee90' : '#006400';
          bikewayFeatures.push({
            type: 'Feature',
            properties: { streetGridId: seg.streetGridId, facilityType: key, color },
            geometry: bw.geometry,
          });
        }
      }

      // Traffic calming point features (from street feature multipoint)
      if (seg.street.features?.types && seg.street.features.geometry?.coordinates) {
        const types = seg.street.features.types;
        const coords = seg.street.features.geometry.coordinates;
        const attrs = seg.street.features.attributes ?? [];
        for (let i = 0; i < types.length; i++) {
          if (types[i] === 'traffic_calming' && coords[i]) {
            trafficCalmingFeatures.push({
              type: 'Feature',
              properties: {
                streetGridId: seg.streetGridId,
                featureType: 'traffic_calming',
                featureIndex: i,
                attributes: attrs[i] ?? null,
              },
              geometry: { type: 'Point', coordinates: coords[i] },
            });
          }
        }
      }

      // Crosswalks
      for (const [pos, cw] of [['crosswalk_start', seg.crosswalkStart], ['crosswalk_end', seg.crosswalkEnd]] as const) {
        if (cw?.geometry) {
          crosswalkFeatures.push({
            type: 'Feature',
            properties: { streetGridId: seg.streetGridId, facilityType: pos },
            geometry: cw.geometry,
          });
        }
      }
    }

    const toCollection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection | null =>
      features.length > 0 ? { type: 'FeatureCollection', features } : null;

    return {
      streets: toCollection(streetFeatures),
      sidewalks: toCollection(sidewalkFeatures),
      bikeways: toCollection(bikewayFeatures),
      crosswalks: toCollection(crosswalkFeatures),
      curbRamps: toCollection(curbRampFeatures),
      trafficCalming: toCollection(trafficCalmingFeatures),
    };
  }, [segments]);

  // Handle segment layer taps — determine which facility was tapped
  const handleSegmentLayerPress = (
    event: any,
    facilityType: FacilityType,
  ) => {
    const feature = event?.features?.[0];
    if (!feature?.properties?.streetGridId || !onSegmentPress) return;
    const streetGridId = feature.properties.streetGridId;
    const segment = segments.find(s => s.streetGridId === streetGridId);
    if (segment) {
      onSegmentPress(segment, facilityType);
    }
  };

  // Handle curb ramp tap — convert GeoJSON feature to Feature and open DataRangerCallout
  const handleCurbRampPress = (event: any) => {
    const geoFeature = event?.features?.[0];
    if (!geoFeature) return;

    const props = geoFeature.properties ?? {};
    const coords = geoFeature.geometry?.coordinates as [number, number] | undefined;
    if (!coords) return;

    const rampFeature: Feature = {
      id: props.rampId ?? `ramp_${props.streetGridId}_${props.facilityType}`,
      coordinate: coords,
      type: 'curb_ramp',
      properties: {
        condition_score: props.conditionScore ?? undefined,
        location_in_intersection: props.returnloc ?? undefined,
        position_on_curb: props.returnposition ?? undefined,
        side_of_road: props.facilityType?.replace('sidewalk_', '') ?? undefined,
      },
    };

    setSelectedFeature(rampFeature);
    setShowCallout(true);

    // Center map on tapped ramp
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coords,
        zoomLevel: zoomLevel + 1,
        animationDuration: 500,
      });
    }

    onFeaturePress?.(rampFeature);
  };

  // Hold off mounting Mapbox GL until ready — avoids native GL crash on startup
  if (!isMapReady) {
    return (
      <View style={[styles.container, styles.placeholderContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapBoxAdapter.getMapStyle(mapStyle)}
        surfaceView={false}
        scrollEnabled={!isDimmed}
        pitchEnabled={!isDimmed}
        rotateEnabled={!isDimmed}
        zoomEnabled={!isDimmed}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
        onPress={(e: any) => {
          const coords = e?.geometry?.coordinates;
          if (coords && onMapTap) {
            onMapTap({ longitude: coords[0], latitude: coords[1] });
          }
        }}
        onLongPress={(e: any) => {
          const coords = e?.geometry?.coordinates;
          if (coords && onMapLongPress) {
            onMapLongPress({ longitude: coords[0], latitude: coords[1] });
          }
        }}
        onMapIdle={() => {
          if (onRegionDidChange && mapRef.current) {
            mapRef.current.getVisibleBounds().then((bounds: [[number, number], [number, number]]) => {
              // rnmapbox getVisibleBounds returns [[ne_lon, ne_lat], [sw_lon, sw_lat]]
              onRegionDidChange({
                minLon: bounds[1][0],
                minLat: bounds[1][1],
                maxLon: bounds[0][0],
                maxLat: bounds[0][1],
              });
            }).catch(() => {});
          }
        }}
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

        {/* Render segment layers (proximity network) - sidewalks, bikeways, curb ramps */}
        {/* Streets and crosswalks hidden for now — will be added later */}

        {segmentLayers.sidewalks && (
          <MapboxGL.ShapeSource
            id="segment-sidewalks-source"
            shape={segmentLayers.sidewalks}
            onPress={(e: any) => {
              const ft = e?.features?.[0]?.properties?.facilityType;
              if (ft) handleSegmentLayerPress(e, ft as FacilityType);
            }}
          >
            <MapboxGL.LineLayer
              id="segment-sidewalks-layer"
              style={{
                lineColor: ['get', 'color'],
                lineWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.85,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {segmentLayers.bikeways && (
          <MapboxGL.ShapeSource
            id="segment-bikeways-source"
            shape={segmentLayers.bikeways}
            onPress={(e: any) => {
              const ft = e?.features?.[0]?.properties?.facilityType;
              if (ft) handleSegmentLayerPress(e, ft as FacilityType);
            }}
          >
            <MapboxGL.LineLayer
              id="segment-bikeways-layer"
              style={{
                lineColor: ['get', 'color'],
                lineWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.85,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {segmentLayers.curbRamps && (
          <MapboxGL.ShapeSource
            id="segment-curbramps-source"
            shape={segmentLayers.curbRamps}
            onPress={handleCurbRampPress}
          >
            <MapboxGL.CircleLayer
              id="segment-curbramps-layer"
              style={{
                circleRadius: 5,
                circleColor: '#ff8c00',
                circleStrokeColor: '#ff8c00',
                circleStrokeWidth: 1,
                circleOpacity: 0.9,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {segmentLayers.trafficCalming && (
          <MapboxGL.ShapeSource
            id="segment-calm-source"
            shape={segmentLayers.trafficCalming}
            onPress={(e: any) => {
              const feat = e?.features?.[0];
              if (!feat?.properties?.streetGridId || !onFeaturePress) return;
              const coords: [number, number] = feat.geometry?.coordinates ?? [0, 0];
              onFeaturePress({
                id: `calm_${feat.properties.streetGridId}_${feat.properties.featureIndex}`,
                type: 'traffic_calming',
                coordinate: coords,
                geometry: feat.geometry,
                properties: {
                  type: 'traffic_calming',
                  streetGridId: feat.properties.streetGridId,
                  ...(feat.properties.attributes ?? {}),
                },
              });
            }}
          >
            <MapboxGL.CircleLayer
              id="segment-calm-layer"
              style={{
                circleRadius: 6,
                circleColor: '#9b59b6',
                circleStrokeColor: '#6c3483',
                circleStrokeWidth: 1.5,
                circleOpacity: 0.9,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

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

        {/* Edit preview features (e.g. pending add_node placement) */}
        {previewFeatures && previewFeatures.length > 0 && (
          <MapboxGL.ShapeSource
            id="edit-preview-source"
            shape={{ type: 'FeatureCollection', features: previewFeatures }}
          >
            <MapboxGL.CircleLayer
              id="edit-preview-layer"
              style={{
                circleRadius: 10,
                circleColor: '#ff3b30',
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 2.5,
                circleOpacity: 0.95,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Feature markers removed — curb ramps now rendered from segment data via CircleLayer above */}
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
});

// Add display name for debugging
MapViewComponent.displayName = 'MapViewComponent';

export default MapViewComponent;
