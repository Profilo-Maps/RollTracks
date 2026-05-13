-- Fix underlying table issue: geometry_edits and feature_edits creation failed
-- in the original migrations because they referenced trips(trip_id) which is
-- TEXT (generated column, not unique). Correct FK target is trips(id) (UUID PK).
-- These tables were never created on remote despite migration history marking
-- them as applied.

-- ───────────────────────────────────────────────────────────
-- GEOMETRY EDITS
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.geometry_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  trip_id uuid REFERENCES public.trips(id),
  edit_type text NOT NULL,
  street_grid_id text,
  payload jsonb NOT NULL,
  coord geometry(Point, 4326),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  applied_at timestamptz,
  applied_by text
);

CREATE INDEX IF NOT EXISTS idx_geometry_edits_status
  ON public.geometry_edits(status);
CREATE INDEX IF NOT EXISTS idx_geometry_edits_coord
  ON public.geometry_edits USING gist(coord);

ALTER TABLE public.geometry_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own geometry edits"
  ON public.geometry_edits;
CREATE POLICY "Users can insert their own geometry edits"
  ON public.geometry_edits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own geometry edits"
  ON public.geometry_edits;
CREATE POLICY "Users can view their own geometry edits"
  ON public.geometry_edits FOR SELECT
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- FEATURE EDITS
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feature_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  trip_id uuid REFERENCES public.trips(id),
  street_grid_id text NOT NULL,
  edit_type text NOT NULL CHECK (edit_type IN ('rating', 'attribute_correction', 'geometry_correction')),
  attributes jsonb DEFAULT '{}',
  user_rating integer CHECK (user_rating >= 1 AND user_rating <= 10),
  geometry geometry(Geometry, 4326),
  coord geometry(Point, 4326) NOT NULL,
  feature_type text NOT NULL CHECK (feature_type IN ('point', 'line')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_edits_user
  ON public.feature_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_edits_trip
  ON public.feature_edits(trip_id);
CREATE INDEX IF NOT EXISTS idx_feature_edits_grid_id
  ON public.feature_edits(street_grid_id);
CREATE INDEX IF NOT EXISTS idx_feature_edits_coord
  ON public.feature_edits USING gist(coord);
CREATE INDEX IF NOT EXISTS idx_feature_edits_type
  ON public.feature_edits(edit_type);

ALTER TABLE public.feature_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own feature edits"
  ON public.feature_edits;
CREATE POLICY "Users can insert their own feature edits"
  ON public.feature_edits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own feature edits"
  ON public.feature_edits;
CREATE POLICY "Users can view their own feature edits"
  ON public.feature_edits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feature edits"
  ON public.feature_edits;
CREATE POLICY "Users can update their own feature edits"
  ON public.feature_edits FOR UPDATE
  USING (auth.uid() = user_id);
