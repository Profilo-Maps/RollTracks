# Design Document

## Overview

This feature adds real-time map visualization to the RollTracks Active Trip Page using Leaflet for React Native. The map displays the user's current location and tracked route during an active trip. The implementation uses preloaded offline map tiles stored locally at C:\MobilityTripTracker1\MapData\sf_tiles, enabling offline functionality.

**Key Design Decisions:**
- Use react-native-webview with Leaflet.js for map rendering (most mature solution for React Native)
- Load tiles from local file system using custom tile layer
- Communicate between React Native and WebView using postMessage API
- Maintain existing GPS tracking architecture without modification

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ActiveTripScreen (React Native)             │
│  - Manages trip state (pause/resume/end)                │
│  - Receives GPS updates from GPSService                  │
│  - Sends location updates to MapView via postMessage    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              MapView Component (React Native)            │
│  - Wraps WebView with Leaflet HTML                      │
│  - Handles postMessage communication                     │
│  - Manages map lifecycle and cleanup                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              WebView (Leaflet.js)                        │
│  - Renders interactive map                              │
│  - Loads tiles from local file system                   │
│  - Displays current location marker                     │
│  - Draws route polyline                                 │
└─────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
GPS Update → ActiveTripScreen → MapView → WebView (Leaflet)
                    ↓
            StorageAdapter (GPS Points)
