# Supabase Database Setup

This directory contains the database schema and security policies for the Mobility Trip Tracker application.

## Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. Supabase CLI installed (optional, for local development)

## Applying Migrations

### Option 1: Using Supabase Dashboard (Recommended for initial setup)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the migration files in order:
   - `migrations/20240101000000_initial_schema.sql` - Creates tables and indexes
   - `migrations/20240101000001_enable_rls.sql` - Enables Row Level Security and policies
   - `migrations/20240101000002_storage_setup.sql` - Sets up storage bucket and policies

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed and linked to your project:

```bash
# Link to your Supabase project (first time only)
supabase link --project-ref your-project-ref

# Push migrations to your project
supabase db push
```

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Managed by Supabase Auth)
│                 │
│ - id (PK)       │
│ - email         │
│ - ...           │
└────────┬────────┘
         │
         │ 1:1
         │
┌────────▼────────────────────┐
│       profiles              │
│                             │
│ - id (PK)                   │
│ - user_id (FK, UNIQUE)      │
│ - age                       │
│ - preferred_route           │
│ - vehicle_type              │
│ - created_at                │
│ - updated_at                │
└─────────────────────────────┘

         │
         │ 1:N
         │
┌────────▼────────────────────┐
│         trips               │
│                             │
│ - id (PK)                   │
│ - user_id (FK)              │
│ - start_time                │
│ - end_time                  │
│ - duration_seconds          │
│ - route_info                │
│ - status                    │
│ - created_at                │
│ - updated_at                │
└────────┬────────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────────────┐
│     trip_uploads            │
│                             │
│ - id (PK)                   │
│ - trip_id (FK)              │
│ - file_url                  │
│ - file_type                 │
│ - file_size                 │
│ - created_at                │
└─────────────────────────────┘

┌─────────────────────────────┐
│  storage.buckets            │
│                             │
│  trip-uploads (private)     │
│  - User files organized by  │
│    user_id folders          │
└─────────────────────────────┘
```

### Tables

#### profiles
- Stores user profile information
- One profile per user (enforced by UNIQUE constraint on user_id)
- Fields: id, user_id, age, preferred_route, vehicle_type, created_at, updated_at

#### trips
- Stores trip records
- Each trip belongs to a user
- Fields: id, user_id, start_time, end_time, duration_seconds, route_info, status, created_at, updated_at
- Status can be: 'active' or 'completed'

#### trip_uploads
- Stores file upload metadata for trips
- Each upload is associated with a trip
- Fields: id, trip_id, file_url, file_type, file_size, created_at

### Security

All tables have Row Level Security (RLS) enabled with policies that ensure:
- Users can only view, insert, and update their own data
- Trip uploads are only accessible to the user who owns the associated trip

### Storage

A private storage bucket named `trip-uploads` is created with policies that:
- Allow users to upload files to their own folder (organized by user_id)
- Restrict access to files based on user ownership

## Environment Variables

Make sure to set the following environment variables in your `.env` file:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under API.

## Verification

After applying the migrations, verify the setup:

1. Check that all three tables exist in the Table Editor
2. Verify RLS is enabled on all tables (look for the shield icon)
3. Confirm the `trip-uploads` storage bucket exists in Storage
4. Test creating a user and inserting data to verify policies work correctly
