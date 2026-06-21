-- ============================================
-- MIGRACION: Agregar catalog_name a products
-- Ejecutar en Supabase SQL Editor
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_name VARCHAR(255) DEFAULT '';

-- Asignar nombre de tienda: toma solo la parte antes del primer '_'
-- Ej: 'BIOSUR_macel' → 'BIOSUR', 'NATURE_colageno' → 'NATURE'
UPDATE products SET catalog_name = TRIM(SPLIT_PART(name, '_', 1)) WHERE catalog_name IS NULL OR catalog_name = '';

-- Para productos sin '_', usar el nombre completo
UPDATE products SET catalog_name = name WHERE catalog_name = '';

-- Verificar
SELECT id, name, catalog_name FROM products ORDER BY id DESC LIMIT 20;
