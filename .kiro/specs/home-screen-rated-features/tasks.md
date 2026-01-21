# Implementation Plan: Home Screen with Rated Features

## Overview

This implementation plan breaks down the Home Screen feature into discrete coding tasks. The approach follows an incremental strategy: first establishing the navigation structure and basic screen, then implementing data processing logic, followed by map integration and marker rendering, and finally adding polish with loading/error states and testing.

## Tasks

- [x] 1. Set up HomeScreen component and navigation integration
  - Create `src/screens/HomeScreen.tsx` with basic component structure
  - Add HomeScreen to bottom tab navigator between Record and History tabs
  - Configure tab icon and label for Home tab
  - Verify navigation works by tapping the Home tab
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 2. Implement data fetching and processing logic
  - [x] 2.1 Create data processing utilities
    - Implement `processRatings()` function to group ratings by feature_id and find most recent
    - Implement `calculateMapRegion()` function to determine map bounds from features
    - Implement `getMarkerColor()` function to map rating values to colors
    - _Requirements: 2.5, 3.1, 3.2, 6.2_
  
  - [ ]* 2.2 Write property test for unique marker per feature
    - **Property 1: Unique Marker Per Feature**
    - **Validates: Requirements 2.3, 2.4**
  
  - [ ]* 2.3 Write property test for most recent rating selection
    - **Property 4: Most Recent Rating Selection**
    - **Validates: Requirements 3.4, 6.2**
  
  - [ ]* 2.4 Write unit tests for data processing utilities
    - Test processRatings with empty array, single rating, multiple ratings per feature
    - Test calculateMapRegion with various coordinate sets
    - Test getMarkerColor for all rating ranges (1-3, 4-6, 7-10)
    - _Requirements: 2.5, 3.1, 3.2, 6.2_

- [x] 3. Integrate RatingService and implement state management
  - Add state management using React hooks (useState, useEffect, useMemo)
  - Implement `fetchRatedFeatures()` to call RatingService.getAllRatings()
  - Process fetched ratings using processRatings utility
  - Add loading, error, and data states to component
  - Implement data fetching on component mount and when screen gains focus
  - _Requirements: 2.2, 5.1, 6.3, 6.4_

- [ ]* 3.1 Write unit tests for data fetching and state management
  - Test fetchRatedFeatures calls RatingService.getAllRatings()
  - Test loading state is set during fetch
  - Test error state is set on fetch failure
  - Test data is processed correctly after successful fetch
  - _Requirements: 2.2, 5.1_

- [ ] 4. Implement map display with MapViewMapbox
  - [x] 4.1 Integrate MapViewMapbox component into HomeScreen
    - Add MapViewMapbox to HomeScreen render
    - Pass calculated map region to MapViewMapbox
    - Configure map to allow pan and zoom interactions
    - Handle default region when no rated features exist
    - _Requirements: 2.1, 2.5, 2.6, 7.1, 7.2_
  
  - [ ]* 4.2 Write property test for map region encompasses all features
    - **Property 2: Map Region Encompasses All Features**
    - **Validates: Requirements 2.5**
  
  - [ ]* 4.3 Write unit tests for map integration
    - Test MapViewMapbox is rendered with correct props
    - Test default region is used when ratings array is empty
    - Test map region updates when ratings change
    - _Requirements: 2.1, 2.5, 2.6_

- [ ] 5. Create and render feature markers
  - [ ] 5.1 Create FeatureMarker component
    - Implement custom marker component with color-coded circular design
    - Add white border for visibility
    - Make marker tappable with onPress handler
    - Size marker appropriately (30x30 pixels with 44x44 touch target)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 5.2 Render markers on map for all processed features
    - Map over processedFeatures array to render FeatureMarker components
    - Pass feature data and onPress handler to each marker
    - Ensure markers display at correct coordinates
    - _Requirements: 2.3, 2.4, 3.4_
  
  - [ ]* 5.3 Write property test for marker color matches rating range
    - **Property 3: Marker Color Matches Rating Range**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 5.4 Write unit tests for FeatureMarker component
    - Test marker renders with correct color for different ratings
    - Test marker is tappable and calls onPress handler
    - Test marker displays at correct coordinates
    - _Requirements: 3.1, 3.2_

- [ ] 6. Implement marker interaction and navigation
  - [ ] 6.1 Implement handleMarkerPress function
    - Extract trip_id from tapped feature's most recent rating
    - Navigate to TripHistoryScreen with trip_id parameter
    - Handle navigation errors gracefully
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 6.2 Write property test for navigation includes correct trip ID
    - **Property 5: Navigation Includes Correct Trip ID**
    - **Validates: Requirements 4.1, 4.3**
  
  - [ ]* 6.3 Write unit tests for marker interaction
    - Test handleMarkerPress extracts correct trip_id
    - Test navigation is called with correct parameters
    - Test navigation error handling
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Checkpoint - Ensure core functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement loading, empty, and error states
  - [x] 8.1 Create loading state UI
    - Display loading indicator while fetching ratings
    - Center loading indicator on screen
    - _Requirements: 5.1_
  
  - [x] 8.2 Create empty state UI
    - Display empty state message when no ratings exist
    - Provide helpful guidance on how to rate features
    - Show map with default region in background
    - _Requirements: 5.2_
  
  - [x] 8.3 Create error state UI
    - Display error message when fetch fails
    - Add "Retry" button to refetch data
    - Implement retry functionality
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 8.4 Write unit tests for UI states
    - Test loading indicator displays during fetch
    - Test empty state displays with zero ratings
    - Test error state displays on fetch failure
    - Test retry button triggers refetch
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Add performance optimizations and polish
  - Memoize processedFeatures using useMemo to avoid recalculation
  - Memoize calculateMapRegion result
  - Use useCallback for event handlers (handleMarkerPress)
  - Add accessibility labels to markers for screen readers
  - Ensure minimum touch target size for markers (44x44 points)
  - _Requirements: 6.1, 7.3_

- [x] 10. Update TripHistoryScreen to handle highlightTripId parameter
  - Modify TripHistoryScreen to accept optional highlightTripId route parameter
  - Implement logic to scroll to or highlight the specified trip when parameter is provided
  - Test navigation from HomeScreen to TripHistoryScreen with trip highlighting
  - _Requirements: 4.4_

- [x] 11. Final checkpoint - Integration testing
  - Test complete user flow: open Home tab → see rated features → tap marker → navigate to trip history
  - Test with various data scenarios: empty ratings, single rating, many ratings
  - Test offline mode functionality
  - Test navigation back to Home tab preserves map state
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.3, 7.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples, edge cases, and component integration
- Checkpoints ensure incremental validation of functionality
- All property tests should run minimum 100 iterations
- Property tests must include tag comments referencing design properties
