# Requirements Document

## Introduction

This feature adds real-time obstacle visualization to the RollTracks Active Trip Page. The system displays point features (curb ramps) from a local GeoJSON file on the map during an active trip. Only obstacles within 20 meters of the user's current location are loaded and displayed, optimizing performance and providing relevant contextual information to users during their mobility trips.

## Glossary

- **RollTracks**: The mobile application system for tracking mobility trips
- **Active Trip Page**: The screen displayed while a trip is being recorded
- **Obstacle**: A point feature representing a physical object or location of interest (e.g., curb ramp, barrier, hazard)
- **GeoJSON File**: A standard geospatial data format containing geographic features with geometries and properties
- **Feature Layer**: A collection of geographic features (points, lines, or polygons) displayed on a map
- **Proximity Filter**: A spatial filter that selects features within a specified distance of a reference point
- **Current Location**: The user's real-time GPS position
- **Point Feature**: A geographic feature represented by a single coordinate pair (latitude, longitude)
- **Asset Bundling**: The process of including data files in the compiled Android APK for offline access
- **Curb Ramp**: A sloped connection between a sidewalk and street, represented as a point feature in the dataset
- **Spatial Index**: A data structure that optimizes spatial queries for nearby features

## Requirements

### Requirement 1: GeoJSON File Loading

**User Story:** As a user, I want the app to load obstacle data from a local file, so that I can see obstacles without requiring internet connectivity.

#### Acceptance Criteria

1. WHEN the Active Trip Page initializes THEN the system SHALL load the GeoJSON file from the bundled asset path
2. WHEN loading the GeoJSON file THEN the system SHALL parse point features with latitude, longitude, and attribute data
3. WHEN the GeoJSON file is missing or corrupted THEN the system SHALL log an error and continue trip functionality without obstacle display
4. WHEN the GeoJSON file loads successfully THEN the system SHALL store features in memory for spatial queries
5. WHEN the GeoJSON file contains invalid coordinates THEN the system SHALL skip invalid features and load valid ones

### Requirement 2: Asset Bundling for Android

**User Story:** As a developer, I want the GeoJSON file bundled in the Android APK, so that users can access obstacle data offline.

#### Acceptance Criteria

1. WHEN building the Android APK THEN the system SHALL include the GeoJSON file from C:\MobilityTripTracker1\MapData\curb_ramps.geojson in the assets directory
2. WHEN the app runs on Android THEN the system SHALL access the GeoJSON file from the bundled assets using the React Native asset system
3. WHEN the asset path is configured THEN the system SHALL use a platform-agnostic path resolution mechanism
4. WHEN the APK is built THEN the system SHALL verify the GeoJSON file is included and accessible

### Requirement 3: Proximity-Based Feature Filtering

**User Story:** As a user, I want to see only nearby obstacles, so that the map remains uncluttered and performance stays optimal.

#### Acceptance Criteria

1. WHEN the user's location updates THEN the system SHALL query features within 20 meters of the current location
2. WHEN calculating proximity THEN the system SHALL use the Haversine formula for accurate distance measurement
3. WHEN no features exist within 20 meters THEN the system SHALL display no obstacle markers
4. WHEN multiple features exist within 20 meters THEN the system SHALL display all matching features
5. WHEN the user moves THEN the system SHALL update the displayed features based on the new location

### Requirement 4: Obstacle Marker Display

**User Story:** As a user, I want to see obstacle markers on the map, so that I can identify nearby curb ramps and plan my route accordingly.

#### Acceptance Criteria

1. WHEN features are within proximity range THEN the system SHALL display markers on the map at feature coordinates
2. WHEN displaying obstacle markers THEN the system SHALL use a distinct icon different from the current location marker
3. WHEN displaying obstacle markers THEN the system SHALL use a distinct color to differentiate from the route polyline
4. WHEN obstacle markers are displayed THEN the system SHALL ensure they do not obscure the current location marker
5. WHEN the map is zoomed or panned THEN the system SHALL maintain obstacle marker visibility and positioning

### Requirement 5: Performance Optimization

**User Story:** As a user, I want obstacle display to be performant, so that it doesn't slow down the app or drain my battery.

#### Acceptance Criteria

1. WHEN querying nearby features THEN the system SHALL complete the query in less than 100 milliseconds
2. WHEN location updates occur THEN the system SHALL throttle obstacle queries to a maximum of once per second
3. WHEN more than 50 features are within range THEN the system SHALL limit display to the closest 50 features
4. WHEN the Active Trip Page is not visible THEN the system SHALL pause obstacle queries
5. WHEN the trip ends THEN the system SHALL release all obstacle data from memory

### Requirement 6: Integration with Existing Map

**User Story:** As a developer, I want obstacle visualization to integrate seamlessly with the existing map component, so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN the MapView component renders THEN the system SHALL add obstacle markers to the existing Leaflet map instance
2. WHEN obstacle data updates THEN the system SHALL not interfere with existing location tracking or route visualization
3. WHEN the map component unmounts THEN the system SHALL clean up all obstacle markers and event listeners
4. WHEN map errors occur THEN the system SHALL handle them using the existing ToastContext
5. WHEN obstacle features are displayed THEN the system SHALL maintain all existing map interaction capabilities (pan, zoom, re-center)

### Requirement 7: GeoJSON File Parsing

**User Story:** As a developer, I want to parse GeoJSON files efficiently, so that obstacle data loads quickly without blocking the UI.

#### Acceptance Criteria

1. WHEN parsing the GeoJSON file THEN the system SHALL use native JavaScript JSON parsing
2. WHEN parsing the GeoJSON file THEN the system SHALL extract latitude, longitude from geometry coordinates and properties as attributes
3. WHEN parsing large GeoJSON files THEN the system SHALL parse asynchronously to avoid blocking the UI thread
4. WHEN parsing completes THEN the system SHALL notify the map component that obstacle data is ready
5. WHEN parsing fails THEN the system SHALL provide a descriptive error message indicating the failure reason

### Requirement 8: Spatial Query Efficiency

**User Story:** As a developer, I want spatial queries to be efficient, so that the app remains responsive during trips.

#### Acceptance Criteria

1. WHEN the GeoJSON file loads THEN the system SHALL build a spatial index for efficient proximity queries
2. WHEN querying nearby features THEN the system SHALL use the spatial index rather than iterating all features
3. WHEN the spatial index is unavailable THEN the system SHALL fall back to linear search with acceptable performance
4. WHEN features are queried multiple times THEN the system SHALL cache query results for the current location
5. WHEN the user moves more than 10 meters THEN the system SHALL invalidate the query cache and perform a new query
