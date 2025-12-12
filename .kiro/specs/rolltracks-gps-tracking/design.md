# Design Document

## Overview

RollTracks is a React Native mobile application that enables users to track their mobility trips using GPS technology. The application supports multiple transportation modes (wheelchair, assisted walking, skateboard, scooter, walking) and allows users to rate trip "boldness" on a 1-10 scale. The system architecture follows a service-oriented pattern with clear separation between UI components, business logic services, and data persistence layers.

**This is a local-first demo version** that stores all data on the device using AsyncStorage. This design prioritizes rapid prototyping and offline functionality while maintaining a clean architecture that will facilitate future cloud integration.

The application transforms an existing prototype by:
- Renaming from "MobilityTripTracker" to "RollTracks"
- Replacing single vehicle type with multi-mode selection
- Adding GPS tracking with polyline encoding
- Implementing boldness rating system
- Adding trip purpose field
- Enhancing profile statistics with average boldness and trip distance
- Implementing pause/resume functionality for transit legs

**Future Cloud Version Considerations:**
The architecture is designed with future Supabase integration in mind:
- Service layer abstracts storage implementation (StorageAdapter pattern)
- Profile and trip models include `user_id` fields for multi-user support
- GPS data structure supports real-time streaming to cloud
- Map display capability will use preloaded tiles for specified areas
- Authentication context already exists for user management

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  (React Native Screens & Components)                    │
│  - ProfileScreen, TripScreen, TripHistoryScreen         │
│  - ModeSelector, BoldnessSelector, TripCard             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                    Service Layer                         │
│  - ProfileService: Profile CRUD operations               │
│  - TripService: Trip lifecycle management                │
│  - GPSService: Location tracking & polyline encoding     │
│  - StatisticsService: Calculate averages                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                  Storage Layer                           │
│  - LocalStorageAdapter: AsyncStorage implementation      │
│  - StorageAdapter Interface: Abstract storage operations │
└─────────────────────────────────────────────────────────┘
```

### Navigation Structure

```
App
├── Create/Edit Profile (Initial - no nav bars)
├── Profile Page (with nav bars)
├── Bottom Tab Navigator
│   ├── Record Tab
│   │   ├── Start Trip Page
│   │   ├── Active Trip Page (no nav bars)
│   │   └── Trip Summary Page
│   └── History Tab
│       └── History Page
```

### State Management

- **React Context**: AuthContext, ToastContext, ModeContext (new)
- **Local Component State**: Form inputs, loading states, UI interactions
- **Persistent Storage**: AsyncStorage via LocalStorageAdapter

## Components and Interfaces

### Data Models

#### Profile Model (Updated)

```typescript
interface UserProfile {
  id: string;
  user_id?: string;
  age: number;
  mode_list: Mode[]; // Changed from vehicle_type
  trip_history_ids: string[]; // References to trips
  created_at: string;
  updated_at: string;
}

type Mode = 'wheelchair' | 'assisted_walking' | 'skateboard' | 'scooter' | 'walking';
```

#### Trip Model (Updated)

```typescript
interface Trip {
  id: string;
  user_id?: string;
  mode: Mode; // New field
  boldness: number; // New field (1-10)
  purpose?: string; // New field
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  distance_miles: number | null; // New field
  geometry: string | null; // Encoded polyline
  status: 'active' | 'paused' | 'completed'; // Added 'paused'
  created_at: string;
  updated_at: string;
}
```

#### GPS Location Point

```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}
```

### Service Interfaces

#### ProfileService (Updated)

```typescript
class ProfileService {
  constructor(storageAdapter: StorageAdapter);
  
  createProfile(data: {
    age: number;
    mode_list: Mode[];
  }): Promise<UserProfile>;
  
  getProfile(): Promise<UserProfile | null>;
  
  updateProfile(updates: {
    age?: number;
    mode_list?: Mode[];
  }): Promise<UserProfile>;
  
