-- ═══════════════════════════════════════════════════════════
-- ADD RELATIVE TIMES COLUMN TO TRIPS
-- ═══════════════════════════════════════════════════════════
-- Migration: Add relative_times column for speed analysis
-- Date: 2025-02-11
--
-- Adds a real[] column to store relative timestamps (in seconds)
-- for each coordinate in the trip geometry. This enables:
-- - Speed analysis for Level of Traffic Stress modeling
-- - Identification of slow zones (obstacles, grades, poor surfaces)
-- - Temporal patterns in wheelchair/skateboard travel
--
-- Privacy: Times are relative to trip start (not absolute timestamps)
-- to prevent reconstruction of exact trip timing.
-- ═══════════════════════════════════════════════════════════

-- Add relative_times column to trips table
ALTER TABLE trips
  ADD COLUMN relative_times real[] DEFAULT NULL;

COMMENT ON COLUMN trips.relative_times IS
  'Array of relative timestamps (seconds from trip start) for each coordinate in geometry. Used for speed analysis and Level of Traffic Stress modeling. NULL for legacy trips without timing data.';

-- No index needed - this column is for analysis, not querying
