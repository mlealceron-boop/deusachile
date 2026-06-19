DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dirigido_a_rol') THEN
    CREATE TYPE public.dirigido_a_rol AS ENUM ('cliente', 'ejecutivo', 'ambos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_progreso') THEN
    CREATE TYPE public.estado_progreso AS ENUM ('no_iniciado', 'en_curso', 'completado');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.modulos_capacitacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  link_externo text NOT NULL,
  dirigido_a public.dirigido_a_rol NOT NULL DEFAULT 'ambos',
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.progreso_capacitacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.modulos_capacitacion(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado public.estado_progreso NOT NULL DEFAULT 'no_iniciado',
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_progreso_target CHECK (
    (cliente_id IS NOT NULL AND usuario_id IS NULL) OR 
    (usuario_id IS NOT NULL AND cliente_id IS NULL)
  ),
  CONSTRAINT unique_modulo_cliente UNIQUE (modulo_id, cliente_id),
  CONSTRAINT unique_modulo_usuario UNIQUE (modulo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_progreso_modulo ON public.progreso_capacitacion(modulo_id);
CREATE INDEX IF NOT EXISTS idx_progreso_cliente ON public.progreso_capacitacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_progreso_usuario ON public.progreso_capacitacion(usuario_id);

CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  accion text NOT NULL,
  tabla_afectada text NOT NULL,
  registro_id uuid,
  detalle jsonb,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria(tabla_afectada);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_capacitacion TO authenticated;
GRANT ALL ON public.modulos_capacitacion TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progreso_capacitacion TO authenticated;
GRANT ALL ON public.progreso_capacitacion TO service_role;
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

ALTER TABLE public.modulos_capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver modulos todos" ON public.modulos_capacitacion;
CREATE POLICY "Ver modulos todos" ON public.modulos_capacitacion
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Modificar modulos admin" ON public.modulos_capacitacion;
CREATE POLICY "Modificar modulos admin" ON public.modulos_capacitacion
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Ver progreso filtrado" ON public.progreso_capacitacion;
CREATE POLICY "Ver progreso filtrado" ON public.progreso_capacitacion
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    usuario_id = auth.uid() OR
    cliente_id IN (SELECT id FROM public.clientes WHERE ejecutivo_id = auth.uid())
  );
DROP POLICY IF EXISTS "Modificar progreso filtrado" ON public.progreso_capacitacion;
CREATE POLICY "Modificar progreso filtrado" ON public.progreso_capacitacion
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    usuario_id = auth.uid() OR
    cliente_id IN (SELECT id FROM public.clientes WHERE ejecutivo_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    usuario_id = auth.uid() OR
    cliente_id IN (SELECT id FROM public.clientes WHERE ejecutivo_id = auth.uid())
  );

DROP POLICY IF EXISTS "Ver auditoria admin" ON public.auditoria;
CREATE POLICY "Ver auditoria admin" ON public.auditoria
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Insertar auditoria automatico" ON public.auditoria;
CREATE POLICY "Insertar auditoria automatico" ON public.auditoria
  FOR INSERT TO authenticated WITH CHECK (true);