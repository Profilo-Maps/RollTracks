# Design Document

## Overview

This feature adds real-time obstacle visualization to the RollTracks Active Trip Page. The system loads curb ramp data from a bundled GeoJSON file and displays nearby obstacles (within 20 meters) on the existing Leaflet map. The implementation uses efficient spatial indexing and proximity filtering to maintain performance while providing contextual information to users during their trips.

**Key Design Decisions:**
- Use GeoJSON format for obstacle data (standard, no dependencies required)
- Build a simple spatial grid index for efficient proximity queries
- Integrate obstacle markers into the existing MapView WebView/Leaflet architecture
- Bundle GeoJSON file as an Android asset using React Native's asset system
- Use Haversine formula for accurate distance calculations
- Throttle obstacle queries to once per second to match GPS update throttling

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ActiveTripScreen (React Native)             │
│  - Manages trip state                                   │
│  - Receives GPS updates from GPSService                  │
│  - Passes location to MapView                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              MapView Component (React Native)            │
│  - Wraps WebView with Leaflet HTML                      │
│  - Queries ObstacleService for nearby features          │
│  - Sends obstacle markers to WebView                    │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────┴────────┐    ┌────────┴────────────────────────┐
│  ObstacleService│    │  WebView (Leaflet.js)           │
│  - Loads GeoJSON│    │  - Renders map                  │
│  - Spatial index│    │  - Displays location marker     │
│  - Proximity    │    │  - Draws route polyline         │
│    queries      │    │  - Shows obstacle markers       │
└─────────────────┘    └─────────────────────────────────┘
```

### Component Interaction Flow

```
App Start → ObstacleService.initialize() → Load GeoJSON → Build Spatial Index
                                                                    ↓
GPS Update → MapView → ObstacleService.queryNearby(location) → Filter by 20m
                                                                    ↓
                       MapView → WebView → Display Obstacle Markers
```

## Components and Interfaces

### ObstacleService (New)

```typescript
interface ObstacleFeature {
  id: string;
  latitude: number;
  longitude: number;
  attributes: Record<string, any>; // Additional GeoJSON properties
}

interface ProximityQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

class ObstacleService {
  private features: ObstacleFeature[] = [];
  private spatialIndex: SpatialGrid | null = null;
  private isInitialized: boolean = false;
  private queryCache: Map<string, ObstacleFeature[]> = new Map();

  /**
   * Initialize the service by loading and parsing the Parquet file
   */
  async initialize(): Promise<void>;

  /**
   * Query features within a specified radius of a location
   * @param query - Location and radius for proximity search
   * @returns Array of features within the specified radius
   */
  queryNearby(query: ProximityQuery): ObstacleFeature[];

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @returns Distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number;

  /**
   * Build spatial index for efficient queries
   */
  private buildSpatialIndex(): void;

  /**
   * Clean up resources
   */
  cleanup(): void;
}
```

**Responsibilities:**
- Load GeoJSON file from bundled assets
- Parse GeoJSON data into ObstacleFeature objects
- Build and maintain spatial index for efficient queries
- Execute proximity queries with 20m radius
- Cache query results for current location
- Provide error handling for file loading and parsing

### SpatialGrid (New)

```typescript
interface GridCell {
  features: ObstacleFeature[];
}

class SpatialGrid {
  private grid: Map<string, GridCell> = new Map();
  private cellSize: number; // Size in degrees (approx 100m)

  constructor(features: ObstacleFeature[], cellSize: number = 0.001);

  /**
   * Query features near a location
   * @param lat - Latitude
   * @param lon - Longitude
   * @param radiusMeters - Search radius in meters
   * @returns Features in nearby grid cells
   */
  queryNearby(lat: number, lon: number, radiusMeters: number): ObstacleFeature[];

  /**
   * Get grid cell key for a coordinate
   */
  private getCellKey(lat: number, lon: number): string;

