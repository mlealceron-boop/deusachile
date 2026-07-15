
CREATE OR REPLACE FUNCTION public.anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item record;
  v_stock_actual numeric;
  v_costo_promedio numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ventas WHERE id = p_venta_id) THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Autorización: admin o dueño de la venta
  IF NOT (
    public.has_role(v_user, 'admin')
    OR EXISTS (SELECT 1 FROM public.ventas WHERE id = p_venta_id AND ejecutivo_id = v_user)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Reponer stock por cada ítem y registrar movimiento de reverso
  FOR v_item IN
    SELECT producto_id, cantidad FROM public.venta_items WHERE venta_id = p_venta_id
  LOOP
    INSERT INTO public.inventario (producto_id, stock_actual, costo_promedio)
    VALUES (v_item.producto_id, 0, 0)
    ON CONFLICT (producto_id) DO NOTHING;

    UPDATE public.inventario
    SET stock_actual = stock_actual + v_item.cantidad,
        actualizado_en = now()
    WHERE producto_id = v_item.producto_id
    RETURNING stock_actual, costo_promedio INTO v_stock_actual, v_costo_promedio;

    INSERT INTO public.movimientos_inventario (
      producto_id, tipo, cantidad, costo_unitario,
      costo_promedio_resultante, referencia_id, usuario_id, nota
    ) VALUES (
      v_item.producto_id, 'ajuste_positivo', v_item.cantidad, v_costo_promedio,
      v_costo_promedio, p_venta_id, v_user, 'Reverso por anulación de venta'
    );
  END LOOP;

  -- Eliminar la venta (venta_items se borra por CASCADE)
  DELETE FROM public.ventas WHERE id = p_venta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.anular_venta(uuid) TO authenticated;
