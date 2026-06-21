-- ============================================
-- MIGRACION: Agregar campo visible a productos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna visible (default true = todos visibles)
ALTER TABLE products ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;

-- 2. Index para busquedas por visible
CREATE INDEX IF NOT EXISTS idx_products_visible ON products(visible);

-- 3. Verificar
SELECT id, name, visible, active FROM products WHERE active = true ORDER BY name;
