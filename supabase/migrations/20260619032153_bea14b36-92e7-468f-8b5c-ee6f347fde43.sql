-- Replace SECURITY DEFINER view with column-level privileges + admin RPC
DROP VIEW IF EXISTS public.productos_publicos;
DROP POLICY IF EXISTS productos_select_admin ON public.productos;

CREATE POLICY productos_select_autenticados ON public.productos
  FOR SELECT TO authenticated USING (true);

-- Hide costo_referencia from authenticated role at column level
REVOKE SELECT ON public.productos FROM authenticated;
GRANT SELECT (id, marca_id, nombre, precio_referencia, activo, creado_en)
  ON public.productos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.productos TO authenticated;

-- Admin-only RPC that returns full rows including costo_referencia
CREATE OR REPLACE FUNCTION public.get_productos_admin()
RETURNS SETOF public.productos
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY SELECT * FROM public.productos ORDER BY nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.get_productos_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_productos_admin() TO authenticated;