// ═══════════════════════════════════════════════════════════
// PARQUET TO NETWORK SEGMENTS PIPELINE
// ═══════════════════════════════════════════════════════════
// Reads the Proximity parquet using hyparquet with selective column
// fetching, converts WKB hex geometries to GeoJSON, transforms
// UTM coordinates to WGS84, and assembles NetworkSegment objects.
//
// The primary geometry column (street_geometry) is auto-decoded
// by hyparquet's GeoParquet support. All other geometry columns
// are stored as WKB hex strings and decoded manually.

import type { Geometry, LineString, MultiLineString, MultiPoint, Point } from 'geojson';
import type {
  BikewayData,
  CrosswalkData,
  CurbRampSlot,
  NetworkSegment,
  SegmentFeatureSet,
  SidewalkData,
  StreetFeatureSet,
} from '@/services/types/NetworkSegment';
import { wkbToGeoJSON } from './wkbToGeoJSON';
import { convertGeometryToWgs84 } from './utmToWgs84';

// --- Column lists for selective reading ---

const STREET_COLUMNS = [
  'intersetion_review_flag', // note: typo in actual parquet column name
  'street_id', 'street_grid_id',
  'start_node_id', 'start_node_is_intersection_node',
  'end_node_id', 'end_node_is_intersection_node',
  'normalized_bearing',
  'name', 'highway', 'maxspeed', 'oneway', 'lanes', 'lane_width', 'surface', 'street_incline',
];

const STREET_FEATURE_COLUMNS = [
  'street_feature_types', 'street_feature_geometry',
  'street_feature_geometry_projected', 'street_feature_attributes',
];

function sidewalkColumns(side: string): string[] {
  return [
    `sidewalk_${side}_ID`, `sidewalk_${side}_grid_ID`,
    `sidewalk_${side}_presence`, `sidewalk_${side}_surface`,
    `sidewalk_${side}_quality`, `sidewalk_${side}_width`,
    `sidewalk_${side}_incline`, `sidewalk_${side}_seperator`,
    `sidewalk_${side}_buffered`,
  ];
}

function curbRampColumns(side: string, pos: string, n: number): string[] {
  const prefix = `sidewalk_${side}_curbramp_${pos}_${n}`;
  return [
    `${prefix}_ID`, `${prefix}_returnloc`,
    `${prefix}_returnposition`, `${prefix}_condition_score`,
    `${prefix}_geometry`,
  ];
}

function sidewalkFeatureColumns(side: string): string[] {
  return [
    `sidewalk_${side}_feature_ids`, `sidewalk_${side}_feature_types`,
    `sidewalk_${side}_feature_geometry`, `sidewalk_${side}_feature_geometry_projected`,
  ];
}

function crosswalkColumns(pos: string): string[] {
  return [
    `crosswalk_${pos}_id`, `crosswalk_${pos}_grid_ids`, `crosswalk_${pos}_type`,
    `crosswalk_${pos}_controlled`, `crosswalk_${pos}_marked`,
    `crosswalk_${pos}_markings`, `crosswalk_${pos}_signals`,
    `crosswalk_${pos}_island`, `crosswalk_${pos}_kerb`,
    `crosswalk_${pos}_tactile_paving`, `crosswalk_${pos}_traffic_calming`,
    `crosswalk_${pos}_continuous`, `crosswalk_${pos}_condition`,
    `crosswalk_${pos}_geometry`, `crosswalk_${pos}_island_geometry`,
  ];
}

function bikewayColumns(side: string, n: number): string[] {
  const cols = [
    `bikeway_${side}_${n}_id`,
    `bikeway_${side}_${n}_type`, `bikeway_${side}_${n}_surface`,
    `bikeway_${side}_${n}_quality`, `bikeway_${side}_${n}_permitted`,
    `bikeway_${side}_${n}_width`, `bikeway_${side}_${n}_incline`,
    `bikeway_${side}_${n}_seperator`, `bikeway_${side}_${n}_buffered`,
  ];
  // grid_id only exists for _1
  if (n === 1) cols.splice(1, 0, `bikeway_${side}_${n}_grid_id`);
  return cols;
}

function bikewayFeatureColumns(side: string, n: number): string[] {
  const cols = [
    `bikeway_${side}_${n}_feature_types`,
    `bikeway_${side}_${n}_feature_geometry`,
    `bikeway_${side}_${n}_feature_geometry_projected`,
  ];
  // feature_ids only exists for _1
  if (n === 1) cols.unshift(`bikeway_${side}_${n}_feature_ids`);
  return cols;
}

