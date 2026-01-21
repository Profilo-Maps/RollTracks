# 24-Hour Grading Limit Feature

## Overview
This feature adds a 24-hour time limit for grading (rating) features accessed through the trip history screen. Users can only rate obstacle features within 24 hours after a trip has been completed.

## Implementation Details

### New Files Created

#### 1. `src/utils/timeValidation.ts`
Contains utility functions for time-based validation:
- `canGradeTrip(trip)`: Checks if a trip is within the 24-hour grading window
- `getRemainingGradingTime(trip)`: Returns remaining time in milliseconds
- `formatRemainingTime(remainingMs)`: Formats remaining time as human-readable string

#### 2. `src/utils/__tests__/timeValidation.test.ts`
Unit tests for the time validation utilities (all tests passing).

### Modified Files

#### 1. `src/services/RatingService.ts`
- Updated `createRating()` to accept a `Trip` object instead of just `tripId`
- Updated `updateRating()` to accept a `Trip` object instead of just `tripId`
- Added validation to check if trip is within 24-hour window for completed trips
- Added new error message: `GRADING_WINDOW_EXPIRED`
- Enhanced `createRating()` to automatically check for existing ratings and update them instead of creating duplicates

#### 2. `src/screens/TripSummaryScreen.tsx`
- Added imports for time validation utilities and `RatingModal`
- Added state for `showRatingModal` and toast notifications
- Added `canGrade` and `remainingTime` computed values
- Implemented `handleRateButtonPress()` to check grading eligibility
- Implemented `handleRatingSubmit()` to create/update ratings using simplified `createRating()` call
- Implemented `handleRatingCancel()` for modal cancellation
- Updated `FeaturePopup` to pass grading status and remaining time
- Added `RatingModal` component to enable rating from trip history

#### 3. `src/screens/ActiveTripScreen.tsx`
- Updated calls to `ratingService.createRating()` to pass the full trip object instead of just the trip ID
- Simplified rating logic to always call `createRating()` - the service now handles existing rating checks internally

#### 4. `src/components/FeaturePopup.tsx`
- Added optional props: `canGrade` and `remainingTime`
- Updated button to show disabled state when grading is not available
- Added visual feedback showing "Rating Unavailable" and remaining time
- Added new styles: `disabledButton`, `disabledButtonText`, `remainingTimeText`

#### 5. `src/components/TripCard.tsx`
- Added imports for time validation utilities
- Added grading availability check and remaining time calculation
- Added visual indicator showing "⭐ Grading Available" badge for eligible trips
- Added grading time remaining display in trip details
- Added new styles: `statusRow`, `gradingBadge`, `gradingText`

#### 6. `src/types/index.ts`
- Removed duplicate `Trip` interface (now using the one from `database.types.ts`)
- Added comment noting that Trip type is imported from database types

## User Experience

### Trip History Screen
- Completed trips within 24 hours show a "⭐ Grading Available" badge
- Trip cards display remaining grading time (e.g., "23h 45m remaining")
- Visual indicators help users identify which trips can still be graded

### Trip Summary Screen
- Users can tap on obstacle features to view details
- If within 24-hour window: "Rate Feature" or "Update Rating" button is enabled
- If outside 24-hour window: Button shows "Rating Unavailable" with "Expired" message
- Error toast appears if user tries to rate after window expires

### Active Trip Screen
- No changes to functionality - users can still rate features during active trips
- Rating validation only applies to completed trips accessed from history

## Validation Rules

1. **Active/Paused Trips**: Can always be graded (no time limit)
2. **Completed Trips**: Can only be graded within 24 hours of `end_time`
3. **Trips without `end_time`**: Cannot be graded
4. **Time Calculation**: Based on difference between current time and trip `end_time`

## Error Handling

- Clear error messages when grading window has expired
- Toast notifications for user feedback
- Graceful degradation if trip data is missing
- Validation at both UI and service layers

## Testing

All time validation utilities have comprehensive unit tests covering:
- Active trip handling
- Trips without end_time
- Recent trips (within 24 hours)
- Expired trips (older than 24 hours)
- Time formatting edge cases

## Future Enhancements

Potential improvements for future iterations:
- Configurable time window (e.g., 48 hours, 7 days)
- Push notifications when grading window is about to expire
- Batch grading reminders for multiple trips
- Analytics on grading completion rates