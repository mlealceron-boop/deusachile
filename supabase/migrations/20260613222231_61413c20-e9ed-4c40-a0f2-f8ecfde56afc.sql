
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'ejecutivo');
CREATE TYPE public.tipo_cliente AS ENUM ('clinica_propia', 'recien_empieza');
CREATE TYPE public.estado_cliente AS ENUM ('prospecto', 'activo', 'inactivo');

-- USUARIOS (perfil)
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- USER_ROLES (fuente de verdad para roles)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- has_role security definer (evita recursión)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- CLIENTES
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  clinica text,
  contacto text,
  tipo public.tipo_cliente NOT NULL DEFAULT 'recien_empieza',
  estado public.estado_cliente NOT NULL DEFAULT 'prospecto',
  ejecutivo_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_ejecutivo ON public.clientes(ejecutivo_id);

-- INTERACCIONES
CREATE TABLE public.interacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  nota text NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_interacciones_cliente ON public.interacciones(cliente_id);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacciones TO authenticated;
GRANT ALL ON public.interacciones TO service_role;

-- RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacciones ENABLE ROW LEVEL SECURITY;

-- USUARIOS policies
CREATE POLICY "Ver propio perfil o admin todos"
  ON public.usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin actualiza cualquier usuario"
  ON public.usuarios FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario actualiza propio perfil"
  ON public.usuarios FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- USER_ROLES policies (solo lectura desde cliente; mutaciones via server fn admin)
CREATE POLICY "Ver roles propios o admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- CLIENTES policies (aislamiento por ejecutivo a nivel BD)
CREATE POLICY "Ver clientes propios o admin"
  ON public.clientes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

CREATE POLICY "Insertar clientes propios o admin"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

CREATE POLICY "Actualizar clientes propios o admin"
  ON public.clientes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

CREATE POLICY "Eliminar clientes admin"
  ON public.clientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INTERACCIONES policies (heredan visibilidad del cliente padre)
CREATE POLICY "Ver interacciones de clientes accesibles"
  ON public.interacciones FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.ejecutivo_id = auth.uid())
  );

CREATE POLICY "Insertar interacciones en clientes accesibles"
  ON public.interacciones FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.ejecutivo_id = auth.uid())
    )
  );
