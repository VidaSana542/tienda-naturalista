-- ============================================
-- MIGRACION: Mejorar estructura de categorias
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columnas nuevas a categories (sin romper nada)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 2. Agregar constraint FK para parent_key (opcional, seguro)
-- Solo si no existe ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_key_fk'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_parent_key_fk
      FOREIGN KEY (parent_key) REFERENCES categories(key) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Agregar FK de products.category -> categories.key (opcional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_category_fk'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_category_fk
      FOREIGN KEY (category) REFERENCES categories(key) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Index para sort_order
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- 5. Index para active
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);

-- 6. Normalizar keys inconsistentes (quitar espacios, tildes, etc.)
-- Solo ejecutar una vez, revisar antes de ejecutar
/*
UPDATE categories SET key = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  key, ' ', '_'), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'))
WHERE key ~ '[A-ZÁÉÍÓÚáéíóú ]';
*/

-- 7. Asignar sort_order a categorias existentes basado en su orden actual
UPDATE categories SET sort_order = (
  SELECT ROW_NUMBER() OVER (PARTITION BY parent_key ORDER BY label)
  FROM categories AS sub
  WHERE sub.id = categories.id
);

-- Verificar resultado
SELECT id, key, label, parent_key, icon, sort_order, active FROM categories ORDER BY parent_key NULLS FIRST, sort_order;
