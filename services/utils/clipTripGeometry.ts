// ═══════════════════════════════════════════════════════════
// CLIP TRIP GEOMETRY
// ═══════════════════════════════════════════════════════════
// Client-side anonymization: removes the portions of a trip route that fall
// inside the origin and destination census blocks, hiding exact start/end
// locations before the geometry is uploaded to Supabase.
//
// Coordinates throughout are [longitude, latitude] (GeoJSON order).

/**
 * Ray-casting point-in-polygon test.
 * Returns true if [lon, lat] is inside the given GeoJSON Polygon.
 * Works on the outer ring only (holes are ignored — census blocks have none).
 */
export function pointInPolygon(point: [number, number], polygon: GeoJSON.Polygon): boolean {
  const [px, py] = point;
  const ring = polygon.coordinates[0]; // outer ring
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];

    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export interface ClipResult {
  /** Clipped coordinates in [lon, lat] order. Empty if fewer than 2 points remain. */
  coordinates: [number, number][];
  /** Number of points trimmed from the start (inside origin block). */
  trimmedFromStart: number;
  /** Number of points trimmed from the end (inside destination block). */
  trimmedFromEnd: number;
}

/**
 * Walk inward from both ends of the route, dropping points that fall inside
 * the origin block (from the start) or the destination block (from the end).
 * Stops at the first point that is outside the respective block.
 *
 * If the remaining segment has fewer than 2 points (e.g. a very short trip
 * entirely within one block), returns an empty coordinates array — the caller
 * should treat this as an unclippable trip and upload the original geometry.
 *
 * @param coords  Full route in [lon, lat] order.
 * @param originBlock  GeoJSON Polygon of the origin census block.
 * @param destBlock    GeoJSON Polygon of the destination census block.
 */
export function clipTripToBlocks(
  coords: [number, number][],
  originBlock: GeoJSON.Polygon,
  destBlock: GeoJSON.Polygon,
): ClipResult {
  let start = 0;
  while (start < coords.length && pointInPolygon(coords[start], originBlock)) {
    start++;
  }

  let end = coords.length - 1;
  while (end >= start && pointInPolygon(coords[end], destBlock)) {
    end--;
  }

  const trimmedFromStart = start;
  const trimmedFromEnd = coords.length - 1 - end;
  const clipped = coords.slice(start, end + 1) as [number, number][];

  if (clipped.length < 2) {
    return { coordinates: [], trimmedFromStart, trimmedFromEnd };
  }

  return { coordinates: clipped, trimmedFromStart, trimmedFromEnd };
}