  getStatistics(): Promise<{
    averageBoldness: number;
    averageTripLength: number;
  }>;
}
```

#### TripService (Updated)

```typescript
class TripService {
  constructor(storageAdapter: StorageAdapter);
  
  startTrip(data: {
    mode: Mode;
    boldness: number;
    purpose?: string;
  }): Promise<Trip>;
  
  pauseTrip(tripId: string): Promise<Trip>;
  
  resumeTrip(tripId: string): Promise<Trip>;
  
  stopTrip(tripId: string, geometry: string): Promise<Trip>;
  
  getActiveTrip(): Promise<Trip | null>;
  
  getTrips(): Promise<Trip[]>;
  
  getTrip(tripId: string): Promise<Trip | null>;
}
```

#### GPSService (New)

```typescript
class GPSService {
  requestPermissions(): Promise<boolean>;
  
  startTracking(callback: (location: LocationPoint) => void): Promise<void>;
  
  stopTracking(): void;
  
  pauseTracking(): void;
  
  resumeTracking(): void;
  
  encodePolyline(points: LocationPoint[]): string;
  
  decodePolyline(encoded: string): LocationPoint[];
  
  calculateDistance(points: LocationPoint[]): number; // Returns miles
}
```

#### StatisticsService (New)

```typescript
class StatisticsService {
  constructor(storageAdapter: StorageAdapter);
  
  calculateAverageBoldness(trips: Trip[]): number;
  
  calculateAverageTripLength(trips: Trip[]): number;
  