  /**
   * Get all cells within radius
   */
  private getNearbyCells(lat: number, lon: number, radiusMeters: number): string[];
}
```

**Responsibilities:**
- Divide geographic space into grid cells
- Index features by grid cell
- Efficiently retrieve features in nearby cells
- Handle edge cases at grid boundaries

### MapView Component (Modified)

**New Props:**
```typescript
interface MapViewProps {
  currentLocation: LocationPoint | null;
  routePoints: LocationPoint[];
  isPaused: boolean;
  obstacleFeatures?: ObstacleFeature[]; // NEW
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
}
```

**New Message Types:**
```typescript
type MapMessage =
  | { type: 'updateLocation'; payload: LocationPoint }
  | { type: 'addRoutePoint'; payload: LocationPoint }
  | { type: 'clearRoute' }
  | { type: 'setZoom'; payload: number }
  | { type: 'centerOnUser' }
  | { type: 'setPaused'; payload: boolean }
  | { type: 'updateObstacles'; payload: ObstacleFeature[] }; // NEW
```

**Changes:**
- Accept `obstacleFeatures` prop
- Send obstacle updates to WebView via postMessage
- Throttle obstacle updates to once per second (aligned with GPS throttling)

### Leaflet HTML Template (Modified)

**New JavaScript Functions:**
```javascript
let obstacleMarkers = [];

// Update obstacle markers on the map
function updateObstacles(features) {
  // Clear existing obstacle markers
  obstacleMarkers.forEach(marker => map.removeLayer(marker));
  obstacleMarkers = [];

  // Add new obstacle markers
  features.forEach(feature => {
    const marker = L.circleMarker([feature.latitude, feature.longitude], {
      radius: 6,
      fillColor: '#FF9500', // Orange color
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.7
    }).addTo(map);
    
    // Optional: Add popup with attributes
    if (feature.attributes) {
      marker.bindPopup(formatAttributes(feature.attributes));
    }
    
    obstacleMarkers.push(marker);
  });
}

// Format feature attributes for popup display
function formatAttributes(attributes) {
  return Object.entries(attributes)
    .map(([key, value]) => `<b>${key}:</b> ${value}`)
    .join('<br>');
}
```

**Message Handler Update:**
```javascript
window.addEventListener('message', function(event) {
  const message = event.data;
  
  switch (message.type) {
    // ... existing cases ...
    case 'updateObstacles':
      updateObstacles(message.payload);
      break;
  }
});
```

### ActiveTripScreen (Modified)

**New State and Logic:**
```typescript
export const ActiveTripScreen: React.FC = () => {
  // Existing state...
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
  const [nearbyObstacles, setNearbyObstacles] = useState<ObstacleFeature[]>([]); // NEW

  // Initialize ObstacleService
  useEffect(() => {
    obstacleService.initialize().catch(error => {
      console.error('Failed to initialize obstacle service:', error);
      showToast('Failed to load obstacle data', 'error');
    });

    return () => {
      obstacleService.cleanup();
    };
  }, []);

  // Query nearby obstacles when location updates
  useEffect(() => {
    if (currentLocation) {
      const obstacles = obstacleService.queryNearby({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: 20
      });
      setNearbyObstacles(obstacles);
    }
  }, [currentLocation]);

  return (
    <View style={styles.container}>
      <MapView 
        currentLocation={currentLocation}
        routePoints={routePoints}
        isPaused={isPaused}
        obstacleFeatures={nearbyObstacles} // NEW
      />
      {/* Existing buttons */}
    </View>
  );
};
```

## Data Models

### ObstacleFeature

```typescript
interface ObstacleFeature {
  id: string;                      // Unique identifier
  latitude: number;                // WGS84 latitude
  longitude: number;               // WGS84 longitude
  attributes: Record<string, any>; // Additional properties from GeoJSON
}
```

### GeoJSON File Schema

Expected schema for `curb_ramps.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "CNN": number,
        "LocationDescription": string,
        ...additional properties
      }
    }
  ]
}
```

### Spatial Grid Structure

```typescript
interface GridCell {
  features: ObstacleFeature[];
}

