# Delete Account Fix - Cascade Deletion

## Problem
When a user clicks "Delete Account", their trips and rated features were not being properly cleaned up from local storage, even though the server-side cascade deletion was working correctly.

## What Was Already Working
✅ **Database CASCADE DELETE**: The database schema already has `ON DELETE CASCADE` configured:
- `trips.user_id` → `user_accounts(id) ON DELETE CASCADE`
- `rated_features.user_id` → `user_accounts(id) ON DELETE CASCADE`
- `rated_features.trip_id` → `trips(id) ON DELETE CASCADE`

This means when a user_account is deleted from the server, all associated trips and rated_features are automatically deleted by PostgreSQL.

## What Was Missing
❌ **Local Storage Cleanup**: The `deleteAccount()` method was only calling `logout()`, which only removed session and user keys. It didn't clean up:
- User's trips from `@rolltracks:trips`
- User's rated features from `@rolltracks:rated_features`
- User's sync queue items from `@rolltracks:sync_queue`
- User's profile from `@rolltracks:profile`

## Solution Applied

Updated `AuthService.deleteAccount()` to properly clean up local storage:

### 1. Filter User's Trips
```typescript
const allTrips = JSON.parse(tripsJson);
const remainingTrips = allTrips.filter((trip: any) => trip.user_id !== userId);
await AsyncStorage.setItem('@rolltracks:trips', JSON.stringify(remainingTrips));
```

### 2. Filter User's Rated Features
```typescript
// Get user's trip IDs first
const userTripIds = allTrips
  .filter((trip: any) => trip.user_id === userId)
  .map((trip: any) => trip.id);

// Filter out features associated with user's trips
const remainingFeatures = allFeatures.filter(
  (feature: any) => !userTripIds.includes(feature.tripId)
);
```

### 3. Filter User's Sync Queue Items
```typescript
const remainingQueueItems = allQueueItems.filter((item: any) => item.userId !== userId);
```

### 4. Clear User's Profile
```typescript
const profile = JSON.parse(profileJson);
if (profile.user_id === userId) {
  await AsyncStorage.removeItem('@rolltracks:profile');
}
```

### 5. Clear Session Data
```typescript
await AsyncStorage.multiRemove([
  SESSION_KEY,
  USER_KEY,
  '@rolltracks:active_trip',
  '@rolltracks:gps_points',
]);
```

## Key Design Decision

**Why filter instead of clearing everything?**

The app supports multiple users on the same device. If User A deletes their account, we should only remove User A's data from local storage, not User B's data. This approach:
- Preserves other users' local data
- Prevents data loss for other users on the same device
- Maintains proper data isolation

## Files Modified
- `src/services/AuthService.ts`

## Testing Recommendations

### Single User Scenario
1. Create an account and add some trips
2. Delete the account
3. Verify all trips are removed from local storage
4. Verify all rated features are removed
5. Verify server data is deleted (check database)

### Multi-User Scenario
1. Create User A and add trips
2. Log out and create User B with different trips
3. Log back in as User A
4. Delete User A's account
5. Log in as User B
6. Verify User B's trips are still present in local storage
7. Verify User B's data is intact on the server

## Error Handling
The local storage cleanup is wrapped in a try-catch block. If local cleanup fails, the operation continues because:
- Server data is already deleted (most important)
- User is logged out
- Local data will be filtered out by user_id on next login anyway

## Impact
- ✅ Complete data deletion on account removal
- ✅ Proper cleanup of local storage
- ✅ Multi-user support maintained
- ✅ Server-side cascade deletion already working
- ✅ No orphaned data in local storage
