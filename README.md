# RollTracks

A privacy-first route sharing platform for non-car transport users, with a focus on wheelchair users, skateboarders, and other travelers sensitive to ADA compliance.

## Overview

RollTracks creates an anonymized, open dataset of non-car transport activity for routing and traffic modeling analysis. The app develops wheelchair and skateboard-specific models of Level of Traffic Stress for better urban design integration.

### Key Features

- **Trip Recording**: Track routes with mode selection (wheelchair, skateboard, assisted walking, walking, scooter), comfort level, and trip purpose
- **Post-Trip Survey**: After each trip, users answer "Did you reach your destination?" to help analyze trip completion rates and routing effectiveness
- **Privacy-First Architecture**:
  - Anonymous Supabase accounts with username/password recovery (no email collection)
  - Time-binned data storage (7 time-of-day bins + weekday/weekend indicator)
  - Relative timestamps in GPS tracks (prevents exact trip timing reconstruction)
  - No absolute timestamps stored in database
  - Server-side census block clipping removes trip origins and destinations
- **Multi-Device Support**: Data migration between devices using recovery credentials
- **Offline Capability**: Local trip buffering with automatic sync when connectivity returns

## Get Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- MapBox account and access token

### Installation

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables

   Create a `.env` file in the root directory:

   ```bash
   # Supabase Configuration
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # MapBox Configuration
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
   ```

