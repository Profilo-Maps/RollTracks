-- Create a more efficient bulk seed function
CREATE OR REPLACE FUNCTION seed_curb_ramps_bulk(
  p_data JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_feature JSONB;
BEGIN
  FOR v_feature IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    INSERT INTO curb_ramps (
      cnn, location_description, curb_return_loc, position_on_return,
      condition_score, detectable_surf, location_text, geometry
    ) VALUES (
      (v_feature->>'cnn')::INTEGER,
      v_feature->>'location_description',
      v_feature->>'curb_return_loc',
      v_feature->>'position_on_return',
      (v_feature->>'condition_score')::INTEGER,
      (v_feature->>'detectable_surf')::NUMERIC,
      v_feature->>'location_text',
      ST_GeogFromText('POINT(' || (v_feature->>'lng') || ' ' || (v_feature->>'lat') || ')')
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION seed_curb_ramps_bulk IS 'Bulk seed curb ramps from JSONB array, bypasses RLS';;
