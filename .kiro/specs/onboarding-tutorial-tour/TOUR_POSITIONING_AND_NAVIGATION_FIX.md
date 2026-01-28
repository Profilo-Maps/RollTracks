# Tour Positioning and Navigation Fix

## Issues

### Issue 1: Tour Bubbles Obstructing UI
The tour information bubbles were appearing in the center of the screen, obstructing all UI elements and making it difficult to see what the tour was highlighting.

### Issue 2: Tour Not Navigating Between Screens
The tour would stay fixed on the Home screen without iterating through the various pages when pressing "Next".

## Root Causes

### Issue 1 Root Cause
- Most tour steps (2, 3, 4) were configured with `position: 'center'`
- The center positioning placed the bubble directly in the middle of the screen
- The overlay container was using flex centering which didn't work well with absolute positioning

### Issue 2 Root Cause
- The navigation guard was blocking tour navigation due to a race condition
- When advancing to the next step:
  1. `navigateToStep()` would navigate to the new screen
  2. The navigation guard would fire and check if the current screen matches the expected screen
  3. The guard would see the OLD step index (not yet updated) and block the navigation
  4. User would be redirected back to the previous screen

## Solutions

### Solution 1: Improved Tour Bubble Positioning

**File**: `src/components/TourOverlay.tsx`

1. **Updated positioning styles** to use absolute positioning for all positions:
```typescript
contentCardTop: {
  position: 'absolute',
  top: 100,
  alignSelf: 'center',
},
contentCardBottom: {
  position: 'absolute',
  bottom: 100,
  alignSelf: 'center',
},
contentCardCenter: {
  position: 'absolute',
  top: '50%',
  alignSelf: 'center',
  transform: [{ translateY: -150 }],
},
```

2. **Removed flex centering** from overlay container:
```typescript
overlay: {
  flex: 1,
  // Removed: justifyContent: 'center', alignItems: 'center'
},
```

**File**: `src/services/TourService.ts`

3. **Changed all steps to use bottom positioning** to minimize UI obstruction:
```typescript
// All steps now use position: 'bottom'
{
  id: 'home_profile_nav',
  position: 'bottom',  // Was: 'bottom' ✓
},
{
  id: 'profile_modes',
  position: 'bottom',  // Was: 'center' ✗
},
{
  id: 'start_trip',
  position: 'bottom',  // Was: 'center' ✗
},
{
  id: 'grade_obstacles',
  position: 'bottom',  // Was: 'center' ✗
},
{
  id: 'trip_history',
  position: 'bottom',  // Was: 'top' (changed for consistency)
},
```

### Solution 2: Smart Navigation Guard

**File**: `src/contexts/TourContext.tsx`

Updated the navigation guard to allow navigation to adjacent steps (next and previous):

```typescript
// Get the expected screen for the current tour step
const currentStep = tourServiceRef.current.getStep(state.currentStep);
const expectedScreen = currentStep.screen;

// Also check if the current screen matches the NEXT step (to allow tour navigation)
const nextStepIndex = state.currentStep + 1;
const nextStep = nextStepIndex < state.totalSteps 
  ? tourServiceRef.current.getStep(nextStepIndex) 
  : null;
const nextExpectedScreen = nextStep?.screen;

// Also check if the current screen matches the PREVIOUS step (to allow back navigation)
const prevStepIndex = state.currentStep - 1;
const prevStep = prevStepIndex >= 0 
  ? tourServiceRef.current.getStep(prevStepIndex) 
  : null;
const prevExpectedScreen = prevStep?.screen;

// Allow navigation if it matches current, next, or previous step
const isAllowedScreen = currentRouteName === expectedScreen ||
                       currentRouteName === nextExpectedScreen ||
                       currentRouteName === prevExpectedScreen;

// Only block if navigating to a screen that's not part of the tour flow
if (!isAllowedScreen) {
  // Block the navigation...
}
```

Also added `state.totalSteps` to the dependency array to ensure the guard updates properly.

## Benefits

### Positioning Benefits
1. **Less obstructive**: Tour bubbles now appear at the bottom of the screen
2. **Consistent UX**: All steps use the same positioning for predictability
3. **Better visibility**: Users can see the UI elements being highlighted
4. **Proper absolute positioning**: Bubbles stay in place regardless of screen content

### Navigation Benefits
1. **Smooth tour flow**: Users can navigate forward and backward through tour steps
2. **No blocking**: Tour navigation is allowed while still preventing navigation to non-tour screens
3. **Race condition resolved**: Guard is aware of pending navigation to adjacent steps
4. **Maintains security**: Still blocks navigation to screens outside the tour flow

## User Experience

**Before:**
- Tour bubble in center of screen blocking everything
- Pressing "Next" would navigate but immediately get blocked and redirected back
- Tour felt broken and confusing

**After:**
- Tour bubble at bottom of screen, UI visible
- Pressing "Next" smoothly navigates to the next screen
- Pressing "Back" smoothly navigates to the previous screen
- Tour feels polished and professional

## Testing

Manual testing should verify:
1. ✓ Tour bubbles appear at bottom of screen on all steps
2. ✓ Pressing "Next" advances to the next screen
3. ✓ Pressing "Back" returns to the previous screen
4. ✓ Navigation guard still blocks navigation to non-tour screens
5. ✓ Tour can be dismissed at any time
6. ✓ UI elements are visible and not obstructed by tour bubbles
