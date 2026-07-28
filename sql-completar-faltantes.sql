-- Inserts faltantes: 4 ventas + usuario liceth + sequences
-- Ejecutar en el SQL Editor del nuevo proyecto

-- VENTAS
INSERT INTO sales (id, customer_id, customer_name, total, excedente, method, method_key, credit_info, status, shipping_info, created_at, venta_por_fuera) VALUES
(554, NULL, 'Cliente mostrador', 16000, 0, 'Efectivo', 'cash', NULL, 'completada', NULL, '2026-07-04T14:55:08.874435+00:00', false),
(346, 5867, 'Hijadelamamadebianis', 140000, 0, 'Credito', 'credito', '{"tipo":"abono","balance":140000,"pagadas":0,"payments":[],"cuotaValor":0,"totalCuotas":0}', 'completada', NULL, '2026-07-28T06:52:43.811+00:00', false),
(316, NULL, 'Cliente mostrador', 110000, 0, 'Tarjeta', 'card', NULL, 'completada', NULL, '2026-06-27T15:15:51.683065+00:00', false),
(1258, NULL, 'Cliente mostrador', 10000, 0, 'Efectivo', 'cash', NULL, 'completada', NULL, '2026-07-21T22:50:58.404951+00:00', false);

-- USUARIO LICETH
INSERT INTO pos_users (id, username, pass, role, name) VALUES (2, 'liceth', 'liceth123', 'admin', 'Liceth');

-- SEQUENCES
SELECT setval('sales_id_seq', 1258);
SELECT setval('pos_users_id_seq', 2);
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id),1) FROM categories));
SELECT setval('customers_id_seq', (SELECT COALESCE(MAX(id),1) FROM customers));
SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id),1) FROM products));
SELECT setval('sale_items_id_seq', (SELECT COALESCE(MAX(id),1) FROM sale_items));
SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id),1) FROM payments));
SELECT setval('inventory_log_id_seq', (SELECT COALESCE(MAX(id),1) FROM inventory_log));
SELECT setval('cash_base_id_seq', (SELECT COALESCE(MAX(id),1) FROM cash_base));
SELECT setval('expenses_id_seq', (SELECT COALESCE(MAX(id),1) FROM expenses));
SELECT setval('labs_id_seq', (SELECT COALESCE(MAX(id),1) FROM labs));
SELECT setval('lab_orders_id_seq', (SELECT COALESCE(MAX(id),1) FROM lab_orders));
SELECT setval('temp_products_id_seq', (SELECT COALESCE(MAX(id),1) FROM temp_products));
