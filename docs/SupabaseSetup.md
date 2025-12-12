# Supabase Setup Guide

This guide will walk you through setting up Supabase cloud integration for the RollTracks application.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed
- React Native development environment set up

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - Name: RollTracks (or your preferred name)
   - Database Password: Choose a strong password
   - Region: Select closest to your users
4. Click "Create new project"
5. Wait for project to be provisioned (takes ~2 minutes)

## Step 2: Get API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **anon/public key**: Long JWT token starting with `eyJ...`

⚠️ **Important**: Use the **anon** key, NOT the service_role key. The service_role key should never be used in client applications.

## Step 3: Configure Environment Variables

1. In your project root, create a `.env` file (if it doesn't exist)
2. Add your Supabase credentials:

```bash
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=eyJ... (your anon key)
```

3. Verify `.env` is in `.gitignore` (it should already be there)

## Step 4: Apply Database Migrations

You need to run the SQL migrations to set up your database schema.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Run each migration file in order:

   **Migration 1: Create user_accounts table**
   - Open `supabase/migrations/20250101000000_create_user_accounts.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"

   **Migration 2: Update profiles table**
   - Open `supabase/migrations/20250101000001_update_profiles.sql`
   - Copy and run

   **Migration 3: Update trips table**
   - Open `supabase/migrations/20250101000002_update_trips.sql`
   - Copy and run

   **Migration 4: Create rated_features table**
   - Open `supabase/migrations/20250101000003_create_rated_features.sql`
   - Copy and run

   **Migration 5: Create trip_uploads table**
   - Open `supabase/migrations/20250101000004_create_trip_uploads.sql`
   - Copy and run

   **Migration 6: Enable RLS policies**
   - Open `supabase/migrations/20250101000005_enable_rls.sql`
   - Copy and run

   **Migration 7: Setup storage bucket**
   - Open `supabase/migrations/20250101000006_storage_setup.sql`
   - Copy and run

   **Migration 8: Create auth functions**
   - Open `supabase/migrations/20250101000007_auth_functions.sql`
   - Copy and run

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link to your project (first time only)
supabase link --project-ref [your-project-id]

# Push all migrations
supabase db push
```

## Step 5: Verify Setup

### Check Tables

1. Go to **Table Editor** in Supabase dashboard
2. Verify these tables exist:
   - `user_accounts`
   - `profiles`
   - `trips`
   - `rated_features`
   - `trip_uploads`

### Check RLS (Row Level Security)

1. In Table Editor, click on each table
2. Look for the shield icon 🛡️ next to the table name
3. All tables should have RLS enabled

### Check Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Verify `trip-files` bucket exists
3. Click on the bucket → **Policies** tab
4. Verify policies are in place for user-based access

### Check Auth Functions

1. Go to **Database** → **Functions**
2. Verify these functions exist:
   - `hash_password`
   - `verify_password`

## Step 6: Install Dependencies

```bash
npm install
```

This will install the required packages including:
- `@supabase/supabase-js`
- `@react-native-community/netinfo`
- `react-native-fs`

## Step 7: Test the Integration

1. Start your development server:
   ```bash
   npm start
   ```

2. Run the app on your device/emulator:
   ```bash
   npm run android
   # or
   npm run ios
   ```

3. Check the console logs for:
   ```
   === Environment Validation ===
   Mode: Cloud
   ✓ Environment validation passed
   ==============================
   SyncService initialized
   ```

4. Try creating an account:
   - Open the app
   - Navigate to Profile
   - You should see Login/Register screens
   - Create a test account with a display name and password

## Accessing Research Data

All trip and rating data can be accessed from the Supabase dashboard:

1. Go to **Table Editor**
2. Select the table you want to view:
   - `trips` - All trip data with user_id (UUID only)
   - `rated_features` - All accessibility ratings with user_id (UUID only)
   - `profiles` - User profiles with user_id (UUID only)

3. Export data:
   - Click the "..." menu in the table view
   - Select "Download as CSV" or "Download as JSON"

**Note**: Display names are stored separately in the `user_accounts` table and are NOT included in research data exports.

## Troubleshooting

### "Supabase not configured" error

- Check that `.env` file exists and has correct values
- Verify environment variables are not placeholder values
- Restart the Metro bundler: `npm start -- --reset-cache`

### "Invalid Supabase URL format" error

- Ensure URL starts with `https://`
- Ensure URL ends with `.supabase.co`
- Check for typos in the URL

### "Invalid display name or password" error

- Verify auth functions were created (Step 4, Migration 8)
- Check that pgcrypto extension is enabled
- Try running the auth functions migration again

### RLS policy errors

- Verify all RLS policies were created (Step 4, Migration 6)
- Check that RLS is enabled on all tables
- Test with a fresh user account

### Sync not working

- Check network connectivity
- Look for sync errors in console logs
- Verify SyncService initialized successfully
- Check sync status indicator in app header

### File upload errors

- Verify storage bucket exists
- Check storage policies are in place
- Ensure file size is under 10MB
- Verify file type is supported (JPEG, PNG, GPX, KML)

## Security Notes

1. **Never commit `.env` file** - It's in `.gitignore` by default
2. **Never use service_role key in the app** - Only use anon key
3. **RLS is enforced at database level** - Users can only access their own data
4. **Display names are isolated** - Not included in research data tables
5. **All data is encrypted in transit** - HTTPS only

## Next Steps

- Test authentication flow
- Create test trips and verify sync
- Test offline functionality
- Verify data appears in Supabase dashboard
- Set up data retention policy (TODO in code)

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review migration files in `supabase/migrations/`
- Check console logs for detailed error messages
