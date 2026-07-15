ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nivel text,
  ADD COLUMN IF NOT EXISTS interes text,
  ADD COLUMN IF NOT EXISTS notas text;