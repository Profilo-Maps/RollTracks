-- Create rated_features table for accessibility ratings
-- This stores user ratings of obstacles/features encountered during trips

CREATE TABLE rated_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL, -- Original obstacle feature ID
  user_rating INTEGER NOT NULL CHECK (user_rating >= 1 AND user_rating <= 10),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  properties JSONB, -- Original obstacle properties
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, trip_id, feature_id) -- Prevent duplicate ratings for same feature in same trip
);

-- Indexes for performance
CREATE INDEX idx_rated_features_user_id ON rated_features(user_id);
CREATE INDEX idx_rated_features_trip_id ON rated_features(trip_id);
CREATE INDEX idx_rated_features_feature_id ON rated_features(feature_id);

-- Simple indexes for lat/lon queries (PostGIS not required)
CREATE INDEX idx_rated_features_latitude ON rated_features(latitude);
CREATE INDEX idx_rated_features_longitude ON rated_features(longitude);
