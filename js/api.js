// ============================================
// SUPABASE CLIENT + API
// ============================================

const _SUPABASE_URL = 'https://jcksqhqopqhswwxskhls.supabase.co';
const _SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impja3NxaHFvcHFoc3d3eHNraGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTIzNjksImV4cCI6MjA5NjQ4ODM2OX0.1hnEgbk9--eedO1Tw9L0p6NKtHkz9h9NENEFiFJjbj0';

let _sb = null;
try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        _sb = window.supabase.createClient(_SUPABASE_URL, _SUPABASE_KEY);
        console.log('[API] Supabase conectado OK');
    } else {
        console.error('[API] window.supabase no existe. CDN no cargo.');
    }
} catch(e) {
    console.error('[API] Error creando cliente Supabase:', e.message);
}

const API = {
  isAvailable: false,

  // ---- Health Check ----
  async check() {
    console.log('[API] check() iniciando...');
    if (!_sb) { console.error('[API] _sb es null. Supabase client no se creó.'); this.isAvailable = false; return false; }
    try {
      console.log('[API] Probando conexión a tabla products...');
      const { data, error } = await _sb.from('products').select('id').limit(1);
      if (error) {
        console.error('[API] Check error:', error.message, 'code:', error.code, 'details:', error.details);
        this.isAvailable = false;
        return false;
      }
      console.log('[API] Check OK, productos encontrados:', data ? data.length : 0);
      this.isAvailable = true;
      return true;
    } catch(e) {
      console.error('[API] Check exception:', e.message, e);
      this.isAvailable = false;
      return false;
    }
  },

  // ---- Productos ----
  async getProducts(category, search) {
    let query = _sb
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async saveProduct(product) {
    const payload = {
      name: product.name,
      catalog_name: product.catalog_name || '',
      barcode: product.barcode && product.barcode.trim() ? product.barcode.trim() : null,
      brand: product.brand && product.brand.trim() ? product.brand.trim() : null,
      category: product.category || 'suplementos',
      subcategory: product.subcategory || '',
      price: product.price || 0,
      cost: product.cost || 0,
      stock: product.stock || 0,
      img: product.img || '',
      description: product.description || '',
      images: product.images || [],
      supplier_id: product.supplier_id || null,
      featured: product.featured || false,
      visible: product.visible !== false,
      active: true,
      updated_at: new Date().toISOString()
    };
    if (product.id) payload.id = product.id;

    const { data, error } = await _sb
      .from('products')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[API] saveProduct upsert error:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
    return data;
  },

  async deleteProduct(id) {
    const { error } = await _sb
      .from('products')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
    return { message: 'Producto eliminado' };
  },

  // ---- Clientes ----
  async getCustomers(search) {
    let query = _sb
      .from('customers')
      .select('*')
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async saveCustomer(customer) {
    if (customer.id) {
      const { data, error } = await _sb
        .from('customers')
        .update({
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          tipo: customer.tipo || 'local'
        })
        .eq('id', customer.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await _sb
        .from('customers')
        .insert({
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          tipo: customer.tipo || 'local'
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteCustomer(id) {
    const { error } = await _sb
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { message: 'Cliente eliminado' };
  },

  // ---- Proveedores ----
  async getSuppliers(search) {
    let query = _sb
      .from('suppliers')
      .select('*')
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,contact.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async saveSupplier(supplier) {
    if (supplier.id) {
      const { data, error } = await _sb
        .from('suppliers')
        .update({
          name: supplier.name,
          nit: supplier.nit || '',
          contact: supplier.contact || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || ''
        })
        .eq('id', supplier.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await _sb
        .from('suppliers')
        .insert({
          name: supplier.name,
          nit: supplier.nit || '',
          contact: supplier.contact || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || ''
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteSupplier(id) {
    const { error } = await _sb
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { message: 'Proveedor eliminado' };
  },

  // ---- Upload (Supabase Storage) ----
  async uploadImage(file) {
    const ext = file.name.split('.').pop();
    const filename = 'products/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    const { error } = await _sb.storage
      .from('product-images')
      .upload(filename, file, { cacheControl: '31536000', upsert: false });

    if (error) throw error;

    const { data } = _sb.storage
      .from('product-images')
      .getPublicUrl(filename);

    return { url: data.publicUrl, filename };
  },

  async uploadImages(files) {
    const results = [];
    for (const file of files) {
      const result = await this.uploadImage(file);
      results.push(result);
    }
    return results;
  },

  async deleteImage(filename) {
    const { error } = await _sb.storage
      .from('product-images')
      .remove([filename]);
    if (error) throw error;
    return { message: 'Archivo eliminado' };
  },

  // ---- Ventas ----
  async getSales(search, customerId) {
    let query = _sb
      .from('sales')
      .select(`
        *,
        sale_items (*),
        payments (*)
      `)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('customer_name', `%${search}%`);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mapear sale_items a items y payments a creditInfo.payments para compatibilidad
    return (data || []).map(sale => ({
      ...sale,
      items: sale.sale_items || [],
      payments: sale.payments || []
    }));
  },

  async getSale(id) {
    const { data, error } = await _sb
      .from('sales')
      .select(`
        *,
        sale_items (*),
        payments (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return {
      ...data,
      items: data.sale_items || [],
      payments: data.payments || []
    };
  },

  async saveSale(sale) {
    // Insertar venta
    const { data: saleData, error: saleError } = await _sb
      .from('sales')
      .insert({
        customer_id: sale.customer_id || null,
        customer_name: sale.customer_name || '',
        total: sale.total,
        excedente: sale.excedente || 0,
        method: sale.method || 'Efectivo',
        method_key: sale.method_key || 'cash',
        credit_info: sale.credit_info || null,
        venta_por_fuera: sale.venta_por_fuera || false,
        status: 'completada',
        created_at: sale.created_at || undefined
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Insertar items
    if (sale.items && sale.items.length > 0) {
      const itemsToInsert = sale.items.map(item => ({
        sale_id: saleData.id,
        product_id: String(item.id),
        product_name: item.name,
        qty: item.qty,
        price: item.price
      }));

      const { error: itemsError } = await _sb
        .from('sale_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    return saleData;
  },

  async updateSale(id, data) {
    const { error } = await _sb
      .from('sales')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return { message: 'Venta actualizada' };
  },

  async updateSaleItems(saleId, items) {
    await _sb.from('sale_items').delete().eq('sale_id', saleId);
    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        sale_id: saleId,
        product_id: String(item.id),
        product_name: item.name,
        qty: item.qty,
        price: item.price
      }));
      const { error } = await _sb.from('sale_items').insert(itemsToInsert);
      if (error) throw error;
    }
    return { message: 'Items actualizados' };
  },

  async deleteSale(id) {
    const { error: itemsErr } = await _sb.from('sale_items').delete().eq('sale_id', id);
    const { error: payErr } = await _sb.from('payments').delete().eq('sale_id', id);
    const { error } = await _sb.from('sales').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Venta eliminada' };
  },

  async addPayment(saleId, amount, note) {
    const { data, error } = await _sb
      .from('payments')
      .insert({
        sale_id: saleId,
        amount: amount,
        note: note || ''
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePaymentBySaleAndAmount(saleId, amount) {
    const { error } = await _sb
      .from('payments')
      .delete()
      .eq('sale_id', saleId)
      .eq('amount', amount);
    if (error) throw error;
  },

  async clearSalePayments(saleId) {
    const { error } = await _sb
      .from('payments')
      .delete()
      .eq('sale_id', saleId);
    if (error) throw error;
  },

  async reinsertSalePayments(saleId, payments) {
    if (!payments || payments.length === 0) return;
    const rows = payments.map(p => ({
      sale_id: saleId,
      amount: p.amount,
      note: 'Re-sincronizado desde POS',
      created_at: p.date || undefined
    }));
    const { error } = await _sb.from('payments').insert(rows);
    if (error) throw error;
  },

  // ---- Inventario ----
  async getInventoryLog(limit, scope) {
    let query = _sb
      .from('inventory_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (scope === 'local') {
      query = query.eq('venta_por_fuera', false);
    } else if (scope === 'fuera') {
      query = query.eq('venta_por_fuera', true);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addInventoryLog(entry) {
    const productIdNum = parseInt(String(entry.product_id).replace(/^p/i, ''));
    const { data, error } = await _sb
      .from('inventory_log')
      .insert({
        product_id: productIdNum,
        product_name: entry.product_name,
        type: entry.type,
        quantity: entry.quantity,
        previous_stock: entry.previous_stock,
        new_stock: entry.new_stock,
        reason: entry.reason || '',
        sale_id: entry.sale_id || null,
        venta_por_fuera: entry.venta_por_fuera || false
      })
      .select()
      .single();

    if (error) {
      console.error('[API] addInventoryLog:', error.message, 'code:', error.code, 'details:', error.details);
      throw error;
    }
    return data;
  },

  async clearInventoryLog() {
    const { error } = await _sb.from('inventory_log').delete().neq('id', -1);
    if (error) throw error;
  },

  async updateInventoryLog(id, data) {
    const productIdNum = parseInt(String(data.product_id).replace(/^p/i, ''));
    const { error } = await _sb
      .from('inventory_log')
      .update({
        product_id: productIdNum,
        product_name: data.product_name,
        type: data.type,
        quantity: data.quantity,
        previous_stock: data.previous_stock,
        new_stock: data.new_stock,
        reason: data.reason || '',
        sale_id: data.sale_id || null,
        venta_por_fuera: data.venta_por_fuera || false
      })
      .eq('id', id);
    if (error) {
      console.error('[API] updateInventoryLog:', error.message);
      throw error;
    }
  },

  async getInventoryStats() {
    const { data: products, error } = await _sb
      .from('products')
      .select('stock, active')
      .eq('active', true);

    if (error) throw error;

    const stats = {
      total: products.length,
      available: products.filter(p => p.stock > 5).length,
      low: products.filter(p => p.stock > 0 && p.stock <= 5).length,
      out: products.filter(p => p.stock <= 0).length
    };

    return stats;
  },

  // ---- Categorias ----
  async getCategories() {
    const { data, error } = await _sb
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('label');

    if (error) throw error;
    return data || [];
  },

  async saveCategory(cat) {
    if (cat.id) {
      const { data, error } = await _sb
        .from('categories')
        .update({
          label: cat.label,
          parent_key: cat.parent_key || null,
          icon: cat.icon || '',
          image: cat.image || '',
          sort_order: cat.sort_order || 0,
          active: cat.active !== false
        })
        .eq('id', cat.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await _sb
        .from('categories')
        .insert({
          key: cat.key,
          label: cat.label,
          parent_key: cat.parent_key || null,
          icon: cat.icon || '',
          image: cat.image || '',
          sort_order: cat.sort_order || 0,
          active: true
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteCategory(id) {
    const { error } = await _sb
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ---- Caja / Cash Management ----

  async getCashBase(date) {
    const { data, error } = await _sb
      .from('cash_base')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async saveCashBase(date, baseAmount) {
    const { data, error } = await _sb
      .from('cash_base')
      .upsert({ date, base_amount: baseAmount }, { onConflict: 'date' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getExpenses(date) {
    const { data, error } = await _sb
      .from('expenses')
      .select('*')
      .eq('date', date)
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  async saveExpense(exp) {
    if (exp.id) {
      const { data, error } = await _sb
        .from('expenses')
        .update({ description: exp.description, amount: exp.amount, category: exp.category })
        .eq('id', exp.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await _sb
        .from('expenses')
        .insert({ date: exp.date, description: exp.description, amount: exp.amount, category: exp.category })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  },

  async deleteExpense(id) {
    const { error } = await _sb
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ---- Productos Temporales ----
  async saveTempProduct(temp) {
    const { data, error } = await _sb
      .from('temp_products')
      .insert({
        name: temp.name,
        price: temp.price,
        qty: temp.qty || 1,
        sale_id: temp.sale_id || null
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTempProductsBySale(saleId) {
    const { data, error } = await _sb
      .from('temp_products')
      .select('*')
      .eq('sale_id', saleId);
    if (error) throw error;
    return data || [];
  },

  // ---- Salidas Temporales ----
  async getSalidas() {
    const { data: salidas, error: err1 } = await _sb
      .from('salidas')
      .select('*')
      .order('created_at', { ascending: false });
    if (err1) throw err1;
    if (!salidas || salidas.length === 0) return [];
    const { data: items, error: err2 } = await _sb
      .from('salida_items')
      .select('*');
    if (err2) throw err2;
    const itemsBySalida = {};
    (items || []).forEach(it => {
      if (!itemsBySalida[it.salida_id]) itemsBySalida[it.salida_id] = [];
      itemsBySalida[it.salida_id].push({
        productId: it.product_id,
        sentQty: it.sent_qty,
        soldQty: it.sold_qty,
        returnedQty: it.returned_qty
      });
    });
    return salidas.map(s => ({
      id: s.id,
      created_at: s.created_at,
      userId: s.user_id,
      userName: s.user_name,
      items: itemsBySalida[s.id] || [],
      notes: s.notes,
      status: s.status
    }));
  },

  async saveSalida(salida) {
    const { data: salData, error: salErr } = await _sb
      .from('salidas')
      .upsert({
        id: salida.id || undefined,
        user_id: salida.userId || '',
        user_name: salida.userName || '',
        notes: salida.notes || '',
        status: salida.status || 'open',
        created_at: salida.created_at || undefined
      }, { onConflict: 'id' })
      .select()
      .single();
    if (salErr) throw salErr;
    const sid = salData.id;
    await _sb.from('salida_items').delete().eq('salida_id', sid);
    if (salida.items && salida.items.length > 0) {
      const itemsToInsert = salida.items.map(it => ({
        salida_id: sid,
        product_id: it.productId,
        sent_qty: it.sentQty || 0,
        sold_qty: it.soldQty || 0,
        returned_qty: it.returnedQty || 0
      }));
      const { error: itemsErr } = await _sb.from('salida_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;
    }
    return salData;
  },

  async deleteSalida(id) {
    const { error } = await _sb.from('salidas').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ============ LAB ORDERS ============
  async getLabOrders() {
    const { data, error } = await _sb.from('lab_orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async saveLabOrder(order) {
    const { data, error } = await _sb.from('lab_orders').insert({
      lab: order.lab,
      status: order.status || 'pendiente',
      items: order.items || [],
      total: order.total || 0,
      notes: order.notes || ''
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateLabOrder(id, updates) {
    const { error } = await _sb.from('lab_orders').update(updates).eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async deleteLabOrder(id) {
    const { error } = await _sb.from('lab_orders').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
};
