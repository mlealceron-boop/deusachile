ALTER TABLE public.ventas DROP CONSTRAINT ventas_cliente_id_fkey;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;