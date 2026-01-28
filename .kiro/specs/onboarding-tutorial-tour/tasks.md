# Implementation Plan: Onboarding Tutorial Tour

## Overview

This implementation plan breaks down the onboarding tutorial tour feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: first building the core data models and storage layer, then the service layer with business logic, followed by the UI components, and finally integration with existing screens. Each task builds on previous work, with testing sub-tasks to validate functionality early.

## Tasks

- [ ] 1. Set up tour data models and storage layer
  - [x] 1.1 Create TypeScript interfaces for tour data models
    - Define TourState, TourStep, StoredTourState, SimulatedTrip, and SimulatedObstacle interfaces
    - Add TourStatus and related type definitions
    - Create ProfileExtension interface for tourCompleted flag
    - _Requirements: 1.3, 9.1, 9.2, 7.2_
  
  - [x] 1.2 Implement TourStorage class
    - Create TourStorage class with AsyncStorage integration
    - Implement getTourState, saveTourState, and clearTourState methods
    - Add error handling for storage failures
    - _Requirements: 1.4, 9.1, 9.2, 4.3_
  
  - [ ]* 1.3 Write property tests for TourStorage
    - **Property 3: Tour state persistence on start**
    - **Property 19: Tour state persistence on changes**
    - **Property 20: Tour resumption after restart**
    - **Validates: Requirements 1.4, 9.1, 9.2, 9.3**
  
  - [ ]* 1.4 Write unit tests for TourStorage error handling
    - Test AsyncStorage failure scenarios
    - Test default value returns on errors
    - _Requirements: 1.4, 9.1, 9.2_

- [ ] 2. Implement SimulatedTripManager
  - [x] 2.1 Create SimulatedTripManager class
    - Implement createSimulation method
    - Implement gradeObstacle method
    - Implement endSimulation, isSimulationActive, and getCurrentSimulation methods
    - Add error handling for invalid operations
    - _Requirements: 7.2, 7.5_
  
  - [ ]* 2.2 Write property tests for SimulatedTripManager
    - **Property 16: Simulated trip creation**
    - **Property 17: Simulated trip cleanup**
    - **Validates: Requirements 7.2, 7.5**
  
  - [ ]* 2.3 Write unit tests for SimulatedTripManager
    - Test gradeObstacle with invalid obstacle IDs
    - Test error when grading without active simulation
    - _Requirements: 7.2, 7.5_

- [ ] 3. Implement TourService with business logic
  - [x] 3.1 Create TourService class with dependencies
    - Set up constructor with TourStorage, ProfileService, and navigationRef
    - Implement initializeTourSteps method with all 5 tour steps
    - Add getStep method
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.3, 7.4, 8.1, 8.2, 8.4_
  
  - [x] 3.2 Implement tour lifecycle methods
    - Implement shouldStartTour method
    - Implement startTour method
    - Implement completeTour method with profile update
    - Implement dismissTour method
    - Implement restartTour method
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.2, 3.3, 4.2, 4.3, 4.4_
  
  - [x] 3.3 Implement navigation logic
    - Implement navigateToStep method with screen navigation
    - Add step action handling (navigate, simulate_trip, end_simulation)
    - Integrate SimulatedTripManager for trip simulation
    - Add validation for step index bounds
    - _Requirements: 2.2, 2.3, 2.7, 7.2, 7.5_
  
  - [ ]* 3.4 Write property tests for tour lifecycle
    - **Property 1: New user tour activation**
    - **Property 2: Tour non-activation for completed users**
    - **Property 4: Profile completion tracking**
    - **Property 8: Tour completion on finish**
    - **Property 12: Tour dismissal state changes**
    - **Property 13: Restart after dismissal**
    - **Property 14: Tour restart resets state**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 2.6, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4**
  
  - [ ]* 3.5 Write property tests for navigation logic
    - **Property 5: Forward navigation advances step**
    - **Property 6: Backward navigation decrements step**
    - **Property 7: Screen navigation on step change**
    - **Property 15: Restart navigates to home**
    - **Validates: Requirements 2.2, 2.3, 2.7, 4.5**
  
  - [ ]* 3.6 Write unit tests for TourService error handling
    - Test invalid step index navigation
    - Test navigation with missing navigationRef
    - Test profile service failures
    - _Requirements: 2.2, 2.3, 2.7_

- [x] 4. Checkpoint - Ensure core services pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create TourContext and provider
  - [x] 5.1 Implement TourContext with React Context API
    - Define TourContextValue interface
    - Create TourContext with createContext
    - Implement useTour hook with error handling
    - _Requirements: 1.1, 2.2, 2.3, 3.2, 4.2_
  
  - [x] 5.2 Implement TourProvider component
    - Create TourProvider with state management
    - Initialize TourService instance
    - Implement startTour, nextStep, previousStep, dismissTour, completeTour, and restartTour handlers
    - Add automatic tour start logic for new users
    - Load persisted tour state on mount
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.6, 3.2, 4.2, 9.3_
  
  - [ ]* 5.3 Write unit tests for TourProvider
    - Test context initialization
    - Test automatic tour start for new users
    - Test tour state loading from storage
    - Test all action handlers
    - _Requirements: 1.1, 1.2, 1.3, 9.3_

