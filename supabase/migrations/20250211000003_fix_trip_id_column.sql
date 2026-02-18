-- Fix trip_id column to use the id column value
-- The trips table has both 'id' (UUID primary key) and 'trip_id' (text, always null)
-- We need to make trip_id actually contain the id value

-- Option 1: Drop trip_id and use id directly (cleanest)
-- But this would require app code changes

-- Option 2: Make trip_id a generated column that copies id (best for compatibility)
-- Drop the existing trip_id column
ALTER TABLE trips DROP COLUMN IF EXISTS trip_id;
-- Add trip_id back as a generated column that stores id as text
ALTER TABLE trips ADD COLUMN trip_id text GENERATED ALWAYS AS (id::text) STORED;
COMMENT ON COLUMN trips.trip_id IS 'Text representation of the id UUID. Generated automatically from id column for app compatibility.';
-- Create index on trip_id for lookups
CREATE INDEX IF NOT EXISTS idx_trips_trip_id ON trips(trip_id);
