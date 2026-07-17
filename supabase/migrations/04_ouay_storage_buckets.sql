-- =============================================================================
-- 04_ouay_storage_buckets.sql
--
-- Public storage buckets for generated images and PDFs. Both are public-read
-- so the admin dashboard, ebook download links and BookVault (which fetches
-- the interior/cover PDFs by URL) can reach them without signed URLs. Writes
-- still only happen server-side via the service key. Apply in the SQL editor.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('ouay-images', 'ouay-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ouay-pdfs', 'ouay-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read on both buckets. (Uploads are done with the service role, which
-- bypasses these policies, so no insert/update policy is needed for the app.)
DROP POLICY IF EXISTS "ouay_images_public_read" ON storage.objects;
CREATE POLICY "ouay_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ouay-images');

DROP POLICY IF EXISTS "ouay_pdfs_public_read" ON storage.objects;
CREATE POLICY "ouay_pdfs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ouay-pdfs');
