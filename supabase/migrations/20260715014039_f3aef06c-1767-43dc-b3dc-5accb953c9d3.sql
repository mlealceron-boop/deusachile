ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS es_muestra boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_ventas_es_muestra ON public.ventas(es_muestra);