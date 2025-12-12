# Implementation Plan

- [x] 1. Update data models and types for RollTracks





  - Update Profile type to include `mode_list: Mode[]` instead of `vehicle_type`
  - Update Trip type to include `mode: Mode`, `boldness: number`, `purpose?: string`, `distance_miles: number | null`, `geometry: string | null`
  - Add `Mode` type enum with values: wheelchair, assisted_walking, skateboard, scooter, walking
  - Update TripStatus to include 'paused' state
  - Add `LocationPoint` interface for GPS data
  - _Requirements: 1.4, 4.3, 5.1, 5.3_

- [ ]* 1.1 Write property test for profile data model
  - **Property 1: Profile creation with valid data succeeds**
  - **Validates: Requirements 1.5, 1.6**

- [x] 2. Update LocalStorageAdapter for new data structures


  - Update profile storage to handle mode_list array
  - Update trip storage to handle new fields (mode, boldness, purpose, distance_miles, geometry)
  - Add storage key for temporary GPS points during active trip
  - Ensure backward compatibility with existing data
  - _Requirements: 10.1, 10.2_

- [ ]* 2.1 Write property test for storage round trip
  - **Property 3: Profile data round trip**
  - **Validates: Requirements 10.1, 10.3**

- [ ]* 2.2 Write property test for trip data round trip
  - **Property 13: Trip data round trip**
  - **Validates: Requirements 10.2**

- [x] 3. Create GPSService for location tracking



  - Install react-native-geolocation-service package
  - Implement requestPermissions() method
  - Implement startTracking() with location callback
  - Implement stopTracking() method
  - Implement pauseTracking() and resumeTracking() methods
  - Add location point validation (lat/lng bounds, accuracy threshold)
  - _Requirements: 5.2, 5.3, 6.1, 6.4, 11.1, 11.3_

- [x] 3.1 Implement polyline encoding and decoding


  - Install @mapbox/polyline or implement custom algorithm
  - Implement encodePolyline(points: LocationPoint[]): string
  - Implement decodePolyline(encoded: string): LocationPoint[]
  - Implement calculateDistance(points: LocationPoint[]): number (returns miles)
  - _Requirements: 7.2, 7.4, 12.2, 12.3, 12.4_

- [ ]* 3.2 Write property test for polyline round trip
  - **Property 11: Polyline round trip**
  - **Validates: Requirements 7.2, 12.2, 12.4**

- [ ]* 3.3 Write property test for GPS tracking lifecycle
  - **Property 9: GPS tracking lifecycle**
  - **Validates: Requirements 5.2, 5.3, 6.1, 6.4, 6.5**

- [x] 4. Create StatisticsService for calculations


  - Implement calculateAverageBoldness(trips: Trip[]): number
  - Implement calculateAverageTripLength(trips: Trip[]): number
  - Implement getProfileStatistics(profileId: string): Promise<Statistics>
  - Handle edge case of zero trips (return 0 or null)
  - _Requirements: 3.1, 3.3, 3.5_

- [ ]* 4.1 Write property test for statistics calculation
  - **Property 4: Statistics calculation correctness**
  - **Validates: Requirements 3.1, 3.3**

- [ ]* 4.2 Write property test for statistics formatting
  - **Property 5: Statistics formatting precision**
  - **Validates: Requirements 3.2, 3.4**

- [x] 5. Update ProfileService for new profile structure


  - Update createProfile() to accept mode_list instead of vehicle_type
  - Update updateProfile() to handle mode_list updates
  - Add validation for mode_list (must have at least one mode)
  - Integrate StatisticsService for getStatistics() method
  - _Requirements: 1.5, 2.8_

- [ ]* 5.1 Write property test for profile update
  - **Property 2: Profile update preserves identity**
  - **Validates: Requirements 2.8**

- [x] 6. Update TripService for new trip structure and GPS integration


  - Update startTrip() to accept mode, boldness, and optional purpose
  - Integrate GPSService to start tracking when trip starts
  - Implement pauseTrip() to pause GPS tracking
  - Implement resumeTrip() to resume GPS tracking
  - Update stopTrip() to encode polyline and calculate distance
  - Store GPS points temporarily during active trip
  - _Requirements: 5.1, 5.2, 6.1, 6.4, 7.1, 7.2, 7.3, 7.4_

- [ ]* 6.1 Write property test for trip creation
  - **Property 8: Trip creation with parameters**
  - **Validates: Requirements 5.1**

- [ ]* 6.2 Write property test for pause preserves state
  - **Property 10: Pause preserves trip state**
  - **Validates: Requirements 6.2**

- [ ]* 6.3 Write property test for trip completion
  - **Property 12: Trip completion updates all fields**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 7. Create ModeSelector component


  - Create multi-select dropdown component
  - Display checkboxes for each mode option
  - Accept selectedModes and onSelectionChange props
  - Style according to app design
  - Add accessibility labels
  - _Requirements: 1.4, 2.4_

- [x] 8. Create BoldnessSelector component


  - Create dropdown with options 1-10
  - Add info button next to label
  - Accept value and onChange props
  - Style according to app design
  - Add accessibility labels
  - _Requirements: 4.4, 4.5, 4.6_

- [x] 8.1 Create BoldnessInfoModal component


  - Create modal popup component
  - Display boldness definition (placeholder text for now)
  - Accept visible and onClose props
  - Style according to app design
  - Add accessibility support
  - _Requirements: 4.7_