const GEOMETRY_COLUMNS = [
  'street_geometry', 'start_node_geometry', 'end_node_geometry',
  'sidewalk_left_geometry', 'sidewalk_right_geometry',
  'curb_return_geometry',
  'bikeway_left_1_geometry', 'bikeway_left_2_geometry',
  'bikeway_right_1_geometry', 'bikeway_right_2_geometry',
];

const PUBLIC_DATA_COLUMNS = [
  'public_data_id_street', 'public_data_id_start_end_nodes',
  'public_data_id_street_feature',
  'public_data_id_sidewalk_left', 'public_data_id_sidewalk_right',
  'public_data_id_crosswalk_start', 'public_data_id_crosswalk_end',
  'public_data_id_bikeway_left_1', 'public_data_id_bikeway_left_2',
  'public_data_id_bikeway_right_1', 'public_data_id_bikeway_right_2',
  'public_data_id_sidewalk_left_feature', 'public_data_id_sidewalk_right_feature',
  'public_data_id_bikeway_left_1_features', 'public_data_id_bikeway_left_2_features',
  'public_data_id_bikeway_right_1_features', 'public_data_id_bikeway_right_2_features',
  // Curb ramp public data IDs
  ...['left', 'right'].flatMap(side =>
    ['start', 'end'].flatMap(pos =>
      [1, 2, 3].map(n => `public_data_id_sidewalk_${side}_curbramp_${pos}_${n}`)
    )
  ),
];

/** Build the full list of columns to fetch from the parquet. */
export function getAllColumns(): string[] {
  const cols = [
    ...STREET_COLUMNS,
    ...STREET_FEATURE_COLUMNS,
    ...sidewalkColumns('left'),
    ...sidewalkColumns('right'),
    ...['left', 'right'].flatMap(side =>
      ['start', 'end'].flatMap(pos =>
        [1, 2, 3].flatMap(n => curbRampColumns(side, pos, n))
      )
    ),
    ...sidewalkFeatureColumns('left'),
    ...sidewalkFeatureColumns('right'),
    ...crosswalkColumns('start'),
    ...crosswalkColumns('end'),
    ...bikewayColumns('left', 1),
    ...bikewayColumns('left', 2),
    ...bikewayColumns('right', 1),
    ...bikewayColumns('right', 2),
    ...bikewayFeatureColumns('left', 1),
    ...bikewayFeatureColumns('left', 2),
    ...bikewayFeatureColumns('right', 1),
    ...bikewayFeatureColumns('right', 2),
    ...GEOMETRY_COLUMNS,
    ...PUBLIC_DATA_COLUMNS,
  ];
  return [...new Set(cols)]; // deduplicate
}

/**
 * Minimal column set for on-device rendering (sidewalks, bikeways, curb ramps,
 * traffic calming, plus the street centerline used by the spatial index).
 * Skips crosswalk columns (hidden in rendering), public_data_id_* (unused at
 * runtime), street-level metadata, and other attribute columns we never display.
 *
 * Trimming from ~220 columns to ~70 keeps peak page reads / JS allocations
 * roughly 3× smaller and dropped the UI freeze on row-group load.
 */
export function getRenderColumns(): string[] {
  const cols = [
    'street_grid_id',
    'street_geometry', // required: rowToNetworkSegment returns null without it; spatial index uses it
    'street_feature_types', 'street_feature_geometry', 'street_feature_attributes', // traffic calming
    // Sidewalk lines
    ...['left', 'right'].flatMap(side => [
      `sidewalk_${side}_ID`,
      `sidewalk_${side}_geometry`,
      `sidewalk_${side}_buffered`,
      `sidewalk_${side}_presence`,
    ]),
    // Curb ramps (ID + geometry + the 3 attributes shown in the rating modal)
    ...['left', 'right'].flatMap(side =>
      ['start', 'end'].flatMap(pos =>
        [1, 2, 3].flatMap(n => [
          `sidewalk_${side}_curbramp_${pos}_${n}_ID`,
          `sidewalk_${side}_curbramp_${pos}_${n}_geometry`,
          `sidewalk_${side}_curbramp_${pos}_${n}_returnloc`,
          `sidewalk_${side}_curbramp_${pos}_${n}_returnposition`,
          `sidewalk_${side}_curbramp_${pos}_${n}_condition_score`,
        ])
      )
    ),
    // Bikeway lines
    ...['left', 'right'].flatMap(side =>
      [1, 2].flatMap(n => [
        `bikeway_${side}_${n}_id`,
        `bikeway_${side}_${n}_geometry`,
        `bikeway_${side}_${n}_buffered`,
      ])
    ),
  ];
  return [...new Set(cols)];
}

