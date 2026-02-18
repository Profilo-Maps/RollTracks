-- Migration: Fix Polyline Function Delimiters
-- The previous migration had incorrect function delimiters ($ instead of $$)
-- This migration recreates the functions with correct syntax

-- ═══════════════════════════════════════════════════════════
-- 1. CREATE POLYLINE DECODING FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.decode_polyline(encoded TEXT)
RETURNS public.geometry
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  len INTEGER;
  index INTEGER := 1;
  lat INTEGER := 0;
  lng INTEGER := 0;
  dlat INTEGER;
  dlng INTEGER;
  shift INTEGER;
  result INTEGER;
  byte INTEGER;
  coords TEXT := '';
  char_code INTEGER;
BEGIN
  -- Handle NULL or empty input
  IF encoded IS NULL OR encoded = '' THEN
    RETURN NULL;
  END IF;

  len := length(encoded);

  WHILE index <= len LOOP
    -- Decode latitude
    shift := 0;
    result := 0;
    LOOP
      char_code := ascii(substring(encoded from index for 1)) - 63;
      index := index + 1;
      result := result | ((char_code & 31) << shift);
      shift := shift + 5;
      EXIT WHEN char_code < 32;
    END LOOP;
    
    IF (result & 1) = 1 THEN
      dlat := ~(result >> 1);
    ELSE
      dlat := result >> 1;
    END IF;
    lat := lat + dlat;

    -- Decode longitude
    shift := 0;
    result := 0;
    LOOP
      char_code := ascii(substring(encoded from index for 1)) - 63;
      index := index + 1;
      result := result | ((char_code & 31) << shift);
      shift := shift + 5;
      EXIT WHEN char_code < 32;
    END LOOP;
    
    IF (result & 1) = 1 THEN
      dlng := ~(result >> 1);
    ELSE
      dlng := result >> 1;
    END IF;
    lng := lng + dlng;

    -- Append coordinate (lon, lat) to WKT string
    IF coords != '' THEN
      coords := coords || ',';
    END IF;
    coords := coords || (lng::FLOAT / 100000.0)::TEXT || ' ' || (lat::FLOAT / 100000.0)::TEXT;
  END LOOP;

  -- Return as PostGIS LineString
  IF coords = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN ST_GeomFromText('LINESTRING(' || coords || ')', 4326);
END;
$$;
COMMENT ON FUNCTION public.decode_polyline IS
  'Decodes a Mapbox polyline string (precision 5) to PostGIS LineString geometry in SRID 4326';