3. Configure Supabase security settings (see [Security Configuration](#security-configuration) below)

4. Seed census block data for anonymization

   ```bash
   node scripts/seed-census-blocks.js
   ```

5. Upload DataRanger assets to Supabase Storage (optional, only if using DataRanger mode)

   ```bash
   node scripts/upload-dataranger-assets.js
   ```

   This uploads `curb_ramps.geojson` and `sidewalks.geojson` to the `dataranger-assets` storage bucket.

6. Start the development server

   ```bash
   npm start
   ```

### Development Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in web browser
npm run lint           # Run ESLint
npm test               # Run all tests
npm run test:a11y      # Run accessibility tests only
```

## Architecture

RollTracks follows a **Model-ViewModel-View** pattern with clear separation of concerns and unidirectional data flow:

```
┌─────────────────────────────────────────────────────────┐
│  DATA MODEL (Supabase, MapBox, Native GPS)             │
│  - User profiles, trips, and route data                │
│  - Map tiles and styling                               │
│  - Real-time GPS positioning                           │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  ADAPTERS (Abstraction Layer)                           │
│  - DatabaseAdapter: Auth + data ops + time binning      │
│  - MapBoxAdapter: Tile fetching and styles              │
│  - NativeAdapter: Native device services (GPS, etc.)    │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  SERVICES (Business Logic)                              │
│  - TripService: Recording with relative timestamps      │
│  - SyncService: Offline buffering, upload queue         │
│  - HistoryService: Trip retrieval and aggregation       │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  CONTEXTS (State Management)                            │
│  - AuthContext: User authentication state               │
│  - TourContext: Onboarding flow management              │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  SCREENS & COMPONENTS (UI Layer)                        │
│  - Screens fetch from Services, pass to Components      │
│  - Components receive data via props only               │
│  - MapViewComponent renders tiles + overlays            │
└─────────────────────────────────────────────────────────┘
```

### Module Relationships

**Data Flow Pattern:**
1. **Screens** call **Services** to fetch data
2. **Services** use **Adapters** to access external systems
3. **Screens** pass data to **Components** via props
4. **Components** never fetch data directly—they're purely presentational

**Example: Displaying Trip History**
```
HistoryScreen → HistoryService → DatabaseAdapter → Supabase
     ↓
MapViewComponent (receives polylines as props)
```

**Example: Recording a Trip**
```
ActiveTripScreen → TripService → NativeAdapter → Native GPS
                       ↓ (relative timestamps)
                  SyncService → DatabaseAdapter (time binning) → Supabase
                                      ↓
                              Discards absolute timestamps,
                              stores only binned time-of-day + weekday
```

### Key Directories

- `/app` - Screens with file-based routing
  - `(auth)/` - Login, registration, profile management
  - `(main)/` - Home, active trip, trip summary, history
- `/components` - Reusable UI components (receive data via props)
- `/adapters` - External service abstraction layer
  - `DatabaseAdapter.ts` - Supabase operations (auth + data)
  - `MapBoxAdapter.ts` - Map tile fetching and styles
  - `NativeAdapter.ts` - Native device services (GPS location, etc.)
- `/services` - Business logic layer
  - `TripService.ts` - Trip recording and polyline compilation
  - `SyncService.ts` - Offline buffering and sync queue
  - `HistoryService.ts` - Trip retrieval and statistics
- `/contexts` - React Context providers
  - `AuthContext.tsx` - User authentication state
  - `TourContext.tsx` - Onboarding tour state
- `/assets` - Static resources (images, local data)
  - `data/Blocks.geojson` - Census block polygons for anonymization clipping
- `/scripts` - Utility scripts
  - `seed-census-blocks.js` - Loads census blocks into Supabase
  - `upload-dataranger-assets.js` - Uploads curb ramps and sidewalk data to Supabase Storage
- `/supabase` - Database migrations and server-side functions
- `/constants` - Configuration and theme

## Core Services

### DataRangerService

**Purpose:** Manages curb ramp feature data for DataRanger mode with on-demand downloading and caching

**Responsibilities:**
- Downloads curb ramp GeoJSON data from Supabase Storage when DataRanger mode is enabled
- Caches feature data locally in AsyncStorage for offline access
- Checks for updates on app launch when DataRanger mode is active
- Builds spatial grid index for efficient proximity queries (50m radius)
- Provides features to ActiveTripScreen for display on map
- Manages feature ratings and uploads to Supabase
- Clears cache when DataRanger mode is disabled

**Storage Strategy:**
- Features stored server-side in Supabase Storage bucket (`dataranger-assets`)
- Downloaded only when user enables DataRanger mode (opt-in feature)
- Cached in AsyncStorage with version timestamp for update detection
- ~17 MB curb ramps data (San Francisco CRIS dataset)
- Spatial indexing enables instant queries without server round-trips

**Privacy Note:**
- Feature data is public (city infrastructure data)
- User ratings are anonymized and linked to trips (which are already anonymized)
- No personal data stored in feature cache

**Dependencies:**
- DatabaseAdapter (download and version checking)
- AsyncStorage (local caching)

**Used By:**
- DataRangerContext (initialization)
- ActiveTripScreen (feature queries during trips)

### TripService

**Purpose:** Manages trip recording lifecycle and GPS data compilation with privacy-preserving relative timestamps

**Responsibilities:**
- Validates GPS and internet connectivity before trip start
- Receives GPS data from NativeAdapter and compiles into polylines with relative timestamps
- Tracks time relative to trip start (seconds elapsed) for each GPS coordinate
- Maintains persistent trip state (active/paused/completed) with absolute timestamps locally for orphaned trip detection
- Detects orphaned trips on app launch (within 200m = resume, else end)
- Passes polyline data with relative times and absolute start time to SyncService for binning and upload
- Serves real-time polylines to ActiveTripScreen for display
- Accepts optional `reachedDest` parameter in `endTrip()` method from post-trip survey

**Privacy Implementation:**
- Stores absolute timestamps only in-memory and AsyncStorage (never sent to server)
- Calculates relative time (seconds since trip start) for each GPS point
- Geometry stored as GeoJSON LineString with `properties.times` array containing relative timestamps
- Passes absolute `startTime` to DatabaseAdapter solely for server-side binning, then discarded

**Post-Trip Survey Integration:**
- `endTrip(reachedDest?: boolean)` accepts optional boolean from post-trip survey
- Survey asks "Did you reach your destination?" after user stops trip
- Result stored in trip metadata for analyzing trip completion rates and routing effectiveness

**Dependencies:**
- NativeAdapter (location data)
- SyncService (data persistence)

**Used By:**
- ActiveTripScreen
- TripModal

### SyncService

**Purpose:** Handles offline trip buffering and upload queue management with privacy-preserving data relay

**Responsibilities:**
- Receives trip data from TripService (with relative timestamps and absolute startTime for binning)
- Buffers data locally when connectivity is lost mid-trip
- Automatically syncs buffered data when connectivity returns
- Passes trip data to DatabaseAdapter for server-side time binning before storage
- Uses DatabaseAdapter to write to Supabase
- Caches raw GPS data when a trip is first viewed on the trip summary screen
- Clears cached raw GPS data after successful sync to server

**Raw GPS Cache:**
- Preserves original unclipped geometry so users can see their full route immediately after ending a trip
- Before server-side census block clipping modifies the geometry, cached data shows the complete route
- Cache includes a `synced` flag to track upload status
- Unsynced trips display cached raw data on trip summary screen
- Once synced, trip summary fetches clipped geometry from server and clears the cache
- All locally stored raw GPS data is removed after successful sync

**Privacy Note:**
- Acts as a relay between TripService and DatabaseAdapter
- Does not perform time binning itself—passes raw data to DatabaseAdapter
- Buffered trips stored locally with absolute timestamps, binned only when uploaded
- Raw GPS cache is temporary and cleared after sync completes

**Dependencies:**
- DatabaseAdapter (Supabase operations)

**Used By:**
- TripService
- TripSummaryScreen (for cached raw GPS retrieval)

### HistoryService

**Purpose:** Retrieves and aggregates historical trip data with privacy-preserving binned timestamps

**Responsibilities:**
- Fetches trip lists with summary details (time-of-day bin, weekday indicator, mode, duration, distance, comfort)
- Provides polyline data with relative timestamps for map visualization
- Calculates user statistics (average trip length, duration)
- Uses DatabaseAdapter to query Supabase tables
- Supports flexible filtering (e.g., fetch only completed trips)

**Key Methods:**
- `getTripSummaries()` - Lightweight trip data for history list
- `getTrip(tripId)` - Full trip data including geometry
- `getUserTrips(filter?)` - All user trips with optional filtering (e.g., `{ status: 'completed' }`)
- `getHistoryOverview()` - Aggregate statistics for user
- `getProfileStatistics()` - Average trip metrics for profile display
- `deleteTrip(tripId)` - Remove trip and associated data

**Privacy Note:**
- All retrieved trips contain binned time data (timeOfDay, weekday) instead of absolute timestamps
- Polyline geometry includes relative timestamps in `properties.times` array
- No reconstruction of exact trip timing possible from retrieved data

**Dependencies:**
- DatabaseAdapter (Supabase queries)

**Used By:**
- HomeScreen (all trips overview)
- TripSummaryScreen (individual trip details)
- TripHistoryScreen (trip list)
- ProfileScreen (user statistics)

## Core Adapters

### DatabaseAdapter

**Purpose:** Abstraction layer for all database operations with privacy-preserving time binning, enabling easy migration between cloud providers

**Modules:**

**AuthService:**
- User registration with username/password (no email)
- Two-layer authentication: local device security + multi-device recovery
- Login/logout operations
- Account deletion
- Profile updates (mode list, settings)
- CAPTCHA verification (Cloudflare Turnstile)
- Multi-device recovery: validates credentials and migrates all trips/data to new anonymous Supabase user

**DataService:**
- Trip data writes (from TripService via SyncService) with server-side time binning
- Trip data reads (for HistoryService)
- Asset version checking (local vs. server)
- Privacy-preserving data transformation:
  - Bins absolute timestamps into 7 time-of-day categories (late_night, early_morning, morning_rush, midday, evening_rush, evening, night)
  - Converts dates to weekday/weekend indicator (1 for Mon-Fri, 0 for Sat-Sun)
  - Discards absolute timestamps after binning
  - Stores GeoJSON geometry with relative timestamps in `properties.times` array

**Authentication Architecture:**
- Creates Supabase anonymous user (random UUID) on registration
- Password hashing: Argon2id with cryptographically secure salt (see [Password Hashing](#password-hashing))
- Stores username + Argon2id password hash locally in secure storage
- Stores recovery credentials (username + hash) server-side in account_recovery table
- JWT tokens (access + refresh) managed automatically by Supabase SDK in AsyncStorage
- On device recovery: validates credentials → creates new anonymous user → migrates all data
- Verification: parses encoded hash, re-hashes with same parameters, compares results

**Trip Data Model:**

The `Trip` interface uses privacy-preserving binned time data:

```typescript
interface Trip {
  tripId: string;
  userId: string;
  mode: string;
  comfort: number;
  purpose: string;
  timeOfDay: TimeOfDayBin;  // 'late_night' | 'early_morning' | 'morning_rush' | 'midday' | 'evening_rush' | 'evening' | 'night'
  weekday: number;           // 1 for weekdays (Mon-Fri), 0 for weekends (Sat-Sun)
  durationS?: number;
  distanceMi?: number;
  status: 'active' | 'paused' | 'completed';
  reachedDest?: boolean;     // Post-trip survey: Did user reach their destination?
  geometry: GeoJSON.LineString;  // Coordinates with relative timestamps in properties.times
  devicePlatform?: string;   // Device platform (ios, android, web) - captured automatically when trip starts
  deviceOsVersion?: string;  // OS version (e.g., "iOS 17.2", "Android 14") - captured automatically
  appVersion?: string;       // App version (e.g., "1.0.0") - captured automatically
  featuresRated?: number;
  segmentsCorrected?: number;
}
```

**Device & Software Version Tracking:**
- Automatically captures device platform, OS version, and app version when each trip starts
- Stored with trip data for debugging, platform-specific issue tracking, and app version adoption metrics
- Helps correlate bugs with specific devices/versions and understand usage patterns across platforms
- Captured in background by TripService using expo-constants and react-native Platform API
- No user action required - completely automatic

**Time Binning Functions:**
- `_getTimeOfDayBin(timestamp: string)`: Converts absolute timestamp to one of 7 time-of-day bins
- `_getWeekdayBin(timestamp: string)`: Converts date to binary weekday indicator (1 or 0)

**Used By:**
- Auth screens (login, registration, profile)
- SyncService (trip uploads)
- HistoryService (trip queries)

### MapBoxAdapter

**Purpose:** Fetches map tiles and provides style configurations

**Provides:**
- Map styles: Streets, Outdoors, Light, Dark, Satellite, Navigation
- Access token management and validation
- Tile URLs for custom tilesets

**Used By:**
- MapViewComponent

### NativeAdapter

**Purpose:** Source of truth for native device functionality

**Responsibilities:**
- Receives location data from native GPS API
- Validates location permissions on app launch
- Throws errors if permissions denied or connection lost
- Serves position data to TripService and screens

**Used By:**
- TripService (trip recording)
- HomeScreen, ActiveTripScreen, TripSummaryScreen, TripHistoryScreen (map centering)

## Key Components

### MapViewComponent

**Purpose:** Renders map tiles and displays trip/location overlays

**Props:**
- `polylines` - Trip route data (from HistoryService or TripService)
- `centerPosition` - Map center coordinates
- `userPosition` - Current GPS position (from NativeAdapter)
- `interactionState` - Interactive or dimmed
- `mapStyle` - MapBox style (from MapBoxAdapter)
- `onRecenter` - Recenter button callback

**Data Flow:**
- Screens fetch data from Services
- Screens pass data to MapViewComponent as props
- Component never fetches data directly—purely presentational

**Usage Example:**

```tsx
import MapViewComponent from '@/components/MapViewComponent';
import { MapStyles } from '@/adapters/MapBoxAdapter';

<MapViewComponent
  polylines={tripRoutes}
  userPosition={currentLocation}
  mapStyle={MapStyles.STREETS}
  onRecenter={handleRecenter}
/>
```

### BasemapLayout

**Purpose:** Provides persistent full-screen map background with overlay slots

**Slots:**
- **Header** - Top of screen (e.g., title + profile button)
- **Body** - Main content area overlaying map (e.g., trip history cards)
- **Secondary Footer** - Above footer (e.g., recenter button)
- **Footer** - Bottom navigation bar

All slots are transparent by default, allowing the map to show through unless a screen adds opaque content.

**Used By:**
- HomeScreen
- ActiveTripScreen
- TripSummaryScreen
- TripHistoryScreen

### Other Components

- **BottomNavigationBarComponent**: Record button (launches TripModal), Home button, History button
- **TripModal**: Multi-purpose modal with three modes:
  - **Start Trip Mode** (default): Collects mode, comfort level, trip purpose before starting trip
  - **Orphaned Trip Mode**: Detects paused/active trips on app launch and offers resume/end options
  - **Post-Trip Survey Mode**: After trip completion, asks "Did you reach your destination?" (Yes/No)
    - Triggered when user stops a trip on ActiveTripScreen
    - Result stored as `reachedDest` boolean in trip metadata
    - Used for analyzing trip completion rates and routing effectiveness
- **DataRangerCallout**: Feature rating callout bubble for DataRanger mode
  - Available on Active Trip and Trip Summary screens only
  - Displays feature details (location, condition score, intersection position, curb position)
  - Rating slider (1-10 scale, defaults to 5)
  - Image upload button (camera or photo library via expo-image-picker)
  - Calls DataRangerService to log ratings to Supabase rated_features table
  - Compact design optimized for MapboxGL.Callout display
  - Supports re-rating (pre-fills existing rating when available)
  - **6-Hour Rating Window**: Features encountered more than 6 hours ago display in read-only mode (info only, no interactive UI)
  - Read-only mode shows existing rating without slider/upload controls
  - Not available on Home screen (Home screen shows polylines only for trip navigation)
- **TripHistoryCard**: Displays trip summary with privacy-preserving binned data (time of day bin, weekday/weekend, mode, duration, distance, comfort rating)
  - Formats time bins into readable labels (e.g., "Morning Rush", "Late Night")
  - Shows weekday vs weekend classification
  - Supports both card and drawer variants for different screen layouts
- **SelectModeListComponent**: Mode selection UI (wheelchair, skateboard, assisted walking, walking, scooter)
- **RecenterButton**: Recenters map on user's current GPS position

## Screens

### Authentication Flow (`/app/(auth)`)

- **LoginScreen**: Authenticates users via DatabaseAdapter AuthService
- **CreateProfileScreen**: Registers new users (age 18+, display name, password, mode list) with CAPTCHA verification
- **ProfileScreen**: Displays user statistics (avg trip length/duration), mode list editor, logout/delete account buttons

### Main Flow (`/app/(main)`)

All main screens use BasemapLayout with persistent map background.

- **HomeScreen**: 
  - Displays all user trip polylines via HistoryService
  - Map auto-zooms to encompass all trip data
  - Bottom navigation bar in footer slot
  - Recenter button in secondary footer slot

- **ActiveTripScreen**:
  - Shows real-time trip recording with live polyline updates from TripService
  - Tracks relative time (seconds since trip start) for each GPS point
  - Maintains absolute timestamp locally for orphaned trip detection
  - Pause/stop buttons in footer slot
  - Recenter button in secondary footer slot
  - On trip end, displays post-trip survey modal asking "Did you reach your destination?"
  - Survey result (reachedDest: boolean) passed to TripService.endTrip() for storage
  - After survey completion, navigates to TripSummaryScreen

- **TripSummaryScreen**:
  - Given a trip_id, displays route data via HistoryService
  - Shows TripHistoryCard in drawer format in footer slot with binned time data
  - Displays time-of-day label (e.g., "Morning Rush") and weekday/weekend classification

- **TripHistoryScreen**:
  - Lists all trips as TripHistoryCard components in body slot
  - Each card shows binned time data instead of absolute timestamps
  - Profile button in header slot
  - Map is frozen and dimmed (interactionState prop)

## Technology Stack

- **React Native** (0.81.5) with **Expo** (~54.0.33)
- **Expo Router** (~6.0.23) for file-based routing
- **TypeScript** (~5.9.2) with strict mode
- **@rnmapbox/maps** (^10.2.10) - MapBox integration
- **@supabase/supabase-js** (^2.95.3) - Backend and auth
- **@sphereon/isomorphic-argon2** (^1.0.1) - Password hashing (Argon2id algorithm)
- **@sphereon/react-native-argon2** (^2.0.9) - Native Argon2 bindings for React Native
- **expo-crypto** (~15.0.8) - Cryptographically secure random number generation
- **Jest** (~29.7.0) - Testing framework

## Security

### Privacy-Preserving Time Binning

RollTracks implements a comprehensive privacy-first architecture that prevents re-identification attacks while maintaining analytical utility for urban planning research.

**Time Binning System:**

Instead of storing exact trip timestamps, RollTracks bins all temporal data:

1. **Time of Day Bins** (7 categories):
   - `late_night` (00:00 - 05:00)
   - `early_morning` (05:00 - 07:00)
   - `morning_rush` (07:00 - 10:00)
   - `midday` (10:00 - 16:00)
   - `evening_rush` (16:00 - 19:00)
   - `evening` (19:00 - 22:00)
   - `night` (22:00 - 24:00)

2. **Weekday Indicator** (binary):
   - `1` for weekdays (Monday-Friday)
   - `0` for weekends (Saturday-Sunday)

3. **Relative Timestamps** (GPS tracks):
   - Each coordinate includes time in seconds since trip start
   - Stored in GeoJSON `properties.times` array: `[0, 5, 10, 15, ...]`
   - Enables speed analysis without exposing exact trip timing

**Privacy Benefits:**
- **Temporal anonymity**: Reduces time granularity from 86,400 possible seconds/day to just 7 bins
- **Date anonymity**: Binary weekday/weekend classification prevents date-specific identification
- **No trip timing reconstruction**: Relative timestamps prevent linking trips to specific times
- **k-anonymity**: Easier to achieve k≥5 similar trips within the same time bin
- **Server never sees absolute times**: Time binning happens server-side in DatabaseAdapter after receiving absolute timestamp, which is immediately discarded

**Implementation Flow:**
1. TripService tracks GPS with absolute timestamps locally (in-memory + AsyncStorage)
2. For each GPS point, calculates relative time (seconds since trip start)
3. On trip end, passes absolute `startTime` and relative timestamps to DatabaseAdapter
4. DatabaseAdapter bins `startTime` to `timeOfDay` and `weekday`, then discards absolute value
5. Stores only binned data and relative timestamps in Supabase
6. Local absolute timestamps used only for orphaned trip detection (within 200m = resume)

**Database Schema:**
```sql
CREATE TYPE time_of_day_bin AS ENUM (
  'late_night', 'early_morning', 'morning_rush', 'midday',
  'evening_rush', 'evening', 'night'
);

ALTER TABLE trips
  ADD COLUMN time_of_day time_of_day_bin NOT NULL,
  ADD COLUMN weekday INTEGER NOT NULL;

-- Absolute timestamps completely removed
ALTER TABLE trips
  DROP COLUMN start_time,
  DROP COLUMN end_time;
```

**GeoJSON Format:**
```json
{
  "type": "LineString",
  "coordinates": [[-97.7431, 30.2672], [-97.7432, 30.2673], ...],
  "properties": {
    "times": [0, 5, 10, 15, ...]
  }
}
```

### Anonymization Service

RollTracks implements a multi-tier anonymization pipeline to minimize identifiability while maximizing data richness. The goal is an open dataset of non-car transport activity that cannot be traced back to individual users.

**6 Layers of Anonymization:**

| # | Layer | Location | Status |
|---|-------|----------|--------|
| 1 | Relative timestamps | Client (TripService) | Implemented |
| 2 | Characteristic binning | Client (DatabaseAdapter) | Implemented |
| 3 | Census block clipping | Server (BEFORE INSERT trigger) | Implemented |
| 4 | Sidewalk network snapping | Server (BEFORE INSERT trigger) | Planned |
| 5 | Synthetic data for k-anonymity | Server (publish pipeline) | Planned |
| 6 | UUID removal on publish | Server (export pipeline) | Planned |

**Tier 1 Level 1 — Census Block Clipping:**

A PostgreSQL `BEFORE INSERT` trigger on the `trips` table automatically clips route geometries to exclude portions within the origin and destination census blocks. Only the route segment *between* blocks is stored, preventing identification of where trips start or end.

```
Original trip:  [Home] ──────────────────────────── [Work]
                ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓
                origin                          destination
                block                           block

Stored trip:           ░░░░░░░░░░░░░░░░░░░░░░░░
                       (only middle portion saved)
```

How it works:
1. On trip INSERT, the trigger identifies which census blocks contain the route's first and last points
2. Uses `ST_Difference` to clip the route geometry against those block polygons
3. Recalculates `distance_mi` from the clipped geometry
4. If the entire trip is within one or two blocks, geometry is set to NULL (metadata still stored)
5. Trips outside the coverage area pass through unmodified

Census block polygons are loaded from `assets/data/Blocks.geojson` into the `census_blocks` table via the seed script (`scripts/seed-census-blocks.js`).

The `corrected_segments` table is excluded from Tier 1 anonymization to preserve accurate geometries for sidewalk network correction.

**Data Flow with Anonymization:**
```
TripService (relative timestamps)
    → DatabaseAdapter (time binning)
        → Supabase INSERT
            → BEFORE INSERT trigger (census block clipping)
                → Stored trip: binned time + clipped geometry
```

### Password Hashing

RollTracks uses **Argon2id** for password hashing, the winner of the Password Hashing Competition and recommended by OWASP.

**Implementation:**
- Package: `@sphereon/isomorphic-argon2` with native bindings
  - Android: `argon2kt` (official Argon2 C library)
  - iOS: `CatCrypto` (Swift wrapper around official Argon2)
- Salt generation: `expo-crypto` (cryptographically secure, 16 bytes)

**Configuration:**
- Algorithm: Argon2id (hybrid mode, resistant to both side-channel and GPU attacks)
- Memory: 64 MiB (65536 KiB)
- Time: 3 iterations
- Parallelism: 4 threads
- Hash length: 32 bytes

**Verification Process:**
- Parses encoded hash to extract salt and parameters
- Re-hashes input password with identical parameters
- Constant-time comparison of encoded hash strings

**Benefits:**
- Memory-hard function resistant to GPU/ASIC attacks
- Side-channel attack resistance
- Configurable parameters for future-proofing
- Optimal balance between security and mobile performance (~200-300ms on mobile devices)

### Authentication Architecture

- **Anonymous Supabase users** with username/password recovery
- **Two-layer authentication**: Local device security + multi-device recovery
- **No email collection** for maximum privacy
- **CAPTCHA verification** (Cloudflare Turnstile) after failed login attempts
- **Row Level Security (RLS)** on all database tables
- **SECURITY DEFINER functions** to prevent username enumeration

### Security Configuration

When setting up Supabase, ensure proper RLS policies are configured. See `/supabase/migrations/` for migration files that establish:
- User profile access controls
- Trip data isolation by user
- Account recovery security
- Function security definers
- Time binning schema and privacy-preserving data model

**Key Migrations:**
- `20250209000009_migrate_to_argon2.sql` - Upgrades password hashing to Argon2id
- `20250209000010_fix_argon2_regex.sql` - Fixes Argon2 hash validation regex for base64 padding
- `20250209000011_update_trips_table_binning.sql` - Implements time binning schema with relative timestamps
- `20250209000012_anonymization_census_block_clipping.sql` - Census block clipping trigger for origin/destination anonymization
- `20250210000000_fix_census_block_insert.sql` - Fixes census block data insertion issues
- `20250210000001_add_reached_dest.sql` - Adds post-trip survey field and device/software version tracking to user profiles
- `20250212000000_dataranger_assets.sql` - Creates storage bucket and metadata table for DataRanger feature assets
- `20250212000001_feature_images.sql` - Creates storage bucket for user-uploaded feature photos and adds image_url column to rated_features table

Refer to `/supabase/SECURITY_DEFINER_AUDIT.md` for security audit documentation.

### Security Advisors

RollTracks uses Supabase's security advisor to continuously monitor for vulnerabilities. As of the latest check:

**Resolved:**
- ✅ All 16 function search path warnings fixed (migration `20250212000002_fix_function_search_path_warnings.sql`)
  - Added `SET search_path = ''` to all database functions to prevent search path hijacking attacks

**Remaining Warnings (Expected/Acceptable):**
- ⚠️ **Anonymous Access Policies** - Expected for privacy-first architecture
  - `asset_metadata`, `curb_ramps`, `storage.objects` tables allow public read access
  - Required for DataRanger mode and public infrastructure data
- ⚠️ **PostGIS Extension in Public Schema** - Cannot be moved without breaking existing spatial functions
- ⚠️ **spatial_ref_sys RLS Disabled** - PostGIS system table, requires superuser to modify
- ⚠️ **Leaked Password Protection Disabled** - Consider enabling in Supabase Auth settings for additional security

To check current security status:
```bash
# Using Supabase CLI
supabase db lint --level warning

# Or via Supabase Dashboard
# Navigate to: Database → Advisors → Security
```

## DataRanger Mode

DataRanger mode is an opt-in feature that enables users to validate and improve urban infrastructure data quality.

### Features

- **Curb Ramp Rating**: Rate condition of curb ramps (1-10 scale) during trips with optional photo uploads
- **Photo Documentation**: Upload images of curb ramps and accessibility features using camera or photo library
- **Sidewalk Correction**: Correct AI-generated sidewalk network data
- **On-Demand Asset Loading**: Feature data downloaded only when DataRanger mode is enabled
- **Automatic Updates**: Checks for new feature data on app launch

### Asset Management

**Storage:**
- Feature data stored in Supabase Storage bucket: `dataranger-assets`
- Assets: `curb_ramps.geojson` (~17 MB), `sidewalks.geojson` (TBD)
- Version tracking via `asset_metadata` table

**Caching:**
- Downloaded assets cached in AsyncStorage
- Cache persists between app sessions
- Update check on each app launch when DataRanger mode is active
- Cache cleared when DataRanger mode is disabled (optional)

**Upload Script:**
```bash
node scripts/upload-dataranger-assets.js
```

This script:
1. Uploads `assets/data/curb_ramps.geojson` to Supabase Storage
2. Updates `asset_metadata` table with version timestamp
3. Enables automatic update detection in the app

**User Flow:**
1. User enables DataRanger mode in Profile Screen
2. DataRangerContext initializes and downloads feature data
3. Features cached locally for offline access
4. On subsequent app launches, checks for updates

### Image Upload

**Feature Photo Documentation:**
- Users can upload photos of curb ramps and accessibility features when rating them
- Images stored in Supabase Storage bucket: `feature-images`
- Organized by user ID for access control and cleanup
- Supports both camera capture and photo library selection

**Storage Structure:**
```
feature-images/
  └── {userId}/
      └── {crisId}_{timestamp}.{ext}
```

**Permissions:**
- iOS: Camera and Photo Library permissions configured in app.json
- Android: CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE permissions
- Permissions requested at runtime when user attempts to upload

**Implementation:**
- Package: `expo-image-picker` for camera and gallery access
- Image quality: 0.8 compression for optimal balance between quality and file size
- Aspect ratio: 4:3 with editing enabled
- Upload handled by DatabaseAdapter with automatic URL generation
- Image URLs stored in `rated_features.image_url` column

**Privacy:**
- Images are public (linked to anonymized ratings)
- User IDs in storage paths are anonymous Supabase UUIDs
- No EXIF data or metadata preserved that could identify users
- Images can be deleted when user deletes their rating or account
5. During active trips, features displayed within 50m of user position
6. User can rate features via DataRanger modal
7. Ratings uploaded to Supabase and linked to trip

**Privacy:**
- Feature data is public (city infrastructure)
- User ratings are anonymized (linked to anonymized trips)
- No personal data in feature cache

## Screen Implementation Status

### Completed Screens

- **Login Screen** (`/app/(auth)/login.tsx`) - User authentication
- **Create Profile Screen** (`/app/(auth)/create-profile.tsx`) - New user registration
- **Profile Screen** (`/app/(auth)/profile.tsx`) - User settings and statistics
- **Home Screen** (`/app/(main)/index.tsx`) - Map view with trip history overlay
- **Trip History Screen** (`/app/(main)/history.tsx`) - List of past trips with profile button
- **Trip History Cards** (`/components/TripHistoryCard.tsx`) - Component for displaying trip summaries with binned time data (time-of-day labels, weekday/weekend classification)

### In Progress

- **Active Trip Screen** - Real-time trip recording interface with relative timestamp tracking
- **Trip Summary Screen** - Detailed view of individual trips with privacy-preserving binned data

### Basemap Layout Pattern

All main screens use the `BasemapLayout` component which provides:
- Persistent map background (full screen)
- **Header slot** - Top of screen (e.g., title + profile button)
- **Body slot** - Main content area overlaying map
- **Secondary footer slot** - Above footer
- **Footer slot** - Bottom navigation bar

All slots are transparent by default to show the map through.

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native MapBox](https://github.com/rnmapbox/maps)
- [Supabase Documentation](https://supabase.com/docs)

For detailed architecture information, see `/prompts/RollTracks Architecture.md`.


## User Experience

### Haptic Feedback

RollTracks provides comprehensive haptic feedback throughout the app for enhanced tactile interaction on both iOS and Android.

**Implementation:**
- Centralized haptic utility (`/utils/haptics.ts`) for consistent feedback patterns
- Cross-platform support with appropriate fallbacks
- Uses `expo-haptics` for native haptic engine access

**Platform Support:**

| Platform | Impact Feedback | Notification Feedback | Selection Feedback |
|----------|----------------|----------------------|-------------------|
| **iOS** | ✅ Full support (Taptic Engine) | ✅ Full support | ✅ Full support |
| **Android** | ✅ Full support (Vibration) | ⚠️ Falls back to impact | ⚠️ Falls back to light impact |
| **Web** | ❌ No support | ❌ No support | ❌ No support |

**Platform Differences:**
- **iOS**: Uses native Taptic Engine with distinct patterns for each feedback type
- **Android**: Supports impact feedback (light/medium/heavy vibration patterns). Notification and selection types fall back to impact feedback since Android doesn't have equivalent native patterns
- **Web**: Haptic feedback gracefully degrades (no-op) on web platform

**Feedback Types:**

| Type | Usage | Examples | Android Fallback |
|------|-------|----------|------------------|
| **Light Impact** | Subtle selections and toggles | Tab switches, mode selection, comfort slider | Light vibration |
| **Medium Impact** | Standard interactions | Navigation buttons, recenter, pause/resume | Medium vibration |
| **Heavy Impact** | Primary actions | Record button press | Heavy vibration |
| **Success Notification** | Successful completions | Trip started, survey submitted | Medium vibration |
| **Warning Notification** | Destructive actions | Stop trip confirmation | Heavy vibration |
| **Error Notification** | Validation errors | Login failed, form errors | Heavy vibration |
| **Selection Feedback** | Picker changes | Mode/purpose selection, comfort level | Light vibration |

**Coverage:**

All interactive elements include appropriate haptic feedback:
- Bottom navigation (home, history, record button)
- Trip modal (mode, comfort, purpose selection)
- Post-trip survey (yes/no buttons)
- Trip controls (pause, resume, stop)
- Navigation (back button, profile button)
- Recenter button
- Authentication (login, create account)
- Settings toggles (DataRanger mode)

**Benefits:**
- Improved accessibility for users with visual impairments
- Enhanced tactile confirmation of actions
- Better user confidence during critical operations (trip recording)
- Consistent feedback patterns across the app
- Cross-platform support for broader accessibility

**Usage Example:**

```typescript
import { mediumImpact, successNotification } from '@/utils/haptics';

const handleButtonPress = () => {
  mediumImpact(); // Provide immediate tactile feedback (iOS & Android)
  performAction();
};

const handleSuccess = () => {
  successNotification(); // Confirm successful completion (iOS: success pattern, Android: medium vibration)
  navigateToNextScreen();
};
```


## DataRanger Mode Setup

DataRanger mode is an optional feature that allows users to rate curb ramps and correct sidewalk network data during trips. When enabled, the app downloads feature data from Supabase Storage for offline access.

### Prerequisites

1. Curb ramp GeoJSON data in `assets/data/curb_ramps.geojson`
2. Supabase Storage bucket configured for DataRanger assets
3. Asset metadata table in Supabase

### Setup Steps

#### 1. Verify Supabase Storage Bucket

The `dataranger-assets` bucket should already exist in your Supabase project (created by migration `20250212000000_dataranger_assets.sql`). Verify it's configured correctly:

**Via Supabase Dashboard:**
1. Navigate to Storage → Buckets
2. Verify `dataranger-assets` bucket exists and is marked as **Public**
3. If the bucket doesn't exist, the upload script will create it automatically

**Via SQL (optional):**
```sql
SELECT id, name, public FROM storage.buckets WHERE name = 'dataranger-assets';
-- Should return: public = true
```

#### 2. Upload Assets to Supabase Storage

**Prerequisites:**
- Service role key from Supabase (required for admin operations)
- Add to your `.env` file:
  ```bash
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
  ```
- Find it in: Supabase Dashboard → Project Settings → API → `service_role` key
- ⚠️ **WARNING**: Keep this key secret! Never commit it to version control. Add `.env` to `.gitignore`.

Run the upload script to upload the curb ramps data:

```bash
node scripts/upload-curb-ramps-storage.js
```

This script will:
- Verify/create the `dataranger-assets` public storage bucket
- Upload `curb_ramps.geojson` (~17 MB) to the bucket
- Update the `asset_metadata` table with version and file size information
- Display the public URL for verification

**Expected Output:**
```
Reading curb_ramps.geojson...
File size: 17.23 MB
✓ Bucket already exists
Uploading curb_ramps.geojson to Supabase Storage...
✓ File uploaded successfully!
Path: curb_ramps.geojson
Public URL: https://[project-ref].supabase.co/storage/v1/object/public/dataranger-assets/curb_ramps.geojson
✓ Asset metadata updated
✓ Done!
```

#### 3. Verify Upload Success

**Option A: Via Supabase Dashboard**
1. Navigate to Storage → dataranger-assets bucket
2. Verify `curb_ramps.geojson` appears in the file list
3. Check file size is approximately 17 MB

**Option B: Via SQL**
```sql
SELECT name, metadata->>'size' as size_bytes, created_at 
FROM storage.objects 
WHERE bucket_id = 'dataranger-assets' AND name = 'curb_ramps.geojson';
```

**Option C: Test Download URL**

Open this URL in your browser (replace `[project-ref]` with your Supabase project reference):
```
https://[project-ref].supabase.co/storage/v1/object/public/dataranger-assets/curb_ramps.geojson
```

If configured correctly, the GeoJSON file should download immediately.

#### 4. Enable DataRanger Mode in App

Users can enable DataRanger mode from the Profile screen:
1. Open the app and navigate to Profile
2. Toggle "DataRanger Mode" on
3. The app will automatically download and cache the feature data

**First-time initialization logs:**
```
[DataRangerService] Initializing...
[DataRangerService] No cache found, loading from local assets...
[DataRangerService] Loaded from local assets
[DataRangerService] Loaded 17234 features into memory
[DataRangerService] Spatial index stats: {totalCells: 1523, totalFeatures: 17234}
```

### How It Works

**Two-Tier Loading Strategy:**

DataRangerService uses a simplified loading approach optimized for React Native:

1. **Cache First** (AsyncStorage)
   - Fastest: Loads from local cache if available
   - No network required
   - Checks for updates in background

2. **Server Download** (Supabase Storage)
   - Downloads from `dataranger-assets/curb_ramps.geojson` if no cache exists
   - Caches downloaded data for offline use
   - Updates asset metadata with version timestamp

**Note**: Local asset bundling is disabled because Metro bundler has issues with large JSON files (17 MB). The app downloads directly from Supabase Storage on first use, then caches for offline access.

**Update Checking:**

When DataRanger mode is enabled and the app launches:
- Compares local version timestamp with server version
- Downloads new data if server version is newer
- Updates cache automatically
- User sees latest data without manual intervention

**Cache Management:**

- Large GeoJSON data stored in FileSystem (app document directory)
  - Path: `${FileSystem.documentDirectory}dataranger_curb_ramps.json`
  - Handles files up to device storage limits (no 6 MB AsyncStorage limit)
- Version metadata stored in AsyncStorage
  - Key: `@dataranger/curb_ramps_version`
  - Small timestamp string for update checking
- Cache cleared when DataRanger mode is disabled
- Typical cache size: ~17 MB (San Francisco CRIS dataset)

### Troubleshooting

**Error: "Cannot find module '@/assets/data/curb_ramps.geojson'"**

This error is expected and harmless. Local asset bundling is disabled because Metro bundler has issues with large JSON files. The app will automatically fall back to downloading from Supabase Storage.

**Error: "data.text is not a function"**

This error occurs when the Blob API differs between environments. The DatabaseAdapter now handles both web and React Native Blob formats using FileReader as a fallback.

**Error: "Failed to download curb_ramps.geojson: 400"**

This means the file doesn't exist in Supabase Storage. Run the upload script:

```bash
node scripts/upload-curb-ramps-storage.js
```

**Verify the file is accessible:**

The file should be publicly accessible at:
```
https://[project-ref].supabase.co/storage/v1/object/public/dataranger-assets/curb_ramps.geojson
```

Replace `[project-ref]` with your Supabase project reference (found in Project Settings → API → Project URL).

For the RollTracks project, the URL is:
```
https://vavqokubsuaiaaqmizso.supabase.co/storage/v1/object/public/dataranger-assets/curb_ramps.geojson
```

If you get a 400 error when accessing this URL, the file hasn't been uploaded yet.

**Features not appearing on map during active trip**

1. Verify DataRanger mode is enabled in Profile screen
2. Check that features initialized successfully in logs: `[DataRangerService] Loaded X features into memory`
3. Ensure GPS permissions are granted
4. Verify you're within 50m of curb ramp features (default query radius)

**Cache not updating with new data**

1. Disable DataRanger mode in Profile screen
2. Re-enable DataRanger mode
3. This forces a fresh download and cache update

### Development Notes

**Adding New Feature Types:**

To add sidewalk segments or other feature types:

1. Add GeoJSON file to `assets/data/` (e.g., `sidewalks.geojson`)
2. Update `DatabaseAdapter.ts` to support the new asset type
3. Modify `DataRangerService.ts` to handle the new feature schema
4. Update the upload script to include the new file
5. Run the upload script to deploy to Supabase Storage

**Testing Without Server:**

The local assets fallback allows testing DataRanger features without Supabase Storage:

1. Ensure `assets/data/curb_ramps.geojson` exists
2. Enable DataRanger mode
3. App will load from local assets and cache
4. Features will work offline immediately

**Performance Considerations:**

- Spatial grid indexing enables sub-millisecond queries for 50m radius
- LRU cache (max 10 queries) reduces redundant spatial searches
- Feature limit of 50 results per query prevents UI overload
- Haversine distance calculation for precise proximity filtering
