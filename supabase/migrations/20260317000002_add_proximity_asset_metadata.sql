-- ═══════════════════════════════════════════════════════════
-- PROXIMITY NETWORK ASSET METADATA
-- ═══════════════════════════════════════════════════════════
-- Register the proximity network parquet in asset_metadata
-- so the version-check flow works for on-device downloads.

INSERT INTO asset_metadata (asset_name, last_updated, description)
VALUES ('ProximityNetwork', '2026-03-17T00:00:00Z', 'Proximity graph network parquet for street/sidewalk/bikeway data')
ON CONFLICT (asset_name) DO NOTHING;
