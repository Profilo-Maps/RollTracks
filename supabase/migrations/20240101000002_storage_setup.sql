-- Create storage bucket for trip uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-uploads', 'trip-uploads', false);

-- Storage policies for trip-uploads bucket
CREATE POLICY "Users can upload own trip files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own trip files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own trip files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'trip-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own trip files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
