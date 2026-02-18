-- Allow authenticated users to insert curb ramps (for seeding)
CREATE POLICY "Authenticated users can insert curb ramps"
ON curb_ramps FOR INSERT
WITH CHECK (auth.role() = 'authenticated');;
