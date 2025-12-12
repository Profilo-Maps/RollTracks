-- Create storage bucket for trip files (photos, GPS tracks, etc.)
-- Files are organized by user_id for privacy and easy management

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-files', 'trip-files', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES FOR trip-files BUCKET
-- ============================================================================

-- Users can upload files to their own folder
-- File path format: {user_id}/{trip_id}/{filename}
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