// Grid organized by cell keys: "lat_lon" (e.g., "37.7749_-122.4194")
// Cell size: 0.001 degrees (~100m at mid-latitudes)
```

## Data Models

### GeoJSON Loading Strategy

**Asset Path Resolution:**
- Development: `file:///android_asset/curb_ramps.geojson`
- Android APK: `file:///android_asset/curb_ramps.geojson`
- iOS: (To be implemented)
- Use React Native's `Platform` module for path resolution

**Loading Process:**
1. Resolve asset path based on platform
2. Fetch file using fetch API
3. Parse GeoJSON using native JSON.parse()
4. Extract coordinates from geometry and properties as attributes
5. Build ObstacleFeature objects
6. Construct spatial index
7. Mark service as initialized

**Error Handling:**
- File not found: Log error, continue without obstacles
- Parse error: Log error with details, continue without obstacles
- Invalid coordinates: Skip invalid features, load valid ones
- Memory constraints: Limit features to reasonable count (e.g., 100,000)

### Spatial Indexing Strategy

**Grid-Based Index:**
- Divide space into grid cells of 0.001 degrees (~100m)
- Each cell contains features within its bounds
- Query checks 9 cells (3x3 grid around query point)
- Fallback to linear search if index build fails

**Index Build Time:**
- Expected: O(n) where n = number of features
- Target: < 500ms for 10,000 features

**Query Time:**
- Expected: O(k) where k = features in nearby cells
- Target: < 100ms per query
- Typical k: 10-50 features for 20m radius in urban areas

### Distance Calculation

