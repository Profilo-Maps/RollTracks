# Proximity Model Integration Design

## Summary

Integrate the Proximity graph network parquet into RollTracks so that DataRanger mode displays street, sidewalk, bikeway, crosswalk, and curb ramp data on the map during active trips, and allows users to edit segment attributes in real time as they move.

The parquet is uploaded to both Supabase Storage (for device download) and a Supabase table (for future server-side pathfinding). On-device, `hyparquet` selectively reads columns, converts WKB hex to GeoJSON, and produces a unified `NetworkSegment` array cached as JSON. A LineString-aware spatial grid enables efficient per-GPS-update proximity queries.

**Note on spelling**: The schema consistently uses `seperator` (a misspelling of "separator"). This is preserved intentionally throughout the codebase to match parquet column names. Do not "fix" this spelling.

Sidewalks.json is deprecated and replaced by the proximity model.

## References

- `specs/ProximitySchema.md` — authoritative column definitions
- `specs/RollTracks Architecture.md` — system architecture
- `.kiro/specs/osm-network-parquet-generator/design.md` — parquet generation pipeline

## Data Model

### NetworkSegment

Each parquet row maps 1:1 to a `NetworkSegment` object — the atomic unit for spatial indexing, display, and editing.

```typescript
interface NetworkSegment {
  // Street identity
  streetId: string;                     // osmid (stringified)
  streetGridId: string;                 // "12_34_0" — spatial + sequence key
  intersectionReviewFlag: boolean;
  startNodeId: number;
  startNodeIsIntersection: boolean;
  endNodeId: number;
  endNodeIsIntersection: boolean;
  normalizedBearing: number;

  // Street attributes (maxspeed is read-only per editability rule)
  street: {
    name: string | null;
    highway: string | null;
    maxspeed: number | null;             // READ-ONLY
    oneway: string | null;
    lanes: number | null;
    laneWidth: number | null;
    surface: string | null;
    incline: number | null;
    geometry: GeoJSON.LineString;
    features: StreetFeatureSet | null;   // no ids column in schema for street features
  };

  // Sidewalks (nullable = no sidewalk on that side)
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
  startNodeGeometry: GeoJSON.Point | null;
  endNodeGeometry: GeoJSON.Point | null;
  curbReturnGeometry: GeoJSON.Geometry | null;

  // Read-only metadata (public_data_id_* columns)
  publicDataIds: Record<string, string | null>;
}
```

### SidewalkData

```typescript
interface SidewalkData {
  id: string;                           // streetGridId + "L" or "R"
  gridId: string;                       // same as id (schema defines both columns)
  presence: string | null;
  surface: string | null;
  quality: string | null;
  width: number | null;
  incline: number | null;
  seperator: string | null;             // intentional spelling — matches parquet column
  buffered: string;                     // "yes" | "no"
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  curbRamps: CurbRampSlot[];            // up to 6 per side (start/end x 3)
  features: SegmentFeatureSet | null;
}
```

### CurbRampSlot

```typescript
interface CurbRampSlot {
  id: string | null;
  position: 'start' | 'end';
  slotNumber: 1 | 2 | 3;
  returnloc: string | null;            // NW, N, NE, E, SE, S, SW, W
  returnposition: string | null;        // Left, Center, Right
  conditionScore: number | null;
  geometry: GeoJSON.Point | null;
}
```

### CrosswalkData

```typescript
interface CrosswalkData {
  id: string | null;
  gridIds: string | null;
  type: string | null;
  controlled: string | null;
  marked: string | null;
  markings: string | null;
  signals: string | null;              // stringified list of signal attributes
  island: string | null;               // "yes" | "no"
  kerb: string | null;
  tactilePaving: string | null;
  trafficCalming: string | null;
  continuous: string | null;
  condition: string | null;
  geometry: GeoJSON.LineString | null;
  islandGeometry: GeoJSON.MultiPoint | null;
}
```

### BikewayData

```typescript
interface BikewayData {
  id: string | null;
  gridId: string | null;                // schema defines grid_id for bikeway_*_1 (also used for *_2)
  type: string | null;
  surface: string | null;
  quality: string | null;
  permitted: string | null;
  width: number | null;
  incline: number | null;
  seperator: string | null;             // intentional spelling — matches parquet column
  buffered: string;                     // "yes" | "no"
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  features: SegmentFeatureSet | null;   // note: bikeway_*_2 has no feature_ids column
}
```

### StreetFeatureSet

Street features have `attributes` but no `ids` column in the schema.

```typescript
interface StreetFeatureSet {
  types: string[] | null;
  geometry: GeoJSON.MultiPoint | null;
  geometryProjected: GeoJSON.MultiPoint | null;
  attributes: Record<string, unknown>[] | null;
}
```

