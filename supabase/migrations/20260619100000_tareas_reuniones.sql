-- Migration to create 'tareas' and 'reuniones' tables with security policies and enums

-- 1. Create Enums if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_tarea') THEN
    CREATE TYPE public.estado_tarea AS ENUM ('pendiente', 'en_curso', 'completada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_reunion') THEN
    CREATE TYPE public.estado_reunion AS ENUM ('agendada', 'realizada', 'cancelada');
  END IF;
END$$;

-- 2. Create 'tareas' Table
CREATE TABLE IF NOT EXISTS public.tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  ejecutivo_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  estado public.estado_tarea NOT NULL DEFAULT 'pendiente',
  fecha_limite timestamptz,
  creado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_tareas_ejecutivo ON public.tareas(ejecutivo_id);
CREATE INDEX IF NOT EXISTS idx_tareas_cliente ON public.tareas(cliente_id);

-- 3. Create 'reuniones' Table
CREATE TABLE IF NOT EXISTS public.reuniones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ejecutivo_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  fecha_hora timestamptz NOT NULL,
  objetivo text NOT NULL,
  resultado text,
  estado public.estado_reunion NOT NULL DEFAULT 'agendada',
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_reuniones_ejecutivo ON public.reuniones(ejecutivo_id);
CREATE INDEX IF NOT EXISTS idx_reuniones_cliente ON public.reuniones(cliente_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniones ENABLE ROW LEVEL SECURITY;

-- 5. Set Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tareas TO authenticated;
GRANT ALL ON public.tareas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reuniones TO authenticated;
GRANT ALL ON public.reuniones TO service_role;

-- 6. TAREAS RLS Policies
DROP POLICY IF EXISTS "Ver tareas propias o admin" ON public.tareas;
CREATE POLICY "Ver tareas propias o admin"
  ON public.tareas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Insertar tareas propias o admin" ON public.tareas;
CREATE POLICY "Insertar tareas propias o admin"
  ON public.tareas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Actualizar tareas propias o admin" ON public.tareas;
CREATE POLICY "Actualizar tareas propias o admin"
  ON public.tareas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Eliminar tareas admin" ON public.tareas;
CREATE POLICY "Eliminar tareas admin"
  ON public.tareas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- 7. REUNIONES RLS Policies
DROP POLICY IF EXISTS "Ver reuniones propias o admin" ON public.reuniones;
CREATE POLICY "Ver reuniones propias o admin"
  ON public.reuniones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Insertar reuniones propias o admin" ON public.reuniones;
CREATE POLICY "Insertar reuniones propias o admin"
  ON public.reuniones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Actualizar reuniones propias o admin" ON public.reuniones;
CREATE POLICY "Actualizar reuniones propias o admin"
  ON public.reuniones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR ejecutivo_id = auth.uid());

DROP POLICY IF EXISTS "Eliminar reuniones admin" ON public.reuniones;
CREATE POLICY "Eliminar reuniones admin"
  ON public.reuniones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