// --- Geometry helpers ---

/**
 * Heuristic: detect whether a coordinate pair is already in WGS84
 * (lon in [-180, 180], lat in [-90, 90]) vs. UTM (eastings/northings in the
 * hundreds of thousands). The current parquet stores GeoParquet WGS84 directly;
 * older builds shipped UTM that needed conversion. We keep both paths so older
 * cached parquet files still render correctly.
 */
function isLikelyWgs84(coord: unknown): boolean {
  if (!Array.isArray(coord)) return false;
  const [x, y] = coord as [unknown, unknown];
  return typeof x === 'number' && typeof y === 'number'
    && x >= -180 && x <= 180 && y >= -90 && y <= 90;
}

function firstCoord(geom: Geometry): unknown {
  switch (geom.type) {
    case 'Point': return geom.coordinates;
    case 'LineString':
    case 'MultiPoint': return geom.coordinates[0];
    case 'MultiLineString':
    case 'Polygon': return geom.coordinates[0]?.[0];
    case 'MultiPolygon': return geom.coordinates[0]?.[0]?.[0];
    default: return null;
  }
}

function maybeConvertToWgs84(geom: Geometry): Geometry {
  return isLikelyWgs84(firstCoord(geom)) ? geom : convertGeometryToWgs84(geom);
}

/**
 * Decode a geometry value from the parquet. Newer parquet builds store
 * geometries as already-decoded GeoJSON objects (in WGS84); older builds
 * stored WKB hex strings (in UTM). Accept all three forms and skip the UTM
 * conversion when coordinates are already in WGS84 range.
 */
function decodeGeom(input: string | Uint8Array | Geometry | null | undefined): Geometry | null {
  if (input == null) return null;
  // GeoJSON object passthrough — hyparquet decodes BYTE_ARRAY geometry columns
  // directly when the parquet is written with the GeoParquet metadata.
  if (typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)) {
    const g = input as Geometry;
    if (g.type) return maybeConvertToWgs84(g);
  }
  const geom = wkbToGeoJSON(input as string | Uint8Array);
  if (!geom) return null;
  return maybeConvertToWgs84(geom);
}

/** Convert hyparquet's auto-decoded GeoParquet geometry to WGS84 if necessary. */
function convertAutoDecodedGeom(geom: Geometry | null | undefined): Geometry | null {
  if (!geom) return null;
  return maybeConvertToWgs84(geom);
}

function asLineString(geom: Geometry | null): LineString | null {
  if (!geom) return null;
  if (geom.type === 'LineString') return geom as LineString;
  return null;
}

function asLineOrMultiLine(geom: Geometry | null): LineString | MultiLineString | null {
  if (!geom) return null;
  if (geom.type === 'LineString' || geom.type === 'MultiLineString') return geom as LineString | MultiLineString;
  return null;
}

function asPoint(geom: Geometry | null): Point | null {
  if (!geom) return null;
  if (geom.type === 'Point') return geom as Point;
  return null;
}

function asMultiPoint(geom: Geometry | null): MultiPoint | null {
  if (!geom) return null;
  if (geom.type === 'MultiPoint') return geom as MultiPoint;
  return null;
}

/** Parse a stringified list like "['a','b']" or "a,b" into string array. */
function parseStringList(val: string | null | undefined): string[] | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val.replace(/'/g, '"'));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall back to comma-split
  }
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

/** Parse stringified list of dicts. */
function parseAttributesList(val: string | null | undefined): Record<string, unknown>[] | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val.replace(/'/g, '"'));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Unparseable
  }
  return null;
}

// --- Row to NetworkSegment ---

