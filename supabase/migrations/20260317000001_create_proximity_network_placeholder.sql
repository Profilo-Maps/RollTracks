-- ═══════════════════════════════════════════════════════════
-- PROXIMITY NETWORK TABLE (PLACEHOLDER)
-- ═══════════════════════════════════════════════════════════
-- PostGIS table structure for future server-side pathfinding.
-- Not populated in this iteration — data is served via Supabase Storage
-- and processed client-side.

CREATE TABLE proximity_network (
  street_grid_id TEXT PRIMARY KEY,
  street_id TEXT NOT NULL,
  data JSONB NOT NULL,
  street_geometry geography(Geometry, 4326)
);

ALTER TABLE proximity_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to proximity network"
  ON proximity_network FOR SELECT
  USING (true);

CREATE INDEX idx_proximity_network_geometry
  ON proximity_network USING GIST (street_geometry);

COMMENT ON TABLE proximity_network IS 'Placeholder for future server-side pathfinding. Populated from Proximity graph network parquet.';
