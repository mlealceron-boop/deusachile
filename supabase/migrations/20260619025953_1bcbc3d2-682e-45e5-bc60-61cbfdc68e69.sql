
CREATE POLICY "Public read productos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'productos');
CREATE POLICY "Admins insert productos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'productos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update productos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'productos' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'productos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete productos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'productos' AND public.has_role(auth.uid(), 'admin'));
