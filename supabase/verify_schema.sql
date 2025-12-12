-- Verification queries for Mobility Trip Tracker database schema
-- Run these queries in Supabase SQL Editor to verify your setup

-- 1. Check if all tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'trips', 'trip_uploads')
ORDER BY table_name;

-- Expected: 3 rows showing all three tables

-- 2. Check if RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'trips', 'trip_uploads')
ORDER BY tablename;

-- Expected: 3 rows with rowsecurity = true

-- 3. Check RLS policies for profiles table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

-- Expected: 3 policies (SELECT, INSERT, UPDATE)

-- 4. Check RLS policies for trips table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'trips'
ORDER BY policyname;

-- Expected: 3 policies (SELECT, INSERT, UPDATE)

-- 5. Check RLS policies for trip_uploads table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'trip_uploads'
ORDER BY policyname;

-- Expected: 2 policies (SELECT, INSERT)

-- 6. Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'trips', 'trip_uploads')
ORDER BY tablename, indexname;

-- Expected: Multiple indexes including idx_trips_user_id, idx_trips_start_time, idx_trip_uploads_trip_id

-- 7. Check foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('profiles', 'trips', 'trip_uploads')
ORDER BY tc.table_name;

-- Expected: Foreign keys with CASCADE delete rules

-- 8. Check storage bucket
SELECT 
  id,
  name,
  public
FROM storage.buckets
WHERE name = 'trip-uploads';

-- Expected: 1 row with public = false

-- 9. Check storage policies
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%trip%'
ORDER BY policyname;

-- Expected: 4 policies (INSERT, SELECT, UPDATE, DELETE)

-- 10. Verify table structures
\d profiles
\d trips
\d trip_uploads

-- This will show detailed table structure including columns, types, and constraints
