-- ═══════════════════════════════════════════════════════════
-- ADD reached_dest AND DEVICE TRACKING TO TRIPS TABLE
-- Migration: Add post-trip survey field and device/software tracking
-- Date: 2025-02-10
--
-- PART 1: Post-Trip Survey
-- The Start Trip Modal now includes a Post Trip Configuration
-- that asks users whether they successfully reached their
-- intended destination. This data enriches trip completion
-- analysis without compromising privacy.
--
-- PART 2: Device & Software Version Tracking
-- Tracks device platform, OS version, and app version with each trip for:
-- - Bug tracking and debugging (correlate issues with specific devices/versions)
-- - Feature compatibility analysis across platforms
-- - User support and troubleshooting
-- - App version adoption metrics
-- - Understanding device usage patterns in different contexts
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- PART 1: ADD reached_dest TO TRIPS TABLE
-- ───────────────────────────────────────────────────────────

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS reached_dest BOOLEAN;

COMMENT ON COLUMN trips.reached_dest IS
  'Whether the user reported successfully reaching their intended destination. NULL if not answered.';

-- ───────────────────────────────────────────────────────────
-- PART 2: ADD DEVICE TRACKING TO TRIPS TABLE
-- ───────────────────────────────────────────────────────────

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS device_platform TEXT,
  ADD COLUMN IF NOT EXISTS device_os_version TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT;

COMMENT ON COLUMN trips.device_platform IS
  'Device platform used for this trip (ios, android, web). Captured automatically when trip starts.';

COMMENT ON COLUMN trips.device_os_version IS
  'Operating system version (e.g., "iOS 17.2", "Android 14"). Captured automatically when trip starts.';

COMMENT ON COLUMN trips.app_version IS
  'App version from package.json (e.g., "1.0.0"). Captured automatically when trip starts.';