**Haversine Formula:**
```typescript
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

**Accuracy:**
- Haversine provides accuracy within 0.5% for distances < 1km
- Sufficient for 20m proximity queries
- Faster than more accurate geodesic calculations

### Query Caching Strategy

**Cache Key:**
- Round location to 3 decimal places (~100m precision)
- Key format: `"lat_lon"` (e.g., `"37.775_-122.419"`)

**Cache Invalidation:**
- Invalidate when user moves > 10m from cached location
- Clear cache on trip end
- Max cache size: 10 entries (LRU eviction)

**Cache Hit Rate:**
- Expected: 80-90% for typical walking speeds
- GPS updates every second, user moves ~1-2m/s walking
- Cache valid for ~5-10 seconds per location



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining properties, I've analyzed the prework to eliminate redundancy:

**Redundancies Identified:**
- Properties 1.2 and 7.2 both test GeoJSON parsing of latitude/longitude/attributes - these are the same requirement
- Properties 3.1 and 3.4 both test proximity queries - can be combined into one comprehensive property
- Properties 3.5 and 5.2 both involve location updates and query behavior - but test different aspects (update triggering vs throttling), so both are needed
- Property 8.2 is about implementation details (using index) which is covered by performance property 5.1

**Consolidated Properties:**
After reflection, we'll focus on unique, high-value properties that provide comprehensive coverage without redundancy.

### Correctness Properties

Property 1: GeoJSON parsing extracts all valid features
*For any* GeoJSON FeatureCollection containing Point features with coordinates and properties, parsing should extract all features with valid coordinates and preserve all property data
**Validates: Requirements 1.2, 7.2**

Property 2: Invalid coordinates are filtered
*For any* GeoJSON file containing a mix of valid and invalid coordinates, the system should load only features with valid coordinates (latitude between -90 and 90, longitude between -180 and 180) and skip invalid ones
**Validates: Requirements 1.5**

Property 3: Successful load enables spatial queries
*For any* successfully loaded GeoJSON file, the resulting features should be queryable by location and radius
**Validates: Requirements 1.4**

Property 4: Platform-agnostic path resolution
*For any* platform (Android, iOS, development), the path resolver should return a valid path to the GeoJSON asset appropriate for that platform
**Validates: Requirements 2.3**

Property 5: Proximity queries return only nearby features
*For any* location and set of features, querying with a 20-meter radius should return only features within 20 meters of that location (as measured by Haversine distance)
**Validates: Requirements 3.1, 3.4**

Property 6: Haversine distance accuracy
*For any* two coordinate pairs, the calculated distance using the Haversine formula should match the expected geodesic distance within 0.5% for distances under 1km
**Validates: Requirements 3.2**

Property 7: Location updates trigger feature updates
*For any* location change, the system should query and update the displayed features based on the new location
**Validates: Requirements 3.5**

Property 8: Markers positioned at feature coordinates
*For any* set of nearby features, obstacle markers should be created at exactly the latitude and longitude of each feature
**Validates: Requirements 4.1**

Property 9: Map interactions preserve obstacle markers
*For any* map interaction (zoom or pan), obstacle markers should remain visible and correctly positioned at their feature coordinates
**Validates: Requirements 4.5**

Property 10: Query performance under 100ms
*For any* proximity query with a typical dataset (up to 10,000 features), the query should complete in less than 100 milliseconds
**Validates: Requirements 5.1**

Property 11: Query throttling to once per second
*For any* sequence of location updates arriving faster than once per second, obstacle queries should be throttled to execute at most once per second
**Validates: Requirements 5.2**

Property 12: Result limiting to 50 features
*For any* proximity query that would return more than 50 features, the system should limit the results to the closest 50 features by distance
**Validates: Requirements 5.3**

Property 13: Visibility-based query pausing
*For any* map component that is not visible, obstacle queries should not execute even when location updates occur
**Validates: Requirements 5.4**

Property 14: Obstacle updates preserve existing map elements
*For any* obstacle marker update, the current location marker and route polyline should remain unchanged and correctly positioned
**Validates: Requirements 6.2**

Property 15: Map interactions work with obstacles
*For any* map with obstacle markers displayed, pan, zoom, and re-center operations should function correctly
**Validates: Requirements 6.5**

Property 16: Async parsing doesn't block UI
*For any* GeoJSON file, parsing should return a Promise and complete asynchronously without blocking the JavaScript thread
**Validates: Requirements 7.3**

Property 17: Query result caching
*For any* location, repeated queries at the same location (within 100m precision) should return cached results without re-executing the spatial query
**Validates: Requirements 8.4**

Property 18: Cache invalidation on movement
*For any* cached query result, when the user moves more than 10 meters from the cached location, the cache should be invalidated and a new query should execute
**Validates: Requirements 8.5**

## Error Handling

### Error Categories

**GeoJSON Loading Errors**
- File not found at asset path
- File read permission denied
- Corrupted or invalid GeoJSON format
- Out of memory during file load

**Parsing Errors**
- Invalid GeoJSON schema (not a FeatureCollection)
- Missing or invalid geometry coordinates
- Invalid data types in properties
- Malformed JSON syntax

**Spatial Query Errors**
- Invalid query coordinates (NaN, undefined)
- Invalid radius (negative, zero, NaN)
- Spatial index build failure
- Query timeout (> 100ms)

**Integration Errors**
- MapView not initialized when sending obstacles
- WebView postMessage failure
- Memory pressure during large result sets
- Concurrent query conflicts

### Error Handling Strategy

**User-Facing Errors**
- Display toast notification for GeoJSON load failures
- Log error details to console for debugging
- Continue trip functionality without obstacle display
- Provide "Retry" option for recoverable errors

**Developer Errors**
- Log all errors with stack traces
- Include file path and error details for load failures
- Log query performance metrics for slow queries
- Track cache hit/miss rates

**Graceful Degradation**
- If GeoJSON file fails to load, continue without obstacles
- If spatial index fails to build, fall back to linear search
- If query times out, return empty result set
- If WebView communication fails, skip obstacle updates

### Error Recovery

**Automatic Recovery**
- Retry GeoJSON load once after 1 second delay
- Rebuild spatial index if queries consistently fail
- Clear cache if memory pressure detected
- Reinitialize service if in invalid state

**Manual Recovery**
- Provide "Reload Obstacles" button in settings
- Allow users to disable obstacle display
- Maintain all trip recording functionality even if obstacles fail
- Log errors for user to report issues

## Testing Strategy

### Unit Testing

**ObstacleService Tests**
- GeoJSON file loading and parsing
- Spatial index construction
- Proximity query logic
- Distance calculations (Haversine)
- Cache management
- Error handling for invalid inputs

**SpatialGrid Tests**
- Grid cell key generation
- Feature indexing by cell
- Nearby cell calculation
- Query performance with various densities
- Edge cases at grid boundaries

**Integration Tests**
- MapView with obstacle features
- ActiveTripScreen with ObstacleService
- Location updates triggering queries
- Cleanup on trip end

### Property-Based Testing

**Testing Framework**: fast-check (already in package.json)

**Configuration**: Each property-based test should run a minimum of 100 iterations to ensure comprehensive coverage of the input space.

**Test Tagging**: Each property-based test MUST be tagged with a comment explicitly referencing the correctness property in this design document using the format: `// Feature: obstacle-visualization, Property {number}: {property_text}`

