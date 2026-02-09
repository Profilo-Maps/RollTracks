# Project Structure

## Architecture Pattern

**Model-ViewModel-View** with clear separation of concerns:

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

## Directory Organization

### `/app` - Screens (File-based Routing)
- `(auth)/` - Authentication flow screens
  - `login.tsx`, `create-profile.tsx`, `profile.tsx`
- `(main)/` - Main app screens
  - `index.tsx` (home), `active-trip.tsx`, `trip-summary.tsx`, `history.tsx`
- `_layout.tsx` - Root layout

### `/components` - Reusable UI Components
- Screen-specific components (modals, cards, navigation)
- Shared UI primitives in `/ui` subdirectory
- Components receive data via props, don't fetch directly

### `/contexts` - React Context Providers
- `AuthContext.tsx` - User authentication state
- `TourContext.tsx` - Onboarding tour state
- `DataRangerContext.tsx` - DataRanger mode state

### `/services` - Business Logic Layer
- `TripService.ts` - Trip recording and management
- `HistoryService.ts` - Trip history retrieval
- `DataRangerService.ts` - Feature rating and segment correction
- `SyncService.ts` - Data synchronization buffer

### `/adapters` - External Service Abstraction
- `DatabaseAdapter.ts` - Database operations (auth + data)
- `MapBoxAdapter.ts` - Map tile fetching
- `GPSAdapter.ts` - Native GPS data access

### `/assets` - Static Resources
- `/data` - Local JSON data (CurbRamps.json, Sidewalks.json)
- `/images` - App icons, splash screens, logos

### `/constants` - Configuration
- `theme.ts` - Theme and styling constants

### `/hooks` - Custom React Hooks
- `use-color-scheme.ts` - Theme detection
- `use-theme-color.ts` - Theme color utilities

### `/__tests__` - Test Files
- Test files with `.test.ts` suffix
- Accessibility tests in separate suite

### `/__mocks__` - Test Mocks
- Mock implementations for testing (e.g., react-native)

## Key Conventions

### Data Flow
- **Screens** fetch data from **Services**
- **Services** use **Adapters** for external data
- **Components** receive data via props (no direct service calls)
- **Contexts** provide global state across screens

### Component Props Pattern
MapViewComponent example:
- Accepts: map tiles, polylines, features, center position, interaction state
- Callbacks: onFeaturePress, onRecenter
- Does NOT fetch data internally

### Naming
- Screens: PascalCase with "Screen" suffix (implied by location)
- Components: PascalCase with "Component" suffix
- Services: PascalCase with "Service" suffix
- Adapters: PascalCase with "Adapter" suffix
- Contexts: PascalCase with "Context" suffix

### File Organization
- One component/service/adapter per file
- Co-locate related files in feature directories
- Use index files sparingly (Expo Router handles routing)

## Basemap Layout Pattern

Persistent map background with overlay slots:
- **Header slot** - Top of screen
- **Body slot** - Main content area (overlays map)
- **Secondary footer slot** - Above footer
- **Footer slot** - Bottom of screen
- All slots transparent by default to show map through
