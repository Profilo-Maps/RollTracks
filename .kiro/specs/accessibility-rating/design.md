# Design Document

## Overview

The Accessibility Rating feature extends the existing obstacle visualization system to allow users to provide feedback on curb ramp accessibility during trips. The feature integrates with the Active Trip Screen and Trip Summary Screen, adding interactive rating capabilities and persistent storage of user feedback.

The design follows the established service-oriented architecture pattern used in the application, creating a new RatingService that manages rated features independently while integrating seamlessly with existing TripService and ObstacleService components.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Active Trip Screen                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MapView    │  │ Feature      │  │ Rating       │      │
│  │  Component   │──│ Popup Modal  │──│ Modal        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RatingService                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • createRating(feature, tripId, rating)             │   │
│  │  • getRatingsForTrip(tripId)                         │   │
│  │  • getRatingForFeature(featureId, tripId)            │   │
│  │  • updateRating(featureId, tripId, rating)           │   │
│  │  • getAllRatings()                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  LocalStorageAdapter                         │
│  Storage Key: @rolltracks:rated_features                     │
│  Format: RatedFeature[]                                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Integration

The feature integrates with existing components:

1. **MapView Component**: Extended to handle obstacle feature taps and display rated features with distinct styling
2. **Active Trip Screen**: Manages rating modal state and coordinates between MapView and RatingService
3. **Trip Summary Screen**: Loads and displays rated features for completed trips
4. **LocalStorageAdapter**: Extended with new methods for rated feature persistence

## Components and Interfaces

### Type Definitions

```typescript
// New type for rated features
export interface RatedFeature {
  id: string;                    // Original feature ID
  tripId: string;                // Associated trip ID
  userRating: number;            // Rating value (1-10)
  timestamp: string;             // ISO 8601 timestamp
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: Record<string, any>; // Original obstacle properties
}

// Extended ObstacleFeature for UI state
export interface ObstacleFeatureWithRating extends ObstacleFeature {
  rating?: number;               // Present if feature has been rated
  isRated: boolean;              // Flag for visual distinction
}
```

### RatingService Interface

```typescript
export class RatingService {
  constructor(storageAdapter: StorageAdapter);
  
  // Create a new rating for a feature
  async createRating(
    feature: ObstacleFeature,
    tripId: string,
    rating: number
  ): Promise<RatedFeature>;
  
  // Get all ratings for a specific trip
  async getRatingsForTrip(tripId: string): Promise<RatedFeature[]>;
  
  // Get rating for a specific feature in a trip
  async getRatingForFeature(
    featureId: string,
    tripId: string
  ): Promise<RatedFeature | null>;
  
  // Update an existing rating
  async updateRating(
    featureId: string,
    tripId: string,
    rating: number
  ): Promise<RatedFeature>;
  
  // Get all ratings across all trips
  async getAllRatings(): Promise<RatedFeature[]>;
  
  // Export ratings as GeoJSON
  exportAsGeoJSON(): Promise<string>;
}
```

### LocalStorageAdapter Extensions

```typescript
// Add to LocalStorageAdapter class
export class LocalStorageAdapter implements StorageAdapter {
  // ... existing methods ...
  
  // Rated features operations
  async getRatedFeatures(): Promise<RatedFeature[]>;
  async saveRatedFeature(feature: RatedFeature): Promise<void>;
  async updateRatedFeature(
    featureId: string,
    tripId: string,
    updates: Partial<RatedFeature>
  ): Promise<void>;
  async getRatedFeaturesForTrip(tripId: string): Promise<RatedFeature[]>;
}
```

### UI Components

#### FeaturePopup Component

```typescript
interface FeaturePopupProps {
  feature: ObstacleFeatureWithRating;
  visible: boolean;
  onClose: () => void;
  onRate: () => void;
  tripId: string;
}

export const FeaturePopup: React.FC<FeaturePopupProps>;
```

#### RatingModal Component

```typescript
interface RatingModalProps {
  visible: boolean;
  initialRating?: number;
  onSubmit: (rating: number) => void;
  onCancel: () => void;
}

export const RatingModal: React.FC<RatingModalProps>;
```

## Data Models

### RatedFeature Storage Format

Rated features are stored as a JSON array in AsyncStorage under the key `@rolltracks:rated_features`. Each rated feature follows the GeoJSON Feature format:

```json
{
  "id": "feature_123",
  "tripId": "trip_1234567890_abc123",
  "userRating": 7,
  "timestamp": "2024-12-05T10:30:00.000Z",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "properties": {
    "CNN": 33014000,
    "LocationDescription": "SAN PABLO AVE: SAN PABLO AVE intersection",
    "curbReturnLoc": "E",
    "positionOnReturn": "Right",
    "conditionScore": -2,
    "detectableSurf": null,
    "Location": "(37.740068566951635, -122.4610751177511)"
  }
}
```

### Data Flow