**Property Test Coverage**:
- Each correctness property listed above MUST be implemented by a SINGLE property-based test
- Property tests should use smart generators that constrain to valid input spaces
- Property tests should avoid mocking when possible to test real behavior

**Key Property Tests**:

1. GeoJSON parsing (Properties 1, 2, 3)
   - Generate random GeoJSON FeatureCollections
   - Include mix of valid and invalid coordinates
   - Verify parsing, filtering, and queryability

2. Path resolution (Property 4)
   - Generate different platform identifiers
   - Verify correct path format for each platform

3. Proximity queries (Properties 5, 6, 7)
   - Generate random locations and feature sets
   - Verify only nearby features returned
   - Verify Haversine distance accuracy
   - Verify updates on location change

4. Marker display (Properties 8, 9)
   - Generate random feature sets
   - Verify marker positioning
   - Verify persistence through map interactions

5. Performance (Properties 10, 11, 12, 13)
   - Generate large feature sets
   - Verify query performance
   - Verify throttling behavior
   - Verify result limiting
   - Verify visibility-based pausing

6. Integration (Properties 14, 15)
   - Generate obstacle updates
   - Verify existing map elements preserved
   - Verify map interactions still work

7. Async and caching (Properties 16, 17, 18)
   - Verify async parsing
   - Verify cache hits and misses
   - Verify cache invalidation

### Integration Testing

**Service Integration Tests**
- ObstacleService initialization in ActiveTripScreen
- Location updates flowing to obstacle queries
- Query results flowing to MapView
- Cleanup on trip end

**WebView Integration Tests**
- Obstacle marker messages sent to WebView
- Markers rendered in Leaflet
- Markers cleared on update
- Error handling for WebView failures

**End-to-End Tests**
- Complete trip with obstacle visualization
- Move through areas with varying obstacle density
- Verify performance remains acceptable
- Verify cleanup on trip end

### Manual Testing Checklist

**GeoJSON Loading**
- [ ] GeoJSON file loads on app start
- [ ] Features are queryable after load
- [ ] Invalid coordinates are filtered
- [ ] Error handling for missing file

**Proximity Queries**
- [ ] Only nearby obstacles displayed
- [ ] Obstacles update as user moves
- [ ] No obstacles shown when none nearby
- [ ] Query performance is acceptable

**Marker Display**
- [ ] Obstacle markers appear on map
- [ ] Markers use distinct color/icon
- [ ] Markers don't obscure location marker
- [ ] Markers persist through map interactions

**Performance**
- [ ] Queries complete quickly (< 100ms)
- [ ] No lag with many obstacles
- [ ] Throttling prevents excessive queries
- [ ] Memory usage remains reasonable

**Integration**
- [ ] Location tracking still works
- [ ] Route polyline still works
- [ ] Map interactions still work
- [ ] Trip recording still works

**Error Handling**
- [ ] Missing file handled gracefully
- [ ] Parse errors handled gracefully
- [ ] Query errors handled gracefully
- [ ] Cleanup happens on trip end

## Implementation Notes

### Technology Stack

**Dependencies:**
- No additional dependencies required (uses native JSON parsing)

**Existing Dependencies:**
- react-native-webview: ^13.12.2 (WebView for Leaflet)
- react-native-geolocation-service: ^5.3.1 (GPS tracking)

### Asset Bundling Configuration

**Android Configuration:**

