-- ═══════════════════════════════════════════════════════════
-- DATARANGER ASSETS MIGRATION
-- ═══════════════════════════════════════════════════════════
-- Creates storage bucket and metadata table for DataRanger feature assets.
-- Assets are downloaded on-demand when DataRanger mode is enabled.

-- Create storage bucket for DataRanger assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('dataranger-assets', 'dataranger-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to DataRanger assets
CREATE POLICY "Public read access for DataRanger assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'dataranger-assets');

-- Allow authenticated users to upload assets (for admin purposes)
CREATE POLICY "Authenticated users can upload DataRanger assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dataranger-assets' 
  AND auth.role() = 'authenticated'
);

-- Create asset_metadata table to track versions
CREATE TABLE IF NOT EXISTS asset_metadata (
  asset_name TEXT PRIMARY KEY,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_size_bytes BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on asset_metadata
ALTER TABLE asset_metadata ENABLE ROW LEVEL SECURITY;

-- Allow public read access to asset metadata
CREATE POLICY "Public read access to asset metadata"
ON asset_metadata FOR SELECT
USING (true);

-- Allow authenticated users to update metadata (for admin purposes)
CREATE POLICY "Authenticated users can update asset metadata"
ON asset_metadata FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Insert initial metadata for curb ramps
INSERT INTO asset_metadata (asset_name, description)
VALUES 
  ('CurbRamps', 'San Francisco CRIS curb ramp condition data'),
  ('Sidewalks', 'AI-generated sidewalk network data from Tile2Net/CitySurfaces')
ON CONFLICT (asset_name) DO NOTHING;

-- Add comment
COMMENT ON TABLE asset_metadata IS 'Tracks version and metadata for DataRanger feature assets stored in Supabase Storage';
