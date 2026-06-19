
-- Helpers para gestionar usuarios sin service role key (no disponible en Lovable Cloud)

-- 1) Existe al menos un admin (callable por anon — usado en /auth)
CREATE OR REPLACE FUNCTION public.any_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.any_admin_exists() TO anon, authenticated;

-- 2) Bootstrap del primer admin: el usuario recién registrado se auto-promueve
--    SOLO si todavía no existe ningún admin.
CREATE OR REPLACE FUNCTION public.bootstrap_admin(p_nombre text, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Ya existe un administrador';
  END IF;
  INSERT INTO public.usuarios (id, nombre, email)
  VALUES (v_uid, p_nombre, p_email)
  ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text) TO authenticated;

-- 3) Crear perfil + rol para un usuario ya existente en auth.users.
--    Solo administradores pueden invocarla.
CREATE OR REPLACE FUNCTION public.crear_perfil_y_rol(
  p_uid uuid, p_nombre text, p_email text, p_rol app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.usuarios (id, nombre, email)
  VALUES (p_uid, p_nombre, p_email)
  ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_uid, p_rol)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_perfil_y_rol(uuid, text, text, app_role) TO authenticated;

-- 4) Cambiar el rol de un usuario, manteniendo siempre al menos un admin.
CREATE OR REPLACE FUNCTION public.cambiar_rol(p_user uuid, p_rol app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_user = auth.uid() AND p_rol <> 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Debe existir al menos un administrador';
    END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user, p_rol);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_rol(uuid, app_role) TO authenticated;