-- ═══════════════════════════════════════════════════════════
-- 2. CREATE POLYLINE ENCODING HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.encode_signed_number(num INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sgn_num INTEGER;
  encoded TEXT := '';
  char_code INTEGER;
BEGIN
  -- Convert to unsigned and shift left
  IF num < 0 THEN
    sgn_num := (~num) << 1;
  ELSE
    sgn_num := num << 1;
  END IF;

  -- Encode in chunks of 5 bits
  WHILE sgn_num >= 32 LOOP
    char_code := (sgn_num & 31) | 32;
    encoded := encoded || chr(char_code + 63);
    sgn_num := sgn_num >> 5;
  END LOOP;

  encoded := encoded || chr(sgn_num + 63);
  
  RETURN encoded;
END;
$$;
-- ═══════════════════════════════════════════════════════════
-- 3. CREATE POLYLINE ENCODING FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.encode_polyline(geom public.geometry)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  encoded TEXT := '';
  prev_lat INTEGER := 0;
  prev_lng INTEGER := 0;
  lat INTEGER;
  lng INTEGER;
  dlat INTEGER;
  dlng INTEGER;
  point public.geometry;
  num_points INTEGER;
  i INTEGER;
BEGIN
  -- Handle NULL input
  IF geom IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get number of points
  num_points := ST_NPoints(geom);
  
  IF num_points = 0 THEN
    RETURN '';
  END IF;

  -- Iterate through points
  FOR i IN 1..num_points LOOP
    point := ST_PointN(geom, i);
    lat := ROUND(ST_Y(point) * 100000)::INTEGER;
    lng := ROUND(ST_X(point) * 100000)::INTEGER;
    
    dlat := lat - prev_lat;
    dlng := lng - prev_lng;
    
    encoded := encoded || encode_signed_number(dlat) || encode_signed_number(dlng);
    
    prev_lat := lat;
    prev_lng := lng;
  END LOOP;

  RETURN encoded;
END;
$$;
COMMENT ON FUNCTION public.encode_polyline IS
  'Encodes a PostGIS LineString geometry to Mapbox polyline string (precision 5)';
-- ═══════════════════════════════════════════════════════════
-- 4. UPDATE CENSUS BLOCK CLIPPING TRIGGER FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.store_trip_census_blocks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  trip_geom public.geometry;
  origin_point public.geometry;
  dest_point public.geometry;
  origin_geoid TEXT;
  dest_geoid TEXT;
  origin_block_geom public.geometry;
  dest_block_geom public.geometry;
  clipped_geom public.geometry;
BEGIN
  -- Skip if geometry is NULL or empty
  IF NEW.geometry IS NULL OR NEW.geometry = '' THEN
    NEW.od_geoids := NULL;
    RETURN NEW;
  END IF;

  -- Decode polyline to PostGIS geometry
  BEGIN
    trip_geom := decode_polyline(NEW.geometry);
  EXCEPTION WHEN OTHERS THEN
    -- If decoding fails, log and continue without clipping
    RAISE WARNING 'Failed to decode polyline for trip %: %', NEW.trip_id, SQLERRM;
    NEW.od_geoids := NULL;
    RETURN NEW;
  END;

  -- Skip if decoded geometry is NULL or has less than 2 points
  IF trip_geom IS NULL OR ST_NPoints(trip_geom) < 2 THEN
    NEW.od_geoids := NULL;
    RETURN NEW;
  END IF;

  -- Get origin and destination points
  origin_point := ST_StartPoint(trip_geom);
  dest_point := ST_EndPoint(trip_geom);

  -- Find origin census block
  SELECT geoid20, geom INTO origin_geoid, origin_block_geom
  FROM census_blocks
  WHERE ST_Contains(geom, origin_point)
  LIMIT 1;

  -- Log if origin block was found
  IF origin_geoid IS NOT NULL THEN
    RAISE NOTICE 'Found origin block: %', origin_geoid;
  ELSE
    RAISE NOTICE 'No origin block found for point: % %', ST_X(origin_point), ST_Y(origin_point);
  END IF;

  -- Find destination census block
  SELECT geoid20, geom INTO dest_geoid, dest_block_geom
  FROM census_blocks
  WHERE ST_Contains(geom, dest_point)
  LIMIT 1;

  -- Log if destination block was found
  IF dest_geoid IS NOT NULL THEN
    RAISE NOTICE 'Found destination block: %', dest_geoid;
  ELSE
    RAISE NOTICE 'No destination block found for point: % %', ST_X(dest_point), ST_Y(dest_point);
  END IF;

  -- Store the GEOIDs (even if NULL)
  NEW.od_geoids := ARRAY[origin_geoid, dest_geoid];

  -- Only clip if we found both blocks
  IF origin_geoid IS NOT NULL AND dest_geoid IS NOT NULL THEN
    BEGIN
      -- Clip the geometry by removing portions inside origin and destination blocks
      -- This removes the exact start and end points for privacy
      clipped_geom := ST_Difference(
        trip_geom,
        ST_Union(origin_block_geom, dest_block_geom)
      );

      -- If clipping resulted in valid geometry, re-encode it
      IF clipped_geom IS NOT NULL AND ST_GeometryType(clipped_geom) IN ('ST_LineString', 'ST_MultiLineString') THEN
        -- If MultiLineString, take the longest segment
        IF ST_GeometryType(clipped_geom) = 'ST_MultiLineString' THEN
          SELECT geom INTO clipped_geom
          FROM (
            SELECT (ST_Dump(clipped_geom)).geom AS geom
          ) AS segments
          ORDER BY ST_Length(geom) DESC
          LIMIT 1;
        END IF;

        -- Re-encode the clipped geometry
        NEW.geometry := encode_polyline(clipped_geom);
      END IF;
      -- If clipping failed or resulted in invalid geometry, keep original
    EXCEPTION WHEN OTHERS THEN
      -- If clipping fails, log and keep original geometry
      RAISE WARNING 'Failed to clip geometry for trip %: %', NEW.trip_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.store_trip_census_blocks IS
  'BEFORE INSERT trigger that decodes polyline, finds origin/destination census blocks, clips geometry for privacy, and stores block GEOIDs';
