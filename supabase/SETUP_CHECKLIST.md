# Supabase Setup Checklist

Use this checklist to ensure your Supabase database is properly configured for the Mobility Trip Tracker application.

## Pre-Setup

- [ ] Created a Supabase project at https://supabase.com
- [ ] Noted project URL from Project Settings → API
- [ ] Noted anon key from Project Settings → API
- [ ] Copied `.env.example` to `.env`
- [ ] Added SUPABASE_URL to `.env`
- [ ] Added SUPABASE_ANON_KEY to `.env`

## Database Schema Setup

### Migration 1: Initial Schema
- [ ] Opened Supabase Dashboard → SQL Editor
- [ ] Copied content from `migrations/20240101000000_initial_schema.sql`
- [ ] Pasted and executed in SQL Editor
- [ ] Verified no errors in execution
- [ ] Checked Table Editor - `profiles` table exists
- [ ] Checked Table Editor - `trips` table exists
- [ ] Checked Table Editor - `trip_uploads` table exists

### Migration 2: Row Level Security
- [ ] Copied content from `migrations/20240101000001_enable_rls.sql`
- [ ] Pasted and executed in SQL Editor
- [ ] Verified no errors in execution
- [ ] Checked `profiles` table has shield icon (RLS enabled)
- [ ] Checked `trips` table has shield icon (RLS enabled)
- [ ] Checked `trip_uploads` table has shield icon (RLS enabled)
- [ ] Verified `profiles` table has 3 policies (SELECT, INSERT, UPDATE)
- [ ] Verified `trips` table has 3 policies (SELECT, INSERT, UPDATE)
- [ ] Verified `trip_uploads` table has 2 policies (SELECT, INSERT)

### Migration 3: Storage Setup
- [ ] Copied content from `migrations/20240101000002_storage_setup.sql`
- [ ] Pasted and executed in SQL Editor
- [ ] Verified no errors in execution
- [ ] Checked Storage → `trip-uploads` bucket exists
- [ ] Verified bucket is set to private (not public)
- [ ] Checked bucket has 4 policies (INSERT, SELECT, UPDATE, DELETE)

## Verification

### Table Structure
- [ ] `profiles` table has column: `id` (uuid, primary key)
- [ ] `profiles` table has column: `user_id` (uuid, foreign key, unique)
- [ ] `profiles` table has column: `age` (integer, not null)
- [ ] `profiles` table has column: `preferred_route` (text, nullable)
- [ ] `profiles` table has column: `vehicle_type` (text, not null)
- [ ] `profiles` table has column: `created_at` (timestamp)
- [ ] `profiles` table has column: `updated_at` (timestamp)

- [ ] `trips` table has column: `id` (uuid, primary key)
- [ ] `trips` table has column: `user_id` (uuid, foreign key)
- [ ] `trips` table has column: `start_time` (timestamp, not null)
- [ ] `trips` table has column: `end_time` (timestamp, nullable)
- [ ] `trips` table has column: `duration_seconds` (integer, nullable)
- [ ] `trips` table has column: `route_info` (text, nullable)
- [ ] `trips` table has column: `status` (text, not null, check constraint)
- [ ] `trips` table has column: `created_at` (timestamp)
- [ ] `trips` table has column: `updated_at` (timestamp)
- [ ] `trips` table has index: `idx_trips_user_id`
- [ ] `trips` table has index: `idx_trips_start_time`

- [ ] `trip_uploads` table has column: `id` (uuid, primary key)
- [ ] `trip_uploads` table has column: `trip_id` (uuid, foreign key)
- [ ] `trip_uploads` table has column: `file_url` (text, not null)
- [ ] `trip_uploads` table has column: `file_type` (text, not null)
- [ ] `trip_uploads` table has column: `file_size` (integer, not null)
- [ ] `trip_uploads` table has column: `created_at` (timestamp)
- [ ] `trip_uploads` table has index: `idx_trip_uploads_trip_id`

### Security Verification
- [ ] Ran verification queries from `verify_schema.sql`
- [ ] All tables show RLS enabled
- [ ] All expected policies exist
- [ ] Foreign key constraints have CASCADE delete
- [ ] Storage bucket is private

## Testing

### Create Test User
- [ ] Went to Authentication → Users
- [ ] Created a test user (or signed up via app)
- [ ] Noted the user's UUID

### Test Profile Operations
- [ ] Opened SQL Editor
- [ ] Ran: `SELECT * FROM profiles WHERE user_id = 'test-user-uuid';`
- [ ] Verified query works (returns empty or user's profile)
- [ ] Attempted to insert profile for test user
- [ ] Verified insert succeeded
- [ ] Attempted to update profile for test user
- [ ] Verified update succeeded

### Test Trip Operations
- [ ] Inserted a test trip for test user
- [ ] Verified insert succeeded
- [ ] Queried trips for test user
- [ ] Verified query returns only test user's trips
- [ ] Updated test trip
- [ ] Verified update succeeded

### Test Storage
- [ ] Went to Storage → trip-uploads
- [ ] Attempted to upload a test file
- [ ] Verified upload succeeded
- [ ] Verified file is organized in user_id folder
- [ ] Attempted to access file
- [ ] Verified access works

### Test RLS Isolation
- [ ] Created a second test user
- [ ] Inserted data for second user
- [ ] Verified first user cannot see second user's data
- [ ] Verified second user cannot see first user's data

## Post-Setup

- [ ] Documented any issues encountered
- [ ] Saved project URL and keys securely
- [ ] Committed migration files to version control
- [ ] Did NOT commit `.env` file to version control
- [ ] Shared setup instructions with team
- [ ] Set up database backups (if needed)
- [ ] Configured monitoring/alerts (if needed)

## Troubleshooting

If you encounter issues:

1. **Check Supabase Logs**: Dashboard → Logs → Database Logs
2. **Verify RLS**: Ensure policies match user_id correctly
3. **Check Auth**: Verify user is authenticated when testing
4. **Review Errors**: Read error messages carefully for hints
5. **Consult Docs**: See `DATABASE_SETUP.md` for detailed troubleshooting

## Success Criteria

✅ All migrations executed without errors
✅ All tables exist with correct structure
✅ RLS enabled on all tables with correct policies
✅ Storage bucket created with correct policies
✅ Test user can perform CRUD operations
✅ Data isolation verified between users
✅ Application can connect and query database

---

**Setup Complete!** 🎉

Your Supabase database is now ready for the Mobility Trip Tracker application.
