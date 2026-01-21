# Features Not Showing Fix

## Issue
Features (curb ramps/obstacles) were not appearing on the Active Trip screen or Trip History screen.

## Root Causes

### 1. Missing GeoJSON Asset File
The `curb_ramps.geojson` file was not copied to the Android assets folder (`android/app/src/main/assets/`), which prevented the ObstacleService from loading any features.

**Solution:** Run the copy script before building:
```bash
npm run copy-geojson
```

Or run the prebuild script which copies both tiles and geojson:
```bash
npm run prebuild
```

### 2. Missing Feature Count in Trip History
The TripCard component (used in TripHistoryScreen) did not display any information about rated features, making it unclear whether features were recorded during trips.

**Solution:** Updated TripCard to:
- Accept a `ratedFeaturesCount` prop
- Display the count of rated features when > 0
- Updated TripHistoryScreen to load and pass the rated features count for each trip

## Files Modified

### 1. `src/components/TripCard.tsx`
- Added `ratedFeaturesCount` prop to interface
- Added display of rated features count in the trip details

### 2. `src/screens/TripHistoryScreen.tsx`
- Added state for `ratedFeaturesCounts` (Record<string, number>)
- Updated `loadTrips()` to fetch rated features count for each trip
- Updated `onRefresh()` to fetch rated features count for each trip
- Updated `renderTripItem()` to pass the count to TripCard

## How Features Work

### During Active Trip (ActiveTripScreen)
1. ObstacleService initializes and loads features from `curb_ramps.geojson`
2. As GPS location updates, nearby obstacles are queried (50m radius)
3. Encountered obstacles are accumulated and displayed on the map
4. User can tap features to rate them
5. Rated features are stored in LocalStorage with the trip ID

### After Trip Completion (TripSummaryScreen)
1. Trip route is decoded from the stored polyline geometry
2. ObstacleService queries obstacles along the entire route
3. Previously rated features are loaded from storage
4. All encountered obstacles are displayed on the map
5. Rated features show their ratings with color-coded stars
6. User can still rate features within 24 hours of trip completion

### In Trip History (TripHistoryScreen)
1. All trips are loaded from storage
2. For each trip, the count of rated features is fetched
3. TripCard displays the feature count (e.g., "3 rated")
4. Tapping a completed trip navigates to TripSummaryScreen

## Build Requirements

**IMPORTANT:** After copying the GeoJSON file, you must rebuild the app for the asset to be included in the APK:

```bash
# Copy assets
npm run prebuild

# Rebuild Android app
npm run android
```

Or for release builds:
```bash
npm run prebuild
cd android
./gradlew assembleRelease
```

## Verification

To verify features are working:

1. **Check asset file exists:**
   - File should exist at: `android/app/src/main/assets/curb_ramps.geojson`
   - File size should be ~17MB

2. **Check console logs during app startup:**
   - Look for: "ObstacleService initialized with X features"
   - Should show thousands of features loaded

3. **During active trip:**
   - Console should show: "Found X nearby obstacles"
   - Features should appear as markers on the map
   - Tapping features should open the rating popup

4. **In trip history:**
   - Completed trips should show "X rated" in the feature count
   - Tapping a trip should show the trip summary with obstacles

## Troubleshooting

### No features appear on map
- Check if `curb_ramps.geojson` exists in assets folder
- Rebuild the app after copying the file
- Check console for "ObstacleService initialized" message
- Verify GPS location is in San Francisco area (where the data is from)

### Features appear but can't be rated
- Check if trip is active or within 24-hour grading window
- Verify RatingService is properly initialized
- Check console for rating-related errors

### Feature count shows 0 in history
- Verify features were actually rated during the trip
- Check LocalStorage for rated_features entries
- Ensure RatingService.getRatingsForTrip() is working

## Related Files
- `src/services/ObstacleService.ts` - Loads and queries features
- `src/services/RatingService.ts` - Manages feature ratings
- `src/components/TripCard.tsx` - Displays trip info with feature count
- `src/screens/ActiveTripScreen.tsx` - Records trip and allows rating
- `src/screens/TripSummaryScreen.tsx` - Shows trip summary with features
- `src/screens/TripHistoryScreen.tsx` - Lists all trips with feature counts
- `scripts/copy-geojson-to-assets.js` - Copies GeoJSON to assets folder