- [x] 9. Create TripSummaryCard component


  - Display "Trip Complete!" message
  - Show trip mode, boldness, and distance
  - Add X button in top right
  - Accept trip and onClose props
  - Handle error state display
  - Style according to app design
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ]* 9.1 Write property test for trip display completeness
  - **Property 14: Trip display completeness**
  - **Validates: Requirements 8.3, 8.4, 8.5, 9.4, 9.5, 9.6, 9.7**

- [x] 10. Create ProfileStatistics component


  - Display average boldness (1 decimal place)
  - Display average trip length (2 decimal places)
  - Handle zero trips case with placeholder text
  - Accept statistics prop
  - Style according to app design
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 11. Update TripCard component



  - Add distance display in miles (2 decimal places)
  - Ensure all existing fields still display (mode, start time, end time)
  - Update styling if needed
  - _Requirements: 9.4, 9.5, 9.6, 9.7_

- [x] 12. Update ProfileScreen for new profile structure



  - Replace vehicle_type input with ModeSelector component
  - Update form validation for mode_list
  - Add ProfileStatistics component to display page
  - Make age and mode list clickable to navigate to edit page
  - Update create/edit logic for new data structure


  - _Requirements: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4_

- [ ] 13. Create StartTripScreen (Record - Start Trip Page)
  - Add ModeSelector dropdown populated from user's mode_list
  - Add BoldnessSelector dropdown with info button
  - Add "Start Trip" button (green when enabled, grey when disabled)
  - Implement button enable/disable logic based on selections
  - Handle trip start action with TripService
  - Navigate to ActiveTripScreen on success
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1, 5.4_

- [ ]* 13.1 Write property test for mode dropdown population
  - **Property 6: Mode dropdown population**
  - **Validates: Requirements 4.3**



- [ ]* 13.2 Write property test for start button enablement
  - **Property 7: Start button enablement**
  - **Validates: Requirements 4.10**

- [ ] 14. Create ActiveTripScreen (Record - Active Trip Page)
  - Hide Profile Button and Bottom Menu Bar
  - Display "Transit Leg" pause button
  - Display "End Trip" stop button


  - Implement pause/resume functionality
  - Toggle pause button to play button when paused
  - Handle stop trip action with GPS data
  - Navigate to TripSummaryScreen on completion


  - _Requirements: 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.5_

- [ ] 15. Create TripSummaryScreen (Record - Trip Summary Page)
  - Display TripSummaryCard component
  - Handle success and error states
  - Add X button to close and return to StartTripScreen
  - _Requirements: 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 16. Update TripHistoryScreen
  - Ensure TripCard displays distance
  - Verify trips are ordered by start time descending
  - Update any styling for new trip fields


  - _Requirements: 9.1, 9.2, 9.3, 9.7, 9.8_

- [ ]* 16.1 Write property test for trip history ordering
  - **Property 15: Trip history ordering**
  - **Validates: Requirements 9.8**

- [ ]* 16.2 Write property test for trip history completeness
  - **Property 16: Trip history completeness**
  - **Validates: Requirements 9.2, 9.3**



- [ ] 17. Update navigation structure
  - Configure initial route to ProfileScreen if no profile exists
  - Hide nav bars on Create/Edit Profile, ActiveTrip, and TripSummary screens
  - Show Profile Button on StartTrip and History screens
  - Update Bottom Tab Navigator with Record and History tabs

  - Implement navigation between all screens
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 5.4, 7.5, 8.7, 9.1_

- [ ]* 17.1 Write property test for navigation state consistency
  - **Property 18: Navigation state consistency**
  - **Validates: Requirements 1.2, 2.2, 4.1, 5.4, 7.5, 8.7, 9.1**



- [ ] 18. Implement GPS permission handling
  - Request location permissions on first trip start
  - Display error message if permissions denied
  - Display error message if location services disabled
  - Provide guidance to user on enabling permissions


  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 19. Add error handling and user feedback
  - Implement error handling for storage failures
  - Implement error handling for GPS failures



  - Add toast notifications for transient errors
  - Add modal dialogs for critical errors
  - Ensure all error messages are user-friendly
  - _Requirements: 8.1, 10.5, 11.2, 11.4_

- [ ] 20. Implement data migration for existing users
  - Create migration utility to convert vehicle_type to mode_list
  - Add default boldness (5) to existing trips if needed
  - Calculate distance for existing trips with geometry
  - Test migration with sample data
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 21. Update app branding to RollTracks
  - Update app name in package.json
  - Update app display name in iOS and Android configs
  - Update any branding text in UI
  - Update splash screen if applicable
  - _Requirements: All (app-wide)_

- [ ] 22. Checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Fix any failing tests
  - Verify test coverage is adequate
  - Ask the user if questions arise

- [ ]* 23. Write integration tests for complete user flows
  - Test profile creation → trip recording → history viewing flow
  - Test trip pause/resume functionality
  - Test error scenarios (permissions, storage failures)
  - Test navigation between all screens

- [ ] 24. Final testing and polish
  - Test on iOS device/simulator
  - Test on Android device/emulator
  - Verify GPS tracking accuracy
  - Verify battery usage is acceptable
  - Test accessibility features
  - Fix any UI/UX issues discovered
  - _Requirements: All_
