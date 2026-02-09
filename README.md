# RollTracks

A privacy-first route sharing platform for non-car transport users, with a focus on wheelchair users, skateboarders, and other travelers sensitive to ADA compliance.

## Overview

RollTracks helps create an anonymized, open dataset of non-car transport activity for routing and traffic modeling analysis. The app develops wheelchair and skateboard-specific models of Level of Traffic Stress for better urban design integration.

### Key Features

- **Trip Recording**: Track routes with mode, comfort level, and trip purpose
- **DataRanger Mode**: Advanced tools for validating curb ramp conditions and correcting sidewalk network data
- **Privacy-First**: Anonymous accounts with username/PIN recovery (no email collection)
- **Multi-Device Support**: Data migration between devices using recovery credentials

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

RollTracks follows a **Model-ViewModel-View** pattern with clear separation of concerns:

```
Data Model (Supabase, MapBox, GPS)
    ↕
Adapters (abstraction layer)
    ↕
Services (business logic)
    ↕
Contexts (state management)
    ↕
Screens & Components (UI)
```

### Key Directories

- `/app` - Screens with file-based routing (auth and main flows)
- `/components` - Reusable UI components
- `/adapters` - External service abstraction (Supabase, MapBox, GPS)
- `/services` - Business logic (Trip, History, DataRanger, Sync)
- `/contexts` - React Context providers (Auth, Tour, DataRanger)
- `/assets` - Static resources (images, local data)
- `/constants` - Configuration and theme

## MapBox Integration

The app uses MapBox for map rendering through a clean adapter pattern:

### MapBoxAdapter

Located in `/adapters/MapBoxAdapter.ts`, provides:

- **Map Styles**: Streets, Outdoors, Light, Dark, Satellite, Navigation modes
- **Configuration**: Access token management and validation
- **Tile URLs**: Custom tileset support for data overlays

### MapViewComponent

The `MapViewComponent` (`/components/MapViewComponent.tsx`) integrates with the MapBox adapter and accepts:

**Props:**
- `polylines` - Trip route data
- `features` - Curb ramps, obstacles, segments
- `centerPosition` - Map center coordinates
- `userPosition` - Current GPS position
- `interactionState` - Interactive or dimmed
- `mapStyle` - MapBox style (from adapter)
- `onFeaturePress` - Feature selection callback
- `onRecenter` - Recenter button callback

**Usage Example:**

```tsx
import MapViewComponent from '@/components/MapViewComponent';
import { MapStyles } from '@/adapters/MapBoxAdapter';

<MapViewComponent
  polylines={tripRoutes}
  features={curbRamps}
  userPosition={currentLocation}
  mapStyle={MapStyles.STREETS}
  onFeaturePress={handleFeaturePress}
/>
```

## Technology Stack

- **React Native** (0.81.5) with **Expo** (~54.0.33)
- **Expo Router** (~6.0.23) for file-based routing
- **TypeScript** (~5.9.2) with strict mode
- **@rnmapbox/maps** - MapBox integration
- **@supabase/supabase-js** - Backend and auth
- **argon2** - Password hashing (Argon2id algorithm)
- **Jest** (30.2.0) - Testing framework

## Security

### Password Hashing

RollTracks uses **Argon2id** for password hashing, the winner of the Password Hashing Competition and recommended by OWASP. This provides superior security compared to bcrypt:

**Configuration:**
- Algorithm: Argon2id (hybrid mode, resistant to both side-channel and GPU attacks)
- Memory: 64 MiB (65536 KiB)
- Time: 3 iterations
- Parallelism: 4 threads

**Benefits:**
- Memory-hard function resistant to GPU/ASIC attacks
- Side-channel attack resistance
- Configurable parameters for future-proofing
- Optimal balance between security and mobile performance

**Migration from bcrypt:**
- New registrations automatically use Argon2id
- Existing bcrypt hashes are no longer supported
- Users with old accounts will need to re-register

### Authentication Architecture

- **Anonymous Supabase users** with username/password recovery
- **Two-layer authentication**: Local device security + multi-device recovery
- **No email collection** for maximum privacy
- **CAPTCHA verification** (Cloudflare Turnstile) after failed login attempts
- **Row Level Security (RLS)** on all database tables
- **SECURITY DEFINER functions** to prevent username enumeration

## Testing

```bash
npm test               # Run all tests
npm run test:a11y      # Run accessibility tests only
```

Tests are located in `__tests__/` with mocks in `__mocks__/`.

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
