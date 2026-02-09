# Design Document: BasemapLayout

## Overview

The BasemapLayout component is a foundational layout system that provides a persistent map background with overlay slots for screen-specific content. It wraps the existing MapViewComponent and uses absolute positioning to create four distinct content areas (header, body, secondary footer, footer) that overlay the map while maintaining transparency by default.

This design enables code reuse across multiple screens (Home, Active Trip, Trip Summary, Trip History) by providing a consistent map-based interface with flexible content slots.

## Architecture

### Component Hierarchy

```
BasemapLayout
├── MapViewComponent (full-screen background)
└── Overlay Container (absolute positioned)
    ├── Header Slot (top, respects safe area)
    ├── Body Slot (fills remaining space)
    ├── Secondary Footer Slot (above footer)
    └── Footer Slot (bottom, respects safe area)
```

### Positioning Strategy

The layout uses a two-layer approach:

1. **Background Layer**: MapViewComponent with `position: absolute` filling the entire screen
2. **Overlay Layer**: Container with `position: absolute` and `flex: 1` containing all slots

All slots use flexbox for vertical stacking, with the body slot using `flex: 1` to fill available space.

### Props Interface Design

The component accepts:
- All MapViewComponent props (via type extension)
- Optional ReactNode props for each slot (header, body, secondaryFooter, footer)

This allows consumers to pass map configuration directly to BasemapLayout while also providing slot content.

## Components and Interfaces

### BasemapLayoutProps Interface

```typescript
interface BasemapLayoutProps extends MapViewComponentProps {
  header?: React.ReactNode;
  body?: React.ReactNode;
  secondaryFooter?: React.ReactNode;
  footer?: React.ReactNode;
}
```

### MapViewComponent Integration

The BasemapLayout destructures its props to separate:
- Slot content props (header, body, secondaryFooter, footer)
- MapViewComponent props (everything else)

MapViewComponent props are spread directly to the MapViewComponent using the rest operator.

### Slot Rendering Logic

Each slot is conditionally rendered:
```typescript
{header && <View style={styles.headerSlot}>{header}</View>}
```

This ensures empty slots don't create unnecessary DOM elements or affect layout calculations.

## Data Models

### Style Definitions

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  headerSlot: {
    width: '100%',
    // No background color - transparent by default
  },
  bodySlot: {
    flex: 1,
    width: '100%',
    // No background color - transparent by default
  },
  secondaryFooterSlot: {
    width: '100%',
    // No background color - transparent by default
  },
  footerSlot: {
    width: '100%',
    // No background color - transparent by default
  },
});
```

### Safe Area Integration

Use React Native's `SafeAreaView` or Expo's `useSafeAreaInsets` hook:

```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

