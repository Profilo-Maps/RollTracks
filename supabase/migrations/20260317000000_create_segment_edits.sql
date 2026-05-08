-- ═══════════════════════════════════════════════════════════
-- SEGMENT EDITS TABLE
-- ═══════════════════════════════════════════════════════════
-- Stores user-submitted attribute edits for proximity network segments.
-- Each row represents one field edit on one facility of one street segment.
-- Edits are stored separately from base data (same pattern as rated_features).

CREATE TABLE segment_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  street_grid_id TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_facility CHECK (facility_type IN (
    'street', 'sidewalk_left', 'sidewalk_right',
    'crosswalk_start', 'crosswalk_end',
    'bikeway_left_1', 'bikeway_left_2',
    'bikeway_right_1', 'bikeway_right_2'
  ))
);

-- RLS
ALTER TABLE segment_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own edits"
  ON segment_edits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all edits"
  ON segment_edits FOR SELECT
  USING (true);

CREATE POLICY "Users can delete own edits"
  ON segment_edits FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for common query patterns
CREATE INDEX idx_segment_edits_street_grid_id ON segment_edits (street_grid_id);
CREATE INDEX idx_segment_edits_trip_id ON segment_edits (trip_id);
CREATE INDEX idx_segment_edits_user_id ON segment_edits (user_id);

COMMENT ON TABLE segment_edits IS 'User-submitted attribute corrections for proximity network segments during DataRanger mode';
