-- Migration to create 'modulos_capacitacion', 'progreso_capacitacion', and 'auditoria' tables

-- 1. Create Enums if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dirigido_a_rol') THEN
    CREATE TYPE public.dirigido_a_rol AS ENUM ('cliente', 'ejecutivo', 'ambos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_progreso') THEN
    CREATE TYPE public.estado_progreso AS ENUM ('no_iniciado', 'en_curso', 'completado');
  END IF;
END$$;

-- 2. Create 'modulos_capacitacion' Table
CREATE TABLE IF NOT EXISTS public.modulos_capacitacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  link_externo text NOT NULL,
  dirigido_a public.dirigido_a_rol NOT NULL DEFAULT 'ambos',
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 3. Create 'progreso_capacitacion' Table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_progreso_modulo ON public.progreso_capacitacion(modulo_id);
CREATE INDEX IF NOT EXISTS idx_progreso_cliente ON public.progreso_capacitacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_progreso_usuario ON public.progreso_capacitacion(usuario_id);

-- 4. Create 'auditoria' Table
CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  accion text NOT NULL,
  tabla_afectada text NOT NULL,
  registro_id uuid,
  detalle jsonb,
  fecha timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria(tabla_afectada);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.modulos_capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progreso_capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.modulos_capacitacion TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.modulos_capacitacion TO authenticated;
GRANT ALL ON public.modulos_capacitacion TO service_role;

GRANT SELECT ON public.progreso_capacitacion TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.progreso_capacitacion TO authenticated;
GRANT ALL ON public.progreso_capacitacion TO service_role;

GRANT SELECT ON public.auditoria TO authenticated;
GRANT INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

-- 6. RLS Policies

-- modulos_capacitacion: Select all, write admin
DROP POLICY IF EXISTS "Ver modulos todos" ON public.modulos_capacitacion;
CREATE POLICY "Ver modulos todos" ON public.modulos_capacitacion
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Modificar modulos admin" ON public.modulos_capacitacion;
CREATE POLICY "Modificar modulos admin" ON public.modulos_capacitacion
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- progreso_capacitacion: Select / Update
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

-- auditoria: Select admin, insert authenticated, update/delete block
DROP POLICY IF EXISTS "Ver auditoria admin" ON public.auditoria;
CREATE POLICY "Ver auditoria admin" ON public.auditoria
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Insertar auditoria automatico" ON public.auditoria;
CREATE POLICY "Insertar auditoria automatico" ON public.auditoria
  FOR INSERT TO authenticated WITH CHECK (true);


-- 7. Automatic Auditing Trigger and Function
CREATE OR REPLACE FUNCTION public.fn_auditar_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion text;
  v_tabla text := TG_TABLE_NAME;
  v_registro_id uuid;
  v_detalle jsonb;
  v_usuario_id uuid := auth.uid();
BEGIN
  -- SKIP AUDITING TEMPORAL TRANSACTIONS OR DELETIONS ON SYSTEM AUDIT TABLE ITSELF
  IF v_tabla = 'auditoria' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- SKIP AUDITING movements logs to avoid excessive row updates
  IF v_tabla = 'movimientos_inventario' AND TG_OP IN ('UPDATE', 'DELETE') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine action and register ID
  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id;
    v_detalle := to_jsonb(NEW);
    CASE v_tabla
      WHEN 'clientes' THEN v_accion := 'creó cliente';
      WHEN 'ventas' THEN v_accion := 'creó venta';
      WHEN 'tareas' THEN v_accion := 'creó tarea';
      WHEN 'reuniones' THEN v_accion := 'creó reunión';
      WHEN 'usuarios' THEN v_accion := 'creó usuario';
      WHEN 'inventario' THEN v_accion := 'inicializó inventario';
      WHEN 'movimientos_inventario' THEN
        CASE NEW.tipo
          WHEN 'entrada' THEN v_accion := 'registró entrada de stock';
          WHEN 'ajuste_positivo' THEN v_accion := 'registró ajuste de stock';
          WHEN 'ajuste_negativo' THEN v_accion := 'registró ajuste de stock';
          ELSE v_accion := 'movimiento de inventario';
        END CASE;
      ELSE v_accion := 'insertó registro';
    END CASE;
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id;
    v_detalle := jsonb_build_object(
      'anterior', to_jsonb(OLD),
      'nuevo', to_jsonb(NEW)
    );
    CASE v_tabla
      WHEN 'clientes' THEN v_accion := 'editó cliente';
      WHEN 'ventas' THEN v_accion := 'editó venta';
      WHEN 'tareas' THEN v_accion := 'editó tarea';
      WHEN 'reuniones' THEN v_accion := 'editó reunión';
      WHEN 'usuarios' THEN v_accion := 'editó usuario';
      WHEN 'inventario' THEN v_accion := 'actualizó stock';
      ELSE v_accion := 'editó registro';
    END CASE;
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id;
    v_detalle := to_jsonb(OLD);
    CASE v_tabla
      WHEN 'clientes' THEN v_accion := 'eliminó cliente';
      WHEN 'ventas' THEN v_accion := 'anuló venta';
      WHEN 'tareas' THEN v_accion := 'eliminó tarea';
      WHEN 'reuniones' THEN v_accion := 'eliminó reunión';
      WHEN 'usuarios' THEN v_accion := 'eliminó usuario';
      WHEN 'inventario' THEN v_accion := 'eliminó inventario';
      ELSE v_accion := 'eliminó registro';
    END CASE;
  END IF;

  -- Insert audit log
  INSERT INTO public.auditoria (
    usuario_id,
    accion,
    tabla_afectada,
    registro_id,
    detalle
  )
  VALUES (
    v_usuario_id,
    v_accion,
    v_tabla,
    v_registro_id,
    v_detalle
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on core tables
-- Tables: clientes, ventas, tareas, reuniones, usuarios, movimientos_inventario, inventario

-- Trigger: clientes
DROP TRIGGER IF EXISTS trg_audit_clientes ON public.clientes;
CREATE TRIGGER trg_audit_clientes
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: ventas
DROP TRIGGER IF EXISTS trg_audit_ventas ON public.ventas;
CREATE TRIGGER trg_audit_ventas
  AFTER INSERT OR UPDATE OR DELETE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: tareas
DROP TRIGGER IF EXISTS trg_audit_tareas ON public.tareas;
CREATE TRIGGER trg_audit_tareas
  AFTER INSERT OR UPDATE OR DELETE ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: reuniones
DROP TRIGGER IF EXISTS trg_audit_reuniones ON public.reuniones;
CREATE TRIGGER trg_audit_reuniones
  AFTER INSERT OR UPDATE OR DELETE ON public.reuniones
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: usuarios
DROP TRIGGER IF EXISTS trg_audit_usuarios ON public.usuarios;
CREATE TRIGGER trg_audit_usuarios
  AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: movimientos_inventario
DROP TRIGGER IF EXISTS trg_audit_movimientos ON public.movimientos_inventario;
CREATE TRIGGER trg_audit_movimientos
  AFTER INSERT OR UPDATE OR DELETE ON public.movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();

-- Trigger: inventario
DROP TRIGGER IF EXISTS trg_audit_inventario ON public.inventario;
CREATE TRIGGER trg_audit_inventario
  AFTER INSERT OR UPDATE OR DELETE ON public.inventario
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_cambio();
