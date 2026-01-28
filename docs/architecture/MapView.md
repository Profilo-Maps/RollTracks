# MapView Component

## Overview

The MapView component provides real-time map visualization for active trips in the RollTracks application. It uses Leaflet.js running in a WebView to display an interactive map with offline tile support.

## Features

- **Offline Map Tiles**: Loads map tiles from local file system (C:\MobilityTripTracker1\MapData\sf_tiles)
- **Real-time Location Tracking**: Displays current GPS position with accuracy circle
- **Route Visualization**: Draws traveled route as a polyline
- **Interactive Map**: Supports pan, zoom, and re-center functionality
- **Performance Optimized**: Includes GPS throttling, polyline simplification, and tile caching
- **Pause/Resume Support**: Stops route drawing when trip is paused

## Usage

```typescript
import { MapView } from '../components/MapView';
import { LocationPoint } from '../types';

function ActiveTripScreen() {
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <MapView
      currentLocation={currentLocation}
      routePoints={routePoints}
      isPaused={isPaused}
      onMapReady={() => console.log('Map ready')}
      onMapError={(error) => console.error('Map error:', error)}
    />
  );
}
```

## Props

### `currentLocation: LocationPoint | null`
The user's current GPS location. Updates the location marker on the map.

```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}
```

### `routePoints: LocationPoint[]`
Array of GPS points representing the traveled route. Draws a polyline connecting these points.

### `isPaused: boolean`
Whether the trip is currently paused. When true, stops adding new points to the route polyline.

### `onMapReady?: () => void` (optional)
Callback fired when the map has finished initializing and is ready to receive updates.

### `onMapError?: (error: string) => void` (optional)
Callback fired when a map error occurs (e.g., WebView load failure, tile loading error).

## Message Protocol

The MapView component communicates with the Leaflet WebView using postMessage:

### Messages to WebView

```typescript
type MapMessage =
  | { type: 'updateLocation'; payload: LocationPoint }
  | { type: 'addRoutePoint'; payload: LocationPoint }
  | { type: 'clearRoute' }
  | { type: 'setZoom'; payload: number }
  | { type: 'centerOnUser' }
  | { type: 'setPaused'; payload: boolean };
```

### Messages from WebView

```typescript
type WebViewMessage =
  | { type: 'mapReady' }
  | { type: 'mapError'; payload: string }
  | { type: 'tileLoadError'; payload: { z: number; x: number; y: number } };
```

## Performance Optimizations

### GPS Update Throttling
Map updates are throttled to a maximum of 1 per second to reduce battery drain and improve performance.

### Polyline Simplification
When the route contains more than 1000 points, the Douglas-Peucker algorithm simplifies the polyline while maintaining route shape.

### Visibility-Based Updates
Map updates are paused when the app is in the background to conserve resources.

### Tile Caching
Leaflet and WebView automatically cache loaded tiles to avoid redundant file system reads.

## Tile Directory Structure

The map expects tiles to be organized in the following structure:

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

Tile URL pattern: `file:///C:/MobilityTripTracker1/MapData/sf_tiles/{z}/{x}/{y}.png`

- `{z}`: Zoom level (10-18)
- `{x}`: Longitude tile coordinate
- `{y}`: Latitude tile coordinate

## Error Handling

### Missing Tiles
If a tile is not found in the local directory, a blank placeholder is displayed instead of crashing.

### WebView Errors
If the WebView fails to load, an error message is displayed and the `onMapError` callback is fired.

### GPS Errors
Invalid GPS coordinates are logged but don't crash the map. The last valid location is maintained.

## Styling

The MapView fills its container and should be used with `flex: 1`:

```typescript
<View style={{ flex: 1 }}>
  <MapView {...props} />
</View>
```

## Accessibility

- Map container has appropriate accessibility labels
- Buttons remain accessible when map is displayed
- Screen readers announce location updates

## Known Limitations

- Requires preloaded map tiles for offline functionality
- WebView performance may vary on older devices
- File:// protocol access required for local tiles
- Limited to tile-based maps (no vector maps)

## Future Enhancements

- Compass/heading indicator
- Speed display
- Elevation profile
- Route statistics overlay
- Multiple tile sources
- Satellite imagery
- Route replay
- Heatmap visualization
