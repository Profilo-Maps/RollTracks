# Implementation Plan

- [x] 1. Create type definitions and interfaces


  - Add RatedFeature interface to src/types/index.ts
  - Add ObstacleFeatureWithRating interface for UI state
  - Add RatingModalProps and FeaturePopupProps interfaces
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_

- [ ] 2. Extend LocalStorageAdapter with rated feature storage
  - [x] 2.1 Add RATED_FEATURES storage key constant


    - Add `@rolltracks:rated_features` to STORAGE_KEYS
    - _Requirements: 6.3_

  - [x] 2.2 Implement getRatedFeatures method


    - Read from AsyncStorage and parse JSON array
    - Return empty array if no data exists
    - Handle parsing errors gracefully
    - _Requirements: 5.5_

  - [x] 2.3 Implement saveRatedFeature method


    - Load existing rated features
    - Check if feature already exists for this trip
    - Add or update the feature in the array
    - Save back to AsyncStorage
    - _Requirements: 2.5_

  - [x] 2.4 Implement getRatedFeaturesForTrip method


    - Load all rated features
    - Filter by tripId
    - Return filtered array
    - _Requirements: 5.4_

  - [x] 2.5 Implement updateRatedFeature method


    - Load all rated features
    - Find feature by featureId and tripId
    - Update rating value while preserving timestamp
    - Save back to AsyncStorage
    - _Requirements: 3.3_

  - [ ]* 2.6 Write property test for storage round-trip
    - **Property 10: Storage round-trip consistency**
    - **Validates: Requirements 2.5**

  - [ ]* 2.7 Write property test for trip filtering
    - **Property 20: Trip-specific retrieval filtering**
    - **Validates: Requirements 5.4**

  - [ ]* 2.8 Write property test for storage isolation
    - **Property 22: Storage key isolation**
    - **Validates: Requirements 6.3**

- [ ] 3. Implement RatingService
  - [x] 3.1 Create RatingService class with constructor


    - Accept StorageAdapter in constructor
    - Initialize with dependency injection pattern
    - _Requirements: 6.1, 6.2_

  - [x] 3.2 Implement createRating method


    - Validate rating is between 1-10
    - Validate feature has required properties
    - Create RatedFeature object with all properties
    - Add userRating, tripId, and timestamp
    - Convert coordinates to GeoJSON format [lon, lat]
    - Call storageAdapter.saveRatedFeature
    - Return created RatedFeature
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_

  - [x] 3.3 Implement getRatingsForTrip method


    - Call storageAdapter.getRatedFeaturesForTrip
    - Return filtered results
    - _Requirements: 5.4_

  - [x] 3.4 Implement getRatingForFeature method


    - Get all ratings for trip
    - Find rating matching featureId
    - Return rating or null
    - _Requirements: 3.1_

  - [x] 3.5 Implement updateRating method


    - Validate new rating is between 1-10
    - Call storageAdapter.updateRatedFeature
    - Return updated RatedFeature
    - _Requirements: 3.3_

  - [x] 3.6 Implement getAllRatings method


    - Call storageAdapter.getRatedFeatures
    - Return all ratings
    - _Requirements: 5.5_

  - [x] 3.7 Implement exportAsGeoJSON method



    - Get all rated features
    - Format as GeoJSON FeatureCollection
    - Return JSON string
    - _Requirements: 5.1_

  - [ ]* 3.8 Write property test for property preservation
    - **Property 6: Property preservation on rating creation**
    - **Validates: Requirements 2.1, 5.2**

  - [ ]* 3.9 Write property test for rating value storage
    - **Property 7: Rating value storage**
    - **Validates: Requirements 2.2**

  - [ ]* 3.10 Write property test for GeoJSON format compliance
    - **Property 18: GeoJSON format compliance**
    - **Validates: Requirements 5.1**

  - [ ]* 3.11 Write property test for coordinate format
    - **Property 19: Coordinate format validation**
    - **Validates: Requirements 5.3**

  - [ ]* 3.12 Write unit tests for RatingService methods
    - Test createRating with valid inputs
    - Test createRating with invalid rating values (0, 11, -1)
    - Test getRatingsForTrip with empty storage
    - Test updateRating for existing features
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_