  getProfileStatistics(profileId: string): Promise<{
    averageBoldness: number;
    averageTripLength: number;
    totalTrips: number;
  }>;
}
```

### UI Components

#### New Components

**ModeSelector**
- Multi-select dropdown for transportation modes
- Displays checkboxes for each mode option
- Props: `selectedModes: Mode[]`, `onSelectionChange: (modes: Mode[]) => void`

**BoldnessSelector**
- Dropdown with options 1-10
- Includes info button that shows definition popup
- Props: `value: number | null`, `onChange: (boldness: number) => void`

**BoldnessInfoModal**
- Modal popup displaying boldness definition
- Props: `visible: boolean`, `onClose: () => void`

**TripSummaryCard**
- Displays trip completion information
- Shows mode, boldness, distance
- Props: `trip: Trip`, `onClose: () => void`

#### Updated Components

**TripCard** (Enhanced)
- Add distance display in miles
- Props: `trip: Trip` (now includes distance_miles)

**ProfileStatistics** (New)
- Displays average boldness (1 decimal)
- Displays average trip length (2 decimals)
- Props: `statistics: { averageBoldness: number, averageTripLength: number }`

## Data Models

### Storage Schema

#### AsyncStorage Keys

```typescript
const STORAGE_KEYS = {
  PROFILE: '@rolltracks:profile',
  TRIPS: '@rolltracks:trips',
  ACTIVE_TRIP: '@rolltracks:active_trip',
  GPS_POINTS: '@rolltracks:gps_points', // Temporary storage during active trip
} as const;
```

### Data Validation Rules

**Profile Validation**
- Age: Must be integer between 13 and 120
- Mode List: Must contain at least one mode from valid Mode enum

**Trip Validation**
- Mode: Must be one of the valid Mode enum values
- Boldness: Must be integer between 1 and 10 (inclusive)
- Start Time: Must be valid ISO 8601 timestamp
- End Time: Must be after Start Time when present
- Geometry: Must be valid encoded polyline string when present

**GPS Validation**
- Latitude: Must be between -90 and 90
- Longitude: Must be between -180 and 180
- Accuracy: Should be less than 50 meters for quality tracking

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

Before defining properties, I've analyzed the prework to eliminate redundancy:

**Redundancies Identified:**
- Properties 8.3, 8.4, 8.5 (trip summary display) can be combined with 9.4, 9.5, 9.7 (trip card display) into a single "trip data display" property
- Properties 2.3, 2.4 (profile page display) are similar and can be combined
- Properties 3.1 and 3.3 (average calculations) are both testing calculation correctness and can be combined
- Properties 5.2, 5.3 (GPS capture and storage) are sequential steps of the same process and can be combined
- Properties 6.1, 6.4 (pause and resume) are inverse operations and can be tested together
- Properties 12.2 and 12.4 (encode and decode) are a round trip property

**Consolidated Properties:**
After reflection, we'll focus on unique, high-value properties that provide comprehensive coverage without redundancy.

### Correctness Properties

Property 1: Profile creation with valid data succeeds
*For any* valid age (13-120) and non-empty mode list, creating a profile should succeed and the profile should be retrievable with the same data
**Validates: Requirements 1.5, 1.6**

Property 2: Profile update preserves identity
*For any* existing profile and valid updates, updating the profile should maintain the same profile ID and only change the specified fields
**Validates: Requirements 2.8**

Property 3: Profile data round trip
*For any* valid profile, saving then loading the profile should return equivalent data
**Validates: Requirements 10.1, 10.3**

Property 4: Statistics calculation correctness
*For any* set of completed trips, the calculated average boldness and average trip length should equal the mathematical average of those values across all trips
**Validates: Requirements 3.1, 3.3**

Property 5: Statistics formatting precision
*For any* calculated average boldness, the displayed value should be formatted to exactly one decimal place, and for any average trip length, the displayed value should be formatted to exactly two decimal places
**Validates: Requirements 3.2, 3.4**

Property 6: Mode dropdown population
*For any* user profile with a mode list, the mode dropdown on the Start Trip page should contain exactly the modes from that user's mode list
**Validates: Requirements 4.3**

Property 7: Start button enablement
*For any* combination of mode and boldness selections, the Start Trip button should be enabled if and only if both mode and boldness have been selected
**Validates: Requirements 4.10**

Property 8: Trip creation with parameters
*For any* valid mode and boldness (1-10), starting a trip should create a trip record with those exact values and a start time within 1 second of the current time
**Validates: Requirements 5.1**

Property 9: GPS tracking lifecycle
*For any* started trip, GPS tracking should be active, and when paused, GPS should stop capturing, and when resumed, GPS should continue capturing and append to existing data
**Validates: Requirements 5.2, 5.3, 6.1, 6.4, 6.5**

Property 10: Pause preserves trip state
*For any* active trip, pausing should set status to 'paused' without setting an end time, and the trip should remain retrievable as the active trip
**Validates: Requirements 6.2**

Property 11: Polyline round trip
*For any* set of GPS location points, encoding to polyline then decoding should return location points within acceptable precision (0.00001 degrees)
**Validates: Requirements 7.2, 12.2, 12.4**

Property 12: Trip completion updates all fields
*For any* active trip with GPS data, stopping the trip should set end time, encode geometry as polyline, calculate distance, and set status to 'completed'
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

Property 13: Trip data round trip
*For any* completed trip including encoded polyline, saving then loading the trip should return equivalent data with the same geometry
**Validates: Requirements 10.2**

Property 14: Trip display completeness
*For any* trip, displaying it (in summary or history) should show all required fields: mode, boldness, start time, end time, and distance
**Validates: Requirements 8.3, 8.4, 8.5, 9.4, 9.5, 9.6, 9.7**

Property 15: Trip history ordering
*For any* set of trips, displaying them on the History Page should order them by start time descending (most recent first)
**Validates: Requirements 9.8**

Property 16: Trip history completeness
*For any* user with completed trips, the History Page should display exactly the trips that belong to that user with status 'completed'
**Validates: Requirements 9.2, 9.3**

Property 17: Distance calculation consistency
*For any* set of GPS points, calculating distance should return the same value regardless of when the calculation is performed
**Validates: Requirements 7.4**

Property 18: Navigation state consistency
*For any* navigation action (clicking buttons, completing operations), the system should navigate to the correct page and update UI visibility (nav bars) according to the page requirements
**Validates: Requirements 1.2, 2.2, 4.1, 5.4, 7.5, 8.7, 9.1**

## Error Handling

### Error Categories

**Validation Errors**
- Invalid age (< 13 or > 120)
- Empty mode list
- Invalid boldness (< 1 or > 10)
- Invalid GPS coordinates

**Permission Errors**
- Location permission denied
- Location services disabled

**Storage Errors**
- AsyncStorage read failure
- AsyncStorage write failure
- Storage quota exceeded

**GPS Errors**
- GPS signal lost
- Location accuracy too low (> 50m)
- GPS timeout

**State Errors**
- Attempting to start trip when one is active
- Attempting to pause/resume non-active trip
- Attempting to stop non-existent trip

### Error Handling Strategy

**User-Facing Errors**
- Display toast notifications for transient errors
- Display modal dialogs for critical errors requiring user action
- Provide clear, actionable error messages
- Include retry mechanisms where appropriate

**Developer Errors**
- Log all errors to console with context
- Include stack traces for debugging
- Validate inputs at service boundaries
- Use TypeScript for compile-time type safety

**Graceful Degradation**
- If GPS accuracy is low, warn user but continue tracking
- If storage is full, prevent new trips but allow viewing history
- If statistics calculation fails, show "N/A" instead of crashing

### Error Recovery

**Automatic Recovery**
- Retry GPS location requests up to 3 times
- Retry storage operations once after 1 second delay
- Resume GPS tracking if signal is regained

**Manual Recovery**
- Provide "Retry" buttons for failed operations
- Allow users to manually enable permissions from settings
- Provide "Clear Data" option in profile for storage issues

## Testing Strategy

### Unit Testing

**Service Layer Tests**
- ProfileService: CRUD operations, validation, statistics calculation
- TripService: Trip lifecycle, state transitions, data integrity
- GPSService: Permission handling, tracking control, polyline encoding/decoding
- StatisticsService: Average calculations, formatting

**Component Tests**
- ModeSelector: Multi-select behavior, validation
- BoldnessSelector: Dropdown behavior, info modal
- TripCard: Data display, formatting
- ProfileStatistics: Statistics display, formatting

**Storage Tests**
- LocalStorageAdapter: CRUD operations, error handling
- Data serialization/deserialization
- Storage key management

### Property-Based Testing

**Testing Framework**: fast-check (already in package.json)

**Configuration**: Each property-based test should run a minimum of 100 iterations to ensure comprehensive coverage of the input space.

**Test Tagging**: Each property-based test MUST be tagged with a comment explicitly referencing the correctness property in this design document using the format: `// Feature: rolltracks-gps-tracking, Property {number}: {property_text}`

