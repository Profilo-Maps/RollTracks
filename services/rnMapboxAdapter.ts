/**
 * rnMapboxAdapter.ts
 * Implements the MapAdapter interface from @proximity/shared using @rnmapbox/maps APIs.
 * Platform-specific bridge between RN Mapbox and the shared tool state machines.
 */

import type { LineString, Polygon } from 'geojson';
import {
  type MapAdapter,
  type MapTapEvent,
  type QueriedFeature,
  type NearestSegmentResult,
  type SegmentPairInfo,
} from '@proximity/shared';

// Re-export MapAdapter for consumers that import it from this module.
export type { MapAdapter };

// --- Layer IDs used in MapViewComponent ---
const LAYER_IDS = {
  STREETS: 'px-streets',
  POINTS: 'px-points',
  HULLS: 'px-hull-fill',
  SIDEWALKS: 'px-sidewalks',
  BIKEWAYS: 'px-bikeways',
  CURB_RAMPS: 'segment-curbramps-layer',
  TRAFFIC_CALMING: 'segment-calm-layer',
} as const;

// Hull layers that may contain polygon features with node_id properties.
const HULL_LAYER_IDS: string[] = [LAYER_IDS.HULLS];

// Feature type to layer mapping
const FEATURE_TYPE_LAYERS: Record<string, string> = {
  street: LAYER_IDS.STREETS,
  point: LAYER_IDS.POINTS,
  hull: LAYER_IDS.HULLS,
  sidewalk: LAYER_IDS.SIDEWALKS,
  bikeway: LAYER_IDS.BIKEWAYS,
  ramp: LAYER_IDS.CURB_RAMPS,
  calm: LAYER_IDS.TRAFFIC_CALMING,
};

// --- Cache types ---

type SegmentPairCache = Map<string, SegmentPairInfo | null>;
type HullVerticesCache = Map<string, [number, number][] | null>;

/**
 * Extended adapter object returned by createRnMapboxAdapter.
 * Satisfies the MapAdapter interface and adds async fetch/preload methods
 * for queries that require awaiting the Mapbox MapView API.
 */
export interface RnMapboxAdapterInstance extends MapAdapter {
  /**
   * Async: query rendered features for both segments, extract coordinates,
   * find any shared endpoint, and cache the result under `${seg1Id}|${seg2Id}`.
   */
  fetchSegmentPairInfo(seg1Id: string, seg2Id: string): Promise<SegmentPairInfo | null>;
  /**
   * Async: query hull layers for a polygon whose node_id matches nodeId,
   * extract the exterior ring (minus closing duplicate), and cache the result.
   */
  fetchHullVertices(nodeId: string): Promise<[number, number][] | null>;
  /** Populate the SegmentPairInfo cache without returning the value. */
  preloadSegmentPair(s1: string, s2: string): Promise<void>;
  /** Populate the hull vertices cache without returning the value. */
  preloadHullVertices(nodeId: string): Promise<void>;
}

/**
 * Create a MapAdapter backed by an @rnmapbox/maps MapView ref.
 * The mapRef must be a ref to a MapboxGL.MapView instance.
 */
