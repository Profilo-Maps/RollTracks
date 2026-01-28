# Tour Crash Fix and Simulated Trip Removal

## Issue
The tour was crashing on step 4 when trying to navigate to ActiveTrip screen because no real active trip existed.

## Solution
Removed all simulated trip functionality and updated tour to have 5 steps with step 4 staying on StartTrip screen to explain active trip functionality.

## Changes Made

### 1. Updated Tour Steps (TourService.ts)
Changed from 4 steps to 5 steps:
1. **Home** - Profile button introduction
2. **Profile** - Modes section customization
3. **StartTrip** - Record button explanation
4. **StartTrip** (NEW) - Active trip info: "When a trip is active, dots representing street features will pop up. Click on the dots to rate them."
5. **History** - Trip history review

### 2. Removed Simulated Trip Functionality
- **Deleted**: `src/services/SimulatedTripManager.ts`
- **Updated**: `src/types/tour.types.ts`
  - Removed `SimulatedTrip` interface
  - Removed `SimulatedObstacle` interface
  - Removed `simulatedTrip` field from `TourState` interface
  - Changed `TourAction` type from `'navigate' | 'simulate_trip' | 'end_simulation'` to just `'navigate'`

### 3. Updated TourService.ts
- Removed `SimulatedTripManager` import and instance
- Removed `getSimulatedTripManager()` method
- Removed simulated trip handling from `navigateToStep()` method
- Removed simulated trip cleanup from `dismissTour()` and `completeTour()` methods
- Removed `simulatedTrip` field from all `TourState` objects

### 4. Updated TourContext.tsx
- Removed `simulatedTrip: null` from initial state
- Removed `simulatedTrip: null` from resumed state

## Testing
The tour now:
- Starts automatically after user enters age and mode preferences
- Navigates through all 5 steps without crashing
- Stays on StartTrip screen for step 4 to explain active trip functionality
- Completes successfully on step 5

## Files Modified
- `src/services/TourService.ts` - Removed simulated trip logic, updated steps
- `src/types/tour.types.ts` - Removed simulated trip types
- `src/contexts/TourContext.tsx` - Removed simulatedTrip from state
- `src/services/SimulatedTripManager.ts` - DELETED

## Next Steps
- Test the complete tour flow end-to-end
- Verify no TypeScript errors remain
- Update any tests that reference simulated trips
