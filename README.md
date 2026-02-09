# RollTracks

A privacy-first route sharing platform for non-car transport users, with a focus on wheelchair users, skateboarders, and other travelers sensitive to ADA compliance.

## Overview

RollTracks creates an anonymized, open dataset of non-car transport activity for routing and traffic modeling analysis. The app develops wheelchair and skateboard-specific models of Level of Traffic Stress for better urban design integration.

### Key Features

- **Trip Recording**: Track routes with mode selection (wheelchair, skateboard, assisted walking, walking, scooter), comfort level, and trip purpose
- **Privacy-First**: Anonymous Supabase accounts with username/password recovery (no email collection)
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

3. Start the development server

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
│  - DatabaseAdapter: Auth + data operations              │
│  - MapBoxAdapter: Tile fetching and styles              │
│  - GPSAdapter: Native location services                 │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  SERVICES (Business Logic)                              │
│  - TripService: Recording, polyline compilation         │
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
ActiveTripScreen → TripService → GPSAdapter → Native GPS
                       ↓
                  SyncService → DatabaseAdapter → Supabase
```

### Key Directories

- `/app` - Screens with file-based routing
  - `(auth)/` - Login, registration, profile management
  - `(main)/` - Home, active trip, trip summary, history
- `/components` - Reusable UI components (receive data via props)
- `/adapters` - External service abstraction layer
  - `DatabaseAdapter.ts` - Supabase operations (auth + data)
  - `MapBoxAdapter.ts` - Map tile fetching and styles
  - `GPSAdapter.ts` - Native GPS access
- `/services` - Business logic layer
  - `TripService.ts` - Trip recording and polyline compilation
  - `SyncService.ts` - Offline buffering and sync queue
  - `HistoryService.ts` - Trip retrieval and statistics
- `/contexts` - React Context providers
  - `AuthContext.tsx` - User authentication state
  - `TourContext.tsx` - Onboarding tour state
- `/assets` - Static resources (images, local data)
- `/constants` - Configuration and theme

## Core Services

### TripService

**Purpose:** Manages trip recording lifecycle and GPS data compilation

**Responsibilities:**
- Validates GPS and internet connectivity before trip start
- Receives GPS data from GPSAdapter and compiles into polylines
- Maintains persistent trip state (active/paused/completed)
- Detects orphaned trips on app launch (within 200m = resume, else end)
- Passes polyline data to SyncService for upload
- Serves real-time polylines to ActiveTripScreen for display

**Dependencies:**
- GPSAdapter (location data)
- SyncService (data persistence)

**Used By:**
- ActiveTripScreen
- StartTripModal

### SyncService

**Purpose:** Handles offline trip buffering and upload queue management

**Responsibilities:**
- Receives trip data from TripService
- Buffers data locally when connectivity is lost mid-trip
- Automatically syncs buffered data when connectivity returns
- Uses DatabaseAdapter to write to Supabase

**Dependencies:**
- DatabaseAdapter (Supabase operations)

**Used By:**
- TripService

### HistoryService

**Purpose:** Retrieves and aggregates historical trip data

**Responsibilities:**
- Fetches trip lists with summary details (mode, duration, distance, comfort)
- Provides polyline data for map visualization
- Calculates user statistics (average trip length, duration)
- Uses DatabaseAdapter to query Supabase tables

**Dependencies:**
- DatabaseAdapter (Supabase queries)

**Used By:**
- HomeScreen (all trips overview)
- TripSummaryScreen (individual trip details)
- TripHistoryScreen (trip list)
- ProfileScreen (user statistics)

## Core Adapters

### DatabaseAdapter

**Purpose:** Abstraction layer for all database operations, enabling easy migration between cloud providers

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
- Trip data writes (from TripService via SyncService)
- Trip data reads (for HistoryService)
- Asset version checking (local vs. server)

**Authentication Architecture:**
- Creates Supabase anonymous user (random UUID) on registration
- Password hashing: Argon2id with cryptographically secure salt (see [Password Hashing](#password-hashing))
- Stores username + Argon2id password hash locally in secure storage
- Stores recovery credentials (username + hash) server-side in account_recovery table
- JWT tokens (access + refresh) managed automatically by Supabase SDK in AsyncStorage
- On device recovery: validates credentials → creates new anonymous user → migrates all data
- Verification: parses encoded hash, re-hashes with same parameters, compares results

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

### GPSAdapter

**Purpose:** Source of truth for GPS location data

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
- `userPosition` - Current GPS position (from GPSAdapter)
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

- **BottomNavigationBarComponent**: Record button (launches StartTripModal), Home button, History button
- **StartTripModal**: Collects mode, comfort level, trip purpose before starting trip
- **TripHistoryCard**: Displays trip summary (start time, mode, duration, distance)
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
  - Pause/stop buttons in footer slot
  - Recenter button in secondary footer slot
  - On trip end, navigates to TripSummaryScreen

- **TripSummaryScreen**:
  - Given a trip_id, displays route data via HistoryService
  - Shows TripHistoryCard in drawer format in footer slot

- **TripHistoryScreen**:
  - Lists all trips as TripHistoryCard components in body slot
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

Refer to `/supabase/SECURITY_DEFINER_AUDIT.md` for security audit documentation.

## Screen Implementation Status

### Completed Screens

- **Login Screen** (`/app/(auth)/login.tsx`) - User authentication
- **Create Profile Screen** (`/app/(auth)/create-profile.tsx`) - New user registration
- **Profile Screen** (`/app/(auth)/profile.tsx`) - User settings and statistics
- **Home Screen** (`/app/(main)/index.tsx`) - Map view with trip history overlay
- **Trip History Screen** (`/app/(main)/history.tsx`) - List of past trips with profile button

### In Progress

- **Trip History Cards** - Component for displaying trip summaries (placeholder implemented)
- **Active Trip Screen** - Real-time trip recording interface
- **Trip Summary Screen** - Detailed view of individual trips

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
