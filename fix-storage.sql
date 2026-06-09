-- ============================================
-- FIX: Storage RLS - Permitir uploads anon
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- Asegurar bucket publico
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Dropear policies viejas si existen
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete images" ON storage.objects;

-- Recrear policies
CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can delete images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- Deshabilitar RLS en storage.objects para anon
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
