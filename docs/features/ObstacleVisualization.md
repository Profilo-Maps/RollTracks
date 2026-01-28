# Obstacle Visualization

## Overview

The obstacle visualization feature displays nearby curb ramps and other obstacles on the map during an active trip. The system loads obstacle data from a bundled GeoJSON file and uses efficient spatial indexing to show only obstacles within 20 meters of the user's current location.

## Architecture

### Components

1. **ObstacleService** (`src/services/ObstacleService.ts`)
   - Loads and parses GeoJSON file containing obstacle data
   - Builds spatial index for efficient proximity queries
   - Provides `queryNearby()` method to find obstacles within a radius
   - Implements caching and throttling for performance

2. **SpatialGrid** (`src/services/SpatialGrid.ts`)
   - Grid-based spatial index for fast feature lookup
   - Divides geographic space into ~100m cells
   - Enables O(k) query time where k = features in nearby cells

3. **MapView** (`src/components/MapView.tsx`)
   - Displays obstacle markers on Leaflet map
   - Receives obstacle features via props
   - Renders orange circle markers with popups

4. **ActiveTripScreen** (`src/screens/ActiveTripScreen.tsx`)
   - Initializes ObstacleService on mount
   - Queries nearby obstacles when location updates
   - Passes obstacles to MapView for display

## Data Format

### GeoJSON File Schema

The `curb_ramps.geojson` file is a standard GeoJSON FeatureCollection containing Point features with:

- `geometry.type`: "Point"
- `geometry.coordinates`: [longitude, latitude] (WGS84)
- `longitude` (DOUBLE, required): WGS84 longitude coordinate
- `id` (STRING, optional): Unique identifier (generated if missing)
- Additional columns (optional): Stored as attributes and displayed in popups

### ObstacleFeature Interface

```typescript
interface ObstacleFeature {
  id: string;
  latitude: number;
  longitude: number;
  attributes: Record<string, any>;
}
```

## Asset Bundling

### Build Process

1. Source file: `C:\MobilityTripTracker1\MapData\curb_ramps.geojson`
2. Build script: `scripts/copy-geojson-to-assets.js`
3. Destination: `android/app/src/main/assets/curb_ramps.geojson`
4. Runs automatically during `npm run prebuild`

### Platform-Specific Paths

- **Android**: `file:///android_asset/curb_ramps.geojson`
- **iOS**: (To be implemented)
- **Development**: `file:///android_asset/curb_ramps.geojson`

## Usage

### Querying Nearby Obstacles

```typescript
import { obstacleService } from './services/ObstacleService';

// Initialize service (once at app start)
await obstacleService.initialize();

// Query obstacles within 20m
const obstacles = obstacleService.queryNearby({
  latitude: 37.7749,
  longitude: -122.4194,
  radiusMeters: 20
});

// Cleanup when done
obstacleService.cleanup();
```

### Displaying on Map

```typescript
<MapView
  currentLocation={currentLocation}
  routePoints={routePoints}
  isPaused={isPaused}
  obstacleFeatures={nearbyObstacles}
/>
```

## Performance

### Spatial Indexing

- Grid cell size: 0.001 degrees (~100m)
- Index build time: < 500ms for 10,000 features
- Query time: < 100ms for typical urban density

### Caching

- Cache key: Rounded to 3 decimal places (~100m precision)
- Cache invalidation: When user moves > 10m
- Max cache size: 10 entries (LRU eviction)

### Throttling

- Location updates: Max 1 per second
- Obstacle queries: Max 1 per second
- Map updates: Max 1 per second

### Result Limiting

- Maximum displayed obstacles: 50 (closest by distance)
- Maximum loaded features: 100,000

## Error Handling

### Graceful Degradation

- Missing GeoJSON file: App continues without obstacles
- Parse errors: App continues without obstacles
- Invalid coordinates: Skipped, valid features loaded
- Spatial index failure: Falls back to linear search

### Error Logging

All errors are logged to console with context:
- File path and error details for load failures
- Query performance metrics for slow queries
- Cache hit/miss rates for debugging

## Marker Styling

### Obstacle Markers

- Shape: Circle marker
- Border: White, 2px
- Radius: 6px
- Opacity: 70%
- Z-index: 400 (below current location marker)

#### Color Coding by Condition Score

Markers are color-coded based on the `conditionScore` attribute:

- **Green (#4CAF50)**: Good condition (score 50-100)
  - Well-maintained curb ramps in excellent condition
- **Orange (#FF9500)**: Fair condition (score 0-49)
  - Functional but may have minor issues
- **Purple (#9C27B0)**: Poor condition (score < 0)
  - Damaged or poorly maintained, may be difficult to use
- **Gray (#999999)**: Unknown condition (no score available)
  - Condition has not been assessed

### Popups

- Display all feature attributes
- Format: `<b>key:</b> value`
- Triggered by tapping marker

## Testing

### Unit Tests

- Asset bundling script: `__tests__/scripts/copy-geojson-to-assets.test.js`
- ObstacleService: `src/services/__tests__/ObstacleService.test.ts`
- SpatialGrid: `src/services/__tests__/SpatialGrid.test.ts`

### Property-Based Tests

Property tests validate correctness properties using fast-check:
- GeoJSON parsing extracts all valid features
- Invalid coordinates are filtered
- Proximity queries return only nearby features
- Haversine distance accuracy
- Query result caching
- And more...

## Troubleshooting

### Obstacles Not Displaying

1. Check if GeoJSON file exists at source location
2. Run `npm run copy-geojson` to copy file to assets
3. Check console for initialization errors
4. Verify GPS location is being received
5. Check if obstacles exist within 20m of location

### Performance Issues

1. Check number of loaded features (should be < 100,000)
2. Verify spatial index was built successfully
3. Check query times in console logs
4. Ensure throttling is working (1 query/second)

### Build Issues

1. Ensure `android/app/src/main/assets` directory exists
2. Verify `android/app/build.gradle` includes assets configuration
3. Check that `prebuild` script runs before Android build
4. Verify source file path is correct for your system

## Understanding the Map Display

When viewing the map during an active trip, you'll see different colored dots representing curb ramps:

- **Purple dots**: Curb ramps in poor condition (conditionScore < 0) - may be damaged or difficult to use
- **Orange dots**: Curb ramps in fair condition (conditionScore 0-49) - functional but may have minor issues  
- **Green dots**: Curb ramps in good condition (conditionScore 50-100) - well-maintained and accessible
- **Gray dots**: Curb ramps with unknown condition (no assessment available)

Tap any marker to see detailed information about that curb ramp, including its location, condition score, and other attributes.

## Future Enhancements

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
