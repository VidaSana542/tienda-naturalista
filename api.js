const API = {
  baseUrl: window.location.origin + '/api',

  async get(url) {
    const res = await fetch(this.baseUrl + url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(this.baseUrl + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(this.baseUrl + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async del(url) {
    const res = await fetch(this.baseUrl + url, { method: 'DELETE' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  // ---- Productos ----
  async getProducts(category, search) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return this.get('/products' + (qs ? '?' + qs : ''));
  },

  async saveProduct(product) {
    if (product.id) {
      return this.put('/products/' + product.id, product);
    }
    return this.post('/products', product);
  },

  async deleteProduct(id) {
    return this.del('/products/' + id);
  },

  // ---- Clientes ----
  async getCustomers(search) {
    const qs = search ? '?search=' + encodeURIComponent(search) : '';
    return this.get('/customers' + qs);
  },

  async saveCustomer(customer) {
    if (customer.id) {
      return this.put('/customers/' + customer.id, customer);
    }
    return this.post('/customers', customer);
  },

  async deleteCustomer(id) {
    return this.del('/customers/' + id);
  },

  // ---- Proveedores ----
  async getSuppliers(search) {
    const qs = search ? '?search=' + encodeURIComponent(search) : '';
    return this.get('/suppliers' + qs);
  },

  async saveSupplier(supplier) {
    if (supplier.id) {
      return this.put('/suppliers/' + supplier.id, supplier);
    }
    return this.post('/suppliers', supplier);
  },

  async deleteSupplier(id) {
    return this.del('/suppliers/' + id);
  },

  // ---- Upload ----
  async uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(this.baseUrl + '/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async uploadImages(files) {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const res = await fetch(this.baseUrl + '/upload/multiple', { method: 'POST', body: form });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async deleteImage(filename) {
    return this.del('/upload', { filename });
  },

  // ---- Ventas ----
  async getSales(search, customerId) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (customerId) params.set('customer_id', customerId);
    const qs = params.toString();
    return this.get('/sales' + (qs ? '?' + qs : ''));
  },

  async getSale(id) {
    return this.get('/sales/' + id);
  },

  async saveSale(sale) {
    return this.post('/sales', sale);
  },

  async addPayment(saleId, amount, note) {
    return this.post('/sales/' + saleId + '/payments', { amount, note });
  },

  // ---- Inventario ----
  async getInventoryLog(limit) {
    const qs = limit ? '?limit=' + limit : '';
    return this.get('/inventory' + qs);
  },

  async addInventoryLog(entry) {
    return this.post('/inventory', entry);
  },

  async getInventoryStats() {
    return this.get('/inventory/stats');
  },

  // ---- Utils ----
  isAvailable: false,

  async check() {
    try {
      await this.get('/health');
      this.isAvailable = true;
      return true;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }
};