export function createRnMapboxAdapter(mapRef: React.RefObject<any>): RnMapboxAdapterInstance {
  const getMap = () => mapRef.current;

  // --- Caches populated by the async fetchers ---
  const segmentPairCache: SegmentPairCache = new Map();
  const hullVerticesCache: HullVerticesCache = new Map();

  // --- Internal helper: query rendered features in a lat/lng bounding box ---
  function queryInBbox(
    bbox: [number, number, number, number],
    layerIds: string[],
  ): any[] | null {
    const map = getMap();
    if (!map || !map.queryRenderedFeaturesInRect) return null;
    try {
      return map.queryRenderedFeaturesInRect(bbox, [], layerIds) ?? null;
    } catch {
      return null;
    }
  }

  // --- Internal helper: build a bbox around a lng/lat point ---
  function pointBbox(
    lng: number,
    lat: number,
    tolerance: number,
  ): [number, number, number, number] {
    return [lng - tolerance, lat - tolerance, lng + tolerance, lat + tolerance];
  }

  /**
   * Translate MapViewComponent ShapeSource properties → shared tool schema.
   * The shared tool logic reads _seg_id, _side, _position, _index, _t, _fid.
   * RollTracks ShapeSource layers use facilityType, streetGridId, rampId, etc.
   */
  function translateFeatureProps(
    raw: Record<string, unknown>,
    featureTypes: string[],
  ): Record<string, unknown> {
    const ft = featureTypes[0];

    if (ft === 'sidewalk') {
      // facilityType: 'sidewalk_left' | 'sidewalk_right'
      const side = String(raw.facilityType ?? '').replace('sidewalk_', '') as 'left' | 'right';
      const suffix = side === 'left' ? 'L' : 'R';
      const segId = `${raw.streetGridId ?? ''}${suffix}`;
      return { ...raw, _seg_id: segId, _side: side, _t: 'sidewalk' };
    }

    if (ft === 'ramp') {
      // facilityType: 'sidewalk_left' | 'sidewalk_right', position, slotNumber
      const side = String(raw.facilityType ?? '').replace('sidewalk_', '') as 'left' | 'right';
      const suffix = side === 'left' ? 'L' : 'R';
      const segId = `${raw.streetGridId ?? ''}${suffix}`;
      return {
        ...raw,
        _t: 'ramp',
        _fid: raw.rampId ?? `ramp_${raw.streetGridId}_${raw.position}_${raw.slotNumber}`,
        _seg_id: segId,
        _side: side,
        _position: raw.position,
        _index: raw.slotNumber ?? 1,
      };
    }

    if (ft === 'calm') {
      return {
        ...raw,
        _t: 'calm',
        _fid: `calm_${raw.streetGridId}_${raw.featureIndex}`,
        _seg_id: raw.streetGridId,
        _calm_type: 'traffic_calming',
      };
    }

    // Street / bikeway / node — pass through with _seg_id alias
    if (raw.streetGridId && !raw._seg_id) {
      return { ...raw, _seg_id: raw.streetGridId };
    }

    return raw;
  }

  const adapter: RnMapboxAdapterInstance = {
    // ─── Core MapAdapter methods (sync, untouched logic) ────────────────────

    queryFeatures(tap: MapTapEvent, featureTypes: string[]): QueriedFeature | null {
      const map = getMap();
      if (!map) return null;

      // Determine which layers to query based on requested feature types
      const layerIds = featureTypes
        .map(ft => FEATURE_TYPE_LAYERS[ft])
        .filter(Boolean);

      try {
        // Use a small bounding box around the tap point (approx 10px tolerance)
        const tolerance = 0.0001; // ~11m at equator
        const bbox = pointBbox(tap.lng, tap.lat, tolerance);

        // Note: In actual usage, the gesture hook will provide screen coordinates
        // and call queryRenderedFeaturesAtPoint directly. This is the fallback.
        const features = map.queryRenderedFeaturesInRect
          ? map.queryRenderedFeaturesInRect(bbox, [], layerIds)
          : null;

        if (!features || features.length === 0) return null;

        const f = features[0];
        const raw = f.properties || {};

        // Translate RollTracks ShapeSource property schema → shared tool schema
        // The shared tool logic uses _seg_id, _side, _position, _index, _t, _fid
        const props = translateFeatureProps(raw, featureTypes);

        return { geometry: f.geometry, properties: props };
      } catch {
        return null;
      }
    },

    queryHulls(tap: MapTapEvent): QueriedFeature | null {
      return adapter.queryFeatures(tap, ['hull']);
    },

    findNearestSegmentPoint(tap: MapTapEvent): NearestSegmentResult | null {
      const map = getMap();
      if (!map) return null;

      try {
        const tolerance = 0.0003; // ~33m search radius
        const bbox = pointBbox(tap.lng, tap.lat, tolerance);

        const features = map.queryRenderedFeaturesInRect
          ? map.queryRenderedFeaturesInRect(bbox, [], [LAYER_IDS.STREETS])
          : null;

        if (!features || features.length === 0) return null;

        // Find nearest point on the closest segment
        let nearest: NearestSegmentResult | null = null;
        let minDist = Infinity;

        for (const f of features) {
          if (f.geometry?.type !== 'LineString') continue;
          const coords = (f.geometry as LineString).coordinates;
          const result = projectPointOnLineCoords(tap.lng, tap.lat, coords);
          if (result && result.dist < minDist) {
            minDist = result.dist;
            nearest = {
              lng: result.point[0],
              lat: result.point[1],
              segId: f.properties?._seg_id || f.id || '',
            };
          }
        }

        return nearest;
      } catch {
        return null;
      }
    },

    // ─── Sync cache-backed methods ───────────────────────────────────────────

    getSegmentPairInfo(seg1Id: string, seg2Id: string): SegmentPairInfo | null {
      // TODO: async hull/pair queries require platform-level state
      const key = `${seg1Id}|${seg2Id}`;
      const reversed = `${seg2Id}|${seg1Id}`;
      return segmentPairCache.get(key) ?? segmentPairCache.get(reversed) ?? null;
    },

    getHullVertices(nodeId: string): [number, number][] | null {
      // TODO: async hull/pair queries require platform-level state
      return hullVerticesCache.get(nodeId) ?? null;
    },

    // ─── Async fetchers ──────────────────────────────────────────────────────

    async fetchSegmentPairInfo(
      seg1Id: string,
      seg2Id: string,
    ): Promise<SegmentPairInfo | null> {
      const key = `${seg1Id}|${seg2Id}`;
      if (segmentPairCache.has(key)) return segmentPairCache.get(key)!;

      const map = getMap();
      if (!map) {
        segmentPairCache.set(key, null);
        return null;
      }

      try {
        // Query the full visible street layer — we scan for matching _seg_id values.
        // Mapbox doesn't support filter-by-property in queryRenderedFeaturesInRect on
        // RN, so we fetch a generous viewport-wide bbox and filter in JS.
        const wideBbox: [number, number, number, number] = [-180, -90, 180, 90];
        const features = queryInBbox(wideBbox, [LAYER_IDS.STREETS]) ?? [];

        let seg1Coords: [number, number][] | null = null;
        let seg2Coords: [number, number][] | null = null;

        for (const f of features) {
          if (f.geometry?.type !== 'LineString') continue;
          const segId: string = f.properties?._seg_id ?? f.id ?? '';
          if (segId === seg1Id && !seg1Coords) {
            seg1Coords = (f.geometry as LineString).coordinates as [number, number][];
          } else if (segId === seg2Id && !seg2Coords) {
            seg2Coords = (f.geometry as LineString).coordinates as [number, number][];
          }
          if (seg1Coords && seg2Coords) break;
        }

        if (!seg1Coords || !seg2Coords) {
          segmentPairCache.set(key, null);
          return null;
        }

        // Find shared node: compare start/end of each segment within ~1m tolerance
        const tolerance = 0.00001;
        const endpoints1: [number, number][] = [
          seg1Coords[0],
          seg1Coords[seg1Coords.length - 1],
        ];
        const endpoints2: [number, number][] = [
          seg2Coords[0],
          seg2Coords[seg2Coords.length - 1],
        ];

        let sharedNodeId: string | null = null;
        outer: for (const p1 of endpoints1) {
          for (const p2 of endpoints2) {
            if (
              Math.abs(p1[0] - p2[0]) < tolerance &&
              Math.abs(p1[1] - p2[1]) < tolerance
            ) {
              sharedNodeId = `${p1[0].toFixed(6)}_${p1[1].toFixed(6)}`;
              break outer;
            }
          }
        }

        const result: SegmentPairInfo = {
          seg1Id,
          seg2Id,
          sharedNodeId,
          seg1Coords,
          seg2Coords,
        };

        segmentPairCache.set(key, result);
        return result;
      } catch {
        segmentPairCache.set(key, null);
        return null;
      }
    },

    async fetchHullVertices(nodeId: string): Promise<[number, number][] | null> {
      if (hullVerticesCache.has(nodeId)) return hullVerticesCache.get(nodeId)!;

      const map = getMap();
      if (!map) {
        hullVerticesCache.set(nodeId, null);
        return null;
      }

      try {
        const wideBbox: [number, number, number, number] = [-180, -90, 180, 90];
        const features = queryInBbox(wideBbox, HULL_LAYER_IDS) ?? [];

        for (const f of features) {
          if (f.geometry?.type !== 'Polygon') continue;
          if (f.properties?.node_id !== nodeId) continue;

          // Extract exterior ring, drop the closing duplicate point
          const ring: number[][] = (f.geometry as Polygon).coordinates[0];
          const vertices = ring
            .slice(0, ring.length - 1)
            .map((c): [number, number] => [c[0], c[1]]);

          hullVerticesCache.set(nodeId, vertices);
          return vertices;
        }

        hullVerticesCache.set(nodeId, null);
        return null;
      } catch {
        hullVerticesCache.set(nodeId, null);
        return null;
      }
    },

    // ─── Preload helpers ─────────────────────────────────────────────────────

    async preloadSegmentPair(s1: string, s2: string): Promise<void> {
      await adapter.fetchSegmentPairInfo(s1, s2);
    },

    async preloadHullVertices(nodeId: string): Promise<void> {
      await adapter.fetchHullVertices(nodeId);
    },
  };

  return adapter;
}

// --- Internal geometry helper ---

/**
 * Projects a point onto a polyline defined by coordinate pairs.
 * Returns the projected point, distance, and segment vertex index.
 * Kept as an internal helper since the shared `projectPointOnSegment` may
 * operate on a different input shape (segment objects vs raw coordinate arrays).
 */
function projectPointOnLineCoords(
  px: number,
  py: number,
  coordinates: number[][],
): { point: [number, number]; dist: number; vertexIndex: number } | null {
  if (coordinates.length < 2) return null;

  let minDist = Infinity;
  let bestPoint: [number, number] = [0, 0];
  let bestIndex = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const ax = coordinates[i][0], ay = coordinates[i][1];
    const bx = coordinates[i + 1][0], by = coordinates[i + 1][1];

    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

    if (dist < minDist) {
      minDist = dist;
      bestPoint = [projX, projY];
      bestIndex = i;
    }
  }

  return { point: bestPoint, dist: minDist, vertexIndex: bestIndex };
}
