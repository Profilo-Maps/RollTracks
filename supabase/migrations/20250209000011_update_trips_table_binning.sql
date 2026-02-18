-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS TRIPS TABLE PRIVACY UPDATE
-- Migration: Update trips table to use time bins instead of absolute timestamps
-- Date: 2025-02-09
--
-- This migration updates the trips table to store:
-- - time_of_day bins instead of start_time/end_time
-- - weekday indicator (1 for weekdays, 0 for weekends/holidays)
-- - Geometry with relative timestamps in properties.times
--
-- PRIVACY BENEFITS:
-- - Server never stores absolute trip timestamps
-- - Time binning reduces granularity for k-anonymity
-- - Relative timestamps in geometry enable speed analysis without exposing exact times
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- CREATE ENUM TYPE FOR TIME OF DAY BINS
-- ───────────────────────────────────────────────────────────

CREATE TYPE time_of_day_bin AS ENUM (
  'late_night',    -- 00:00 - 05:00
  'early_morning', -- 05:00 - 07:00
  'morning_rush',  -- 07:00 - 10:00
  'midday',        -- 10:00 - 16:00
  'evening_rush',  -- 16:00 - 19:00
  'evening',       -- 19:00 - 22:00
  'night'          -- 22:00 - 24:00
);
COMMENT ON TYPE time_of_day_bin IS
  'Time of day bins for trip classification. Reduces temporal granularity for privacy while maintaining analytical utility.';
-- ───────────────────────────────────────────────────────────
-- UPDATE TRIPS TABLE SCHEMA
-- ───────────────────────────────────────────────────────────

-- Add new columns (as nullable first, in case there's existing data)
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS time_of_day time_of_day_bin,
  ADD COLUMN IF NOT EXISTS weekday INTEGER;
COMMENT ON COLUMN trips.time_of_day IS
  'Binned time of day when trip started. One of 7 bins (late_night, early_morning, morning_rush, midday, evening_rush, evening, night).';
COMMENT ON COLUMN trips.weekday IS
  '1 for weekdays (Mon-Fri), 0 for weekends/holidays. Enables analysis of weekday vs weekend travel patterns.';
-- Migrate existing data if any (bin existing start_time values)
-- This ensures backward compatibility if there are any existing trips
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trips' AND column_name = 'start_time') THEN

    -- Bin existing start_time values into time_of_day and weekday
    UPDATE trips
    SET
      time_of_day = CASE
        WHEN EXTRACT(HOUR FROM start_time) >= 0 AND EXTRACT(HOUR FROM start_time) < 5 THEN 'late_night'::time_of_day_bin
        WHEN EXTRACT(HOUR FROM start_time) >= 5 AND EXTRACT(HOUR FROM start_time) < 7 THEN 'early_morning'::time_of_day_bin
        WHEN EXTRACT(HOUR FROM start_time) >= 7 AND EXTRACT(HOUR FROM start_time) < 10 THEN 'morning_rush'::time_of_day_bin
        WHEN EXTRACT(HOUR FROM start_time) >= 10 AND EXTRACT(HOUR FROM start_time) < 16 THEN 'midday'::time_of_day_bin
        WHEN EXTRACT(HOUR FROM start_time) >= 16 AND EXTRACT(HOUR FROM start_time) < 19 THEN 'evening_rush'::time_of_day_bin
        WHEN EXTRACT(HOUR FROM start_time) >= 19 AND EXTRACT(HOUR FROM start_time) < 22 THEN 'evening'::time_of_day_bin
        ELSE 'night'::time_of_day_bin
      END,
      weekday = CASE
        WHEN EXTRACT(DOW FROM start_time) IN (1, 2, 3, 4, 5) THEN 1
        ELSE 0
      END
    WHERE time_of_day IS NULL OR weekday IS NULL;

  END IF;
END $$;
-- Make new columns NOT NULL after migration
ALTER TABLE trips
  ALTER COLUMN time_of_day SET NOT NULL,
  ALTER COLUMN weekday SET NOT NULL;
-- Drop old timestamp columns (no longer needed)
ALTER TABLE trips
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time;
-- ───────────────────────────────────────────────────────────
-- CREATE INDEXES FOR EFFICIENT QUERYING
-- ───────────────────────────────────────────────────────────

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_trips_time_of_day
  ON trips(time_of_day);
-- Index for weekday/weekend analysis
CREATE INDEX IF NOT EXISTS idx_trips_weekday
  ON trips(weekday);
-- Composite index for combined time analysis
CREATE INDEX IF NOT EXISTS idx_trips_time_weekday
  ON trips(time_of_day, weekday);
-- Composite index for user's trips by time
CREATE INDEX IF NOT EXISTS idx_trips_user_time
  ON trips(user_id, time_of_day);
COMMENT ON INDEX idx_trips_time_of_day IS
  'Enables fast queries for trips by time of day (e.g., all morning_rush trips).';
COMMENT ON INDEX idx_trips_weekday IS
  'Enables fast queries for weekday vs weekend trip analysis.';
COMMENT ON INDEX idx_trips_time_weekday IS
  'Enables fast queries combining time of day and weekday filters.';
-- ═══════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════
--
-- GEOMETRY WITH RELATIVE TIMESTAMPS:
-- The geometry column now stores GeoJSON LineString with relative timestamps
-- in the properties.times array:
--
-- {
--   "type": "LineString",
--   "coordinates": [[-97.7431, 30.2672], ...],
--   "properties": {
--     "times": [0, 5, 10, 15, ...]  // Seconds since trip start
--   }
-- }
--
-- QUERYING EXAMPLES:
--
-- 1. Get all morning rush hour trips:
--    SELECT * FROM trips WHERE time_of_day = 'morning_rush';
--
-- 2. Get weekday trips:
--    SELECT * FROM trips WHERE weekday = 1;
--
-- 3. Get weekend morning trips:
--    SELECT * FROM trips
--    WHERE time_of_day = 'morning_rush' AND weekday = 0;
--
-- 4. Calculate average trip duration by time bin:
--    SELECT time_of_day, AVG(duration_s) as avg_duration
--    FROM trips
--    GROUP BY time_of_day
--    ORDER BY avg_duration DESC;
--
-- PRIVACY GUARANTEES:
-- - No absolute timestamps stored in database
-- - Time granularity reduced to 7 bins (from 86400 possible seconds/day)
-- - Weekday granularity reduced to binary (from 7 specific days)
-- - Relative timestamps enable speed analysis without exposing trip timing
-- - Better k-anonymity: easier to find k≥5 similar trips in same bin
--
-- ═══════════════════════════════════════════════════════════;
