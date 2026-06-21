
-- 1) Revoke EXECUTE from anon/PUBLIC on SECURITY DEFINER inventory functions and trigger function
REVOKE EXECUTE ON FUNCTION public.fn_auditar_cambio() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_stock(uuid, numeric, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_salida_venta(uuid, numeric, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_ajuste_stock(uuid, text, numeric, uuid, text) FROM PUBLIC, anon;

-- 2) Set search_path on fn_inicializar_inventario
CREATE OR REPLACE FUNCTION public.fn_inicializar_inventario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio, stock_minimo)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (producto_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 3) Restrict listing of productos bucket: files remain accessible by direct public URL (bucket is public),
--    but SDK listing of all objects now requires authentication.
DROP POLICY IF EXISTS "Public read productos" ON storage.objects;
CREATE POLICY "Authenticated list productos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'productos');

-- 4) Tighten audit-log INSERT policy. The fn_auditar_cambio trigger is SECURITY DEFINER and bypasses RLS,
--    so legitimate audit writes are unaffected. Any direct insert must now be attributed to the caller.
DROP POLICY IF EXISTS "Insertar auditoria automatico" ON public.auditoria;
CREATE POLICY "Insertar auditoria propio usuario"
ON public.auditoria
FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());
