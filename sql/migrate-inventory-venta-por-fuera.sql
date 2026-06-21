-- ============================================
-- MIGRACION: Agregar venta_por_fuera a inventory_log
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna venta_por_fuera
ALTER TABLE inventory_log ADD COLUMN IF NOT EXISTS venta_por_fuera BOOLEAN DEFAULT FALSE;

-- 2. Index para busquedas
CREATE INDEX IF NOT EXISTS idx_inventory_log_vpf ON inventory_log(venta_por_fuera);

-- 3. Verificar
SELECT id, product_name, type, venta_por_fuera FROM inventory_log ORDER BY id DESC LIMIT 20;
