-- SQL Script to enable and configure the 'productos' storage bucket in Supabase

-- 1. Insert bucket 'productos' if it doesn't exist, making it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure Row Level Security is enabled on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public read access to all files in the 'productos' bucket
CREATE POLICY "Public Read Access for Products"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'productos');

-- 4. Policy: Allow authenticated administrators to upload product images
CREATE POLICY "Admin Insert Access for Products"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'productos'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  )
);

-- 5. Policy: Allow authenticated administrators to update product images
CREATE POLICY "Admin Update Access for Products"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'productos'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'productos'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  )
);

-- 6. Policy: Allow authenticated administrators to delete product images
CREATE POLICY "Admin Delete Access for Products"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'productos'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  )
);
