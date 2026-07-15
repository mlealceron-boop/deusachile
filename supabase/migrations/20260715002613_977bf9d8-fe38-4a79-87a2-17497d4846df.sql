DROP POLICY IF EXISTS "Authenticated list productos" ON storage.objects;
CREATE POLICY "Admins list productos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'productos' AND public.has_role(auth.uid(), 'admin'));