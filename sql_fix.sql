-- ========================================
-- NORMALIZAR CATEGORIAS Y PRODUCTOS
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ========================================

-- 1. Diagnosticar duplicados
SELECT '--- CATEGORIAS DUPLICADAS ---' AS info;
SELECT a.id AS id_a, a.key AS key_a, b.id AS id_b, b.key AS key_b, a.label
FROM categories a JOIN categories b ON a.label = b.label AND a.key <> b.key;

SELECT '--- CATEGORIAS SIN COINCIDIR CON PRODUCTOS ---' AS info;
SELECT DISTINCT p.category AS product_category
FROM products p
WHERE p.category NOT IN (SELECT key FROM categories WHERE key IS NOT NULL);

-- 2. Si hay duplicados (ej: belleza-y-bienestar y belleza_y_bienestar),
--    elegir UNA key como canonica y actualizar productos
--    DESCOMENTAR y ejecutar SOLO si los SELECTs de arriba muestran duplicados:

-- UPDATE products SET category = 'belleza_y_bienestar'
-- WHERE category = 'belleza-y-bienestar';
-- DELETE FROM categories WHERE key = 'belleza-y-bienestar';

-- 3. Normalizar productos cuyas categorias no existen en la tabla categories
UPDATE products SET category = 'salud_y_bienestar'
WHERE category IN ('salud-y-bienestar', 'salud');

UPDATE products SET category = 'vitaminas'
WHERE category = 'vitaminas-y-minerales';

-- 4. Activar todos los productos
UPDATE products SET active = true WHERE active IS NULL OR active = false;

-- 5. Verificar resultado
SELECT '--- RESULTADO FINAL ---' AS info;
SELECT category, COUNT(*) AS count
FROM products WHERE active = true
GROUP BY category ORDER BY category;