### SegmentFeatureSet

Used for sidewalk and bikeway features. Has `ids` but no `attributes`.
Note: `bikeway_*_2` features have no `ids` column in the schema — `ids` is null for those.

```typescript
interface SegmentFeatureSet {
  ids: string[] | null;                 // null for bikeway_*_2 features
  types: string[] | null;
  geometry: GeoJSON.MultiPoint | null;
  geometryProjected: GeoJSON.MultiPoint | null;
}
```

### Editability Rule

Per ProximitySchema.md: "if a value is empty it is considered missing and should be available for public input. Exceptions are public_data_id columns, maxspeed, and geometry columns."

All non-exception attributes with null values are editable. Attributes with existing values are also editable (user corrections). `public_data_id_*` columns, `maxspeed`, and geometry columns are read-only.

## Data Pipeline

### Trigger

DataRanger mode toggled ON in profile screen. A confirmation alert warns the user:

> "DataRanger mode will download street network data for your area. This requires approximately 80 MB of local storage and an initial download of ~42 MB. Proceed?"

Toggle only completes after user confirms. Cancel keeps the switch OFF.

### Pipeline Flow

```
1. Supabase Storage → download parquet to device temp file
2. hyparquet reads selective columns (all NetworkSegment-mapped columns)
3. Per row: WKB hex strings → GeoJSON via wkbToGeoJSON() utility
4. Per row: flat parquet columns → nested NetworkSegment object
5. Full array → JSON.stringify → write to document dir as proximity_network.json
6. Load cached JSON → build SegmentSpatialGrid → ready for queries
```

### Column Selection

hyparquet reads only columns that map to NetworkSegment fields:

- Street: `intersection_review_flag`, `street_id`, `street_grid_id`, `start_node_id`, `start_node_is_intersection_node`, `end_node_id`, `end_node_is_intersection_node`, `normalized_bearing`, `name`, `highway`, `maxspeed`, `oneway`, `lanes`, `lane_width`, `surface`, `street_incline`
- Street features: `street_feature_types`, `street_feature_geometry`, `street_feature_geometry_projected`, `street_feature_attributes`
- Sidewalks (L/R): `sidewalk_{side}_ID`, `sidewalk_{side}_presence`, `sidewalk_{side}_surface`, `sidewalk_{side}_quality`, `sidewalk_{side}_width`, `sidewalk_{side}_incline`, `sidewalk_{side}_seperator`, `sidewalk_{side}_buffered`
- Curb ramps (L/R, start/end, 1-3): `sidewalk_{side}_curbramp_{pos}_{n}_ID`, `..._returnloc`, `..._returnposition`, `..._condition_score`, `..._geometry`
- Sidewalk features (L/R): `sidewalk_{side}_feature_ids`, `sidewalk_{side}_feature_types`, `sidewalk_{side}_feature_geometry`, `sidewalk_{side}_feature_geometry_projected`
- Crosswalks (start/end): `crosswalk_{pos}_id`, `crosswalk_{pos}_grid_ids`, `crosswalk_{pos}_type`, `crosswalk_{pos}_controlled`, `crosswalk_{pos}_marked`, `crosswalk_{pos}_markings`, `crosswalk_{pos}_signals`, `crosswalk_{pos}_island`, `crosswalk_{pos}_kerb`, `crosswalk_{pos}_tactile_paving`, `crosswalk_{pos}_traffic_calming`, `crosswalk_{pos}_continuous`, `crosswalk_{pos}_condition`, `crosswalk_{pos}_geometry`, `crosswalk_{pos}_island_geometry`
- Bikeways (L/R, 1/2): `bikeway_{side}_{n}_id`, `..._type`, `..._surface`, `..._quality`, `..._permitted`, `..._width`, `..._incline`, `..._seperator`, `..._buffered`
- Bikeway features (L/R, 1/2): `bikeway_{side}_{n}_feature_ids`, `..._feature_types`, `..._feature_geometry`, `..._feature_geometry_projected`
- Main geometries: `street_geometry`, `start_node_geometry`, `end_node_geometry`, `sidewalk_left_geometry`, `sidewalk_right_geometry`, `curb_return_geometry`, `bikeway_left_1_geometry`, `bikeway_left_2_geometry`, `bikeway_right_1_geometry`, `bikeway_right_2_geometry`
- All `public_data_id_*` columns (stored as read-only metadata)

### WKB Hex to GeoJSON Conversion

