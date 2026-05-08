// ═══════════════════════════════════════════════════════════
// NETWORK SEGMENT TYPES
// ═══════════════════════════════════════════════════════════
// TypeScript interfaces for the Proximity graph network.
// Each parquet row maps 1:1 to a NetworkSegment.
// See specs/ProximitySchema.md for authoritative column definitions.
//
// Editability rule: all attributes are editable except
// public_data_id_* columns, maxspeed, and geometry columns.
// "seperator" spelling is intentional — matches parquet column names.

import type { LineString, MultiLineString, MultiPoint, Point, Geometry } from 'geojson';

// --- Feature sets ---

/** Street features have attributes but no ids column in the schema. */
export interface StreetFeatureSet {
  types: string[] | null;
  geometry: MultiPoint | null;
  geometryProjected: MultiPoint | null;
  attributes: Record<string, unknown>[] | null;
}

/**
 * Sidewalk and bikeway features. Has ids but no attributes.
 * Note: bikeway_*_2 features have no ids column — ids is null for those.
 */
export interface SegmentFeatureSet {
  ids: string[] | null;
  types: string[] | null;
  geometry: MultiPoint | null;
  geometryProjected: MultiPoint | null;
}

// --- Curb ramps ---

export interface CurbRampSlot {
  id: string | null;
  position: 'start' | 'end';
  slotNumber: 1 | 2 | 3;
  returnloc: string | null;
  returnposition: string | null;
  conditionScore: number | null;
  geometry: Point | null;
}

// --- Sidewalks ---

export interface SidewalkData {
  id: string;                         // streetGridId + "L" or "R"
  gridId: string;                     // same as id (schema defines both columns)
  presence: string | null;
  surface: string | null;
  quality: string | null;
  width: number | null;
  incline: number | null;
  seperator: string | null;           // intentional spelling — matches parquet column
  buffered: string;                   // "yes" | "no"
  geometry: LineString | MultiLineString | null;
  curbRamps: CurbRampSlot[];          // up to 6 per side (start/end × 3)
  features: SegmentFeatureSet | null;
}

// --- Crosswalks ---

export interface CrosswalkData {
  id: string | null;
  gridIds: string | null;
  type: string | null;
  controlled: string | null;
  marked: string | null;
  markings: string | null;
  signals: string | null;             // stringified list of signal attributes
  island: string | null;              // "yes" | "no"
  kerb: string | null;
  tactilePaving: string | null;
  trafficCalming: string | null;
  continuous: string | null;
  condition: string | null;
  geometry: LineString | null;
  islandGeometry: MultiPoint | null;
}

// --- Bikeways ---

export interface BikewayData {
  id: string | null;
  gridId: string | null;             // schema defines grid_id for bikeway_*_1 (also used for *_2)
  type: string | null;
  surface: string | null;
  quality: string | null;
  permitted: string | null;
  width: number | null;
  incline: number | null;
  seperator: string | null;           // intentional spelling — matches parquet column
  buffered: string;                   // "yes" | "no"
  geometry: LineString | MultiLineString | null;
  features: SegmentFeatureSet | null; // bikeway_*_2 has no feature_ids column
}

// --- Main segment ---

export interface NetworkSegment {
  // Street identity
  streetId: string;
  streetGridId: string;               // "12_34_0" — spatial + sequence key
  intersectionReviewFlag: boolean;
  startNodeId: number;
  startNodeIsIntersection: boolean;
  endNodeId: number;
  endNodeIsIntersection: boolean;
  normalizedBearing: number;

  // Street attributes (maxspeed is READ-ONLY)
  street: {
    name: string | null;
    highway: string | null;
    maxspeed: number | null;
    oneway: string | null;
    lanes: number | null;
    laneWidth: number | null;
    surface: string | null;
    incline: number | null;
    geometry: LineString;
    features: StreetFeatureSet | null;
  };

  // Sidewalks (null = no sidewalk on that side)
  sidewalkLeft: SidewalkData | null;
  sidewalkRight: SidewalkData | null;

  // Crosswalks
  crosswalkStart: CrosswalkData | null;
  crosswalkEnd: CrosswalkData | null;

  // Bikeways (up to 2 per side)
  bikewayLeft1: BikewayData | null;
  bikewayLeft2: BikewayData | null;
  bikewayRight1: BikewayData | null;
  bikewayRight2: BikewayData | null;

  // Node geometries
  startNodeGeometry: Point | null;
  endNodeGeometry: Point | null;
  curbReturnGeometry: Geometry | null;

  // Read-only metadata (public_data_id_* columns)
  publicDataIds: Record<string, string | null>;
}

// --- Segment edits ---

export type FacilityType =
  | 'street'
  | 'sidewalk_left'
  | 'sidewalk_right'
  | 'crosswalk_start'
  | 'crosswalk_end'
  | 'bikeway_left_1'
  | 'bikeway_left_2'
  | 'bikeway_right_1'
  | 'bikeway_right_2'
  | 'curb_ramp';

export interface SegmentEdit {
  id?: string;
  tripId: string;
  userId: string;
  streetGridId: string;
  facilityType: FacilityType;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  createdAt?: string;
}

// --- Geometry edits (topology-altering operations) ---

export type GeometryEditType =
  | 'move_endpoint'
  | 'add_node'
  | 'toggle_curb_ramp'
  | 'split_segment'
  | 'merge_segments'
  | 'draw_crosswalk'
  | 'draw_segment';

export interface MoveEndpointPayload {
  nodeId: number;
  oldCoord: [number, number];
  newCoord: [number, number];
  rubberBandSegments: string[];
}

export interface AddNodePayload {
  coord: [number, number];
}

export interface ToggleRampPayload {
  streetGridId: string;
  side: 'left' | 'right';
  position: 'start' | 'end';
  slotNumber: 1 | 2 | 3;
  enabled: boolean;
  coord?: [number, number];
}

export interface SplitSegmentPayload {
  streetGridId: string;
  splitPoint: [number, number];
}

export interface MergeSegmentsPayload {
  segmentIds: [string, string];
}

export interface DrawCrosswalkPayload {
  fromRampId: string;
  toRampId: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export interface DrawSegmentPayload {
  facilityType: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  attributes: Record<string, string>;
}

export interface AddNodeMobilePayload {
  subtype: 'ramp' | 'calm';
  coord: [number, number];
  attributes: Record<string, string>;
}

export type GeometryEditPayloadData =
  | MoveEndpointPayload
  | AddNodePayload
  | AddNodeMobilePayload
  | ToggleRampPayload
  | SplitSegmentPayload
  | MergeSegmentsPayload
  | DrawCrosswalkPayload
  | DrawSegmentPayload;

export interface GeometryEditPayload {
  editType: GeometryEditType;
  streetGridId?: string;
  payload: GeometryEditPayloadData;
  coord: [number, number];
}

export interface GeometryEditRecord extends GeometryEditPayload {
  id: string;
  userId: string;
  tripId: string;
  status: 'pending' | 'applied' | 'rejected' | 'conflict';
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
}
