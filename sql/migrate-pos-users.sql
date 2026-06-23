-- ============================================
-- MIGRACION: Tabla de Usuarios POS
-- Ejecutar en Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS pos_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  pass VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pos_users DISABLE ROW LEVEL SECURITY;

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_users TO anon;

-- Verificar
SELECT * FROM pos_users;
