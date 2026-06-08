// ============================================
// SUPABASE CLIENT - TIENDA NATURALISTA
// ============================================
// Reemplaza estos valores con los de tu proyecto Supabase
// Ve a: Supabase Dashboard > Settings > API

const SUPABASE_URL = 'https://jcksqhqopqhswwxskhls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impja3NxaHFvcHFoc3d3eHNraGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTIzNjksImV4cCI6MjA5NjQ4ODM2OX0.1hnEgbk9--eedO1Tw9L0p6NKtHkz9h9NENEFiFJjbj0';

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