1. **Rating Creation Flow**:
   - User taps obstacle on map → Feature popup displays
   - User taps "Rate Feature" → Rating modal opens
   - User adjusts slider and confirms → RatingService.createRating()
   - Service creates RatedFeature object → LocalStorageAdapter.saveRatedFeature()
   - UI updates to show rated state

2. **Rating Update Flow**:
   - User taps rated obstacle → Feature popup shows existing rating
   - User taps "Update Rating" → Rating modal opens with current value
   - User adjusts slider and confirms → RatingService.updateRating()
   - Service updates RatedFeature → LocalStorageAdapter.updateRatedFeature()
   - UI refreshes to show updated rating

3. **Trip Summary Display Flow**:
   - Trip Summary Screen loads → RatingService.getRatingsForTrip()
   - Service retrieves rated features → MapView renders markers
   - User taps marker → Feature popup displays with rating


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Feature popup displays on tap
*For any* obstacle feature on the Active Trip Screen map, when a user taps it, the feature popup should become visible and contain the feature's data.
**Validates: Requirements 1.1**

### Property 2: Rate button presence
*For any* feature popup displayed, the rendered output should include a "Rate Feature" button (or "Update Rating" if already rated).
**Validates: Requirements 1.2**

### Property 3: Rating modal appears with correct title
*For any* feature, when the rate button is tapped, the rating modal should appear with the title "Accessibility Rating".
**Validates: Requirements 1.3**

### Property 4: Slider bounds validation
*For any* rating modal displayed, the slider control should have minimum value 1 and maximum value 10.
**Validates: Requirements 1.4**

### Property 5: Slider value display synchronization
*For any* slider value change, the displayed numeric value should match the slider position.
**Validates: Requirements 1.5**

### Property 6: Property preservation on rating creation
*For any* obstacle feature and rating value, creating a rated feature should preserve all original obstacle properties in the properties field.
**Validates: Requirements 2.1, 5.2**

### Property 7: Rating value storage
*For any* rating value between 1 and 10, the created rated feature should have a userRating property equal to that value.
**Validates: Requirements 2.2**

### Property 8: Trip association
*For any* feature rating created during a trip, the rated feature should have a tripId property matching the active trip's ID.
**Validates: Requirements 2.3**

### Property 9: Timestamp presence
*For any* rated feature created, it should have a valid ISO 8601 timestamp property.
**Validates: Requirements 2.4**

### Property 10: Storage round-trip consistency
*For any* rated feature created, immediately retrieving it from storage should return an equivalent rated feature with all properties intact.
**Validates: Requirements 2.5**

### Property 11: Existing rating display
*For any* feature that has been rated in the current trip, opening the feature popup should display the existing rating value.
**Validates: Requirements 3.1**

### Property 12: Button text update for rated features
*For any* feature that has been rated in the current trip, the popup button text should be "Update Rating" instead of "Rate Feature".
**Validates: Requirements 3.2**

### Property 13: Timestamp preservation on update
*For any* rating update, the timestamp of the rated feature should remain unchanged while the userRating value changes.
**Validates: Requirements 3.3**

### Property 14: Visual distinction of rated features
*For any* rated feature displayed on the map, its visual styling should differ from unrated features (e.g., different color or marker).
**Validates: Requirements 3.4**

### Property 15: Trip summary displays all rated features
*For any* trip with rated features, the Trip Summary Screen should display all rated features associated with that trip's ID.
**Validates: Requirements 4.1**

### Property 16: Rated feature marker distinction on summary
*For any* rated feature on the Trip Summary Screen, its marker should be visually distinct from route markers.
**Validates: Requirements 4.2**

### Property 17: Rated feature popup completeness
*For any* rated feature tapped on the Trip Summary Screen, the popup should contain all original properties plus the userRating value.
**Validates: Requirements 4.3**

### Property 18: GeoJSON format compliance
*For any* rated feature persisted to storage, its structure should conform to GeoJSON Feature format with type, geometry, and properties fields.
**Validates: Requirements 5.1**

### Property 19: Coordinate format validation
*For any* rated feature, the geometry coordinates should be an array [longitude, latitude] within a Point geometry type.
**Validates: Requirements 5.3**

### Property 20: Trip-specific retrieval filtering
*For any* trip ID, retrieving rated features for that trip should return only features where tripId matches, excluding all others.
**Validates: Requirements 5.4**

### Property 21: Complete retrieval across trips
*For any* set of rated features stored across multiple trips, getAllRatings should return all of them without omission.
**Validates: Requirements 5.5**

### Property 22: Storage key isolation
*For any* rated feature storage operation, it should use the dedicated key `@rolltracks:rated_features` and not interfere with trip or GPS point storage.
**Validates: Requirements 6.3**

### Property 23: Pre-navigation persistence
*For any* trip being ended with rated features, all rated features should be successfully persisted to storage before navigation to Trip Summary Screen occurs.
**Validates: Requirements 6.5**

## Error Handling

### Validation Errors

1. **Invalid Rating Value**: If a rating outside the 1-10 range is provided, throw a validation error
2. **Missing Trip ID**: If attempting to create a rating without an active trip, throw an error
3. **Invalid Feature Data**: If feature lacks required properties (id, coordinates), throw a validation error