function buildCurbRamps(row: Record<string, unknown>, side: string): CurbRampSlot[] {
  const ramps: CurbRampSlot[] = [];
  for (const pos of ['start', 'end'] as const) {
    for (const n of [1, 2, 3] as const) {
      const prefix = `sidewalk_${side}_curbramp_${pos}_${n}`;
      const id = row[`${prefix}_ID`] as string | null;
      const geomHex = row[`${prefix}_geometry`] as string | null;
      // Only add slot if it has an ID or geometry
      if (id || geomHex) {
        ramps.push({
          id,
          position: pos,
          slotNumber: n,
          returnloc: (row[`${prefix}_returnloc`] as string) ?? null,
          returnposition: (row[`${prefix}_returnposition`] as string) ?? null,
          conditionScore: (row[`${prefix}_condition_score`] as number) ?? null,
          geometry: asPoint(decodeGeom(geomHex)),
        });
      }
    }
  }
  return ramps;
}

function buildSidewalk(row: Record<string, unknown>, side: string, geom: Geometry | null): SidewalkData | null {
  const id = row[`sidewalk_${side}_ID`] as string | null;
  if (!id) return null;

  return {
    id,
    gridId: (row[`sidewalk_${side}_grid_ID`] as string) ?? id,
    presence: (row[`sidewalk_${side}_presence`] as string) ?? null,
    surface: (row[`sidewalk_${side}_surface`] as string) ?? null,
    quality: (row[`sidewalk_${side}_quality`] as string) ?? null,
    width: (row[`sidewalk_${side}_width`] as number) ?? null,
    incline: (row[`sidewalk_${side}_incline`] as number) ?? null,
    seperator: (row[`sidewalk_${side}_seperator`] as string) ?? null,
    buffered: (row[`sidewalk_${side}_buffered`] as string) ?? 'no',
    geometry: asLineOrMultiLine(geom),
    curbRamps: buildCurbRamps(row, side),
    features: buildSegmentFeatures(row, `sidewalk_${side}`),
  };
}

function buildCrosswalk(row: Record<string, unknown>, pos: string): CrosswalkData | null {
  const id = row[`crosswalk_${pos}_id`] as string | null;
  const geomHex = row[`crosswalk_${pos}_geometry`] as string | null;
  if (!id && !geomHex) return null;

  return {
    id,
    gridIds: (row[`crosswalk_${pos}_grid_ids`] as string) ?? null,
    type: (row[`crosswalk_${pos}_type`] as string) ?? null,
    controlled: (row[`crosswalk_${pos}_controlled`] as string) ?? null,
    marked: (row[`crosswalk_${pos}_marked`] as string) ?? null,
    markings: (row[`crosswalk_${pos}_markings`] as string) ?? null,
    signals: (row[`crosswalk_${pos}_signals`] as string) ?? null,
    island: (row[`crosswalk_${pos}_island`] as string) ?? null,
    kerb: (row[`crosswalk_${pos}_kerb`] as string) ?? null,
    tactilePaving: (row[`crosswalk_${pos}_tactile_paving`] as string) ?? null,
    trafficCalming: (row[`crosswalk_${pos}_traffic_calming`] as string) ?? null,
    continuous: (row[`crosswalk_${pos}_continuous`] as string) ?? null,
    condition: (row[`crosswalk_${pos}_condition`] as string) ?? null,
    geometry: asLineString(decodeGeom(geomHex)),
    islandGeometry: asMultiPoint(decodeGeom(row[`crosswalk_${pos}_island_geometry`] as string | null)),
  };
}

function buildBikeway(row: Record<string, unknown>, side: string, n: number, geom: Geometry | null): BikewayData | null {
  const id = row[`bikeway_${side}_${n}_id`] as string | null;
  if (!id) return null;

  return {
    id,
    gridId: n === 1 ? (row[`bikeway_${side}_${n}_grid_id`] as string) ?? null : null,
    type: (row[`bikeway_${side}_${n}_type`] as string) ?? null,
    surface: (row[`bikeway_${side}_${n}_surface`] as string) ?? null,
    quality: (row[`bikeway_${side}_${n}_quality`] as string) ?? null,
    permitted: (row[`bikeway_${side}_${n}_permitted`] as string) ?? null,
    width: (row[`bikeway_${side}_${n}_width`] as number) ?? null,
    incline: (row[`bikeway_${side}_${n}_incline`] as number) ?? null,
    seperator: (row[`bikeway_${side}_${n}_seperator`] as string) ?? null,
    buffered: (row[`bikeway_${side}_${n}_buffered`] as string) ?? 'no',
    geometry: asLineOrMultiLine(geom),
    features: buildSegmentFeatures(row, `bikeway_${side}_${n}`, n === 1),
  };
}

