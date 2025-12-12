# Implementation Plan

- [ ] 1. Install dependencies and setup asset bundling

- [x] 1.1 Install Parquet parsing library


  - Add parquetjs package to dependencies
  - Test basic Parquet parsing functionality
  - Verify compatibility with React Native
  - _Requirements: 7.1_

- [x] 1.2 Create asset bundling script


  - Create scripts/copy-geojson-to-assets.js script
  - Copy curb_ramps.geojson to android/app/src/main/assets/
  - Add copy-geojson script to package.json
  - Update prebuild script to include GeoJSON copying
  - _Requirements: 2.1_

- [x] 1.3 Configure Android asset access


  - Update android/app/build.gradle to include assets directory
  - Test asset accessibility in Android build
  - _Requirements: 2.2_

- [x] 1.4 Write unit tests for asset bundling


  - Test script copies file correctly
  - Test file exists in assets directory after build

- [ ] 2. Implement ObstacleService core functionality

- [x] 2.1 Create ObstacleService class structure


  - Create src/services/ObstacleService.ts
  - Define ObstacleFeature interface
  - Define ProximityQuery interface
  - Implement class skeleton with initialize, queryNearby, cleanup methods
  - _Requirements: 1.1, 1.4_

- [x] 2.2 Implement Parquet file loading


  - Implement platform-specific path resolution
  - Implement file loading using fetch API
  - Parse Parquet file using parquetjs
  - Extract latitude, longitude, and attribute columns
  - Handle missing or corrupted files gracefully
  - _Requirements: 1.1, 1.2, 1.3, 7.2, 7.3_

- [ ] 2.3 Write property test for Parquet parsing
  - **Property 1: Parquet parsing extracts all valid features**
  - **Validates: Requirements 1.2, 7.2**

- [ ] 2.4 Write property test for invalid coordinate filtering
  - **Property 2: Invalid coordinates are filtered**
  - **Validates: Requirements 1.5**

- [ ] 2.5 Write property test for queryability after load
  - **Property 3: Successful load enables spatial queries**
  - **Validates: Requirements 1.4**

- [ ] 2.6 Write property test for path resolution
  - **Property 4: Platform-agnostic path resolution**
  - **Validates: Requirements 2.3**

- [ ] 2.7 Write unit tests for error handling
  - Test missing file handling
  - Test corrupted file handling
  - Test parse error handling

- [ ] 3. Implement Haversine distance calculation

- [x] 3.1 Implement Haversine formula

  - Create calculateDistance method in ObstacleService
  - Implement Haversine formula for distance calculation
  - Return distance in meters
  - Handle edge cases (same point, antipodal points)
  - _Requirements: 3.2_

- [ ] 3.2 Write property test for Haversine accuracy
  - **Property 6: Haversine distance accuracy**
  - **Validates: Requirements 3.2**

- [ ] 3.3 Write unit tests for distance calculation
  - Test known coordinate pairs
  - Test edge cases (equator, poles, date line)

- [ ] 4. Implement SpatialGrid index

- [x] 4.1 Create SpatialGrid class


  - Create src/services/SpatialGrid.ts
  - Define GridCell interface
  - Implement constructor with feature indexing
  - Implement getCellKey method
  - _Requirements: 8.1_

- [x] 4.2 Implement spatial query logic

  - Implement getNearbyCells method
  - Implement queryNearby method
  - Filter candidates by actual distance
  - Handle grid boundary edge cases
  - _Requirements: 8.1, 8.2_

- [ ] 4.3 Write unit tests for SpatialGrid
  - Test cell key generation
  - Test feature indexing
  - Test nearby cell calculation
  - Test query correctness

- [ ] 5. Implement proximity queries in ObstacleService

- [x] 5.1 Integrate SpatialGrid with ObstacleService


  - Build spatial index after Parquet load
  - Implement queryNearby using spatial index
  - Fall back to linear search if index unavailable
  - Filter results to 20-meter radius
  - _Requirements: 3.1, 8.1, 8.3_

- [ ] 5.2 Write property test for proximity queries
  - **Property 5: Proximity queries return only nearby features**
  - **Validates: Requirements 3.1, 3.4**

- [ ] 5.3 Write property test for query performance
  - **Property 10: Query performance under 100ms**
  - **Validates: Requirements 5.1**

- [ ] 6. Implement query caching

- [x] 6.1 Add cache to ObstacleService

  - Create Map-based cache for query results
  - Implement cache key generation (rounded coordinates)
  - Implement cache lookup in queryNearby
  - Implement LRU eviction (max 10 entries)
  - _Requirements: 8.4_

- [x] 6.2 Implement cache invalidation

  - Calculate distance from cached location
  - Invalidate cache if moved > 10 meters
  - Clear cache on cleanup
  - _Requirements: 8.5_

- [ ] 6.3 Write property test for caching
  - **Property 17: Query result caching**
  - **Validates: Requirements 8.4**

- [ ] 6.4 Write property test for cache invalidation
  - **Property 18: Cache invalidation on movement**
  - **Validates: Requirements 8.5**

- [ ] 7. Implement result limiting and throttling

- [x] 7.1 Add result limiting to queryNearby

  - Sort results by distance
  - Limit to closest 50 features
  - _Requirements: 5.3_