A utility function `wkbToGeoJSON(hexString: string): GeoJSON.Geometry | null` decodes WKB hex strings. Handles Point, LineString, MultiLineString, MultiPoint. Returns null for null/empty inputs.

Implementation uses a lightweight WKB parser (no external dependency heavier than needed). WKB hex format: each byte is 2 hex chars, starts with byte order indicator, then geometry type int, then coordinates.

### GeoParquet Active Geometry Column

`street_geometry` is the GeoParquet active geometry column (not a WKB hex string like the other geometry columns). GeoParquet stores the active geometry in a special binary encoding defined by the GeoParquet spec, with metadata in the parquet footer.

**Handling strategy**: Check whether `hyparquet` natively supports GeoParquet metadata and auto-decodes the active geometry column. If it does, `street_geometry` will be read as a geometry object that needs conversion to GeoJSON. If `hyparquet` does not support GeoParquet:
- Option A: Use the `@geoparquet/core` or similar library to read the geometry column metadata and decode manually
- Option B: Pre-convert the parquet so `street_geometry` is stored as WKB hex like the other columns (modification to the Python generator pipeline)

**This is the highest technical risk in the pipeline** and should be prototyped before full implementation. If neither option works cleanly, Option B (modifying the generator) is the most reliable fallback since all other geometry columns already use WKB hex.

### Caching

- `proximity_network.json` — full NetworkSegment array, written to `expo-file-system` document directory via `File` API (same pattern as existing `dataranger_curb_ramps.json`)
- `@proximity/version` — AsyncStorage key tracking download timestamp
- On app launch with DataRanger on: load from cache, background-check `asset_metadata` for updates
- DataRanger toggled OFF: in-memory data released, cache files retained (avoids re-download)
- Cache cleared explicitly only on user request (delete account) or forced update

**Size concern**: The cached JSON will be larger than the parquet (~60-100MB) due to GeoJSON verbosity. If this causes memory pressure on mobile devices during `JSON.parse()`, a future optimization would be streaming/chunked deserialization or a binary cache format (e.g., MessagePack). For the initial implementation, the single-file JSON approach matches the existing pattern and should be profiled before optimizing.

### Download Error Recovery

The parquet download (~42MB) may be interrupted by network drops. Mitigation:
- Validate the downloaded file size against `asset_metadata.file_size_bytes` before parsing
- If validation fails, delete the partial download and surface a retry prompt to the user
- The parquet file is only parsed after a complete, validated download — no partial state is cached

## Spatial Index

### SegmentSpatialGrid

Extends the existing SpatialGrid concept for LineString geometries.

**Indexing**: For each NetworkSegment, iterate all coordinates in `street.geometry`. For each coordinate, compute grid cell key. Insert segment reference into every cell it touches. A street spanning 5 cells appears in all 5.

**Cell size**: 0.001 degrees (~111m), same as existing SpatialGrid.

**Query**: Given user GPS (lat, lon) and radius:
1. Compute center cell and neighbor cells within radius
2. Collect candidate NetworkSegments from those cells (deduplicate by streetGridId)
3. Filter by point-to-LineString distance: for each segment, compute minimum distance from user point to the street geometry
4. Sort by distance, limit results

**Point-to-LineString distance**: For each consecutive pair of coordinates in the LineString, compute perpendicular distance from the query point to that line segment. Return the minimum across all pairs. This handles long and curved streets accurately.

**Performance characteristics**:
- Index build: O(n * avg_coords_per_street) — one-time on load
- Query: O(cells_searched * avg_segments_per_cell) — ~9 cells for 50m radius
- One query per GPS update (~1/sec), returns full NetworkSegments with all children

## DataRanger Service Changes

### New State

```typescript
class DataRangerServiceClass {
  // Existing curb ramp state (preserved during migration)
  private features: InternalFeature[] = [];
  private spatialIndex: SpatialGrid | null = null;

  // New proximity state
  private segments: NetworkSegment[] = [];
  private segmentIndex: SegmentSpatialGrid | null = null;
  private segmentMap: Map<string, NetworkSegment> = new Map(); // streetGridId → segment
  private isProximityInitialized: boolean = false;

  // ... existing state unchanged
}
```

### New Methods

- `initializeProximity(checkForUpdates?: boolean): Promise<void>` — download/cache/load proximity network. Called when DataRanger mode is on and app launches or mode is toggled on.
- `queryNearbySegments(lat: number, lon: number, radiusM?: number): NetworkSegment[]` — returns segments near user position. Default radius 50m.
- `getSegmentById(streetGridId: string): NetworkSegment | null` — direct lookup for editing UI.
- `submitSegmentEdit(edit: SegmentEdit): Promise<void>` — writes edit to Supabase `segment_edits` table via DatabaseAdapter.

