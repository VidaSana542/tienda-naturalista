-- ============================================
-- MIGRACION: Tabla de Salidas Temporales
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Tabla principal de salidas
CREATE TABLE IF NOT EXISTS salidas (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(100) DEFAULT '',
  user_name VARCHAR(255) DEFAULT '',
  notes TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de cada salida (almacenados como JSONB para simplicidad)
-- Alternativa: tabla separada saline_items
CREATE TABLE IF NOT EXISTS salida_items (
  id BIGSERIAL PRIMARY KEY,
  salida_id BIGINT NOT NULL REFERENCES salidas(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL,
  sent_qty INTEGER DEFAULT 0 NOT NULL,
  sold_qty INTEGER DEFAULT 0 NOT NULL,
  returned_qty INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salidas_user ON salidas(user_id);
CREATE INDEX IF NOT EXISTS idx_salidas_status ON salidas(status);
CREATE INDEX IF NOT EXISTS idx_salidas_created ON salidas(created_at);
CREATE INDEX IF NOT EXISTS idx_salida_items_salida ON salida_items(salida_id);
CREATE INDEX IF NOT EXISTS idx_salida_items_product ON salida_items(product_id);

-- RLS
ALTER TABLE salidas DISABLE ROW LEVEL SECURITY;
ALTER TABLE salida_items DISABLE ROW LEVEL SECURITY;

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON salidas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON salida_items TO anon;

-- Verificar
SELECT * FROM salidas ORDER BY id DESC LIMIT 10;