1. Copy GeoJSON file to `android/app/src/main/assets/` during build
2. Update `android/app/build.gradle` to include assets:
```gradle
android {
    sourceSets {
        main {
            assets.srcDirs = ['src/main/assets']
        }
    }
}
```

3. Create build script to copy file:
```javascript
// scripts/copy-geojson-to-assets.js
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../MapData/curb_ramps.geojson');
const dest = path.join(__dirname, '../android/app/src/main/assets/curb_ramps.geojson');

fs.copyFileSync(source, dest);
console.log('Copied Parquet file to Android assets');
```

4. Add to package.json scripts:
```json
{
  "scripts": {
    "copy-parquet": "node scripts/copy-parquet-to-assets.js",
    "prebuild": "npm run copy-tiles && npm run copy-parquet"
  }
}
```

**iOS Configuration (Future):**
- Add Parquet file to Xcode project
- Include in Copy Bundle Resources build phase
- Access via `NSBundle.mainBundle()`

### File Access in React Native

**Android Asset Access:**
```typescript
import { Platform } from 'react-native';
function getObstacleDataPath(): string {
  if (Platform.OS === 'android') {
    return 'file:///android_asset/curb_ramps.geojson';
  } else if (Platform.OS === 'ios') {
    // iOS path will be implemented when needed
    return 'curb_ramps.geojson';
  } else {
    // Development
    return 'file:///android_asset/curb_ramps.geojson';
  }
}
```

**Reading Asset:**
```typescript
async function loadGeoJsonFile(path: string): Promise<any> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON file: ${response.statusText}`);
  }
  return await response.json();
}
```

### Spatial Index Implementation

**Grid Cell Size Calculation:**
- 0.001 degrees ≈ 111 meters at equator
- ≈ 100 meters at mid-latitudes (37°N)
- Good balance between cell count and query efficiency

**Grid Cell Key Format:**
```typescript
function getCellKey(lat: number, lon: number): string {
  const cellLat = Math.floor(lat / 0.001);
  const cellLon = Math.floor(lon / 0.001);
  return `${cellLat}_${cellLon}`;
}
```

**Nearby Cells Calculation:**
```typescript
function getNearbyCells(lat: number, lon: number, radiusMeters: number): string[] {
  // Calculate how many cells to check based on radius
  const cellsToCheck = Math.ceil(radiusMeters / 111000 / 0.001);
  const cells: string[] = [];
  
  for (let dLat = -cellsToCheck; dLat <= cellsToCheck; dLat++) {
    for (let dLon = -cellsToCheck; dLon <= cellsToCheck; dLon++) {
      const cellLat = Math.floor(lat / 0.001) + dLat;
      const cellLon = Math.floor(lon / 0.001) + dLon;
      cells.push(`${cellLat}_${cellLon}`);
    }
  }
  
  return cells;
}
```

### Performance Optimization

**Memory Management:**
- Limit loaded features to 100,000 (typical urban area)
- Use typed arrays for coordinates if memory constrained
- Clear cache periodically to prevent memory leaks

**Query Optimization:**
- Pre-filter by grid cells (reduces candidates by 90%+)
- Use Haversine only for remaining candidates
- Cache results for 100m location precision
- Throttle queries to 1 per second

**Rendering Optimization:**
- Limit displayed markers to 50 (closest features)
- Use Leaflet marker clustering if > 50 features
- Batch marker updates to reduce WebView messages
- Remove markers outside viewport (future enhancement)

### Accessibility

**Screen Reader Support:**
- Provide accessibility labels for obstacle markers
- Announce nearby obstacles to screen readers
- Ensure obstacle info is available without map

**Alternative UI:**
- Provide list view of nearby obstacles
- Include distance and direction to each obstacle
- Allow text-based navigation to obstacles

### Future Enhancements

**Potential Improvements:**
- Support multiple obstacle types (barriers, hazards, etc.)
- Add obstacle filtering by type
- Show obstacle details in popup
- Add obstacle search functionality
- Support user-reported obstacles
- Sync obstacles with backend
- Add obstacle routing (avoid/prefer certain types)
- Support offline obstacle updates
- Add obstacle photos/images
- Implement obstacle clustering for dense areas
