# Requirements Document

## Introduction

This feature adds real-time map visualization to the RollTracks mobility tracking application. The map will display the user's current location and tracked route during an active trip on the Active Trip Page. The implementation uses Leaflet for map rendering and preloaded offline map tiles stored locally at zoom level 17, enabling the application to function without internet connectivity for map display.

## Glossary

- **RollTracks**: The mobile application system for tracking mobility trips
- **Active Trip Page**: The screen displayed while a trip is being recorded
- **Leaflet**: An open-source JavaScript library for interactive maps
- **Map Tiles**: Pre-rendered map image segments organized by zoom level and coordinates
- **Zoom Level**: The level of detail in map display (17 = street-level detail)
- **Tile Coordinates**: X/Y/Z coordinate system for organizing map tiles (Z=zoom, X=longitude, Y=latitude)
- **Current Location Marker**: A visual indicator showing the user's real-time GPS position on the map
- **Route Polyline**: A line drawn on the map showing the path traveled during the trip
- **Map Center**: The geographic coordinate at the center of the map viewport
- **Map Bounds**: The geographic area currently visible in the map viewport
- **Offline Tiles**: Map tiles stored locally on the device for use without internet connection
- **Tile Path**: The file system location of preloaded map tiles (C:\MobilityTripTracker1\MapData\sf_tiles)

## Requirements

### Requirement 1: Map Display on Active Trip Page

**User Story:** As a user, I want to see a live map during my trip, so that I can visualize my current location and the route I'm traveling.

#### Acceptance Criteria

1. WHEN a user starts a trip THEN the Active Trip Page SHALL display a Leaflet map component
2. WHEN displaying the map component THEN the system SHALL initialize the map centered on the user's current GPS location
3. WHEN displaying the map component THEN the system SHALL set the initial zoom level to 17
4. WHEN the map is displayed THEN the system SHALL maintain visibility of the Transit Leg and End Trip buttons

### Requirement 2: Offline Tile Loading

**User Story:** As a user, I want the map to work without internet connection, so that I can track trips in areas with poor connectivity.

#### Acceptance Criteria

1. WHEN the map component initializes THEN the system SHALL configure Leaflet to load tiles from the local file path C:\MobilityTripTracker1\MapData\sf_tiles
2. WHEN loading map tiles THEN the system SHALL use the tile path pattern {z}/{x}/{y}.png where z=zoom level, x=longitude tile coordinate, y=latitude tile coordinate
3. WHEN a required tile is not found in the local tile directory THEN the system SHALL display a placeholder or blank tile
4. WHEN the map viewport changes THEN the system SHALL load only the tiles visible in the current map bounds
5. WHEN the user zooms in or out THEN the system SHALL attempt to load tiles at the requested zoom level from the local tile directory

### Requirement 3: Current Location Display

**User Story:** As a user, I want to see my current position on the map, so that I know where I am during my trip.

#### Acceptance Criteria

1. WHEN GPS location updates are received THEN the system SHALL display a Current Location Marker on the map
2. WHEN displaying the Current Location Marker THEN the system SHALL position it at the user's current GPS coordinates
3. WHEN GPS location updates THEN the system SHALL update the Current Location Marker position smoothly
4. WHEN the Current Location Marker is displayed THEN the system SHALL use a visually distinct icon or color
5. WHEN GPS accuracy is available THEN the system SHALL display an accuracy circle around the Current Location Marker

### Requirement 4: Route Visualization

**User Story:** As a user, I want to see the path I've traveled on the map, so that I can visualize my route in real-time.

#### Acceptance Criteria

1. WHEN GPS location points are captured during a trip THEN the system SHALL draw a Route Polyline connecting the points
2. WHEN new GPS points are added THEN the system SHALL extend the Route Polyline to include the new points
3. WHEN displaying the Route Polyline THEN the system SHALL use a visually distinct color and width
4. WHEN the trip is paused THEN the system SHALL stop extending the Route Polyline
5. WHEN the trip is resumed THEN the system SHALL continue extending the Route Polyline from the last point

### Requirement 5: Map Interaction

**User Story:** As a user, I want to interact with the map, so that I can explore my route and surroundings.

#### Acceptance Criteria

1. WHEN the map is displayed THEN the system SHALL allow the user to pan the map by dragging
2. WHEN the map is displayed THEN the system SHALL allow the user to zoom using pinch gestures
3. WHEN the user pans or zooms THEN the system SHALL load appropriate tiles for the new viewport
4. WHEN the map is interacted with THEN the system SHALL maintain the Current Location Marker and Route Polyline visibility
5. WHEN the user has panned away from their current location THEN the system SHALL provide a button to re-center the map on the current location

### Requirement 6: Map Performance

**User Story:** As a user, I want the map to perform smoothly, so that it doesn't drain my battery or slow down the app.

#### Acceptance Criteria

1. WHEN loading map tiles THEN the system SHALL cache loaded tiles in memory to avoid redundant file reads
2. WHEN GPS updates are received THEN the system SHALL throttle map updates to a maximum of once per second
3. WHEN the Route Polyline contains more than 1000 points THEN the system SHALL simplify the polyline for rendering performance
4. WHEN the map is not visible THEN the system SHALL pause map rendering updates
5. WHEN the trip ends THEN the system SHALL clean up map resources and remove event listeners

### Requirement 7: Map Component Integration

**User Story:** As a developer, I want the map component to integrate cleanly with existing trip recording functionality, so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN the map component is created THEN the system SHALL accept GPS location updates from the existing GPSService
2. WHEN the map component receives location updates THEN the system SHALL not interfere with existing trip recording logic
3. WHEN the trip is paused or resumed THEN the system SHALL receive state updates from the existing TripService
4. WHEN the map component is unmounted THEN the system SHALL properly clean up all map resources
5. WHEN the map component encounters errors THEN the system SHALL display error messages using the existing ToastContext

### Requirement 8: Timer Component Removal

**User Story:** As a developer, I want to remove the obsolete timer functionality, so that the codebase remains clean and maintainable.

#### Acceptance Criteria

1. ✅ COMPLETED: The TripTimer component has been removed from the codebase
2. ✅ COMPLETED: All imports and references to the TripTimer component have been removed from ActiveTripScreen and TripScreen
3. ✅ COMPLETED: Timer-related state management has been removed from the ActiveTripScreen
4. ✅ COMPLETED: The Active Trip Page displays a map instead of timer or duration information
