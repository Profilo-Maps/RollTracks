# Implementation Plan

- [x] 1. Install dependencies and setup


  - Install react-native-webview package
  - Configure WebView permissions for file:// protocol access
  - Test WebView basic functionality
  - _Requirements: 2.1_

- [x] 2. Create MapView component with Leaflet integration

- [x] 2.1 Create MapView component structure


  - Create src/components/MapView.tsx with props interface
  - Implement WebView wrapper with Leaflet HTML template
  - Configure Leaflet to load from CDN (v1.9.4)
  - Set up basic map initialization at zoom level 17
  - _Requirements: 1.1, 1.3_

- [x] 2.2 Configure offline tile loading


  - Implement custom tile layer with local file path
  - Set tile URL pattern to file:///C:/MobilityTripTracker1/MapData/sf_tiles/{z}/{x}/{y}.png
  - Handle missing tiles with placeholder display
  - Configure zoom level support for all available tiles
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ]* 2.3 Write property test for tile URL generation
  - **Property 2: Tile URL pattern correctness**
  - **Validates: Requirements 2.2**

- [ ]* 2.4 Write property test for missing tile handling
  - **Property 3: Missing tile graceful handling**
  - **Validates: Requirements 2.3**

- [x] 3. Implement postMessage communication

- [x] 3.1 Create message protocol types

  - Define MapMessage and WebViewMessage TypeScript types
  - Implement message serialization/deserialization
  - Add message validation
  - _Requirements: 7.1_

- [x] 3.2 Implement React Native to WebView messaging

  - Send location updates via postMessage
  - Send route point additions via postMessage
  - Send map control commands (center, zoom, clear)
  - _Requirements: 3.1, 4.1_

- [x] 3.3 Implement WebView to React Native messaging

  - Handle mapReady event
  - Handle mapError events
  - Handle tileLoadError events
  - _Requirements: 7.5_

- [ ]* 3.4 Write unit tests for message protocol
  - Test message serialization/deserialization
  - Test message type validation
  - Test payload structure validation

- [x] 4. Implement current location marker

- [x] 4.1 Add location marker to Leaflet map

  - Create marker on map initialization
  - Update marker position on location updates
  - Use distinct icon/color for marker
  - _Requirements: 3.1, 3.2_

- [x] 4.2 Add accuracy circle display

  - Display circle around marker when accuracy available
  - Set circle radius based on accuracy value
  - Update circle on location updates
  - _Requirements: 3.5_

- [ ]* 4.3 Write property test for marker positioning
  - **Property 6: Location marker positioning**
  - **Validates: Requirements 3.1, 3.2**

- [ ]* 4.4 Write property test for accuracy circle
  - **Property 7: Accuracy circle display**
  - **Validates: Requirements 3.5**

- [x] 5. Implement route polyline visualization

- [x] 5.1 Create polyline on map

  - Initialize empty polyline on map load
  - Set polyline color and width
  - Add points to polyline as they arrive
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5.2 Handle pause/resume polyline behavior

  - Stop adding points when trip is paused
  - Resume adding points when trip is resumed
  - Maintain polyline continuity
  - _Requirements: 4.4, 4.5_

- [ ]* 5.3 Write property test for polyline construction
  - **Property 8: Route polyline construction**
  - **Validates: Requirements 4.1, 4.2**

- [ ]* 5.4 Write property test for pause/resume behavior
  - **Property 9: Pause/resume polyline behavior**
  - **Validates: Requirements 4.4, 4.5**

- [x] 6. Implement map interaction features

- [x] 6.1 Enable pan and zoom

  - Configure Leaflet for touch interactions
  - Enable dragging and pinch-to-zoom
  - Maintain marker and polyline visibility during interactions
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 6.2 Add re-center button

  - Create button to center map on current location
  - Show button when user pans away from location
  - Implement smooth animation to re-center
  - _Requirements: 5.5_

- [ ]* 6.3 Write property test for element preservation
  - **Property 10: Map interaction preserves elements**
  - **Validates: Requirements 5.4**

- [x] 7. Implement performance optimizations

- [x] 7.1 Add tile caching


  - Implement in-memory tile cache
  - Cache tiles after first load
  - Prevent redundant file system reads
  - _Requirements: 6.1_

