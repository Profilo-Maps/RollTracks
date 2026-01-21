# Design Document: Home Screen with Rated Features

## Overview

The Home Screen feature adds a new central navigation tab to the React Native app that displays all user-rated accessibility features on an interactive Mapbox map. This screen serves as a visual hub for users to see their rating history across all trips and quickly navigate to specific trip details.

The design leverages existing components (MapViewMapbox, RatingService) and integrates seamlessly with the current React Navigation bottom tab structure. The screen will efficiently handle potentially large datasets of rated features while maintaining smooth map interactions and providing clear visual feedback through color-coded markers.

## Architecture

### Component Hierarchy

```
Bottom Tab Navigator
├── Record Tab (StartTripScreen)
├── Home Tab (HomeScreen) ← NEW
│   ├── MapViewMapbox
│   │   └── Feature Markers (custom markers)
│   ├── Loading Indicator
│   └── Empty State View
└── History Tab (TripHistoryScreen)
```

### Data Flow

```
HomeScreen
    ↓ (on mount/focus)
RatingService.getAllRatings()
    ↓
Process ratings → Group by feature_id → Find most recent per feature
    ↓
MapViewMapbox (render markers)
    ↓ (on marker tap)
Navigate to TripHistoryScreen with trip_id parameter
```

### Navigation Integration

The HomeScreen will be added to the existing bottom tab navigator configuration:

```typescript
// Pseudo-navigation structure
<Tab.Navigator>
  <Tab.Screen name="Record" component={StartTripScreen} />
  <Tab.Screen name="Home" component={HomeScreen} />  // NEW
  <Tab.Screen name="History" component={TripHistoryScreen} />
</Tab.Navigator>
```

## Components and Interfaces

### HomeScreen Component

**Purpose:** Main container component that orchestrates map display, data fetching, and user interactions.

**Props:**
```typescript
interface HomeScreenProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'Home'>;
}
```

**State:**
```typescript
interface HomeScreenState {
  ratedFeatures: ProcessedRatedFeature[];
  loading: boolean;
  error: string | null;
  mapRegion: MapRegion | null;
}

interface ProcessedRatedFeature {
  feature_id: string;
  latitude: number;
  longitude: number;
  rating: number;  // Most recent rating value (1-10)
  trip_id: string;  // Trip ID of most recent rating
  timestamp: string;  // Timestamp of most recent rating
  properties: any;  // Feature properties
}
```

**Key Methods:**
- `fetchRatedFeatures()`: Fetches all ratings and processes them
- `processRatings(ratings)`: Groups ratings by feature_id and finds most recent
- `calculateMapRegion(features)`: Determines map bounds from feature coordinates
- `handleMarkerPress(feature)`: Navigates to TripHistoryScreen with trip_id
- `getMarkerColor(rating)`: Returns color based on rating value

### Feature Marker Component

**Purpose:** Custom marker component for displaying rated features on the map.

**Props:**
```typescript
interface FeatureMarkerProps {
  feature: ProcessedRatedFeature;
  onPress: (feature: ProcessedRatedFeature) => void;
}
```

