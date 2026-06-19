-- 1. user_roles: only admins may insert/update/delete roles
DROP POLICY IF EXISTS "Admins insertan roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins actualizan roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins eliminan roles" ON public.user_roles;

CREATE POLICY "Admins insertan roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins actualizan roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins eliminan roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Hide productos.costo_referencia from non-admins
DROP POLICY IF EXISTS productos_select_autenticados ON public.productos;

CREATE POLICY productos_select_admin ON public.productos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.productos_publicos AS
SELECT id, marca_id, nombre, precio_referencia, activo, creado_en
FROM public.productos;

REVOKE ALL ON public.productos_publicos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.productos_publicos TO authenticated;

-- 3. Restrict SECURITY DEFINER admin functions to authenticated callers only
REVOKE ALL ON FUNCTION public.bootstrap_admin(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_perfil_y_rol(uuid, text, text, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cambiar_rol(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalcular_venta(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_perfil_y_rol(uuid, text, text, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_rol(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_venta(uuid) TO authenticated;