### Curb Ramp Migration

Curb ramps are now embedded in `SidewalkData.curbRamps[]`. The existing `queryNearbyFeatures()` method is preserved as a wrapper: it calls `queryNearbySegments()`, extracts all curb ramps from returned segments, and converts them to the existing `Feature` format. This maintains backward compatibility with `DataRangerCallout` until the segment editing callout is built.

The standalone CurbRamps.json download path is removed. The `dataranger_curb_ramps.json` cache file is no longer created.

### Edit Flow

```typescript
interface SegmentEdit {
  tripId: string;
  userId: string;
  streetGridId: string;
  facilityType: 'street' | 'sidewalk_left' | 'sidewalk_right'
    | 'crosswalk_start' | 'crosswalk_end'
    | 'bikeway_left_1' | 'bikeway_left_2'
    | 'bikeway_right_1' | 'bikeway_right_2';
  fieldName: string;
  oldValue: string | null;
  newValue: string;
}
```

On edit submission:
1. Validate the edit (field exists for facility type, value is valid)
2. Write to `segment_edits` Supabase table via DatabaseAdapter
3. Update the in-memory NetworkSegment so the map reflects the change immediately
4. Invalidate query cache

## DatabaseAdapter Changes

### DataService Additions

```typescript
interface IDataService {
  // ... existing methods ...

  /** Write a segment attribute edit */
  writeSegmentEdit(edit: SegmentEdit): Promise<void>;

  /** Get edits for a specific trip */
  getSegmentEditsForTrip(tripId: string): Promise<SegmentEdit[]>;

  /** Get all edits by the current user */
  getUserSegmentEdits(): Promise<SegmentEdit[]>;

  /** Download proximity network parquet from storage */
  downloadProximityAsset(): Promise<ArrayBuffer>;
}
```

### Supabase Implementation

`writeSegmentEdit` inserts into `segment_edits` table.

`downloadProximityAsset` downloads from `dataranger-assets` bucket. Supabase `storage.download()` returns a `Blob`. In React Native, convert to `ArrayBuffer` via `new Response(blob).arrayBuffer()` or `FileReader`. Returns raw `ArrayBuffer` for hyparquet to parse.

`checkAssetUpdates` type union extended from `'CurbRamps' | 'Sidewalks'` to `'CurbRamps' | 'Sidewalks' | 'ProximityNetwork'`.

## Supabase Changes

### Storage

Upload `San_Francisco_County_California_USA_network.parquet` to `dataranger-assets` bucket.

### New Migration: segment_edits Table

```sql
create table segment_edits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  trip_id text not null,
  street_grid_id text not null,
  facility_type text not null,
  field_name text not null,
  old_value text,
  new_value text not null,
  created_at timestamptz default now(),
  constraint valid_facility check (facility_type in (
    'street', 'sidewalk_left', 'sidewalk_right',
    'crosswalk_start', 'crosswalk_end',
    'bikeway_left_1', 'bikeway_left_2',
    'bikeway_right_1', 'bikeway_right_2'
  ))
);

-- RLS
alter table segment_edits enable row level security;

create policy "Users can insert own edits"
  on segment_edits for insert
  with check (auth.uid() = user_id);

create policy "Users can read all edits"
  on segment_edits for select
  using (true);

create policy "Users can delete own edits"
  on segment_edits for delete
  using (auth.uid() = user_id);

-- Indexes for common query patterns
create index idx_segment_edits_street_grid_id on segment_edits (street_grid_id);
create index idx_segment_edits_trip_id on segment_edits (trip_id);
create index idx_segment_edits_user_id on segment_edits (user_id);
```

### asset_metadata Update

Insert row for `ProximityNetwork` asset type so version checking works:

```sql
insert into asset_metadata (asset_name, last_updated, description)
values ('ProximityNetwork', '2026-03-17T00:00:00Z', 'Proximity graph network parquet for street/sidewalk/bikeway data')
on conflict (asset_name) do nothing;
```

### Placeholder: proximity_network Table

Create the PostGIS table structure for future server-side pathfinding. Not populated in this iteration.

```sql
create table proximity_network (
  street_grid_id text primary key,
  street_id text not null,
  data jsonb not null,
  street_geometry geography(Geometry, 4326)  -- Geometry to allow future MultiLineString
);

alter table proximity_network enable row level security;

create policy "Public read access to proximity network"
  on proximity_network for select
  using (true);

create index idx_proximity_network_geometry
  on proximity_network using gist (street_geometry);
```

## Map Display

During active trips with DataRanger on, `queryNearbySegments()` returns NetworkSegments. The active trip screen splits them into map layers:

| Layer | Source | Rendering | Color Logic |
|-------|--------|-----------|-------------|
| Street centerlines | `segment.street.geometry` | Polyline, thin, muted | Gray base |
| Sidewalk left | `segment.sidewalkLeft.geometry` | Polyline | Green=complete, Yellow=partial, Red=needs_survey |
| Sidewalk right | `segment.sidewalkRight.geometry` | Polyline | Same as left |
| Bikeway lines | `segment.bikeway*.geometry` | Polyline, distinct color | Blue tones |
| Crosswalks | `segment.crosswalk*.geometry` | Polyline, dashed | Orange |
| Curb ramps | Extracted from sidewalk curbRamps | Point markers | Existing rating color scheme |

All layers are tappable. Tap target determines which facility's callout opens.

## Segment Edit Callout

Extends `DataRangerCallout` with a segment editing mode:

**On tap of a line segment**:
- Determine closest facility (street vs sidewalk_left vs bikeway_right_1 etc.) based on tap proximity to each rendered geometry
- Show callout with:
  - Segment identity: street name, grid ID, facility type
  - All editable attributes as form fields
  - Null/missing values highlighted as "needs input"
  - Submit button

**Field input types**:
- Dropdowns: `surface`, `quality`, `type`, `controlled`, `marked`, `markings`, `kerb`, `presence`, `highway`, `trafficCalming`
- Numeric: `width`, `incline`, `lanes`, `laneWidth`
- Toggle: `oneway`, `island`, `tactilePaving`, `buffered`, `continuous`
- Composite: `signals` — parsed into individual sub-fields (yes/no, button yes/no, sound yes/no, vibration yes/no, flashing_lights yes/button/sensor) presented as separate toggles/dropdowns in the UI

**Read-only fields** (per editability rule): `maxspeed`, all `public_data_id_*` columns, all geometry columns.

**Curb ramp taps**: Condition score edits flow through the existing `rateFeature` path (rating slider 1-10). Other curb ramp attributes (`returnloc`, `returnposition`) are editable via the `submitSegmentEdit` path — the `SegmentEdit.facilityType` is set to the parent sidewalk (e.g., `sidewalk_left`) and `fieldName` uses the full slot path (e.g., `curbramp_start_1_returnloc`).

## Profile Screen Changes

The DataRanger toggle handler is modified to show a storage warning before enabling:

```typescript
const handleToggleDataRanger = async () => {
  if (!user?.dataRangerMode) {
    // Enabling — show warning
    Alert.alert(
      'Enable DataRanger Mode',
      'DataRanger mode will download street network data for your area. ' +
      'This requires approximately 80 MB of local storage and an initial ' +
      'download of ~42 MB.\n\nProceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              await toggleDataRangerMode();
            } catch (error) {
              Alert.alert('Error', 'Failed to enable DataRanger mode.');
            }
          },
        },
      ],
    );
  } else {
    // Disabling — no warning needed
    await toggleDataRangerMode();
  }
};
```

## Dependencies

### New npm packages

- `hyparquet` — parquet file reader for JavaScript (selective column reading, no native dependencies)
- No WKB library needed — custom lightweight parser for WKB hex (Point, LineString, MultiLineString, MultiPoint only)

### Files Modified

- `services/DataRangerService.ts` — add proximity loading, segment querying, edit submission
- `adapters/DatabaseAdapter.ts` — add segment edit CRUD, proximity asset download
- `app/(auth)/profile.tsx` — storage warning on DataRanger toggle
- `components/MapViewComponent.tsx` — accept and render segment layers
- `components/DataRangerCallout.tsx` — extend for segment attribute editing
- `app/(main)/active-trip.tsx` — pass segments to map, handle segment taps

### Files Created

- `services/types/NetworkSegment.ts` — TypeScript interfaces
- `services/utils/wkbToGeoJSON.ts` — WKB hex decoder
- `services/utils/SegmentSpatialGrid.ts` — LineString-aware spatial grid
- `services/utils/parquetToSegments.ts` — hyparquet column reading + row transformation

### Supabase Migrations

- `{timestamp}_create_segment_edits.sql`
- `{timestamp}_create_proximity_network_placeholder.sql`
- `{timestamp}_add_proximity_asset_metadata.sql`

### Assets

- Upload `San_Francisco_County_California_USA_network.parquet` to Supabase `dataranger-assets` storage bucket
- Do NOT bundle the 42MB parquet in `assets/data/` — it would inflate the app binary. The parquet is downloaded on-demand when DataRanger mode is enabled.
- Remove `assets/data/Sidewalks.json` (deprecated)
