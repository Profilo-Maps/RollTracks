# Implementation Plan: BasemapLayout

## Overview

This implementation plan breaks down the BasemapLayout component into discrete coding steps. The component wraps MapViewComponent with overlay slots for screen-specific content. Tasks are ordered to build incrementally, with testing integrated throughout.

## Tasks

- [x] 1. Create TypeScript interface and component structure
  - Define `BasemapLayoutProps` interface extending `MapViewComponentProps`
  - Add optional ReactNode properties for header, body, secondaryFooter, footer slots
  - Create basic component skeleton with proper exports
  - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.5_

- [ ] 2. Implement MapViewComponent background layer
  - [x] 2.1 Add MapViewComponent rendering with prop forwarding
    - Destructure slot props from MapViewComponent props
    - Spread remaining props to MapViewComponent
    - Apply full-screen absolute positioning styles
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 2.2 Write property test for prop forwarding
    - **Property 1: MapViewComponent Prop Forwarding**
    - **Validates: Requirements 1.1, 1.3**
  
  - [ ]* 2.3 Write property test for full-screen rendering
    - **Property 2: MapViewComponent Full-Screen Rendering**
    - **Validates: Requirements 1.2, 1.4**

- [ ] 3. Implement overlay container and slot system
  - [ ] 3.1 Create overlay container with absolute positioning
    - Add container with absolute positioning and flexbox layout
    - Ensure container spans full screen dimensions
    - _Requirements: 2.6_
  
  - [ ] 3.2 Implement conditional slot rendering
    - Add header slot with conditional rendering
    - Add body slot with flex: 1 and conditional rendering
    - Add secondary footer slot with conditional rendering
    - Add footer slot with conditional rendering
    - Apply width: '100%' to all slots
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [ ]* 3.3 Write property test for slot rendering order
    - **Property 3: Slot Rendering Order**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 3.4 Write property test for empty slot non-rendering
    - **Property 4: Empty Slot Non-Rendering**
    - **Validates: Requirements 2.5**
  
  - [ ]* 3.5 Write property test for overlay absolute positioning
    - **Property 5: Overlay Absolute Positioning**
    - **Validates: Requirements 2.6**

- [ ] 4. Implement transparent slot styling
  - [ ] 4.1 Create slot styles without background colors
    - Define StyleSheet for all slots
    - Ensure no backgroundColor or opacity properties
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 4.2 Write property test for transparent backgrounds
    - **Property 6: Transparent Slot Backgrounds**
    - **Validates: Requirements 3.1, 3.4**
  
  - [ ]* 4.3 Write property test for full width slots
    - **Property 12: Full Width Slots**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  
  - [ ]* 4.4 Write property test for body slot flex expansion
    - **Property 13: Body Slot Flex Expansion**
    - **Validates: Requirements 6.5, 6.6, 6.7**

- [ ] 5. Integrate safe area handling
  - [ ] 5.1 Add safe area insets to header and footer slots
    - Import `useSafeAreaInsets` from react-native-safe-area-context
    - Apply paddingTop to header slot using insets.top
    - Apply paddingBottom to footer slot using insets.bottom
    - Add fallback for when safe area context is unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 5.2 Write property test for header safe area insets
    - **Property 7: Header Safe Area Insets**
    - **Validates: Requirements 4.1**
  
  - [ ]* 5.3 Write property test for footer safe area insets
    - **Property 8: Footer Safe Area Insets**
    - **Validates: Requirements 4.2**
  
  - [ ]* 5.4 Write property test for map edge extension
    - **Property 9: Map Background Extends to Edges**
    - **Validates: Requirements 4.3**
  
  - [ ]* 5.5 Write unit test for safe area fallback
    - Test behavior when useSafeAreaInsets returns zero values
    - Test behavior when safe area context is unavailable

- [ ]* 6. Add comprehensive slot content tests
  - [ ]* 6.1 Write property test for ReactNode acceptance
    - **Property 10: All Slots Accept ReactNode**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  
  - [ ]* 6.2 Write property test for simultaneous multi-slot rendering
    - **Property 11: Simultaneous Multi-Slot Rendering**
    - **Validates: Requirements 5.5**
  
  - [ ]* 6.3 Write unit tests for edge cases
    - Test all slots empty (only map renders)
    - Test single slot with content
    - Test various ReactNode types (string, number, element, fragment)

- [ ]* 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration with existing MapViewComponent
  - [ ] 8.1 Update BasemapLayout stub file
    - Replace TODO comments with full implementation
    - Ensure proper imports from MapViewComponent
    - Verify TypeScript types are correctly imported/exported
    - _Requirements: All_
  
  - [ ]* 8.2 Write integration test with MapViewComponent
    - Test BasemapLayout with actual MapViewComponent props
    - Verify map tiles render correctly through the layout
    - Test slot content can trigger map interactions

- [ ]* 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness across all inputs (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The component should be fully functional after task 5, with tasks 6-8 adding comprehensive testing and integration validation