### Storage Errors

1. **Storage Write Failure**: If AsyncStorage write fails, log error and show user-friendly message
2. **Storage Read Failure**: If AsyncStorage read fails, return empty array and log error
3. **Corrupted Data**: If stored data cannot be parsed, log error and attempt recovery or reset

### Error Recovery

- All RatingService methods should catch and handle errors gracefully
- Failed rating operations should not crash the app or prevent trip continuation
- Storage failures should be logged for debugging but allow app to continue
- UI should provide clear feedback when rating operations fail

### Error Messages

```typescript
const ERROR_MESSAGES = {
  INVALID_RATING: 'Rating must be between 1 and 10',
  NO_ACTIVE_TRIP: 'Cannot rate feature without an active trip',
  INVALID_FEATURE: 'Feature data is invalid or incomplete',
  STORAGE_WRITE_FAILED: 'Failed to save rating. Please try again.',
  STORAGE_READ_FAILED: 'Failed to load ratings',
  FEATURE_NOT_FOUND: 'Rated feature not found',
};
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases:

1. **RatingService Methods**:
   - Test createRating with valid inputs
   - Test createRating with invalid rating values (0, 11, -1)
   - Test getRatingsForTrip with empty storage
   - Test getRatingsForTrip with multiple trips
   - Test updateRating for existing and non-existing features
   - Test GeoJSON export format

2. **LocalStorageAdapter Extensions**:
   - Test saveRatedFeature with valid data
   - Test getRatedFeatures with empty storage
   - Test getRatedFeaturesForTrip filtering
   - Test updateRatedFeature with valid and invalid IDs

3. **UI Components**:
   - Test FeaturePopup renders with feature data
   - Test RatingModal slider bounds
   - Test button text changes based on rating state
   - Test modal submission and cancellation

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** library for TypeScript/JavaScript. Each test will run a minimum of 100 iterations.

1. **Property 6: Property preservation** - Generate random obstacle features and ratings, verify all properties are preserved
2. **Property 10: Storage round-trip** - Generate random rated features, save and retrieve, verify equivalence
3. **Property 13: Timestamp preservation** - Generate ratings, update them, verify timestamp unchanged
4. **Property 18: GeoJSON format** - Generate random rated features, verify structure compliance
5. **Property 20: Trip filtering** - Generate features for multiple trips, verify filtering returns only matching tripId
6. **Property 22: Storage isolation** - Verify rated features don't interfere with other storage keys

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Complete Rating Flow**: Create trip → rate feature → verify storage → end trip → verify summary display
2. **Update Rating Flow**: Rate feature → update rating → verify new value stored
3. **Multiple Features**: Rate multiple features in one trip → verify all appear in summary
4. **Cross-Trip Isolation**: Rate features in different trips → verify proper isolation

### Testing Framework Configuration

```typescript
// jest.config.js additions
module.exports = {
  // ... existing config
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.property.test.ts',
  ],
};
```

### Property Test Example Structure

```typescript
import fc from 'fast-check';

describe('RatingService Property Tests', () => {
  it('Property 10: Storage round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string(),
          latitude: fc.double({ min: -90, max: 90 }),
          longitude: fc.double({ min: -180, max: 180 }),
          attributes: fc.dictionary(fc.string(), fc.anything()),
        }),
        fc.string(),
        fc.integer({ min: 1, max: 10 }),
        async (feature, tripId, rating) => {
          const ratingService = new RatingService(storageAdapter);
          const created = await ratingService.createRating(feature, tripId, rating);
          const retrieved = await ratingService.getRatingForFeature(feature.id, tripId);
          
          expect(retrieved).toEqual(created);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Implementation Notes

### Performance Considerations

1. **Storage Efficiency**: Rated features are stored as a single JSON array, limiting to reasonable size (< 10,000 features)
2. **Query Optimization**: getRatingsForTrip filters in-memory rather than multiple storage reads
3. **UI Responsiveness**: Rating operations are async but provide immediate optimistic UI updates
4. **Memory Management**: Rated features loaded on-demand, not kept in memory permanently

### Accessibility

1. **Slider Control**: Ensure slider has proper accessibility labels and supports screen readers
2. **Button Labels**: Use descriptive accessibility labels for all interactive elements
3. **Modal Announcements**: Announce modal opening/closing to screen readers
4. **Touch Targets**: Ensure all interactive elements meet minimum 44x44pt touch target size

### Future Enhancements

1. **Backend Sync**: Add capability to upload rated features to Supabase backend
2. **Offline Queue**: Queue ratings for upload when connectivity is restored
3. **Rating Analytics**: Aggregate ratings to identify problematic accessibility features
4. **Photo Attachment**: Allow users to attach photos to ratings
5. **Rating Categories**: Add categorical ratings (e.g., surface quality, width, slope)
6. **Community Ratings**: Display aggregate ratings from multiple users
