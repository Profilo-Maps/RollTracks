-- ═══════════════════════════════════════════════════════════
-- ROLLTRACKS SQUASHED MIGRATION
-- Consolidated schema from all previous migrations
-- Date: 2025-02-11
-- ═══════════════════════════════════════════════════════════

-- PART 1: ENUMS AND TYPES
CREATE TYPE time_of_day_bin AS ENUM (
  'late_night', 'early_morning', 'morning_rush', 'midday', 
  'evening_rush', 'evening', 'night'
);

-- PART 2: CORE TABLES
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT UNIQUE NOT NULL,
  age INTEGER,
  mode_list TEXT[],
  dataranger_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_account_recovery_username ON account_recovery(username);

CREATE TABLE IF NOT EXISTS user_recovery_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_id UUID NOT NULL REFERENCES account_recovery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX idx_login_attempts_username_time ON login_attempts(username, attempted_at DESC);
CREATE INDEX idx_login_attempts_cleanup ON login_attempts(attempted_at);

CREATE TABLE IF NOT EXISTS census_blocks (
  id SERIAL PRIMARY KEY,
  geoid20 VARCHAR(15) UNIQUE NOT NULL,
  name20 VARCHAR(50),
  geom geometry(GEOMETRY, 4326) NOT NULL
);
CREATE INDEX idx_census_blocks_geom ON census_blocks USING GIST(geom);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id TEXT GENERATED ALWAYS AS (id::text) STORED,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  geometry TEXT,
  relative_times REAL[],
  distance_mi REAL,
  duration_s INTEGER,
  mode TEXT,
  comfort TEXT,
  purpose TEXT,
  time_of_day time_of_day_bin NOT NULL,
  weekday INTEGER NOT NULL,
  reached_dest BOOLEAN,
  device_platform TEXT,
  device_os_version TEXT,
  app_version TEXT,
  od_geoids VARCHAR(15)[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_trip_id ON trips(trip_id);
CREATE INDEX idx_trips_time_of_day ON trips(time_of_day);
CREATE INDEX idx_trips_weekday ON trips(weekday);
CREATE INDEX idx_trips_time_weekday ON trips(time_of_day, weekday);
CREATE INDEX idx_trips_user_time ON trips(user_id, time_of_day);

-- PART 3: ROW LEVEL SECURITY
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recovery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can read their own profile" ON user_profiles FOR SELECT TO authenticated, anon USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE TO authenticated, anon USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON user_profiles FOR DELETE TO authenticated, anon USING (auth.uid() = id);

CREATE POLICY "No direct inserts to account_recovery" ON account_recovery FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Users can read their own recovery credentials" ON account_recovery FOR SELECT TO authenticated, anon USING (id IN (SELECT recovery_id FROM user_recovery_links WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete their own recovery credentials" ON account_recovery FOR DELETE TO authenticated, anon USING (id IN (SELECT recovery_id FROM user_recovery_links WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own recovery links" ON user_recovery_links FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read their own recovery links" ON user_recovery_links FOR SELECT TO authenticated, anon USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own recovery links" ON user_recovery_links FOR UPDATE TO authenticated, anon USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recovery links" ON user_recovery_links FOR DELETE TO authenticated, anon USING (auth.uid() = user_id);

CREATE POLICY "No direct access to login_attempts" ON login_attempts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "census_blocks_select" ON census_blocks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own trips" ON trips FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read their own trips" ON trips FOR SELECT TO authenticated, anon USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own trips" ON trips FOR UPDATE TO authenticated, anon USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trips" ON trips FOR DELETE TO authenticated, anon USING (auth.uid() = user_id);

-- PART 4: SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION create_recovery_credentials(p_username TEXT, p_password_hash TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recovery_id UUID; v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User must be authenticated'; END IF;
  IF p_username !~ '^[a-zA-Z0-9_-]{3,30}$' THEN RAISE EXCEPTION 'Invalid username format'; END IF;
  IF p_password_hash !~ '^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'Invalid password hash'; END IF;
  IF EXISTS (SELECT 1 FROM user_recovery_links WHERE user_id = v_user_id) THEN RAISE EXCEPTION 'User already has recovery credentials'; END IF;
  BEGIN
    INSERT INTO account_recovery (username, password_hash) VALUES (p_username, p_password_hash) RETURNING id INTO v_recovery_id;
    INSERT INTO user_recovery_links (recovery_id, user_id) VALUES (v_recovery_id, v_user_id);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Registration failed. Try different username.';
  END;
  RETURN v_recovery_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_recovery_credentials(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION verify_login_credentials(p_username TEXT)
RETURNS TABLE (recovery_id UUID, password_hash TEXT, is_locked BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recovery_id UUID; v_password_hash TEXT; v_failed_attempts INTEGER; v_is_locked BOOLEAN := FALSE;
BEGIN
  PERFORM pg_sleep(0.1);
  SELECT count(*) INTO v_failed_attempts FROM login_attempts WHERE username = p_username AND attempted_at >= date_trunc('day', NOW()) AND success = FALSE;
  IF v_failed_attempts >= 10 THEN
    SELECT id INTO v_recovery_id FROM account_recovery WHERE username = p_username;
    IF v_recovery_id IS NOT NULL THEN PERFORM delete_user_completely(v_recovery_id); END IF;
    v_is_locked := TRUE;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, v_is_locked;
    RETURN;
  END IF;
  SELECT account_recovery.id, account_recovery.password_hash INTO v_recovery_id, v_password_hash FROM account_recovery WHERE account_recovery.username = p_username LIMIT 1;
  RETURN QUERY SELECT v_recovery_id, v_password_hash, v_is_locked;
END; $$;
GRANT EXECUTE ON FUNCTION verify_login_credentials(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION record_login_attempt(p_username TEXT, p_success BOOLEAN, p_ip_address INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO login_attempts (username, success, ip_address, user_agent) VALUES (p_username, p_success, p_ip_address, p_user_agent);
  IF p_success THEN DELETE FROM login_attempts WHERE username = p_username AND success = FALSE; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION record_login_attempt(TEXT, BOOLEAN, INET, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_remaining_login_attempts(p_username TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_failed_attempts INTEGER; v_remaining INTEGER;
BEGIN
  SELECT count(*) INTO v_failed_attempts FROM login_attempts WHERE username = p_username AND attempted_at >= date_trunc('day', NOW()) AND success = FALSE;
  v_remaining := 10 - v_failed_attempts;
  IF v_remaining < 0 THEN RETURN 0; END IF;
  RETURN v_remaining;
END; $$;
GRANT EXECUTE ON FUNCTION get_remaining_login_attempts(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION check_display_name_available(p_display_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM user_profiles WHERE LOWER(display_name) = LOWER(p_display_name)) INTO v_exists;
  RETURN NOT v_exists;
END; $$;
GRANT EXECUTE ON FUNCTION check_display_name_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION delete_user_completely(p_recovery_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM user_recovery_links WHERE recovery_id = p_recovery_id;
  IF v_user_id IS NULL THEN RETURN; END IF;
  DELETE FROM trips WHERE user_id = v_user_id;
  DELETE FROM user_profiles WHERE id = v_user_id;
  DELETE FROM user_recovery_links WHERE user_id = v_user_id;
  DELETE FROM account_recovery WHERE id = p_recovery_id;
END; $$;
GRANT EXECUTE ON FUNCTION delete_user_completely(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL '30 days'); END; $$;

-- PART 5: CENSUS BLOCK FUNCTIONS
CREATE OR REPLACE FUNCTION insert_census_block(p_geoid20 TEXT, p_name20 TEXT, p_geojson TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions' AS $$
BEGIN
  INSERT INTO census_blocks (geoid20, name20, geom) VALUES (p_geoid20, p_name20, ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)) ON CONFLICT (geoid20) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION batch_insert_census_blocks(p_blocks JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE insert_count INTEGER;
BEGIN
  WITH inserted AS (
    INSERT INTO census_blocks (geoid20, name20, geom)
    SELECT (block ->> 'geoid20')::VARCHAR(15), (block ->> 'name20')::VARCHAR(50), ST_SetSRID(ST_GeomFromGeoJSON(block ->> 'geojson')::geometry, 4326)
    FROM jsonb_array_elements(p_blocks) AS block ON CONFLICT (geoid20) DO NOTHING RETURNING 1
  )
  SELECT COUNT(*)::integer INTO insert_count FROM inserted;
  RETURN insert_count;
END; $$;

-- PART 6: POLYLINE FUNCTIONS
CREATE OR REPLACE FUNCTION decode_polyline(encoded TEXT)
RETURNS geometry LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE len INTEGER; index INTEGER := 1; lat INTEGER := 0; lng INTEGER := 0; dlat INTEGER; dlng INTEGER; shift INTEGER; result INTEGER; coords TEXT := ''; char_code INTEGER;
BEGIN
  IF encoded IS NULL OR encoded = '' THEN RETURN NULL; END IF;
  len := length(encoded);
  WHILE index <= len LOOP
    shift := 0; result := 0;
    LOOP char_code := ascii(substring(encoded from index for 1)) - 63; index := index + 1; result := result | ((char_code & 31) << shift); shift := shift + 5; EXIT WHEN char_code < 32; END LOOP;
    IF (result & 1) = 1 THEN dlat := ~(result >> 1); ELSE dlat := result >> 1; END IF;
    lat := lat + dlat;
    shift := 0; result := 0;
    LOOP char_code := ascii(substring(encoded from index for 1)) - 63; index := index + 1; result := result | ((char_code & 31) << shift); shift := shift + 5; EXIT WHEN char_code < 32; END LOOP;
    IF (result & 1) = 1 THEN dlng := ~(result >> 1); ELSE dlng := result >> 1; END IF;
    lng := lng + dlng;
    IF coords != '' THEN coords := coords || ','; END IF;
    coords := coords || (lng::FLOAT / 100000.0)::TEXT || ' ' || (lat::FLOAT / 100000.0)::TEXT;
  END LOOP;
  IF coords = '' THEN RETURN NULL; END IF;
  RETURN ST_GeomFromText('LINESTRING(' || coords || ')', 4326);
END; $$;

CREATE OR REPLACE FUNCTION encode_signed_number(num INTEGER)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE sgn_num INTEGER; encoded TEXT := ''; char_code INTEGER;
BEGIN
  IF num < 0 THEN sgn_num := (~num) << 1; ELSE sgn_num := num << 1; END IF;
  WHILE sgn_num >= 32 LOOP char_code := (sgn_num & 31) | 32; encoded := encoded || chr(char_code + 63); sgn_num := sgn_num >> 5; END LOOP;
  encoded := encoded || chr(sgn_num + 63);
  RETURN encoded;
END; $$;

CREATE OR REPLACE FUNCTION encode_polyline(geom geometry)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE encoded TEXT := ''; prev_lat INTEGER := 0; prev_lng INTEGER := 0; lat INTEGER; lng INTEGER; dlat INTEGER; dlng INTEGER; point geometry; num_points INTEGER; i INTEGER;
BEGIN
  IF geom IS NULL THEN RETURN NULL; END IF;
  num_points := ST_NPoints(geom);
  IF num_points = 0 THEN RETURN ''; END IF;
  FOR i IN 1..num_points LOOP
    point := ST_PointN(geom, i);
    lat := ROUND(ST_Y(point) * 100000)::INTEGER;
    lng := ROUND(ST_X(point) * 100000)::INTEGER;
    dlat := lat - prev_lat; dlng := lng - prev_lng;
    encoded := encoded || encode_signed_number(dlat) || encode_signed_number(dlng);
    prev_lat := lat; prev_lng := lng;
  END LOOP;
  RETURN encoded;
END; $$;

-- PART 7: TRIGGERS
CREATE OR REPLACE FUNCTION store_trip_census_blocks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE trip_geom geometry; origin_point geometry; dest_point geometry; origin_geoid TEXT; dest_geoid TEXT;
BEGIN
  IF NEW.geometry IS NULL OR NEW.geometry = '' THEN NEW.od_geoids := NULL; RETURN NEW; END IF;
  BEGIN trip_geom := decode_polyline(NEW.geometry);
  EXCEPTION WHEN OTHERS THEN NEW.od_geoids := NULL; RETURN NEW; END;
  IF trip_geom IS NULL OR ST_NPoints(trip_geom) < 2 THEN NEW.od_geoids := NULL; RETURN NEW; END IF;
  origin_point := ST_StartPoint(trip_geom); dest_point := ST_EndPoint(trip_geom);
  SELECT geoid20 INTO origin_geoid FROM census_blocks WHERE ST_Contains(geom, origin_point) LIMIT 1;
  SELECT geoid20 INTO dest_geoid FROM census_blocks WHERE ST_Contains(geom, dest_point) LIMIT 1;
  NEW.od_geoids := ARRAY[origin_geoid, dest_geoid];
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_store_trip_census_blocks BEFORE INSERT ON trips FOR EACH ROW EXECUTE FUNCTION store_trip_census_blocks();

CREATE OR REPLACE FUNCTION cleanup_orphaned_recovery_credentials()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE link_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO link_count FROM user_recovery_links WHERE recovery_id = OLD.recovery_id;
  IF link_count = 0 THEN DELETE FROM account_recovery WHERE id = OLD.recovery_id; END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER trigger_cleanup_orphaned_recovery AFTER DELETE ON user_recovery_links FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_recovery_credentials();
