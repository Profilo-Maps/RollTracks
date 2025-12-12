# Supabase Integration Troubleshooting Guide

This guide helps you diagnose and fix common issues with Supabase cloud integration.

## Table of Contents

- [Environment & Configuration](#environment--configuration)
- [Authentication Issues](#authentication-issues)
- [Sync Problems](#sync-problems)
- [File Upload Errors](#file-upload-errors)
- [RLS Policy Errors](#rls-policy-errors)
- [Performance Issues](#performance-issues)

---

## Environment & Configuration

### Issue: "Supabase not configured" message

**Symptoms:**
- App shows "Running in Demo Mode"
- Console shows "Supabase not configured"
- Sync status shows "Offline"

**Solutions:**

1. **Check .env file exists**
   ```bash
   # Verify file exists in project root
   ls -la .env
   ```

2. **Verify environment variables**
   ```bash
   # .env should contain:
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```

3. **Check for placeholder values**
   - URL should NOT be `your_supabase_project_url`
   - Key should NOT be `your_supabase_anon_key`

4. **Restart Metro bundler**
   ```bash
   npm start -- --reset-cache
   ```

5. **Rebuild the app**
   ```bash
   npm run android
   # or
   npm run ios
   ```

### Issue: "Invalid Supabase URL format" error

**Symptoms:**
- Console shows URL validation error
- App fails to initialize Supabase client

**Solutions:**

1. **Check URL format**
   - Must start with `https://`
   - Must end with `.supabase.co` or `.supabase.in`
   - Example: `https://abcdefghijklmnop.supabase.co`

2. **Get correct URL**
   - Go to Supabase Dashboard → Settings → API
   - Copy "Project URL" exactly as shown

3. **Check for typos**
   - No spaces before or after URL
   - No quotes around URL in .env file

### Issue: "Anon key format looks unusual" warning

**Symptoms:**
- Console shows anon key validation warning
- Authentication may fail

**Solutions:**

1. **Verify you're using anon key, not service_role key**
   - Anon key starts with `eyJ`
   - Service_role key should NEVER be used in the app

2. **Get correct key**
   - Go to Supabase Dashboard → Settings → API
   - Copy "anon" or "public" key (NOT service_role)

3. **Check key length**
   - Should be very long (200+ characters)
   - Should be a JWT token

---

## Authentication Issues

### Issue: "Invalid display name or password" error

**Symptoms:**
- Login fails with valid credentials
- Registration fails
- Console shows auth function errors

**Solutions:**

1. **Verify auth functions exist**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name IN ('hash_password', 'verify_password');
   ```
   Should return both functions.

2. **Re-run auth functions migration**
   - Open `supabase/migrations/20250101000007_auth_functions.sql`
   - Copy and run in SQL Editor

3. **Check pgcrypto extension**
   ```sql
   -- Run in Supabase SQL Editor
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

4. **Test with new account**
   - Try creating a brand new account
   - Use a unique display name

### Issue: "Display name is already taken" error

**Symptoms:**
- Registration fails even with unique name
- Display name availability check fails

**Solutions:**

1. **Check user_accounts table**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT display_name FROM user_accounts;
   ```

2. **Try different display name**
   - Use completely different name
   - Check for case sensitivity

3. **Clear test data**
   ```sql
   -- CAUTION: This deletes all users!
   DELETE FROM user_accounts WHERE display_name = 'test_user';
   ```

### Issue: Session expires immediately

**Symptoms:**
- User logged out right after login
- Session not persisting

**Solutions:**

1. **Check AsyncStorage permissions**
   - Ensure app has storage permissions
   - Check device storage is not full

2. **Clear app data**
   - Android: Settings → Apps → RollTracks → Clear Data
   - iOS: Delete and reinstall app

3. **Check session storage**
   ```typescript
   // Add debug logging in AuthService
   console.log('Session stored:', session);
   ```

---

## Sync Problems

### Issue: Sync queue not processing

**Symptoms:**
- Sync status shows "X pending" but never syncs
- Items stuck in queue
- Console shows no sync activity

**Solutions:**

1. **Check network connectivity**
   - Verify device has internet
   - Try toggling airplane mode off/on

2. **Manually trigger sync**
   - Pull down to refresh in app
   - Bring app to foreground

3. **Check sync service initialization**
   ```typescript
   // Look for in console:
   "SyncService initialized"
   ```

4. **Clear sync queue (last resort)**
   ```typescript
   // In app, call:
   await syncService.clearQueue();
   ```

### Issue: Sync fails with RLS errors

**Symptoms:**
- Console shows "new row violates row-level security policy"
- Sync status shows failed items

**Solutions:**

1. **Verify user is authenticated**
   ```typescript
   // Check in console:
   const session = await authService.getSession();
   console.log('User ID:', session?.userId);
   ```

2. **Check RLS policies exist**
   - Go to Supabase Dashboard → Authentication → Policies
   - Verify policies for all tables

3. **Re-run RLS migration**
   - Open `supabase/migrations/20250101000005_enable_rls.sql`
   - Copy and run in SQL Editor

4. **Test with fresh user**
   - Create new account
   - Try syncing with new account

### Issue: Sync is very slow

**Symptoms:**
- Takes minutes to sync small amounts of data
- App feels sluggish during sync

**Solutions:**

1. **Check batch size**
   - Default is 10 items per batch
   - Increase in SyncService if needed

2. **Check network speed**
   - Test on WiFi vs cellular
   - Check Supabase region (should be close to users)

3. **Reduce sync frequency**
   - Sync only on app foreground
   - Don't sync on every data change

4. **Check for large files**
   - Files over 1MB may slow sync
   - Consider compressing images

---

## File Upload Errors

### Issue: "File upload failed" error

**Symptoms:**
- File uploads fail
- Console shows storage errors

**Solutions:**

1. **Check storage bucket exists**
   - Go to Supabase Dashboard → Storage
   - Verify `trip-files` bucket exists

2. **Verify storage policies**
   - Click on bucket → Policies tab
   - Should have 4 policies (INSERT, SELECT, UPDATE, DELETE)

3. **Re-run storage migration**
   - Open `supabase/migrations/20250101000006_storage_setup.sql`
   - Copy and run in SQL Editor

4. **Check file size**
   - Maximum 10MB per file
   - Compress large images before upload

5. **Check file type**
   - Supported: JPEG, PNG, GPX, KML
   - Check MIME type is correct

### Issue: "File does not exist" error

**Symptoms:**
- Upload fails immediately
- File path issues

**Solutions:**

1. **Check file permissions**
   - Ensure app has file access permissions
   - Check file is readable

2. **Verify file path**
   ```typescript
   // Check path format
   console.log('File URI:', fileUri);
   // Should be: file:///path/to/file
   ```

3. **Test with different file**
   - Try uploading a small test image
   - Check if specific file is corrupted

---

## RLS Policy Errors

### Issue: "permission denied for table" error

**Symptoms:**
- Database operations fail
- Console shows permission errors

**Solutions:**

1. **Verify RLS is enabled**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
   All tables should have `rowsecurity = true`

2. **Check policies exist**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Re-enable RLS**
   ```sql
   -- Run for each table
   ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
   ALTER TABLE rated_features ENABLE ROW LEVEL SECURITY;
   ALTER TABLE trip_uploads ENABLE ROW LEVEL SECURITY;
   ```

4. **Recreate policies**
   - Run entire RLS migration again
   - `supabase/migrations/20250101000005_enable_rls.sql`

### Issue: Can see other users' data

**Symptoms:**
- User can access data they shouldn't
- Security breach

**Solutions:**

1. **IMMEDIATELY disable public access**
   ```sql
   -- Run in Supabase SQL Editor
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
   ```

2. **Verify RLS policies**
   - Check each policy uses `auth.uid()`
   - Ensure policies check `user_id` column

3. **Test with multiple accounts**
   - Create two test accounts
   - Verify each can only see their own data

4. **Contact support if issue persists**
   - This is a critical security issue
   - Get help from Supabase support

---

## Performance Issues

### Issue: App is slow after enabling Supabase

**Symptoms:**
- UI lags
- Slow navigation
- High battery usage

**Solutions:**

1. **Disable background sync temporarily**
   ```typescript
   // Comment out in App.tsx:
   // syncService.current.syncNow()
   ```

2. **Reduce sync frequency**
   - Only sync on app foreground
   - Increase sync interval

3. **Check for sync loops**
   - Look for repeated sync attempts in console
   - Verify sync completes successfully

4. **Profile the app**
   - Use React Native Debugger
   - Check for memory leaks

### Issue: High data usage

**Symptoms:**
- App uses lots of mobile data
- Unexpected data charges

**Solutions:**

1. **Sync only on WiFi**
   ```typescript
   // Add WiFi check before sync
   const netInfo = await NetInfo.fetch();
   if (netInfo.type === 'wifi') {
     await syncService.syncNow();
   }
   ```

2. **Compress data before upload**
   - Reduce image quality
   - Simplify GPS tracks

3. **Limit sync frequency**
   - Sync once per day instead of continuously
   - Only sync completed trips

---

## Getting More Help

### Check Console Logs

Always check console logs for detailed error messages:

```bash
# Android
adb logcat | grep -i "rolltracks\|supabase\|sync"

# iOS
# Use Xcode console
```

### Enable Debug Mode

Add debug logging to services:

```typescript
// In SyncService.ts
console.log('Sync queue:', queue);
console.log('Sync result:', result);
```

### Verify Database State

Check data directly in Supabase:

1. Go to Table Editor
2. View each table
3. Check for unexpected data or missing rows

### Reset Everything (Last Resort)

If nothing works, reset the integration:

1. **Clear local data**
   - Android: Settings → Apps → RollTracks → Clear Data
   - iOS: Delete and reinstall

2. **Reset Supabase database**
   ```sql
   -- CAUTION: Deletes all data!
   DROP TABLE IF EXISTS trip_uploads CASCADE;
   DROP TABLE IF EXISTS rated_features CASCADE;
   DROP TABLE IF EXISTS trips CASCADE;
   DROP TABLE IF EXISTS profiles CASCADE;
   DROP TABLE IF EXISTS user_accounts CASCADE;
   ```

3. **Re-run all migrations**
   - Run each migration file in order
   - Verify each completes successfully

4. **Create fresh test account**
   - Use new display name
   - Test all functionality

### Contact Support

If you're still stuck:

- Supabase Discord: https://discord.supabase.com
- Supabase GitHub: https://github.com/supabase/supabase/issues
- Check migration files for comments and documentation
