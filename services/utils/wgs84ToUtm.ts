// ═══════════════════════════════════════════════════════════
// WGS84 TO UTM ZONE 10N COORDINATE CONVERTER
// ═══════════════════════════════════════════════════════════
// Converts WGS84 (EPSG:4326) coordinates to UTM Zone 10N (EPSG:32610).
// Used for computing grid cell indices from lat/lon viewport bounds.
//
// Inverse of utmToWgs84.ts. Based on the forward Transverse Mercator
// projection formulas from Snyder, "Map Projections — A Working Manual".

// WGS84 ellipsoid constants
const a = 6378137.0;                       // semi-major axis (m)
const f = 1 / 298.257223563;               // flattening
const b = a * (1 - f);                     // semi-minor axis
const e = Math.sqrt(1 - (b * b) / (a * a)); // first eccentricity
const e2 = e * e;
const ePrime2 = e2 / (1 - e2);             // second eccentricity squared

// UTM Zone 10N constants
const k0 = 0.9996;                         // scale factor
const lon0Deg = -123;                      // central meridian (degrees)
const lon0 = lon0Deg * (Math.PI / 180);    // central meridian (radians)
const falseEasting = 500000;
const falseNorthing = 0;

/**
 * Convert a WGS84 [longitude, latitude] to UTM Zone 10N [easting, northing].
 */
export function latLonToUtm(lat: number, lon: number): [number, number] {
  const phi = lat * (Math.PI / 180);
  const lambda = lon * (Math.PI / 180);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ePrime2 * cosPhi * cosPhi;
  const A = cosPhi * (lambda - lon0);

  const M = a * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * phi)
    + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * phi)
    - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * phi)
  );

  const easting = falseEasting + k0 * N * (
    A
    + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ePrime2) * A * A * A * A * A / 120
  );

  const northing = falseNorthing + k0 * (
    M + N * tanPhi * (
      A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ePrime2) * A * A * A * A * A * A / 720
    )
  );

  return [easting, northing];
}

/**
 * Given a bounding box in WGS84 and a grid origin + cell size,
 * return the range of grid cell indices [minCol, maxCol, minRow, maxRow].
 */
export function bboxToGridCells(
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  origin: { x: number; y: number },
  cellSize: number,
): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  // Convert all 4 corners to UTM and take the envelope
  const corners = [
    latLonToUtm(bbox.minLat, bbox.minLon),
    latLonToUtm(bbox.minLat, bbox.maxLon),
    latLonToUtm(bbox.maxLat, bbox.minLon),
    latLonToUtm(bbox.maxLat, bbox.maxLon),
  ];

  const eastings = corners.map(c => c[0]);
  const northings = corners.map(c => c[1]);

  const minEasting = Math.min(...eastings);
  const maxEasting = Math.max(...eastings);
  const minNorthing = Math.min(...northings);
  const maxNorthing = Math.max(...northings);

  return {
    minCol: Math.floor((minEasting - origin.x) / cellSize),
    maxCol: Math.floor((maxEasting - origin.x) / cellSize),
    minRow: Math.floor((minNorthing - origin.y) / cellSize),
    maxRow: Math.floor((maxNorthing - origin.y) / cellSize),
  };
}

/**
 * Check if a grid ID string (e.g., "12_34_0") falls within a grid cell range.
 */
export function gridIdInRange(
  gridId: string,
  range: { minCol: number; maxCol: number; minRow: number; maxRow: number },
): boolean {
  const parts = gridId.split('_');
  if (parts.length < 2) return false;
  const col = parseInt(parts[0], 10);
  const row = parseInt(parts[1], 10);
  return col >= range.minCol && col <= range.maxCol
    && row >= range.minRow && row <= range.maxRow;
}