- [ ] 6. Build TourOverlay UI component
  - [x] 6.1 Create TourOverlay component structure
    - Implement TourOverlay functional component with props
    - Add backdrop and highlight cutout rendering
    - Create content card with positioning logic
    - _Requirements: 2.1, 3.1_
  
  - [x] 6.2 Implement progress indicator and dismiss button
    - Add progress text display (current step / total steps)
    - Add dismiss button with icon
    - Add accessibility labels
    - _Requirements: 2.1, 3.1, 10.4_
  
  - [x] 6.3 Implement navigation controls
    - Add back button (hidden on first step)
    - Add next button (replaced with finish on last step)
    - Wire up onNext, onPrevious, onDismiss, and onComplete handlers
    - Add accessibility labels to all buttons
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 10.4_
  
  - [x] 6.4 Add step content rendering
    - Display step title and description
    - Add styling for readability
    - _Requirements: 5.2, 6.2, 7.4, 8.4_
  
  - [ ]* 6.5 Write property tests for TourOverlay
    - **Property 9: Progress indicator display**
    - **Property 10: Dismiss button presence**
    - **Property 11: Accessibility labels**
    - **Validates: Requirements 2.1, 3.1, 10.4**
  
  - [ ]* 6.6 Write unit tests for TourOverlay
    - Test back button hidden on first step
    - Test finish button shown on last step
    - Test next button shown on middle steps
    - Test all button click handlers
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 7. Create HighlightCutout component for element highlighting
  - [x] 7.1 Implement HighlightCutout component
    - Create component that measures and highlights target elements
    - Use element ID to find and measure target
    - Render transparent cutout over highlighted element
    - Add fallback for missing elements
    - _Requirements: 5.1, 6.1, 7.1, 8.2_
  
  - [ ]* 7.2 Write unit tests for HighlightCutout
    - Test rendering with valid element ID
    - Test fallback with missing element
    - _Requirements: 5.1, 6.1_

- [ ] 8. Integrate tour with existing screens
  - [x] 8.1 Update ProfileService to support tourCompleted flag
    - Add tourCompleted field to Profile interface
    - Update getProfile to return tourCompleted
    - Update updateProfile to accept tourCompleted
    - _Requirements: 1.5, 4.3_
  
  - [x] 8.2 Add TourProvider to app root
    - Wrap app with TourProvider in App.tsx or root component
    - Pass required dependencies (ProfileService, navigation ref)
    - _Requirements: 1.1, 11.1, 11.2_
  
  - [x] 8.3 Add tour overlay rendering to screens
    - Import useTour hook in HomeScreen, ProfileScreen, StartTripScreen, ActiveTripScreen, TripHistoryScreen
    - Conditionally render TourOverlay when tour is active and on correct screen
    - Add element IDs for highlighting (profile_nav_button, mode_list_section, start_trip_button, obstacle_grading_interface, trip_history_list)
    - _Requirements: 5.1, 6.1, 7.1, 7.3, 8.2_
  
  - [x] 8.4 Add restart tutorial option to settings screen
    - Add "Restart Tutorial" button to settings screen
    - Wire up to restartTour from useTour hook
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  
  - [ ]* 8.5 Write property tests for integration
    - **Property 18: Simulated trip non-persistence**
    - **Property 22: ProfileService integration**
    - **Property 23: Navigation system integration**
    - **Property 24: Authentication requirement**
    - **Validates: Requirements 7.6, 7.7, 11.1, 11.2, 11.3, 11.4**

- [ ] 9. Implement tour navigation blocking
  - [x] 9.1 Add navigation guard for active tours
    - Create navigation listener that checks tour state
    - Block navigation to screens not in current tour step
    - Allow dismissal to unblock navigation
    - _Requirements: 10.5_
  
  - [ ]* 9.2 Write property tests for navigation blocking
    - **Property 21: Tour navigation restriction**
    - **Validates: Requirements 10.5**

- [ ] 10. Final checkpoint and integration testing
  - [x] 10.1 Run full test suite
    - Execute all unit tests
    - Execute all property tests (100 iterations each)
    - Verify coverage goals (>90% line, >85% branch)
    - _Requirements: All_
  
  - [ ]* 10.2 Write end-to-end integration tests
    - Test complete tour flow from start to finish
    - Test tour dismissal and restart
    - Test simulated trip during tour
    - Test tour resumption after app restart
    - _Requirements: 1.1, 2.2, 2.6, 3.2, 4.2, 7.2, 7.5, 9.3_
  
  - [x] 10.3 Final checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples, edge cases, and error conditions
- The tour uses existing ProfileService and navigation systems without modifying their core functionality
- Simulated trips are kept in memory only and never persisted to storage or synced to backend
