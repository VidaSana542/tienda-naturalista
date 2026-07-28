-- ============================================
-- DROP + RECRIAR TODO - Proyecto Nuevo
-- Copia todo esto y ejecútalo en el SQL Editor
-- ============================================

-- BORRAR TABLAS EXISTENTES
DROP TABLE IF EXISTS cash_base CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS inventory_log CASCADE;
DROP TABLE IF EXISTS lab_orders CASCADE;
DROP TABLE IF EXISTS labs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS pos_users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS salida_items CASCADE;
DROP TABLE IF EXISTS salidas CASCADE;
DROP TABLE IF EXISTS supplier_expenses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS temp_products CASCADE;
DROP TABLE IF EXISTS mergedFrom CASCADE;

-- BORRAR SEQUENCES VIEJAS
DROP SEQUENCE IF EXISTS cash_base_id_seq CASCADE;
DROP SEQUENCE IF EXISTS categories_id_seq CASCADE;
DROP SEQUENCE IF EXISTS customers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS expenses_id_seq CASCADE;
DROP SEQUENCE IF EXISTS inventory_log_id_seq CASCADE;
DROP SEQUENCE IF EXISTS lab_orders_id_seq CASCADE;
DROP SEQUENCE IF EXISTS labs_id_seq CASCADE;
DROP SEQUENCE IF EXISTS payments_id_seq CASCADE;
DROP SEQUENCE IF EXISTS pos_users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS products_id_seq CASCADE;
DROP SEQUENCE IF EXISTS sale_items_id_seq CASCADE;
DROP SEQUENCE IF EXISTS sales_id_seq CASCADE;
DROP SEQUENCE IF EXISTS salida_items_id_seq CASCADE;
DROP SEQUENCE IF EXISTS salidas_id_seq CASCADE;
DROP SEQUENCE IF EXISTS supplier_expenses_id_seq CASCADE;
DROP SEQUENCE IF EXISTS suppliers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS temp_products_id_seq CASCADE;

-- BORRAR POLICIES VIEJAS (ignora errores si no existen)
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON cash_base; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON categories; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON customers; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON expenses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON inventory_log; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON lab_orders; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON labs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON payments; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON pos_users; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON products; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON sale_items; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON sales; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON salida_items; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON salidas; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON supplier_expenses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON suppliers; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "allow_all" ON temp_products; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- RECRIAR TABLAS (sin IDENTITY, permite IDs explícitos)
CREATE TABLE cash_base (
  id bigint PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  base_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id bigint PRIMARY KEY,
  key varchar NOT NULL,
  label varchar NOT NULL,
  parent_key varchar,
  created_at timestamptz DEFAULT now(),
  icon varchar DEFAULT '',
  image text DEFAULT '',
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true
);

CREATE TABLE customers (
  id bigint PRIMARY KEY,
  name varchar NOT NULL,
  phone varchar DEFAULT '',
  email varchar DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  tipo text DEFAULT 'local'
);

CREATE TABLE expenses (
  id bigint PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'otros',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_log (
  id bigint PRIMARY KEY,
  product_id varchar NOT NULL,
  product_name varchar NOT NULL,
  type varchar DEFAULT 'entrada',
  quantity integer NOT NULL DEFAULT 0,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  sale_id bigint,
  created_at timestamptz DEFAULT now(),
  venta_por_fuera boolean DEFAULT false,
  unit_price numeric DEFAULT 0
);

CREATE TABLE lab_orders (
  id bigint PRIMARY KEY,
  lab text NOT NULL,
  status text DEFAULT 'pendiente',
  items jsonb DEFAULT '[]'::jsonb,
  total numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE labs (
  id bigint PRIMARY KEY,
  name varchar NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE payments (
  id bigint PRIMARY KEY,
  sale_id bigint,
  amount numeric NOT NULL DEFAULT 0,
  method varchar DEFAULT '',
  note text DEFAULT '',
  date timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE pos_users (
  id bigint PRIMARY KEY,
  username varchar NOT NULL,
  pass varchar NOT NULL,
  role varchar DEFAULT 'admin',
  name varchar NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE products (
  id bigint PRIMARY KEY,
  name varchar NOT NULL,
  barcode varchar DEFAULT '',
  brand varchar DEFAULT '',
  category varchar DEFAULT 'suplementos',
  subcategory varchar DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  cost numeric DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  img text DEFAULT '',
  description text DEFAULT '',
  images jsonb DEFAULT '[]'::jsonb,
  supplier_id varchar,
  old_price numeric DEFAULT 0,
  badge varchar DEFAULT '',
  stock_status varchar DEFAULT 'in',
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  visible boolean DEFAULT true,
  catalog_name varchar DEFAULT ''
);

CREATE TABLE sale_items (
  id bigint PRIMARY KEY,
  sale_id bigint NOT NULL,
  product_id varchar NOT NULL,
  product_name varchar NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id bigint PRIMARY KEY,
  customer_id bigint,
  customer_name varchar DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  excedente numeric DEFAULT 0,
  method varchar DEFAULT 'Efectivo',
  method_key varchar DEFAULT 'cash',
  credit_info jsonb,
  status varchar DEFAULT 'completada',
  shipping_info jsonb,
  created_at timestamptz DEFAULT now(),
  venta_por_fuera boolean DEFAULT false
);

CREATE TABLE salida_items (
  id bigint PRIMARY KEY,
  salida_id bigint NOT NULL,
  product_id varchar NOT NULL,
  sent_qty integer NOT NULL DEFAULT 0,
  sold_qty integer NOT NULL DEFAULT 0,
  returned_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE salidas (
  id bigint PRIMARY KEY,
  user_id varchar DEFAULT '',
  user_name varchar DEFAULT '',
  notes text DEFAULT '',
  status varchar DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE supplier_expenses (
  id bigint PRIMARY KEY,
  supplier varchar NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE suppliers (
  id bigint PRIMARY KEY,
  name varchar NOT NULL,
  nit varchar DEFAULT '',
  contact varchar DEFAULT '',
  phone varchar DEFAULT '',
  email varchar DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE temp_products (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  sale_id bigint,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cash_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE salida_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_products ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "allow_all" ON cash_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON lab_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON labs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON pos_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON salida_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON salidas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON supplier_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON temp_products FOR ALL USING (true) WITH CHECK (true);
