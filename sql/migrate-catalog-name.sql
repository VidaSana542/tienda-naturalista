-- ============================================
-- MIGRACION: Agregar catalog_name a products
-- Ejecutar en Supabase SQL Editor
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_name VARCHAR(255) DEFAULT '';

-- Asignar nombre automatico para productos existentes
UPDATE products SET catalog_name = name WHERE catalog_name IS NULL OR catalog_name = '';

-- Verificar
SELECT id, name, catalog_name FROM products ORDER BY id DESC LIMIT 20;
