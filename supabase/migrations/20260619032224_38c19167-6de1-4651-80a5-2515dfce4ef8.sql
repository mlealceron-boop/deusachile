REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.any_admin_exists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.any_admin_exists() TO authenticated;

REVOKE ALL ON FUNCTION public.get_productos_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_productos_admin() TO authenticated;