- [ ] 4. Create RatingModal component
  - [x] 4.1 Create RatingModal component file


    - Create src/components/RatingModal.tsx
    - Set up component with props interface
    - Add to src/components/index.ts exports
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 4.2 Implement modal UI structure

    - Use React Native Modal component
    - Add "Accessibility Rating" title
    - Add slider component from @react-native-community/slider
    - Set slider min=1, max=10, step=1
    - Display current slider value as text
    - Add Submit and Cancel buttons
    - Style with consistent app styling
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 4.3 Implement slider state and handlers

    - Track slider value in local state
    - Initialize with initialRating prop if provided
    - Update displayed value when slider changes
    - Call onSubmit with final value
    - Call onCancel when cancelled
    - _Requirements: 1.5_

  - [x] 4.4 Add accessibility labels

    - Add accessibility labels to slider
    - Add accessibility labels to buttons
    - Ensure 44x44pt touch targets
    - _Requirements: 1.3, 1.4_

  - [ ]* 4.5 Write unit tests for RatingModal
    - Test modal renders with correct title
    - Test slider bounds (min=1, max=10)
    - Test value display updates with slider
    - Test submit and cancel callbacks
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 5. Create FeaturePopup component
  - [x] 5.1 Create FeaturePopup component file


    - Create src/components/FeaturePopup.tsx
    - Set up component with props interface
    - Add to src/components/index.ts exports
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Implement popup UI structure

    - Use React Native Modal component
    - Display feature properties in scrollable view
    - Format properties as key-value pairs
    - Add "Rate Feature" or "Update Rating" button based on rating state
    - Add Close button
    - Style with consistent app styling
    - _Requirements: 1.1, 1.2, 3.2_

  - [x] 5.3 Implement conditional button text

    - Check if feature.isRated or feature.rating exists
    - Display "Update Rating" if rated, "Rate Feature" if not
    - Show existing rating value if present
    - _Requirements: 3.1, 3.2_

  - [x] 5.4 Add accessibility labels


    - Add accessibility labels to buttons
    - Add accessibility role to modal
    - Ensure proper focus management
    - _Requirements: 1.1, 1.2_

  - [ ]* 5.5 Write unit tests for FeaturePopup
    - Test popup renders with feature data
    - Test "Rate Feature" button appears for unrated features
    - Test "Update Rating" button appears for rated features
    - Test existing rating displays correctly
    - _Requirements: 1.1, 1.2, 3.1, 3.2_

- [ ] 6. Extend MapView component for feature interaction
  - [x] 6.1 Add obstacle marker tap handling


    - Add onPress handler to obstacle markers
    - Pass tapped feature to parent component
    - Ensure markers are touchable
    - _Requirements: 1.1_

  - [x] 6.2 Add visual distinction for rated features

    - Accept ratedFeatureIds prop
    - Render rated features with different color/style
    - Use distinct marker icon or color for rated features
    - _Requirements: 3.4, 4.2_

  - [x] 6.3 Update MapView props interface

    - Add onFeatureTap callback prop
    - Add ratedFeatureIds array prop
    - Update component documentation
    - _Requirements: 1.1, 3.4_

- [ ] 7. Integrate rating feature into Active Trip Screen
  - [x] 7.1 Initialize RatingService in Active Trip Screen


    - Import RatingService
    - Create instance with storageAdapter
    - Initialize in useEffect
    - _Requirements: 6.4_

  - [x] 7.2 Add state for feature popup and rating modal

    - Add selectedFeature state
    - Add showFeaturePopup state
    - Add showRatingModal state
    - Add ratedFeatureIds state
    - _Requirements: 1.1, 1.3_

  - [x] 7.3 Load existing ratings for current trip


    - Call ratingService.getRatingsForTrip on mount
    - Extract feature IDs from ratings
    - Update ratedFeatureIds state
    - Pass to MapView for visual distinction
    - _Requirements: 3.1, 3.4_

  - [x] 7.4 Implement feature tap handler


    - Handle onFeatureTap from MapView
    - Check if feature is already rated
    - Set selectedFeature state
    - Show feature popup
    - _Requirements: 1.1_

  - [x] 7.5 Implement rate button handler

    - Open rating modal when "Rate Feature" tapped
    - Pass existing rating if updating
    - _Requirements: 1.3_

  - [x] 7.6 Implement rating submission handler

    - Call ratingService.createRating or updateRating
    - Update ratedFeatureIds state
    - Close modals
    - Show success toast
    - Refresh nearby obstacles to show updated styling
    - _Requirements: 2.5, 3.3, 3.5_

  - [x] 7.7 Handle errors gracefully

    - Catch and display errors from rating operations
    - Show user-friendly error messages
    - Log errors for debugging
    - _Requirements: 2.5_

  - [ ]* 7.8 Write property test for pre-navigation persistence
    - **Property 23: Pre-navigation persistence**
    - **Validates: Requirements 6.5**

- [x] 8. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integrate rating display into Trip Summary Screen
  - [x] 9.1 Load rated features for trip


    - Import RatingService
    - Create instance with storageAdapter
    - Call getRatingsForTrip with trip.id
    - Store in state
    - _Requirements: 4.1_

  - [x] 9.2 Convert rated features to map markers

    - Transform RatedFeature[] to marker format
    - Extract coordinates from geometry
    - Prepare for MapView display
    - _Requirements: 4.1, 4.2_

  - [x] 9.3 Pass rated features to MapView


    - Add ratedFeatures prop to MapView
    - Render with distinct markers
    - Ensure markers are tappable
    - _Requirements: 4.1, 4.2_

  - [x] 9.4 Implement rated feature tap handler

    - Handle tap on rated feature marker
    - Show FeaturePopup with all properties
    - Display userRating prominently
    - _Requirements: 4.3, 4.4_

  - [x] 9.5 Handle empty state

    - Check if rated features array is empty
    - Display only route if no ratings
    - Don't show error for empty ratings
    - _Requirements: 4.5_

  - [ ]* 9.6 Write integration test for complete rating flow
    - Create trip → rate feature → verify storage → end trip → verify summary display
    - _Requirements: 2.5, 4.1, 4.3, 6.5_

- [x] 10. Final checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.