// Apply to header and footer slots
headerSlot: {
  paddingTop: insets.top,
}
footerSlot: {
  paddingBottom: insets.bottom,
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: MapViewComponent Prop Forwarding

*For any* valid MapViewComponent props object, when passed to BasemapLayout (excluding slot props), those props should be forwarded unchanged to the rendered MapViewComponent.

**Validates: Requirements 1.1, 1.3**

### Property 2: MapViewComponent Full-Screen Rendering

*For any* slot content configuration, the MapViewComponent should always render with absolute positioning and dimensions that fill the entire screen (top: 0, left: 0, right: 0, bottom: 0).

**Validates: Requirements 1.2, 1.4**

### Property 3: Slot Rendering Order

*For any* combination of slot content, when multiple slots are provided, they should render in the correct vertical order: header at top, body in middle, secondary footer above footer, footer at bottom.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 4: Empty Slot Non-Rendering

*For any* slot prop that is undefined or null, the BasemapLayout should not render a container element for that slot in the component tree.

**Validates: Requirements 2.5**

### Property 5: Overlay Absolute Positioning

*For any* rendered BasemapLayout instance, the overlay container should have absolute positioning (position: 'absolute') to properly overlay the map background.

**Validates: Requirements 2.6**

### Property 6: Transparent Slot Backgrounds

*For any* slot container, the slot should not have a backgroundColor or opacity style property applied by the BasemapLayout.

**Validates: Requirements 3.1, 3.4**

### Property 7: Header Safe Area Insets

*For any* device safe area configuration, the header slot should apply paddingTop equal to the top safe area inset value.

**Validates: Requirements 4.1**

### Property 8: Footer Safe Area Insets

*For any* device safe area configuration, the footer slot should apply paddingBottom equal to the bottom safe area inset value.

**Validates: Requirements 4.2**

### Property 9: Map Background Extends to Edges

*For any* device safe area configuration, the MapViewComponent background should not have any padding or margin applied, allowing it to extend into safe area regions.

**Validates: Requirements 4.3**

### Property 10: All Slots Accept ReactNode

*For any* valid ReactNode (string, number, element, fragment, array), when passed to any slot prop (header, body, secondaryFooter, footer), the BasemapLayout should render that content without errors.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 11: Simultaneous Multi-Slot Rendering

*For any* configuration where all four slots contain content, the BasemapLayout should render all four pieces of content simultaneously in the component tree.

**Validates: Requirements 5.5**

### Property 12: Full Width Slots

*For any* slot (header, body, secondaryFooter, footer), the slot container should have width: '100%' style applied.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 13: Body Slot Flex Expansion

*For any* rendered body slot, it should have flex: 1 style applied to expand and fill available vertical space between other slots.

**Validates: Requirements 6.5, 6.6, 6.7**

## Error Handling

### Invalid Props

- **Invalid MapViewComponent props**: Errors will propagate from MapViewComponent itself
- **Invalid ReactNode in slots**: React will handle rendering errors through error boundaries
- **Missing required MapViewComponent props**: TypeScript will catch at compile time

### Runtime Errors

- **Safe area context not available**: Fallback to zero insets if `useSafeAreaInsets` is unavailable
- **Rendering errors in slot content**: Errors should be contained to the specific slot and not crash the entire layout

### Edge Cases

- **All slots empty**: Layout should render only the MapViewComponent background
- **Very tall slot content**: Content should be scrollable within the slot if needed (responsibility of slot content)
- **Rapid prop changes**: React's reconciliation should handle updates efficiently

## Testing Strategy

### Unit Testing

Unit tests will focus on:
- Component renders without crashing with minimal props
- Correct TypeScript interface definitions
- Proper export of the component and types
- Safe area fallback behavior when context is unavailable

### Property-Based Testing

Property-based tests will validate the correctness properties using a property-based testing library for React Native (such as `@fast-check/jest` or similar). Each test should run a minimum of 100 iterations.

**Test Configuration:**
- Library: `@fast-check/jest` or `jest` with custom generators
- Minimum iterations: 100 per property test
- Each test tagged with: `Feature: basemap-layout, Property {N}: {property description}`

**Property Test Coverage:**
1. **Prop Forwarding** (Property 1): Generate random MapViewComponent prop objects and verify forwarding
2. **Full-Screen Rendering** (Property 2): Generate random slot content and verify MapViewComponent dimensions
3. **Slot Order** (Property 3): Generate random slot content combinations and verify rendering order
4. **Empty Slot Handling** (Property 4): Generate random combinations of defined/undefined slots and verify non-rendering
5. **Absolute Positioning** (Property 5): Verify overlay container positioning across all renders
6. **Transparent Backgrounds** (Property 6): Verify no background styles across all slot renders
7. **Header Safe Area** (Property 7): Generate random safe area insets and verify header padding
8. **Footer Safe Area** (Property 8): Generate random safe area insets and verify footer padding
9. **Map Edge Extension** (Property 9): Verify map background has no padding across all configurations
10. **ReactNode Acceptance** (Property 10): Generate various ReactNode types and verify rendering
11. **Multi-Slot Rendering** (Property 11): Verify all slots render when all are provided
12. **Full Width** (Property 12): Verify width: '100%' on all slots across all renders
13. **Flex Expansion** (Property 13): Verify flex: 1 on body slot across all renders

### Integration Testing

Integration tests will verify:
- BasemapLayout works correctly with actual MapViewComponent
- Safe area context integration functions properly
- Layout responds correctly to device orientation changes
- Slot content can interact with map (e.g., buttons that trigger map actions)

### Dual Testing Approach

Both unit tests and property-based tests are necessary:
- **Unit tests** catch specific bugs and verify concrete examples
- **Property tests** verify universal correctness across all possible inputs
- Together they provide comprehensive coverage of the component's behavior
