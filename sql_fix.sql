-- ========================================
-- FIX 1: Set active = true on all products
-- ========================================
UPDATE products
SET active = true
WHERE active IS NULL OR active = false;

-- ========================================
-- FIX 2: Diagnose category mismatches
-- Run these SELECTs to see what values exist
-- ========================================
-- See all distinct category values on products
SELECT DISTINCT category AS product_category FROM products ORDER BY category;

-- See all category keys
SELECT key, label FROM categories ORDER BY key;

-- See products whose category does NOT match any category key
SELECT id, name, category FROM products
WHERE category IS NOT NULL AND category != ''
  AND category NOT IN (SELECT key FROM categories);

-- See counts per category
SELECT category, COUNT(*) AS count
FROM products WHERE active = true
GROUP BY category ORDER BY category;