**Property Test Coverage**:
- Each correctness property listed above MUST be implemented by a SINGLE property-based test
- Property tests should use smart generators that constrain to valid input spaces
- Property tests should avoid mocking when possible to test real behavior

**Key Property Tests**:

1. Profile data integrity (Properties 1, 2, 3)
   - Generate random valid ages and mode lists
   - Verify create/update/retrieve operations

2. Statistics calculations (Properties 4, 5)
   - Generate random trip sets with various boldness and distance values
   - Verify mathematical correctness and formatting

3. Trip lifecycle (Properties 8, 9, 10, 12)
   - Generate random trip parameters
   - Verify state transitions and data integrity

4. Polyline encoding (Property 11)
   - Generate random GPS point sets
   - Verify round trip accuracy

5. Data persistence (Properties 3, 13)
   - Generate random profiles and trips
   - Verify storage round trips

6. Display and ordering (Properties 14, 15, 16)
   - Generate random trip sets
   - Verify display completeness and ordering

### Integration Testing

**Screen Integration Tests**
- Profile creation flow: Create → Display → Edit → Update
- Trip recording flow: Start → Pause → Resume → Stop → Summary
- History viewing flow: Navigate → Load → Display → Sort

**Navigation Tests**
- Verify correct screen transitions
- Verify nav bar visibility on each screen
- Verify back button behavior

