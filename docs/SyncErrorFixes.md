# Sync Error Fixes

This document explains the fixes applied to resolve trip recording and rating feature sync errors.

## Issues Identified

1. **Duplicate Key Constraint Violations**: Trips were being queued for sync multiple times, causing primary key constraint violations when the same trip ID was inserted multiple times.

2. **Race Conditions**: When a trip was created and then immediately updated (e.g., when stopped), both insert and update operations were queued, leading to conflicts.

3. **Poor Error Handling**: The sync service didn't gracefully handle duplicate key errors, causing items to fail permanently after retries.

## Fixes Applied

### 1. Duplicate Detection in Sync Queue (`SyncService.ts`)

- Added logic to remove existing sync items for the same data ID before adding new ones
- This prevents multiple sync operations for the same trip/rated feature from accumulating in the queue

### 2. Graceful Duplicate Handling (`SyncService.ts`)

- Added specific handling for PostgreSQL error code `23505` (unique constraint violation)
- When an insert fails due to duplicate key, automatically convert it to an update operation
- This allows the sync to succeed even if the item already exists in the database

### 3. Simplified Sync Operations (`HybridStorageAdapter.ts`)

- Changed trip updates to use 'insert' operations instead of separate 'update' operations
- The sync service now handles all trip operations as upserts (insert or update as needed)
- This reduces complexity and prevents race conditions

### 4. Debug Utilities

- Added `SyncDebugUtils` class for debugging sync issues
- Added `debugSync.ts` script for troubleshooting sync problems
- These tools help identify duplicate items and high retry counts

## Usage

### For Users Experiencing Sync Issues

If you're experiencing sync errors, you can use the debug utilities:

```typescript
import { debugSyncIssues, clearSyncQueueAndRetry } from '../scripts/debugSync';
import { syncService } from '../path/to/your/sync/service';

// Debug current sync status
await debugSyncIssues(syncService);

// If needed, clear queue and retry
await clearSyncQueueAndRetry(syncService);
```

### For Developers

The fixes are automatic and don't require any changes to existing code. The sync service will now:

1. Automatically deduplicate sync queue items
2. Handle duplicate key errors gracefully
3. Convert failed inserts to updates when appropriate

## Prevention

To prevent similar issues in the future:

1. **Avoid Multiple Sync Calls**: Don't call sync operations multiple times for the same data
2. **Use Proper Loading States**: Ensure UI prevents multiple simultaneous operations
3. **Monitor Sync Queue**: Use the debug utilities to monitor sync queue health

## Testing

To test the fixes:

1. Create a trip and immediately stop it
2. Rate some features during/after the trip
3. Check that sync completes without errors
4. Verify data appears correctly in the database

The sync service should now handle these operations gracefully without duplicate key errors.