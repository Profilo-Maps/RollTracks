// ═══════════════════════════════════════════════════════════
// WKB HEX TO GEOJSON DECODER
// ═══════════════════════════════════════════════════════════
// Lightweight decoder for Well-Known Binary (WKB) hex strings
// into GeoJSON geometry objects. Handles the geometry types
// present in the Proximity parquet schema:
//   Point, LineString, MultiPoint, MultiLineString
//
// WKB hex format: each byte = 2 hex chars.
// Layout: [byte_order(1)] [type(4)] [data...]
// Byte order: 0 = big-endian, 1 = little-endian

import type { Geometry, Point, LineString, MultiPoint, MultiLineString } from 'geojson';

// WKB geometry type codes
const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;

class WKBReader {
  private data: DataView;
  private offset: number = 0;
  private littleEndian: boolean = true;

  constructor(buffer: ArrayBuffer) {
    this.data = new DataView(buffer);
  }

  readByte(): number {
    const val = this.data.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readUint32(): number {
    const val = this.data.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return val;
  }

  readFloat64(): number {
    const val = this.data.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return val;
  }

  readCoord(): [number, number] {
    const x = this.readFloat64(); // lon
    const y = this.readFloat64(); // lat
    return [x, y];
  }

  readCoordArray(count: number): [number, number][] {
    const coords: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      coords.push(this.readCoord());
    }
    return coords;
  }

  readGeometry(): Geometry {
    const byteOrder = this.readByte();
    this.littleEndian = byteOrder === 1;

    const typeCode = this.readUint32();
    // Strip SRID flag (0x20000000) and Z/M flags if present
    const baseType = typeCode & 0xFF;

    switch (baseType) {
      case WKB_POINT:
        return this.readPoint();
      case WKB_LINESTRING:
        return this.readLineString();
      case WKB_MULTIPOINT:
        return this.readMultiPoint();
      case WKB_MULTILINESTRING:
        return this.readMultiLineString();
      default:
        throw new Error(`Unsupported WKB geometry type: ${baseType}`);
    }
  }

  private readPoint(): Point {
    const coord = this.readCoord();
    return { type: 'Point', coordinates: coord };
  }

  private readLineString(): LineString {
    const numPoints = this.readUint32();
    const coords = this.readCoordArray(numPoints);
    return { type: 'LineString', coordinates: coords };
  }

  private readMultiPoint(): MultiPoint {
    const numPoints = this.readUint32();
    const coordinates: [number, number][] = [];
    for (let i = 0; i < numPoints; i++) {
      // Each point in a multi has its own WKB header
      this.readByte(); // byte order
      this.readUint32(); // type (should be Point)
      coordinates.push(this.readCoord());
    }
    return { type: 'MultiPoint', coordinates };
  }

  private readMultiLineString(): MultiLineString {
    const numLines = this.readUint32();
    const coordinates: [number, number][][] = [];
    for (let i = 0; i < numLines; i++) {
      // Each linestring has its own WKB header
      this.readByte(); // byte order
      this.readUint32(); // type (should be LineString)
      const numPoints = this.readUint32();
      coordinates.push(this.readCoordArray(numPoints));
    }
    return { type: 'MultiLineString', coordinates };
  }
}

/**
 * Convert a hex string to an ArrayBuffer.
 */
function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Decode a WKB hex string into a GeoJSON Geometry.
 * Returns null for null, undefined, or empty inputs.
 *
 * Supports: Point, LineString, MultiPoint, MultiLineString.
 */
export function wkbToGeoJSON(hexString: string | null | undefined): Geometry | null {
  if (!hexString || hexString.length === 0) {
    return null;
  }

  try {
    const buffer = hexToBuffer(hexString);
    const reader = new WKBReader(buffer);
    return reader.readGeometry();
  } catch (error) {
    console.warn('[wkbToGeoJSON] Failed to decode WKB hex:', error);
    return null;
  }
}