- [x] 7.2 Add GPS update throttling


  - Throttle map updates to max 1 per second
  - Queue updates if arriving faster
  - Apply latest update after throttle period
  - _Requirements: 6.2_

- [x] 7.3 Add polyline simplification


  - Detect when polyline exceeds 1000 points
  - Apply Douglas-Peucker simplification algorithm
  - Maintain route shape while reducing points
  - _Requirements: 6.3_

- [x] 7.4 Implement visibility-based update pausing


  - Pause map updates when component not visible
  - Resume updates when component becomes visible
  - Track component visibility state
  - _Requirements: 6.4_

- [ ]* 7.5 Write property test for tile caching
  - **Property 11: Tile caching prevents redundant loads**
  - **Validates: Requirements 6.1**

- [ ]* 7.6 Write property test for GPS throttling
  - **Property 12: GPS update throttling**
  - **Validates: Requirements 6.2**

- [ ]* 7.7 Write property test for polyline simplification
  - **Property 13: Polyline simplification threshold**
  - **Validates: Requirements 6.3**

- [ ]* 7.8 Write property test for hidden map behavior
  - **Property 14: Hidden map pauses updates**
  - **Validates: Requirements 6.4**

- [x] 8. Integrate MapView with ActiveTripScreen

- [x] 8.1 Remove TripTimer component
  - Deleted src/components/TripTimer.tsx file
  - Removed TripTimer import from ActiveTripScreen and TripScreen
  - Removed TripTimer from component exports
  - Removed outdated TripScreen.tsx file
  - _Requirements: 8.1, 8.2_

- [x] 8.2 Add MapView to ActiveTripScreen


  - Import MapView component
  - Add state for currentLocation and routePoints
  - Subscribe to GPS updates from GPSService
  - Pass location data to MapView as props
  - _Requirements: 1.1, 7.1_

- [x] 8.3 Update ActiveTripScreen layout

  - Position MapView to fill available space
  - Ensure Transit Leg and End Trip buttons remain visible
  - Remove timer-related state and UI
  - Adjust styling for map container
  - _Requirements: 1.4, 8.3, 8.4_

- [x] 8.4 Handle trip state changes

  - Pass isPaused prop to MapView
  - Update MapView when trip pauses/resumes
  - Clean up MapView on trip end
  - _Requirements: 7.3_

- [ ]* 8.5 Write integration tests for ActiveTripScreen
  - Test MapView renders when trip starts
  - Test GPS updates flow to MapView
  - Test pause/resume affects MapView
  - Test cleanup on trip end

- [x] 9. Implement error handling and cleanup

- [x] 9.1 Add error handling to MapView


  - Handle WebView load failures
  - Handle tile loading errors
  - Display error messages via ToastContext
  - Provide fallback UI for critical errors
  - _Requirements: 7.5_

- [x] 9.2 Implement resource cleanup


  - Unsubscribe from GPS on unmount
  - Clear map instance on unmount
  - Remove event listeners
  - Release WebView resources
  - _Requirements: 6.5, 7.4_

- [ ]* 9.3 Write unit tests for error handling
  - Test WebView error handling
  - Test tile loading error handling
  - Test GPS error handling
  - Test cleanup on unmount

- [x] 10. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Final testing and polish


- [x] 11.1 Test with real GPS data


  - Test on device with actual GPS
  - Verify tile loading from local directory
  - Test with various zoom levels
  - Verify performance with long trips
  - _Requirements: All_

- [ ]* 11.2 Write property test for map initialization
  - **Property 1: Map initialization centers on GPS location**
  - **Validates: Requirements 1.2**

- [ ]* 11.3 Write property test for viewport tile loading
  - **Property 4: Viewport-based tile loading**
  - **Validates: Requirements 2.4, 5.3**

- [ ]* 11.4 Write property test for zoom level loading
  - **Property 5: Zoom level tile loading**
  - **Validates: Requirements 2.5**

- [x] 11.5 Update documentation


  - Document MapView component API
  - Document message protocol
  - Update README with map feature
  - Document tile directory structure

- [ ] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
