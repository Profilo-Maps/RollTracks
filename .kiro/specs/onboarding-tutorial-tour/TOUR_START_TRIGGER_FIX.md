# Tour Start Trigger Fix

## Issue
The onboarding tour was not starting automatically after a new user created their account and entered their age and mode preferences. The tour would only start if manually triggered.

## Root Cause
1. The tour was checking if it should start based on `tourCompleted` flag, but wasn't verifying that the profile was complete (had age and mode_list)
2. New users don't have a profile immediately after registration - they need to fill in age and mode preferences first
3. The tour check wasn't being triggered after profile creation

## Solution

### 1. Updated `TourService.shouldStartTour()` Method
**File**: `src/services/TourService.ts`

Added validation to ensure the profile is complete before starting the tour:

```typescript
async shouldStartTour(userId: string): Promise<boolean> {
  try {
    const profile = await this.profileService.getProfile();
    const tourState = await this.storage.getTourState(userId);
    
    // Tour should start if:
    // 1. Profile exists and is complete (has age and mode_list)
    // 2. Profile doesn't have tourCompleted flag set to true
    // 3. Tour state is not_started
    const profileComplete = profile && 
                           profile.age !== undefined && 
                           profile.mode_list && 
                           profile.mode_list.length > 0;
    
    return profileComplete && !profile?.tourCompleted && tourState.status === 'not_started';
  } catch (error) {
    console.error('Error checking if tour should start:', error);
    return false;
  }
}
```

### 2. Updated `ProfileScreen` to Trigger Tour After Profile Creation
**File**: `src/screens/ProfileScreen.tsx`

Added logic to:
1. Track when a new profile is created (vs updated)
2. Navigate to Home screen after profile creation
3. Set a flag to trigger tour start
4. Use an effect to start the tour after navigation completes

```typescript
const [shouldStartTour, setShouldStartTour] = useState(false);

// Effect to start tour after profile creation
useEffect(() => {
  if (shouldStartTour && !tourState.isActive && tourState.status === 'not_started') {
    const initiateTour = async () => {
      try {
        await startTour();
        setShouldStartTour(false);
      } catch (error) {
        console.error('Error starting tour:', error);
        setShouldStartTour(false);
      }
    };
    initiateTour();
  }
}, [shouldStartTour, tourState.isActive, tourState.status, startTour]);

// In handleSave:
if (isNewProfile) {
  if (navigation) {
    (navigation as any).navigate('Home');
  }
  // Set flag to start tour after navigation
  setShouldStartTour(true);
}
```

### 3. Updated `TourContext` to React to Profile Changes
**File**: `src/contexts/TourContext.tsx`

Added `user?.age` and `user?.modeList` to the dependency array of the tour state loading effect, so the tour check runs when the profile is updated:

```typescript
useEffect(() => {
  const loadTourState = async () => {
    // ... tour loading logic
  };
  
  loadTourState();
}, [user?.id, servicesReady, user?.age, user?.modeList]);
```

### 4. Updated Tests
**File**: `src/services/__tests__/TourService.test.ts`

Updated the test to include complete profile data:

```typescript
it('should return true for new user with complete profile and not_started status', async () => {
  mockProfileService.getProfile.mockResolvedValue({
    id: 'profile-1',
    user_id: mockUserId,
    age: 25,
    mode_list: ['wheelchair'],
    trip_history_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tourCompleted: false,
  } as any);
  // ... rest of test
});
```

## User Flow

1. User registers a new account
2. User is directed to ProfileScreen (in edit mode since no profile exists)
3. User enters age and selects mode preferences
4. User clicks "Save"
5. Profile is created in both AuthContext and ProfileService
6. User is automatically navigated to Home screen
7. Tour automatically starts on Home screen with step 1

## Testing

All tests pass:
- `TourService.shouldStartTour()` tests pass with complete profile data
- Tour only starts when profile is complete (has age and mode_list)
- Tour doesn't start for users with incomplete profiles
- Tour doesn't start for users who have already completed it

## Benefits

1. **Seamless onboarding**: Tour starts immediately after profile setup without requiring manual trigger
2. **Proper validation**: Tour only starts when user has completed their profile
3. **No false starts**: Tour won't attempt to start for users without complete profiles
4. **Maintainable**: Clear separation between profile completion and tour triggering
