-- SQL Script for Supabase Storage Bucket Initialization

-- 1. Insert bucket 'productos' if it doesn't exist, making it public.
-- This command is typically allowed in the SQL editor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

/*
  =========================================
  INSTRUCCIONES PARA CONFIGURAR POLÍTICAS (GUI)
  =========================================
  Si el SQL Editor de Supabase te da el error "must be owner of table objects",
  significa que tu rol de usuario en la consola no tiene permisos directos para
  alterar la tabla del sistema 'storage.objects' desde SQL.

  Por favor, configura las políticas de seguridad visualmente desde la consola de Supabase:

  1. Ve a la sección de **Storage** en el menú lateral izquierdo de Supabase.
  2. Selecciona **Policies** (Políticas).
  3. Busca la sección correspondiente al bucket **productos** (o storage.objects).
  4. Crea las siguientes políticas usando el botón **New Policy** -> **For full customization**:

     ---

     A. POLÍTICA DE LECTURA PÚBLICA (SELECT)
     - **Name**: "Acceso de lectura público para productos"
     - **Allowed operations**: SELECT
     - **Target roles**: public
     - **USING expression**:
       bucket_id = 'productos'

     ---

     B. POLÍTICA DE SUBIDA (INSERT)
     - **Name**: "Permitir subida a administradores"
     - **Allowed operations**: INSERT
     - **Target roles**: authenticated
     - **WITH CHECK expression**:
       bucket_id = 'productos' AND auth.uid() IN (
         SELECT user_id FROM public.user_roles WHERE role = 'admin'
       )

     ---

     C. POLÍTICA DE ACTUALIZACIÓN (UPDATE)
     - **Name**: "Permitir actualización a administradores"
     - **Allowed operations**: UPDATE
     - **Target roles**: authenticated
     - **USING expression**:
       bucket_id = 'productos' AND auth.uid() IN (
         SELECT user_id FROM public.user_roles WHERE role = 'admin'
       )

     ---

     D. POLÍTICA DE ELIMINACIÓN (DELETE)
     - **Name**: "Permitir eliminación a administradores"
     - **Allowed operations**: DELETE
     - **Target roles**: authenticated
     - **USING expression**:
       bucket_id = 'productos' AND auth.uid() IN (
         SELECT user_id FROM public.user_roles WHERE role = 'admin'
       )
*/
