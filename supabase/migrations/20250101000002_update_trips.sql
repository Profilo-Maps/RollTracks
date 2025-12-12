-- Update trips table to match current app schema with new fields
-- Drop old trips table if it exists (from demo version)
DROP TABLE IF EXISTS trips CASCADE;

-- Create trips table with updated schema
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- wheelchair, assisted_walking, skateboard, scooter, walking
  boldness INTEGER NOT NULL CHECK (boldness >= 1 AND boldness <= 10),
  purpose TEXT CHECK (purpose IN ('work', 'recreation', 'other')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  distance_miles NUMERIC(10, 2),
  geometry TEXT, -- Encoded polyline
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE -- Tracks when trip was last synced to cloud
);

-- Indexes for performance
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_start_time ON trips(start_time DESC);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_synced_at ON trips(synced_at) WHERE synced_at IS NULL; -- Find unsynced trips

-- Trigger to automatically update updated_at
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
