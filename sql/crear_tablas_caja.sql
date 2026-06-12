-- Ejecutar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/jcksqhqopqhswwxskhls)
CREATE TABLE IF NOT EXISTS cash_base (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    base_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT NOT NULL DEFAULT 'otros',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
