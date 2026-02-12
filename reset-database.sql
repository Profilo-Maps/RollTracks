-- ═══════════════════════════════════════════════════════════
-- RESET DATABASE - DROP ALL TABLES
-- WARNING: This will delete ALL data!
-- ═══════════════════════════════════════════════════════════

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_store_trip_census_blocks ON trips;
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_recovery ON user_recovery_links;

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS user_recovery_links CASCADE;
DROP TABLE IF EXISTS account_recovery CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS census_blocks CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS store_trip_census_blocks() CASCADE;
DROP FUNCTION IF EXISTS cleanup_orphaned_recovery_credentials() CASCADE;
DROP FUNCTION IF EXISTS create_recovery_credentials(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS verify_login_credentials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS record_login_attempt(TEXT, BOOLEAN, INET, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_remaining_login_attempts(TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_display_name_available(TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_user_completely(UUID) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_login_attempts() CASCADE;
DROP FUNCTION IF EXISTS insert_census_block(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS batch_insert_census_blocks(JSONB) CASCADE;
DROP FUNCTION IF EXISTS decode_polyline(TEXT) CASCADE;
DROP FUNCTION IF EXISTS encode_signed_number(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS encode_polyline(geometry) CASCADE;

-- Drop types
DROP TYPE IF EXISTS time_of_day_bin CASCADE;

-- Note: PostGIS extension and spatial_ref_sys table are preserved