```

## Components and Interfaces

### MapView Component (New)


```typescript
interface MapViewProps {
  currentLocation: LocationPoint | null;
  routePoints: LocationPoint[];
  isPaused: boolean;
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

const MapView: React.FC<MapViewProps> = (props) => {
  // Renders WebView with Leaflet HTML
  // Sends location updates via postMessage
  // Handles map lifecycle
};
```

**Responsibilities:**
- Render WebView with embedded Leaflet HTML/JS
- Send location and route updates to WebView via postMessage
- Handle map initialization and cleanup
- Provide error handling and loading states

### Leaflet HTML Template

The MapView component will inject an HTML template into the WebView containing:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    // Configure custom tile layer for local files
    // Handle postMessage events from React Native
    // Update marker and polyline
  </script>
</body>
</html>
```

### Tile Loading Strategy

**Local Tile Path Configuration:**
- Base path: `file:///C:/MobilityTripTracker1/MapData/sf_tiles`
- Tile URL pattern: `file:///C:/MobilityTripTracker1/MapData/sf_tiles/{z}/{x}/{y}.png`
- Default zoom: 17
- Supported zoom levels: All levels present in the tile directory

**Tile Layer Configuration:**
```javascript
L.tileLayer('file:///C:/MobilityTripTracker1/MapData/sf_tiles/{z}/{x}/{y}.png', {
  maxZoom: 18,
  minZoom: 10,
  attribution: 'Offline Map Tiles'
}).addTo(map);
```

### ActiveTripScreen Modifications

**Changes Completed:**
1. ✅ Removed TripTimer component and all references
2. ✅ Added MapView component with Leaflet integration
3. ✅ Integrated GPS location updates to MapView
4. ✅ Maintained existing pause/resume/end trip functionality
5. ✅ Removed outdated TripScreen.tsx file

**Updated Structure:**
```typescript
export const ActiveTripScreen: React.FC = () => {
  // Existing state and services
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);

  // Subscribe to GPS updates
  useEffect(() => {
    const subscription = gpsService.subscribeToLocationUpdates((location) => {
      setCurrentLocation(location);
      setRoutePoints(prev => [...prev, location]);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <MapView 
        currentLocation={currentLocation}
        routePoints={routePoints}
        isPaused={isPaused}
      />
      {/* Existing buttons */}
    </View>
  );
};
```

## Data Models

### Location Point (Existing)

```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}
```

### Map State

```typescript
interface MapState {
  isInitialized: boolean;
  center: { lat: number; lng: number };
  zoom: number;
  isFollowingUser: boolean;
}
```

### WebView Message Protocol

**Messages from React Native to WebView:**

```typescript
type MapMessage = 
  | { type: 'updateLocation'; payload: LocationPoint }
  | { type: 'addRoutePoint'; payload: LocationPoint }
  | { type: 'clearRoute' }
  | { type: 'setZoom'; payload: number }
  | { type: 'centerOnUser' };
```

**Messages from WebView to React Native:**

```typescript
type WebViewMessage =
  | { type: 'mapReady' }
  | { type: 'mapError'; payload: string }
  | { type: 'tileLoadError'; payload: { z: number; x: number; y: number } };
```

## Data Models

### GPS Service Integration

The existing GPSService will be extended to support location subscriptions:

```typescript
class GPSService {
  // Existing methods...
  
  subscribeToLocationUpdates(
    callback: (location: LocationPoint) => void
  ): { unsubscribe: () => void };
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining properties, I've analyzed the prework to eliminate redundancy:

**Redundancies Identified:**
- Properties 2.4 and 5.3 both test viewport changes triggering tile loading - can be combined
- Properties 3.1 and 3.2 both test marker display and positioning - can be combined
- Properties 4.1 and 4.2 both test polyline drawing and extension - can be combined
- Properties 4.4 and 4.5 test pause/resume behavior - can be combined into one property
- Properties 6.5 and 7.4 both test cleanup on unmount - can be combined

**Consolidated Properties:**
After reflection, we'll focus on unique, high-value properties that provide comprehensive coverage without redundancy.

### Correctness Properties

Property 1: Map initialization centers on GPS location
*For any* valid GPS location, initializing the map should center the viewport on that location's coordinates
**Validates: Requirements 1.2**

Property 2: Tile URL pattern correctness
*For any* tile coordinates (z, x, y), the generated tile URL should follow the pattern `file:///C:/MobilityTripTracker1/MapData/sf_tiles/{z}/{x}/{y}.png`
**Validates: Requirements 2.2**

Property 3: Missing tile graceful handling
*For any* tile request where the tile file does not exist, the system should display a placeholder without crashing
**Validates: Requirements 2.3**

Property 4: Viewport-based tile loading
*For any* map viewport change (pan or zoom), only tiles within the visible bounds should be requested for loading
**Validates: Requirements 2.4, 5.3**

Property 5: Zoom level tile loading
*For any* zoom level change, the system should request tiles at the new zoom level from the local directory
**Validates: Requirements 2.5**

Property 6: Location marker positioning
*For any* GPS location update, the current location marker should be positioned at exactly those coordinates on the map
**Validates: Requirements 3.1, 3.2**

Property 7: Accuracy circle display
*For any* GPS location with accuracy data, an accuracy circle should be displayed around the marker with radius proportional to the accuracy value
**Validates: Requirements 3.5**

Property 8: Route polyline construction
*For any* sequence of GPS points captured during a trip, a polyline should be drawn connecting all points in chronological order
**Validates: Requirements 4.1, 4.2**

Property 9: Pause/resume polyline behavior
*For any* trip, when paused, new GPS points should not extend the polyline, and when resumed, new GPS points should extend the polyline from the last point before pause
**Validates: Requirements 4.4, 4.5**

Property 10: Map interaction preserves elements
*For any* map interaction (pan, zoom), the current location marker and route polyline should remain visible and correctly positioned
**Validates: Requirements 5.4**

Property 11: Tile caching prevents redundant loads
*For any* tile that has been loaded once, subsequent requests for the same tile should use the cached version without file system access
**Validates: Requirements 6.1**

Property 12: GPS update throttling
*For any* sequence of GPS updates arriving faster than once per second, map updates should be throttled to a maximum rate of one update per second
**Validates: Requirements 6.2**

Property 13: Polyline simplification threshold
*For any* route polyline with more than 1000 points, the rendered polyline should be simplified to improve performance while maintaining route shape
**Validates: Requirements 6.3**

Property 14: Hidden map pauses updates
*For any* map component that is not visible (unmounted or hidden), GPS location updates should not trigger map rendering updates
**Validates: Requirements 6.4**

## Error Handling

### Error Categories

**Tile Loading Errors**
- Tile file not found in local directory
- Invalid tile coordinates
- File system access denied
- Corrupted tile image

**GPS Integration Errors**
- GPS service unavailable
- Invalid GPS coordinates
- GPS permission denied (handled by existing GPSService)

**WebView Errors**
- WebView failed to load
- JavaScript execution error in Leaflet
- PostMessage communication failure

**Map Initialization Errors**
- Leaflet library failed to load
- Invalid initial coordinates
- Map container not found

### Error Handling Strategy

**User-Facing Errors**
- Display toast notification for tile loading failures
- Show error overlay on map for critical failures
- Provide "Retry" button for recoverable errors
- Fall back to showing trip info without map if WebView fails

**Developer Errors**
- Log all errors to console with context
- Include tile coordinates in tile loading errors
- Log WebView console messages for debugging
- Track postMessage failures

**Graceful Degradation**
- If tiles are missing, show blank tiles but keep map functional
- If WebView fails, show trip info without map
- If GPS updates fail, keep last known position
- If polyline rendering fails, still show current location

### Error Recovery

**Automatic Recovery**
- Retry tile loading once after 500ms delay
- Reinitialize WebView if postMessage fails
- Resume GPS subscription if connection lost

**Manual Recovery**
- Provide "Reload Map" button for WebView failures
- Allow users to continue trip without map visualization
- Maintain all trip recording functionality even if map fails

## Testing Strategy

### Unit Testing

**MapView Component Tests**
- Props handling and validation
- PostMessage communication
- Lifecycle methods (mount, unmount, cleanup)
- Error handling and fallback UI

**WebView Message Protocol Tests**
- Message serialization/deserialization
- Message type validation
- Payload structure validation

**Integration with Existing Services**
- GPSService subscription and unsubscription
- Location update handling
- Trip state synchronization

### Property-Based Testing

**Testing Framework**: fast-check (already in package.json)

**Configuration**: Each property-based test should run a minimum of 100 iterations to ensure comprehensive coverage of the input space.

**Test Tagging**: Each property-based test MUST be tagged with a comment explicitly referencing the correctness property in this design document using the format: `// Feature: map-visualization, Property {number}: {property_text}`

**Property Test Coverage**:
- Each correctness property listed above MUST be implemented by a SINGLE property-based test
- Property tests should use smart generators that constrain to valid input spaces
- Property tests should avoid mocking when possible to test real behavior

**Key Property Tests**:

1. Map initialization (Property 1)
   - Generate random valid GPS coordinates
   - Verify map centers on those coordinates

2. Tile URL generation (Property 2)
   - Generate random tile coordinates
   - Verify URL pattern correctness

3. Tile loading and caching (Properties 3, 4, 5, 11)
   - Generate random viewport changes
   - Verify correct tiles are requested
   - Verify caching behavior

4. Location marker (Properties 6, 7)
   - Generate random GPS locations with/without accuracy
   - Verify marker positioning and accuracy circle

5. Route polyline (Properties 8, 9, 10)
   - Generate random GPS point sequences
   - Verify polyline construction and pause/resume behavior
   - Verify polyline persists through map interactions

6. Performance optimizations (Properties 12, 13, 14)
   - Generate rapid GPS update sequences
   - Generate large point sets
   - Verify throttling and simplification

### Integration Testing

**Screen Integration Tests**
- ActiveTripScreen with MapView integration
- GPS updates flowing to map display
- Trip pause/resume affecting map behavior
- Trip end triggering map cleanup

**WebView Integration Tests**
- Leaflet initialization in WebView
- PostMessage communication both directions
- Tile loading from local file system
- Map interaction handling

**End-to-End Tests**
- Complete trip with map visualization
- Pause and resume with map updates
- End trip and verify cleanup
- Handle missing tiles gracefully

### Manual Testing Checklist

**Map Display**
- [ ] Map loads and displays tiles
- [ ] Map centers on current location
- [ ] Zoom level starts at 17
- [ ] Buttons remain visible

**Tile Loading**
- [ ] Tiles load from local directory
- [ ] Missing tiles show placeholder
- [ ] Different zoom levels load correctly
- [ ] Tiles cache properly

**Location Tracking**
- [ ] Current location marker appears
- [ ] Marker updates with GPS
- [ ] Accuracy circle displays when available
- [ ] Marker stays visible during map interaction

**Route Visualization**
- [ ] Route polyline draws as trip progresses
- [ ] Polyline stops extending when paused
- [ ] Polyline resumes extending when resumed
- [ ] Polyline visible during map interaction

**Performance**
- [ ] Map updates smoothly
- [ ] No lag with many GPS points
- [ ] Tile loading doesn't block UI
- [ ] Memory usage remains reasonable

**Error Handling**
- [ ] Missing tiles handled gracefully
- [ ] WebView errors show fallback UI
- [ ] GPS errors don't crash map
- [ ] Cleanup happens on trip end

## Implementation Notes

### Technology Stack

**New Dependencies:**
- react-native-webview: ^13.6.0 (for WebView component)
- Leaflet.js: 1.9.4 (loaded via CDN in WebView HTML)

**Existing Dependencies:**
- react-native-geolocation-service: ^5.3.1 (GPS tracking)
- @mapbox/polyline: ^1.2.1 (polyline encoding)

### WebView Configuration

**Security Considerations:**
- Allow file:// protocol for local tile loading
- Disable JavaScript injection from external sources
- Restrict postMessage to known message types
- Validate all coordinates before sending to WebView

**Performance Optimizations:**
- Enable hardware acceleration for WebView
- Use `javaScriptEnabled={true}` for Leaflet
- Set `cacheEnabled={true}` for tile caching
- Use `androidLayerType="hardware"` for Android

### File System Access

**Windows Path Handling:**
- Convert backslashes to forward slashes for file:// URLs
- Use absolute paths for tile loading
- Handle path encoding for special characters

**Tile Directory Structure:**
```
C:\MobilityTripTracker1\MapData\sf_tiles\
  10/
    163/
      395.png
  11/
    327/
      790.png
  ...
  17/
    20964/
      50262.png
```

### GPS Update Flow

1. GPSService captures location
2. ActiveTripScreen receives update
3. ActiveTripScreen updates state
4. MapView receives new props
5. MapView sends postMessage to WebView
6. Leaflet updates marker and polyline

### Cleanup Strategy

**On Trip End:**
1. Stop GPS subscription
2. Send cleanup message to WebView
3. Remove Leaflet map instance
4. Clear WebView cache
5. Unmount MapView component

**On Component Unmount:**
1. Unsubscribe from GPS updates
2. Remove all event listeners
3. Clear map state
4. Release WebView resources

### Accessibility

**Screen Reader Support:**
- Provide accessibility labels for map container
- Announce location updates to screen readers
- Ensure buttons remain accessible with map present

**Alternative UI:**
- Provide text-based trip info alongside map
- Ensure trip can be completed if map fails
- Maintain existing accessibility features

### Future Enhancements

**Potential Improvements:**
- Add compass/heading indicator
- Show speed on map
- Display elevation profile
- Add route statistics overlay
- Support multiple tile sources
- Add satellite imagery option
- Enable route replay after trip
- Add heatmap of frequently traveled routes