function buildStreetFeatures(row: Record<string, unknown>): StreetFeatureSet | null {
  const types = parseStringList(row.street_feature_types as string | null);
  const geomHex = row.street_feature_geometry as string | null;
  if (!types && !geomHex) return null;

  return {
    types,
    geometry: asMultiPoint(decodeGeom(geomHex)),
    geometryProjected: asMultiPoint(decodeGeom(row.street_feature_geometry_projected as string | null)),
    attributes: parseAttributesList(row.street_feature_attributes as string | null),
  };
}

function buildSegmentFeatures(row: Record<string, unknown>, prefix: string, hasIds: boolean = true): SegmentFeatureSet | null {
  const types = parseStringList(row[`${prefix}_feature_types`] as string | null);
  const geomHex = row[`${prefix}_feature_geometry`] as string | null;
  if (!types && !geomHex) return null;

  return {
    ids: hasIds ? parseStringList(row[`${prefix}_feature_ids`] as string | null) : null,
    types,
    geometry: asMultiPoint(decodeGeom(geomHex)),
    geometryProjected: asMultiPoint(decodeGeom(row[`${prefix}_feature_geometry_projected`] as string | null)),
  };
}

function collectPublicDataIds(row: Record<string, unknown>): Record<string, string | null> {
  const ids: Record<string, string | null> = {};
  for (const col of PUBLIC_DATA_COLUMNS) {
    const val = row[col];
    if (val !== undefined) {
      ids[col] = (val as string) ?? null;
    }
  }
  return ids;
}

/**
 * Convert a raw hyparquet row object into a NetworkSegment.
 * street_geometry is auto-decoded by hyparquet (GeoParquet native).
 * All other geometries are WKB hex strings requiring manual decode.
 * All geometries are converted from UTM Zone 10N to WGS84.
 */
export function rowToNetworkSegment(row: Record<string, unknown>): NetworkSegment | null {
  // street_geometry is auto-decoded by hyparquet into GeoJSON (UTM coords)
  const streetGeomRaw = row.street_geometry as Geometry | null;
  const streetGeom = convertAutoDecodedGeom(streetGeomRaw);
  if (!streetGeom || streetGeom.type !== 'LineString') {
    return null; // skip rows without a valid street geometry
  }

  return {
    streetId: String(row.street_id ?? ''),
    streetGridId: String(row.street_grid_id ?? ''),
    intersectionReviewFlag: Boolean(row.intersetion_review_flag), // typo in parquet
    startNodeId: Number(row.start_node_id ?? 0),
    startNodeIsIntersection: Boolean(row.start_node_is_intersection_node),
    endNodeId: Number(row.end_node_id ?? 0),
    endNodeIsIntersection: Boolean(row.end_node_is_intersection_node),
    normalizedBearing: Number(row.normalized_bearing ?? 0),

    street: {
      name: (row.name as string) ?? null,
      highway: (row.highway as string) ?? null,
      maxspeed: (row.maxspeed as number) ?? null,
      oneway: (row.oneway as string) ?? null,
      lanes: (row.lanes as number) ?? null,
      laneWidth: (row.lane_width as number) ?? null,
      surface: (row.surface as string) ?? null,
      incline: (row.street_incline as number) ?? null,
      geometry: streetGeom as LineString,
      features: buildStreetFeatures(row),
    },

    sidewalkLeft: buildSidewalk(row, 'left', decodeGeom(row.sidewalk_left_geometry as string | null)),
    sidewalkRight: buildSidewalk(row, 'right', decodeGeom(row.sidewalk_right_geometry as string | null)),

    crosswalkStart: buildCrosswalk(row, 'start'),
    crosswalkEnd: buildCrosswalk(row, 'end'),

    bikewayLeft1: buildBikeway(row, 'left', 1, decodeGeom(row.bikeway_left_1_geometry as string | null)),
    bikewayLeft2: buildBikeway(row, 'left', 2, decodeGeom(row.bikeway_left_2_geometry as string | null)),
    bikewayRight1: buildBikeway(row, 'right', 1, decodeGeom(row.bikeway_right_1_geometry as string | null)),
    bikewayRight2: buildBikeway(row, 'right', 2, decodeGeom(row.bikeway_right_2_geometry as string | null)),

    startNodeGeometry: asPoint(decodeGeom(row.start_node_geometry as string | null)),
    endNodeGeometry: asPoint(decodeGeom(row.end_node_geometry as string | null)),
    curbReturnGeometry: decodeGeom(row.curb_return_geometry as string | null),

    publicDataIds: collectPublicDataIds(row),
  };
}
