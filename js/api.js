// ============================================
// API CLIENT - Supabase Backend
// ============================================
// Mantiene la misma interfaz que el API anterior
// para que tienda.js y pos.js no necesiten cambios.

const API = {
  isAvailable: false,

  // ---- Health Check ----
  async check() {
    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      this.isAvailable = !error;
      return !error;
    } catch {
      this.isAvailable = false;
      return false;
    }
  },

  // ---- Productos ----
  async getProducts(category, search) {
    let query = supabase
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
    if (product.id) {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: product.name,
          barcode: product.barcode || '',
          brand: product.brand || '',
          category: product.category,
          subcategory: product.subcategory || '',
          price: product.price,
          cost: product.cost || 0,
          stock: product.stock,
          img: product.img || '',
          description: product.description || '',
          images: product.images || [],
          supplier_id: product.supplier_id || null,
          featured: product.featured || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          barcode: product.barcode || '',
          brand: product.brand || '',
          category: product.category || 'suplementos',
          subcategory: product.subcategory || '',
          price: product.price,
          cost: product.cost || 0,
          stock: product.stock || 0,
          img: product.img || '',
          description: product.description || '',
          images: product.images || [],
          supplier_id: product.supplier_id || null,
          featured: product.featured || false
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteProduct(id) {
    const { error } = await supabase
      .from('products')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
    return { message: 'Producto eliminado' };
  },

  // ---- Clientes ----
  async getCustomers(search) {
    let query = supabase
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
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || ''
        })
        .eq('id', customer.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || ''
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteCustomer(id) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { message: 'Cliente eliminado' };
  },

  // ---- Proveedores ----
  async getSuppliers(search) {
    let query = supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    const { error } = await supabase
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

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
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
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filename]);
    if (error) throw error;
    return { message: 'Archivo eliminado' };
  },

  // ---- Ventas ----
  async getSales(search, customerId) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
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

    // Mapear sale_items a items para compatibilidad
    return (data || []).map(sale => ({
      ...sale,
      items: sale.sale_items || []
    }));
  },

  async getSale(id) {
    const { data, error } = await supabase
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
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        customer_id: sale.customer_id || null,
        customer_name: sale.customer_name || '',
        total: sale.total,
        excedente: sale.excedente || 0,
        method: sale.method || 'Efectivo',
        method_key: sale.method_key || 'cash',
        credit_info: sale.credit_info || null,
        status: 'completada'
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

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    return saleData;
  },

  async addPayment(saleId, amount, note) {
    const { data, error } = await supabase
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

  // ---- Inventario ----
  async getInventoryLog(limit) {
    let query = supabase
      .from('inventory_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addInventoryLog(entry) {
    const { data, error } = await supabase
      .from('inventory_log')
      .insert({
        product_id: String(entry.product_id),
        product_name: entry.product_name,
        type: entry.type,
        quantity: entry.quantity,
        previous_stock: entry.previous_stock,
        new_stock: entry.new_stock,
        reason: entry.reason || '',
        sale_id: entry.sale_id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getInventoryStats() {
    const { data: products, error } = await supabase
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
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('label');

    if (error) throw error;
    return data || [];
  },

  async saveCategory(cat) {
    if (cat.id) {
      const { data, error } = await supabase
        .from('categories')
        .update({
          label: cat.label,
          parent_key: cat.parent_key || null
        })
        .eq('id', cat.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          key: cat.key,
          label: cat.label,
          parent_key: cat.parent_key || null
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }
};
