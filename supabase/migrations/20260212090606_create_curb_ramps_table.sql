-- Create curb_ramps table for San Francisco CRIS data
CREATE TABLE IF NOT EXISTS curb_ramps (
  id SERIAL PRIMARY KEY,
  cnn INTEGER,
  location_description TEXT,
  curb_return_loc TEXT,
  position_on_return TEXT,
  condition_score INTEGER,
  detectable_surf NUMERIC,
  location_text TEXT,
  geometry geography(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create spatial index for efficient location queries
CREATE INDEX IF NOT EXISTS curb_ramps_geometry_idx ON curb_ramps USING GIST (geometry);

-- Create index on CNN for lookups
CREATE INDEX IF NOT EXISTS curb_ramps_cnn_idx ON curb_ramps (cnn);

-- Enable RLS
ALTER TABLE curb_ramps ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for DataRanger feature)
CREATE POLICY "Public read access to curb ramps"
ON curb_ramps FOR SELECT
USING (true);

-- Add comment
COMMENT ON TABLE curb_ramps IS 'San Francisco CRIS curb ramp condition data for DataRanger feature';;
