# Mobile Geometry Editing Design

## Overview

Extend DataRanger mode with geometry editing tools that let field users correct network topology directly on mobile. Edits are written to Supabase as `SegmentEdit` records (attribute edits) or a new `GeometryEdit` table (topology changes), then synced back to the Proximity parquet via a server-side pipeline re-run.

## Current State

DataRanger currently supports:
- **Read:** Spatial queries via `SegmentSpatialGrid`, segment/curb-ramp display on map
- **Attribute edits:** Single-field changes via `submitSegmentEdit()` → Supabase `segment_edits` table
- **Ratings:** Curb ramp condition ratings with photo upload

Geometry editing adds topology-altering operations that require pipeline re-runs on the Proximity server.

## Proposed Edit Tools

### Tier 1 — Field-Critical (implement first)

#### 1. Move Endpoint
- **Use case:** Intersection node is misplaced; user drags it to correct GPS position
- **Interaction:** Long-press node marker → drag to new position → confirm
- **Data:** `{ type: "move_endpoint", nodeId, oldCoord: [lon,lat], newCoord: [lon,lat], rubberBandSegments: string[] }`
- **Rubber-banding:** Show connected segments stretching in real-time. Auto-select all connected segments; user can deselect via bottom sheet checkbox list.
- **Pipeline stage:** 0 (SNAP_ENDPOINTS) — triggers full re-run

#### 2. Add Intersection Node
- **Use case:** Missing intersection not detected by OSM data
- **Interaction:** Tap "Add Node" tool → tap map position → confirm
- **Data:** `{ type: "add_node", coord: [lon,lat] }`
- **Snap behavior:** Server finds nearest segment endpoint within 40m and marks it as intersection
- **Pipeline stage:** 1 (BUILD_HULLS)

#### 3. Toggle Curb Ramp
- **Use case:** Curb ramp exists but isn't in data, or is in data but doesn't exist
- **Interaction:** Tap ramp slot on map → toggle on/off in bottom sheet
- **Data:** `{ type: "toggle_curb_ramp", streetGridId, side: "left"|"right", position: "start"|"end", slotNumber: 1|2|3, enabled: boolean, coord?: [lon,lat] }`
- **Pipeline stage:** 2 (ASSIGN_RAMPS)

### Tier 2 — Advanced (implement after Tier 1)

#### 4. Split Segment
- **Use case:** Single segment should be two (e.g., road characteristics change mid-block)
- **Interaction:** Tap segment → tap split point on line → confirm
- **Data:** `{ type: "split_segment", streetGridId, splitPoint: [lon,lat] }`
- **Geo computation:** Use `@turf/nearest-point-on-line` to snap tap to segment centerline, then `@turf/line-split` to produce two halves
- **Pipeline stage:** 0 (SNAP_ENDPOINTS)

#### 5. Merge Segments
- **Use case:** Two segments should be one (false intersection between them)
- **Interaction:** Tap first segment → tap second segment → confirm merge
- **Data:** `{ type: "merge_segments", segmentIds: [string, string] }`
- **Validation:** Segments must share exactly one endpoint
- **Pipeline stage:** 0 (SNAP_ENDPOINTS)

#### 6. Draw Crosswalk
- **Use case:** Missing crosswalk between two curb ramps
- **Interaction:** Tap first ramp → tap second ramp → line preview → confirm
- **Data:** `{ type: "draw_crosswalk", fromRampId, toRampId, geometry: LineString }`
- **Pipeline stage:** 3 (CREATE_XWALKS)

### Tier 3 — Power User (consider for v2)

#### 7. Edit Hull Face
- **Use case:** Intersection hull polygon vertex is wrong
- **Interaction:** Tap hull → drag vertex → confirm
- **Not recommended for mobile v1** — hull polygons are complex and hard to manipulate on small screens

#### 8. Draw Segment
- **Use case:** Missing street segment
- **Interaction:** Multi-tap to draw polyline → confirm
- **Not recommended for mobile v1** — requires attribute entry for all 256 columns (impractical on mobile)

## Data Model

### New Supabase Table: `geometry_edits`

```sql
create table geometry_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  trip_id uuid references trips(id),
  edit_type text not null,           -- "move_endpoint", "add_node", etc.
  street_grid_id text,               -- null for add_node
  payload jsonb not null,            -- tool-specific data (see above)
  coord geometry(Point, 4326),       -- edit location (for spatial queries)
  status text default 'pending',     -- "pending", "applied", "rejected", "conflict"
  created_at timestamptz default now(),
  applied_at timestamptz,
  applied_by text                    -- server process ID or admin user
);

create index idx_geometry_edits_status on geometry_edits(status);
create index idx_geometry_edits_coord on geometry_edits using gist(coord);
```

### Edit Lifecycle

```
User submits edit on mobile
        |
        v
  Supabase `geometry_edits` (status: "pending")
        |
        v
  Server cron or manual trigger:
    1. Fetch pending edits in bbox
    2. Convert to county editor Changeset format
    3. POST to /save endpoint (same pipeline)
    4. Mark edits as "applied" with timestamp
        |
        v
  Updated parquet pushed to Supabase Storage
        |
        v
  Mobile app detects version change → re-downloads parquet
```