**Visual Design:**
- Circular marker with color based on rating
- Rating color scale:
  - 1-3: Red (#FF4444)
  - 4-6: Yellow (#FFAA00)
  - 7-10: Green (#44FF44)
- Size: 30x30 pixels
- Border: 2px white stroke for visibility

### Data Processing Logic

**Rating Aggregation Algorithm:**

```
Input: Array of all ratings from RatingService.getAllRatings()

Process:
1. Group ratings by feature_id using a Map
2. For each feature_id group:
   a. Sort ratings by timestamp (descending)
   b. Take the first (most recent) rating
   c. Extract: feature_id, latitude, longitude, rating, trip_id, timestamp, properties
3. Return array of ProcessedRatedFeature objects

Output: Array of unique features with their most recent ratings
```

**Map Region Calculation:**

```
Input: Array of ProcessedRatedFeature objects

Process:
1. If array is empty, return default region (e.g., user's current location or app default)
2. Extract all latitudes and longitudes
3. Calculate:
   - minLat, maxLat, minLng, maxLng
   - centerLat = (minLat + maxLat) / 2
   - centerLng = (minLng + maxLng) / 2
   - latDelta = (maxLat - minLat) * 1.2  // 20% padding
   - lngDelta = (maxLng - minLng) * 1.2  // 20% padding
4. Return MapRegion object

Output: MapRegion with center and deltas
```

## Data Models

### Rating (from RatingService)

```typescript
interface Rating {
  feature_id: string;
  trip_id: string;
  user_rating: number;  // 1-10
  latitude: number;
  longitude: number;
  properties: any;
  timestamp: string;  // ISO 8601 format
}
```

### MapRegion

```typescript
interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}
```

### Navigation Parameters

```typescript
// Update to RootStackParamList
type RootStackParamList = {
  Record: undefined;
  Home: undefined;
  History: { highlightTripId?: string };  // NEW parameter
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Unique Marker Per Feature

*For any* set of ratings, the number of markers displayed on the map should equal the number of unique feature_ids in the ratings, ensuring no duplicate markers for the same feature.

**Validates: Requirements 2.3, 2.4**

### Property 2: Map Region Encompasses All Features

*For any* non-empty set of rated features, the calculated map region should include all feature coordinates within its bounds (considering latitude/longitude deltas from the center point).

**Validates: Requirements 2.5**

### Property 3: Marker Color Matches Rating Range

*For any* rating value (1-10), the marker color should correspond to the correct rating range: red for ratings 1-3, yellow for ratings 4-6, and green for ratings 7-10.

**Validates: Requirements 3.1, 3.2**

### Property 4: Most Recent Rating Selection

*For any* feature_id with multiple ratings, the selected rating should have the maximum (most recent) timestamp among all ratings for that feature_id.

**Validates: Requirements 3.4, 6.2**

### Property 5: Navigation Includes Correct Trip ID

*For any* feature marker that is tapped, the navigation call to TripHistoryScreen should include the trip_id from the most recent rating for that feature.

**Validates: Requirements 4.1, 4.3**

## Error Handling

### Data Fetching Errors

**Scenario:** RatingService.getAllRatings() fails due to network issues or data corruption.

**Handling:**
1. Catch the error in the fetchRatedFeatures() method
2. Set error state with a user-friendly message
3. Display error UI with a "Retry" button
4. Log error details for debugging
5. Preserve any previously loaded data if available

**Implementation:**
```typescript
try {
  const ratings = await RatingService.getAllRatings();
  // Process ratings...
} catch (error) {
  console.error('Failed to fetch rated features:', error);
  setState({
    error: 'Unable to load rated features. Please try again.',
    loading: false
  });
}
```

### Empty State Handling

**Scenario:** User has not rated any features yet.

**Handling:**
1. Detect empty ratings array after successful fetch
2. Display empty state UI with helpful message
3. Center map on default location (user's current location or app default)
4. Provide guidance on how to rate features (e.g., "Start a trip to rate accessibility features")

### Invalid Data Handling

**Scenario:** Rating data is missing required fields (latitude, longitude, timestamp).

**Handling:**
1. Filter out invalid ratings during processing
2. Log warnings for invalid data
3. Continue displaying valid ratings
4. If all ratings are invalid, treat as empty state

### Navigation Errors

**Scenario:** Navigation to TripHistoryScreen fails or trip_id is invalid.

**Handling:**
1. Wrap navigation calls in try-catch
2. Validate trip_id exists before navigation
3. Fall back to navigating without parameters if trip_id is invalid
4. Log navigation errors for debugging

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases (empty state, error states), component rendering, and navigation integration
- **Property tests**: Verify universal properties across all possible rating datasets, ensuring correctness of aggregation logic, marker rendering, and color mapping

### Property-Based Testing

We will use **fast-check** (for TypeScript/JavaScript) as the property-based testing library. Each property test will:

- Run a minimum of 100 iterations with randomly generated rating datasets
- Reference the corresponding design document property
- Use the tag format: **Feature: home-screen-rated-features, Property {number}: {property_text}**

**Example Property Test Structure:**
```typescript
// Feature: home-screen-rated-features, Property 1: Unique Marker Per Feature
it('should display exactly one marker per unique feature_id', () => {
  fc.assert(
    fc.property(
      fc.array(ratingArbitrary),  // Generate random ratings
      (ratings) => {
        const markers = processRatingsToMarkers(ratings);
        const uniqueFeatureIds = new Set(ratings.map(r => r.feature_id));
        expect(markers.length).toBe(uniqueFeatureIds.size);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Focus

Unit tests will cover:

1. **Component Rendering**: Verify HomeScreen renders MapViewMapbox, loading states, empty states
2. **Navigation Integration**: Test tab navigation and parameter passing to TripHistoryScreen
3. **Edge Cases**: Empty ratings array, single rating, error states
4. **User Interactions**: Marker tap handling, retry button functionality
5. **Integration**: Verify RatingService.getAllRatings() is called on mount

### Test Coverage Goals

- **Property tests**: 5 properties covering core business logic
- **Unit tests**: 15-20 tests covering UI, navigation, edge cases, and integration
- **Coverage target**: 90%+ code coverage for HomeScreen component and data processing logic

### Testing Tools

- **Test Framework**: Jest with React Native Testing Library
- **Property Testing**: fast-check
- **Mocking**: Jest mocks for RatingService, navigation, and MapViewMapbox
- **Test Data**: Factory functions for generating test ratings with various scenarios

## Implementation Notes

### Performance Considerations

1. **Marker Rendering**: For large datasets (>100 features), consider:
   - Using MapViewMapbox's clustering feature if available
   - Implementing virtualization for markers outside viewport
   - Debouncing map region updates

2. **Data Processing**: Memoize processed ratings to avoid recalculation on re-renders:
   ```typescript
   const processedFeatures = useMemo(
     () => processRatings(allRatings),
     [allRatings]
   );
   ```

3. **Map Region Calculation**: Cache calculated region until ratings change

### State Management

Use React hooks for local state management:
- `useState` for ratings, loading, error states
- `useEffect` for data fetching on mount and focus
- `useMemo` for expensive computations (processing ratings, calculating region)
- `useCallback` for event handlers to prevent unnecessary re-renders

### Accessibility

1. Ensure markers are tappable with sufficient touch target size (minimum 44x44 points)
2. Provide screen reader labels for markers with rating information
3. Ensure empty state and error messages are accessible
4. Support keyboard navigation if applicable

### Offline Support

The HomeScreen will work seamlessly in offline mode:
1. RatingService.getAllRatings() returns locally stored ratings
2. No special offline handling needed in HomeScreen
3. Map tiles may be cached by MapViewMapbox (depends on existing implementation)

### Future Enhancements

Potential improvements for future iterations:
1. Filter rated features by rating range (show only low-rated features)
2. Search/filter features by properties
3. Display rating statistics (average rating, total features rated)
4. Cluster markers when zoomed out for better performance
5. Show rating history timeline for a selected feature
