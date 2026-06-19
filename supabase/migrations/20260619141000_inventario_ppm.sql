-- Migration to initialize 'inventario' and 'movimientos_inventario' tables and PPM logic

-- 1. Create inventario table
CREATE TABLE IF NOT EXISTS public.inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL UNIQUE REFERENCES public.productos(id) ON DELETE CASCADE,
  stock_actual numeric NOT NULL DEFAULT 0,
  costo_promedio numeric(12,2) NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_inventario_producto ON public.inventario(producto_id);

-- 2. Create movimientos_inventario table
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida_venta', 'ajuste_positivo', 'ajuste_negativo')),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  costo_unitario numeric(12,2) NOT NULL DEFAULT 0,
  costo_promedio_resultante numeric(12,2) NOT NULL DEFAULT 0,
  referencia_id uuid, -- sale_id if type is salida_venta
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nota text,
  fecha timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON public.movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON public.movimientos_inventario(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON public.movimientos_inventario(fecha);

-- 3. Enable RLS
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.inventario TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventario TO authenticated;
GRANT ALL ON public.inventario TO service_role;

GRANT SELECT ON public.movimientos_inventario TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.movimientos_inventario TO authenticated;
GRANT ALL ON public.movimientos_inventario TO service_role;

-- RLS Policies for inventario
DROP POLICY IF EXISTS "Ver inventario todos" ON public.inventario;
CREATE POLICY "Ver inventario todos" ON public.inventario
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Modificar inventario admin" ON public.inventario;
CREATE POLICY "Modificar inventario admin" ON public.inventario
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for movimientos_inventario
DROP POLICY IF EXISTS "Ver movimientos filtrados" ON public.movimientos_inventario;
CREATE POLICY "Ver movimientos filtrados" ON public.movimientos_inventario
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (tipo = 'salida_venta' AND referencia_id IN (SELECT id FROM public.ventas WHERE ejecutivo_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Modificar movimientos admin" ON public.movimientos_inventario;
CREATE POLICY "Modificar movimientos admin" ON public.movimientos_inventario
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- 4. PostgreSQL Functions for stock operations
-- Function: registrar_entrada_stock
CREATE OR REPLACE FUNCTION public.registrar_entrada_stock(
  p_producto_id uuid,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_usuario_id uuid,
  p_nota text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_actual numeric := 0;
  v_costo_promedio numeric := 0;
  v_nuevo_stock numeric;
  v_nuevo_costo_promedio numeric;
BEGIN
  -- Validate input parameters
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  -- Ensure row exists in inventario (or get current values)
  INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio)
  VALUES (p_producto_id, 0, 0)
  ON CONFLICT (producto_id) DO NOTHING;

  SELECT stock_actual, costo_promedio
  INTO v_stock_actual, v_costo_promedio
  FROM public.inventario
  WHERE producto_id = p_producto_id;

  -- PPM calculation
  v_nuevo_stock := v_stock_actual + p_cantidad;
  IF v_nuevo_stock > 0 THEN
    v_nuevo_costo_promedio := ((v_stock_actual * v_costo_promedio) + (p_cantidad * p_costo_unitario)) / v_nuevo_stock;
  ELSE
    v_nuevo_costo_promedio := 0;
  END IF;

  -- Round PPM to 2 decimal places
  v_nuevo_costo_promedio := round(v_nuevo_costo_promedio, 2);

  -- Update inventario
  UPDATE public.inventario
  SET stock_actual = v_nuevo_stock,
      costo_promedio = v_nuevo_costo_promedio,
      actualizado_en = now()
  WHERE producto_id = p_producto_id;

  -- Register movement log
  INSERT INTO public.movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    costo_unitario,
    costo_promedio_resultante,
    usuario_id,
    nota
  )
  VALUES (
    p_producto_id,
    'entrada',
    p_cantidad,
    p_costo_unitario,
    v_nuevo_costo_promedio,
    p_usuario_id,
    p_nota
  );
END;
$$;


-- Function: registrar_salida_venta
CREATE OR REPLACE FUNCTION public.registrar_salida_venta(
  p_producto_id uuid,
  p_cantidad numeric,
  p_venta_id uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_actual numeric := 0;
  v_costo_promedio numeric := 0;
  v_producto_nombre text;
BEGIN
  -- Validate input parameters
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  -- Ensure row exists in inventario
  INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio)
  VALUES (p_producto_id, 0, 0)
  ON CONFLICT (producto_id) DO NOTHING;

  SELECT stock_actual, costo_promedio
  INTO v_stock_actual, v_costo_promedio
  FROM public.inventario
  WHERE producto_id = p_producto_id;

  -- Check if stock is sufficient
  IF v_stock_actual < p_cantidad THEN
    SELECT split_part(nombre, '|', 1) INTO v_producto_nombre FROM public.productos WHERE id = p_producto_id;
    RAISE EXCEPTION 'Stock insuficiente para %. Disponible: % unidades.', COALESCE(v_producto_nombre, 'Producto'), v_stock_actual;
  END IF;

  -- Update inventario
  UPDATE public.inventario
  SET stock_actual = stock_actual - p_cantidad,
      actualizado_en = now()
  WHERE producto_id = p_producto_id;

  -- Register movement log
  INSERT INTO public.movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    costo_unitario,
    costo_promedio_resultante,
    referencia_id,
    usuario_id,
    nota
  )
  VALUES (
    p_producto_id,
    'salida_venta',
    p_cantidad,
    v_costo_promedio, -- use current PPM as unit cost
    v_costo_promedio, -- PPM remains same
    p_venta_id,
    p_usuario_id,
    'Salida por registro de venta'
  );
END;
$$;


-- Function: registrar_ajuste_stock
CREATE OR REPLACE FUNCTION public.registrar_ajuste_stock(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad numeric,
  p_usuario_id uuid,
  p_nota text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_actual numeric := 0;
  v_costo_promedio numeric := 0;
  v_nuevo_stock numeric;
  v_producto_nombre text;
BEGIN
  -- Validate parameters
  IF p_tipo NOT IN ('ajuste_positivo', 'ajuste_negativo') THEN
    RAISE EXCEPTION 'Tipo de ajuste inválido. Debe ser ajuste_positivo o ajuste_negativo.';
  END IF;
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad de ajuste debe ser mayor que cero.';
  END IF;
  IF p_nota IS NULL OR trim(p_nota) = '' THEN
    RAISE EXCEPTION 'La nota o justificación del ajuste es obligatoria.';
  END IF;

  -- Ensure row exists
  INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio)
  VALUES (p_producto_id, 0, 0)
  ON CONFLICT (producto_id) DO NOTHING;

  SELECT stock_actual, costo_promedio
  INTO v_stock_actual, v_costo_promedio
  FROM public.inventario
  WHERE producto_id = p_producto_id;

  IF p_tipo = 'ajuste_positivo' THEN
    v_nuevo_stock := v_stock_actual + p_cantidad;
  ELSE
    IF v_stock_actual < p_cantidad THEN
      SELECT split_part(nombre, '|', 1) INTO v_producto_nombre FROM public.productos WHERE id = p_producto_id;
      RAISE EXCEPTION 'Stock insuficiente para realizar ajuste en %. Disponible: % unidades.', COALESCE(v_producto_nombre, 'Producto'), v_stock_actual;
    END IF;
    v_nuevo_stock := v_stock_actual - p_cantidad;
  END IF;

  -- Update inventario
  UPDATE public.inventario
  SET stock_actual = v_nuevo_stock,
      actualizado_en = now()
  WHERE producto_id = p_producto_id;

  -- Register movement
  INSERT INTO public.movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    costo_unitario,
    costo_promedio_resultante,
    usuario_id,
    nota
  )
  VALUES (
    p_producto_id,
    p_tipo,
    p_cantidad,
    v_costo_promedio,
    v_costo_promedio,
    p_usuario_id,
    p_nota
  );
END;
$$;


-- 5. Trigger to automatically initialize inventory on product creation
CREATE OR REPLACE FUNCTION public.fn_inicializar_inventario()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio, stock_minimo)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (producto_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_inventario_init ON public.productos;
CREATE TRIGGER trg_productos_inventario_init
  AFTER INSERT ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inicializar_inventario();

-- Seed inventory for existing products
INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio, stock_minimo)
SELECT id, 0, 0, 0 FROM public.productos
ON CONFLICT (producto_id) DO NOTHING;