### Conflict Detection

If two users edit the same node/segment before the server applies either:
1. Server processes edits in `created_at` order
2. Second edit is checked against updated state
3. If the target entity moved/changed, mark as `status: "conflict"`
4. Conflicted edits surface in a review queue (admin dashboard, future work)

## UI Architecture

### Tool Activation

Add a floating action button (FAB) menu to the map screen when DataRanger mode is active:

```
[Map Screen]
  |
  +-- FAB (bottom-right, above trip controls)
       |
       +-- Move Endpoint (icon: crosshair-move)
       +-- Add Node (icon: plus-circle)
       +-- Toggle Ramp (icon: ramp-toggle)
       +-- Split Segment (icon: scissors)       [Tier 2]
       +-- Merge Segments (icon: link)          [Tier 2]
       +-- Draw Crosswalk (icon: crosswalk)     [Tier 2]
```

### Edit Confirmation Flow

All geometry edits use a consistent 3-step flow:

1. **Select** — Tool-specific target selection (tap node, tap segment, etc.)
2. **Adjust** — Optional refinement (drag endpoint, deselect rubber-band segments)
3. **Confirm** — Bottom sheet with edit summary + "Submit" / "Cancel" buttons

### Edit Preview

- Use `@rnmapbox/maps` ShapeSource + SymbolLayer/LineLayer for edit previews
- Color coding matches county editor: green (added), yellow (moved), red (deleted)
- Animate with pulsing opacity on pending edits

### Pending Edits Indicator

- Badge on FAB showing count of pending (unsynced) geometry edits
- "Pending Edits" section in trip summary screen
- Edits persist in local storage (AsyncStorage) until confirmed applied by server

## Service Layer Changes

### DataRangerService Additions

```typescript
// New methods on DataRangerService

async submitGeometryEdit(edit: GeometryEditPayload): Promise<void> {
  // Write to Supabase geometry_edits table
  // Store locally in pendingGeometryEdits for preview
  // Invalidate query cache
}

getPendingGeometryEdits(): GeometryEditPayload[] {
  // Return locally cached pending edits for map preview
}

async syncGeometryEditStatuses(): Promise<void> {
  // Check Supabase for status updates on pending edits
  // Remove applied edits from local cache
  // Surface conflicts to user
}
```

### New Types

```typescript
interface GeometryEditPayload {
  editType: GeometryEditType;
  streetGridId?: string;
  payload: MoveEndpointPayload | AddNodePayload | ToggleRampPayload
           | SplitSegmentPayload | MergeSegmentsPayload | DrawCrosswalkPayload;
  coord: [number, number];  // lon, lat
}

type GeometryEditType =
  | 'move_endpoint'
  | 'add_node'
  | 'toggle_curb_ramp'
  | 'split_segment'
  | 'merge_segments'
  | 'draw_crosswalk';

interface MoveEndpointPayload {
  nodeId: number;
  oldCoord: [number, number];
  newCoord: [number, number];
  rubberBandSegments: string[];
}

interface AddNodePayload {
  coord: [number, number];
}

interface ToggleRampPayload {
  streetGridId: string;
  side: 'left' | 'right';
  position: 'start' | 'end';
  slotNumber: 1 | 2 | 3;
  enabled: boolean;
  coord?: [number, number];
}

interface SplitSegmentPayload {
  streetGridId: string;
  splitPoint: [number, number];
}

interface MergeSegmentsPayload {
  segmentIds: [string, string];
}

interface DrawCrosswalkPayload {
  fromRampId: string;
  toRampId: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}
```

## Shared Code with County Editor (via @proximity/shared)

The following utilities are used by both platforms and should live in the shared package:

| Module | Mobile use | Web editor use |
|--------|-----------|---------------|
| `NetworkSegment` types | Parquet parsing, edit targets | Map features, attribute table |
| `SegmentSpatialGrid` | Nearby queries | Replace current flat Map index |
| `wkbToGeoJSON` | Parquet geometry decode | Already uses server-side equivalent |
| `utmToWgs84` | Coordinate conversion | Proj4 CDN (can migrate) |
| `GeometryEditType` types | Edit submission | Changeset schema alignment |

## Dependencies

New dependencies required for geometry tools:

```json
{
  "@turf/nearest-point-on-line": "^7.0.0",
  "@turf/line-split": "^7.0.0",
  "@turf/distance": "^7.0.0",
  "@turf/helpers": "^7.0.0"
}
```

These are the same Turf modules already used by the county editor (tree-shaken, ~60KB total).

## Implementation Order

1. Supabase `geometry_edits` table + RLS policies
2. `GeometryEditPayload` types in `@proximity/shared`
3. `submitGeometryEdit()` + `syncGeometryEditStatuses()` in DataRangerService
4. FAB menu component + edit confirmation bottom sheet
5. Move Endpoint tool (most complex, validates the full flow)
6. Add Node tool
7. Toggle Curb Ramp tool
8. Server-side cron to apply pending geometry edits via /save endpoint
9. Split Segment, Merge Segments, Draw Crosswalk (Tier 2)