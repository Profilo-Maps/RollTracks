-- ═══════════════════════════════════════════════════════════
-- FEATURE IMAGES MIGRATION
-- ═══════════════════════════════════════════════════════════
-- Creates storage bucket and adds image_url column to rated_features table
-- for user-uploaded photos of curb ramps and other features.

-- Create storage bucket for user-uploaded feature images
INSERT INTO storage.buckets (id, name, public)
VALUES ('feature-images', 'feature-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to feature images
CREATE POLICY "Public read access for feature images"
ON storage.objects FOR SELECT
USING (bucket_id = 'feature-images');

-- Allow authenticated users to upload their own feature images
CREATE POLICY "Authenticated users can upload feature images"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'feature-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own feature images
CREATE POLICY "Users can delete their own feature images"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (
  bucket_id = 'feature-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create rated_features table if it doesn't exist
CREATE TABLE IF NOT EXISTS rated_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  cris_id TEXT NOT NULL,
  condition_score INTEGER NOT NULL,
  user_rating INTEGER NOT NULL CHECK (user_rating >= 1 AND user_rating <= 10),
  lat DOUBLE PRECISION NOT NULL,
  long DOUBLE PRECISION NOT NULL,
  time_stamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add image_url column to rated_features table
ALTER TABLE rated_features 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create indexes for rated_features if they don't exist
CREATE INDEX IF NOT EXISTS idx_rated_features_user_id ON rated_features(user_id);
CREATE INDEX IF NOT EXISTS idx_rated_features_trip_id ON rated_features(trip_id);
CREATE INDEX IF NOT EXISTS idx_rated_features_cris_id ON rated_features(cris_id);

-- Enable RLS on rated_features
ALTER TABLE rated_features ENABLE ROW LEVEL SECURITY;

-- RLS policies for rated_features
DROP POLICY IF EXISTS "Users can insert their own ratings" ON rated_features;
CREATE POLICY "Users can insert their own ratings" 
ON rated_features FOR INSERT 
TO authenticated, anon 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own ratings" ON rated_features;
CREATE POLICY "Users can read their own ratings" 
ON rated_features FOR SELECT 
TO authenticated, anon 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ratings" ON rated_features;
CREATE POLICY "Users can update their own ratings" 
ON rated_features FOR UPDATE 
TO authenticated, anon 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own ratings" ON rated_features;
CREATE POLICY "Users can delete their own ratings" 
ON rated_features FOR DELETE 
TO authenticated, anon 
USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE rated_features IS 'User ratings of curb ramps and other features, with optional photo uploads';
COMMENT ON COLUMN rated_features.image_url IS 'URL to user-uploaded photo in Supabase Storage (feature-images bucket)';;
