-- Create trip_uploads table for file upload metadata
-- This stores references to files uploaded to Supabase storage

-- Drop old trip_uploads table if it exists
DROP TABLE IF EXISTS trip_uploads CASCADE;

-- Create trip_uploads table with user_id for RLS
CREATE TABLE trip_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- JPEG, PNG, GPX, KML, etc.
  file_size INTEGER NOT NULL, -- Size in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trip_uploads_trip_id ON trip_uploads(trip_id);
CREATE INDEX idx_trip_uploads_user_id ON trip_uploads(user_id);