- [ ] 7.2 Write property test for result limiting
  - **Property 12: Result limiting to 50 features**
  - **Validates: Requirements 5.3**

- [ ] 8. Update MapView component for obstacles

- [x] 8.1 Add obstacle props to MapView


  - Add obstacleFeatures prop to MapViewProps interface
  - Add updateObstacles message type to MapMessage
  - _Requirements: 6.1_

- [x] 8.2 Implement obstacle message sending


  - Send updateObstacles message when obstacleFeatures prop changes
  - Throttle obstacle updates to once per second
  - Only send when map is ready and visible
  - _Requirements: 5.2, 5.4_

- [ ] 8.3 Write property test for query throttling
  - **Property 11: Query throttling to once per second**
  - **Validates: Requirements 5.2**

- [ ] 8.4 Write property test for visibility-based pausing
  - **Property 13: Visibility-based query pausing**
  - **Validates: Requirements 5.4**

- [ ] 9. Update Leaflet HTML for obstacle markers

- [x] 9.1 Add obstacle marker rendering to Leaflet


  - Create obstacleMarkers array in Leaflet HTML
  - Implement updateObstacles function
  - Clear existing markers before adding new ones
  - Create circle markers with distinct color (orange)
  - Add markers to map
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 9.2 Add obstacle marker popups

  - Implement formatAttributes function
  - Bind popups to obstacle markers
  - Display feature attributes in popup
  - _Requirements: 4.1_

- [x] 9.3 Handle obstacle message in Leaflet


  - Add updateObstacles case to message handler
  - Call updateObstacles function with payload
  - _Requirements: 6.1_

- [ ] 9.4 Write property test for marker positioning
  - **Property 8: Markers positioned at feature coordinates**
  - **Validates: Requirements 4.1**

- [ ] 9.5 Write property test for marker persistence
  - **Property 9: Map interactions preserve obstacle markers**
  - **Validates: Requirements 4.5**

- [ ] 10. Integrate ObstacleService with ActiveTripScreen

- [x] 10.1 Initialize ObstacleService in ActiveTripScreen


  - Import ObstacleService
  - Create service instance
  - Call initialize on component mount
  - Handle initialization errors with toast
  - Call cleanup on component unmount
  - _Requirements: 6.1, 5.5_

- [x] 10.2 Query obstacles on location updates


  - Add nearbyObstacles state
  - Query ObstacleService when currentLocation updates
  - Update nearbyObstacles state with results
  - _Requirements: 3.1, 3.5_

- [x] 10.3 Pass obstacles to MapView


  - Add obstacleFeatures prop to MapView
  - Pass nearbyObstacles state to MapView
  - _Requirements: 6.1_

- [ ] 10.4 Write property test for location update triggering
  - **Property 7: Location updates trigger feature updates**
  - **Validates: Requirements 3.5**

- [ ] 10.5 Write integration tests for ActiveTripScreen
  - Test ObstacleService initialization
  - Test location updates trigger queries
  - Test obstacles passed to MapView
  - Test cleanup on unmount

- [ ] 11. Implement error handling and cleanup

- [x] 11.1 Add error handling to ObstacleService

  - Handle file not found errors
  - Handle parse errors
  - Handle query errors
  - Log errors with details
  - Continue functionality without obstacles on error
  - _Requirements: 1.3, 7.5_

- [x] 11.2 Implement cleanup in ObstacleService

  - Clear features array
  - Clear spatial index
  - Clear query cache
  - Set isInitialized to false
  - _Requirements: 5.5_

- [x] 11.3 Add error handling to MapView

  - Handle obstacle update errors
  - Log errors to console
  - Continue map functionality on error
  - _Requirements: 6.4_

- [ ] 11.4 Write unit tests for error handling
  - Test missing file error handling
  - Test parse error handling
  - Test query error handling
  - Test cleanup

- [ ] 12. Test integration and verify correctness

- [ ] 12.1 Write property test for map element preservation
  - **Property 14: Obstacle updates preserve existing map elements**
  - **Validates: Requirements 6.2**

- [ ] 12.2 Write property test for map interactions
  - **Property 15: Map interactions work with obstacles**
  - **Validates: Requirements 6.5**

- [ ] 12.3 Write property test for async parsing
  - **Property 16: Async parsing doesn't block UI**
  - **Validates: Requirements 7.3**

- [ ] 12.4 Write integration tests for MapView
  - Test obstacle markers render in WebView
  - Test markers cleared on update
  - Test markers persist through map interactions

- [ ] 12.5 Manual testing with real data
  - Test with actual curb_ramps.geojson file
  - Verify obstacles display near user location
  - Verify obstacles update as user moves
  - Verify performance is acceptable
  - Test on Android device
  - _Requirements: All_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Documentation and polish

- [x] 14.1 Update documentation


  - Document ObstacleService API
  - Document SpatialGrid usage
  - Document Parquet file format requirements
  - Update README with obstacle feature
  - Document asset bundling process
  - _Requirements: All_

- [x] 14.2 Add TypeScript exports


  - Export ObstacleService from src/services/index.ts
  - Export ObstacleFeature interface from src/types/index.ts
  - Ensure proper type definitions

- [x] 15. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