**End-to-End Tests**
- Complete user journey from profile creation to trip history viewing
- Test with real GPS simulation data
- Test offline/online transitions

### GPS Testing Strategy

**Simulated GPS Data**
- Use mock location providers for consistent testing
- Generate realistic GPS tracks with varying accuracy
- Test edge cases: signal loss, low accuracy, rapid movement

**Real Device Testing**
- Test on physical devices with actual GPS
- Verify battery usage is acceptable
- Test in various environments (urban, rural, indoor)

## Implementation Notes

### Technology Stack

**Core**
- React Native 0.82.1
- TypeScript 5.8.3
- React Navigation 7.x

**Storage**
- @react-native-async-storage/async-storage 2.2.0

**GPS & Location**
- react-native-geolocation-service (to be added)
- @mapbox/polyline (to be added) or custom implementation

**Testing**
- Jest 29.6.3
- fast-check 4.3.0
- react-test-renderer 19.1.1

### Performance Considerations

**GPS Tracking**
- Sample location every 2-5 seconds during active tracking
- Use distance filter to avoid redundant points (minimum 5 meters)
- Batch location updates to reduce battery drain

**Storage**
- Compress polylines using encoding algorithm
- Limit trip history to last 1000 trips
- Implement pagination for history display if needed

**UI Responsiveness**
- Debounce dropdown selections
- Use FlatList for trip history (already implemented)
- Lazy load trip statistics

### Security Considerations

**Data Privacy**
- Store all data locally by default
- Do not transmit GPS data without explicit user consent
- Provide data export and deletion options

**Input Validation**
- Sanitize all user inputs
- Validate GPS coordinates before storage
- Prevent injection attacks in text fields

### Accessibility

**Screen Reader Support**
- All interactive elements have accessibility labels
- Form fields have proper hints and roles
- Error messages are announced

**Touch Targets**
- Minimum 44pt touch targets (already implemented)
- Adequate spacing between interactive elements

**Visual**
- Sufficient color contrast ratios
- Text size respects system settings
- Icons have text alternatives

### Migration Strategy

**Data Migration**
- Convert existing profiles: `vehicle_type` → `mode_list` (single mode)
- Add default boldness value (5) to existing trips
- Calculate distance for existing trips if geometry exists
- Add purpose field as optional (null for existing trips)

**Code Migration**
- Update database types
- Update service interfaces
- Update UI components
- Maintain backward compatibility during transition

### Future Cloud Version (Supabase Integration)

**Architecture Changes for Cloud Version**
- Replace LocalStorageAdapter with SupabaseStorageAdapter
- Implement real-time GPS streaming to Supabase database
- Add authentication flow with Supabase Auth
- Implement Row Level Security (RLS) policies for user data isolation
- Add offline-first sync strategy with conflict resolution

**Cloud Features**
- Multi-user support with individual profiles
- Real-time trip tracking visible to authorized users
- Cloud backup and restore of trip history
- Cross-device synchronization
- Map display with preloaded tiles for specified geographic areas
- Server-side trip analytics and aggregations

**Data Storage Strategy**
- Profiles: Supabase `profiles` table (already exists in schema)
- Trips: Supabase `trips` table with PostGIS for geometry
- GPS Points: Real-time streaming to Supabase Realtime
- Map Tiles: Supabase Storage buckets with offline caching

**Additional Future Features**
- Trip purpose categorization with predefined options
- Social sharing of anonymized trip statistics
- Export trips to GPX/KML formats
- Trip photos and notes with cloud storage
- Community heatmaps of popular routes
- Accessibility ratings for routes
