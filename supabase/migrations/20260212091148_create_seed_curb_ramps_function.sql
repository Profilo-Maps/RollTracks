-- Create a function to seed curb ramps data (bypasses RLS)
CREATE OR REPLACE FUNCTION seed_curb_ramp(
  p_cnn INTEGER,
  p_location_description TEXT,
  p_curb_return_loc TEXT,
  p_position_on_return TEXT,
  p_condition_score INTEGER,
  p_detectable_surf NUMERIC,
  p_location_text TEXT,
  p_lng NUMERIC,
  p_lat NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO curb_ramps (
    cnn, location_description, curb_return_loc, position_on_return,
    condition_score, detectable_surf, location_text, geometry
  ) VALUES (
    p_cnn, p_location_description, p_curb_return_loc, p_position_on_return,
    p_condition_score, p_detectable_surf, p_location_text,
    ST_GeogFromText('POINT(' || p_lng || ' ' || p_lat || ')')
  );
END;
$$;

COMMENT ON FUNCTION seed_curb_ramp IS 'Helper function to seed curb ramps data, bypasses RLS for initial data load';;
