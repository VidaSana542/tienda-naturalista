// ============ POS POR FUERA - Config ============
const POS_RESTRICTED_PANELS = [];
const POS_PANEL_TITLES = { dashboard:'Dashboard', orders:'Pedidos', tpv:'TPV / Pedido', products:'Productos', customers:'Clientes', cuentas:'Estado de Cuentas', inventory:'Inventario', sales:'Historial de Ventas' };
const POS_PANEL_RENDERERS = {};

// ============ TPV POR FUERA ============
let _barcodeTimer = null;

function handleBarcodeScan() {
    const input = document.getElementById('tpvBarcode');
    const code = input.value.trim();
    if (code.length < 3) return;
    clearTimeout(_barcodeTimer);
    _barcodeTimer = setTimeout(() => {
        const product = posProducts.find(p => p.barcode === code);
        if (product) {
            if (product.stock > 0) {
                addToCart(product.id);
                showToast('+ ' + product.name);
                input.value = '';
                renderTpvProducts();
            } else {
                showToast(product.name + ' (agotado)');
                input.value = '';
            }
        } else {
            showToast('Codigo no encontrado');
            input.select();
        }
    }, 120);
}

function populateTpvFilters() {
    const cats = POS_CATEGORIES.filter(c => !c.parent_key);
    const catSel = document.getElementById('tpvCatFilter');
    if (!catSel) return;
    catSel.innerHTML = '<option value="">Todas las categorias</option>' + cats.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    updateTpvSubcats();
}
function updateTpvSubcats() {
    const cat = document.getElementById('tpvCatFilter').value;
    const subcats = cat ? POS_CATEGORIES.filter(c => c.parent_key === cat) : [];
    const subSel = document.getElementById('tpvSubcatFilter');
    subSel.innerHTML = '<option value="">' + (cat ? 'Todas las subcategorias' : 'Sin categoria') + '</option>' + subcats.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
}

function renderTpv() {
    populateTpvFilters();
    renderTpvProducts();
    renderTpvCart();
}

function filterTpvProducts() {
    renderTpvProducts();
}

function renderTpvProducts() {
    const q = document.getElementById('tpvSearch').value.toLowerCase().trim();
    const catFilter = document.getElementById('tpvCatFilter').value;
    const subcatFilter = document.getElementById('tpvSubcatFilter').value;
    let filtered = posProducts;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);
    if (subcatFilter) filtered = filtered.filter(p => (p.subcategory || '') === subcatFilter);
    const grid = document.getElementById('tpvGrid');
    grid.innerHTML = filtered.map(p => {
        const out = p.stock <= 0;
        return `<div class="tpv-item ${out ? 'out-of-stock' : ''}" onclick="${out ? '' : "addToCart('" + p.id + "')"}">
            <div class="thumb"><img src="${p.img || DEFAULT_IMG}" alt="${p.name}" loading="lazy"></div>
            <div class="tpv-name">${p.name}</div>
            <div class="tpv-price">${formatPrice(p.price)}</div>
            <div class="tpv-stock">${out ? 'Agotado' : 'Stock: ' + p.stock}</div>
        </div>`;
    }).join('');
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);grid-column:1/-1;"><p>No se encontraron productos</p></div>';
    }
}

function renderTpvCart() {
    const container = document.getElementById('tpvCartItems');
    const count = document.getElementById('tpvCartCount');
    const subtotal = document.getElementById('tpvSubtotal');
    const totalEl = document.getElementById('tpvTotal');
    const btn = document.getElementById('tpvCheckoutBtn');
    const badge = document.getElementById('cartBadge');
    const barTotal = document.getElementById('tpvBarTotal');

    if (posCart.length === 0) {
        if (container) container.innerHTML = '<div class="tpv-cart-empty"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg><p>Agrega productos al pedido</p></div>';
        if (count) count.textContent = '0';
        if (subtotal) subtotal.textContent = '$0';
        if (totalEl) totalEl.textContent = '$0';
        if (btn) { btn.innerHTML = ' Registrar Pedido $0'; btn.disabled = true; }
        if (badge) badge.textContent = '0';
        if (barTotal) barTotal.textContent = '$0';
        return;
    }

    const totalQty = posCart.reduce((s, i) => s + i.qty, 0);
    const total = posCart.reduce((s, i) => s + i.price * i.qty, 0);

    if (count) count.textContent = totalQty;
    if (subtotal) subtotal.textContent = formatPrice(total);
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Registrar Pedido ' + formatPrice(total); btn.disabled = false; }
    if (badge) badge.textContent = totalQty;
    if (barTotal) barTotal.textContent = formatPrice(total);

    if (container) container.innerHTML = posCart.map((item, idx) => {
        const p = item.isTemp ? null : posProducts.find(pr => pr.id === item.id);
        const name = item.isTemp ? item.tempName : (p ? p.name : 'Producto');
        return `<div class="tpv-cart-item">
            <div class="tpv-ci-info">
                <div class="tpv-ci-name">${name}${item.isTemp ? ' <span style="font-size:10px;color:var(--warning);">(temp)</span>' : ''}</div>
                <div class="tpv-ci-price">${formatPrice(item.price)}</div>
            </div>
            <div class="tpv-ci-qty">
                <button onclick="updateCartQty(${idx}, -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="updateCartQty(${idx}, 1)">+</button>
            </div>
            <button class="tpv-ci-remove" onclick="removeFromCart(${idx})">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>`;
    }).join('');
}

function addToCart(id) {
    const existing = posCart.findIndex(i => i.id === id);
    if (existing >= 0) {
        posCart[existing].qty += 1;
        const prod = posProducts.find(p => p.id === id);
        if (prod && posCart[existing].qty > prod.stock) {
            posCart[existing].qty = prod.stock;
            showToast('Stock maximo alcanzado');
        }
    } else {
        const prod = posProducts.find(p => p.id === id);
        if (!prod || prod.stock <= 0) { showToast('Producto agotado'); return; }
        posCart.push({ id, qty: 1, price: prod.price });
    }
    saveCart();
    renderTpvCart();
}

function updateCartQty(idx, delta) {
    if (!posCart[idx]) return;
    const newQty = posCart[idx].qty + delta;
    if (newQty <= 0) { posCart.splice(idx, 1); }
    else {
        const prod = posProducts.find(p => p.id === posCart[idx].id);
        if (prod && newQty > prod.stock) { showToast('Stock maximo: ' + prod.stock); return; }
        posCart[idx].qty = newQty;
    }
    saveCart();
    renderTpvCart();
}

function removeFromCart(idx) {
    posCart.splice(idx, 1);
    saveCart();
    renderTpvCart();
}

function toggleTpvCart() {
    const cart = document.getElementById('tpvCart');
    if (!cart) return;
    cart.classList.toggle('open');
}

function clearCart() {
    posCart = [];
    saveCart();
    renderTpvCart();
}

// ============ PRODUCTO TEMPORAL ============
let _tempProductCounter = 0;

function openTempProductModal() {
    document.getElementById('tempProdName').value = '';
    document.getElementById('tempProdPrice').value = '';
    document.getElementById('tempProdQty').value = '1';
    document.getElementById('tempProductModal').classList.add('open');
    setTimeout(() => document.getElementById('tempProdName').focus(), 100);
}

function closeTempProductModal() {
    document.getElementById('tempProductModal').classList.remove('open');
}

function addTempProductToCart() {
    const name = document.getElementById('tempProdName').value.trim();
    const price = Math.round(parseFloat(document.getElementById('tempProdPrice').value) * 100) / 100;
    const qty = parseInt(document.getElementById('tempProdQty').value) || 1;

    if (!name) { showToast('Ingresa el nombre del producto'); return; }
    if (!price || price <= 0 || isNaN(price)) { showToast('Ingresa un precio valido'); return; }

    _tempProductCounter++;
    const tempId = 'temp_' + Date.now() + '_' + _tempProductCounter;

    posCart.push({ id: tempId, qty, price, isTemp: true, tempName: name });
    saveCart();
    renderTpvCart();
    closeTempProductModal();
    showToast('+ ' + name + ' (temporal)');
}

// ============ CHECKOUT PEDIDO ============
function openCheckoutModal() {
    if (posCart.length === 0) { showToast('Agrega productos al pedido'); return; }
    document.getElementById('chkCustomerId').value = '';
    document.getElementById('chkCustomerInput').value = '';
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    renderCheckoutCustomers();
    renderCheckoutResumen();
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('open');
}

function renderCheckoutCustomers() {
    const q = document.getElementById('chkCustomerInput').value.toLowerCase().trim();
    const list = document.getElementById('chkCustomerList');
    const selectedId = document.getElementById('chkCustomerId').value;
    const filtered = q ? posCustomers.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone && c.phone.includes(q);
        const parts = q.split(/\s*-\s*/);
        const partMatch = parts.length > 1 && (
            c.name.toLowerCase().includes(parts[0].trim()) ||
            (c.phone && c.phone.includes(parts[1].trim()))
        );
        return nameMatch || phoneMatch || partMatch;
    }) : posCustomers;
    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Sin resultados</div>';
        return;
    }
    list.innerHTML = filtered.slice(0, 50).map(c => {
        const isSel = c.id === selectedId;
        const nameHtml = q ? c.name.replace(new RegExp(q, 'gi'), m => '<strong>' + m + '</strong>') : c.name;
        return '<div class="checkout-customer-item' + (isSel ? ' selected' : '') + '" onclick="pickCheckoutCustomer(\'' + c.id + '\')">' +
            '<div class="ck-name">' + nameHtml + '</div>' +
            (c.phone ? '<div class="ck-phone">' + c.phone + '</div>' : '') +
            '<div class="ck-check' + (isSel ? ' selected' : '') + '">' + (isSel ? '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : '') + '</div>' +
            '</div>';
    }).join('');
}

function pickCheckoutCustomer(id) {
    document.getElementById('chkCustomerId').value = id;
    const cust = posCustomers.find(c => c.id === id);
    if (cust) document.getElementById('chkCustomerInput').value = cust.name + (cust.phone ? ' - ' + cust.phone : '');
    renderCheckoutCustomers();
}

// ============ QUICK ADD CUSTOMER ============
function toggleQuickAddCustomer() {
    const form = document.getElementById('quickAddCustomer');
    const isOpen = form.classList.contains('open');
    form.classList.toggle('open');
    if (!isOpen) {
        document.getElementById('quickCustName').value = '';
        document.getElementById('quickCustPhone').value = '';
        document.getElementById('quickCustAddress').value = '';
        setTimeout(() => document.getElementById('quickCustName').focus(), 100);
    }
}

function saveQuickCustomer() {
    const name = document.getElementById('quickCustName').value.trim();
    const phone = document.getElementById('quickCustPhone').value.trim();
    const address = document.getElementById('quickCustAddress').value.trim();
    if (!name) { showToast('Ingresa el nombre del cliente'); return; }
    const exists = posCustomers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) { showToast('Ya existe un cliente con ese nombre'); return; }
    const id = 'c' + Date.now();
    const customer = { id, name, phone, email: '', address, tipo: 'fuera', pending: 0, _synced: false };
    posCustomers.push(customer);
    saveCustomers();
    document.getElementById('quickAddCustomer').classList.remove('open');
    document.getElementById('chkCustomerId').value = id;
    document.getElementById('chkCustomerInput').value = name + (phone ? ' - ' + phone : '');
    requestAnimationFrame(() => {
        renderCheckoutCustomers();
        renderCustomerTable();
        const list = document.getElementById('chkCustomerList');
        if (list) list.scrollTop = list.scrollHeight;
    });
    showToast('Cliente "' + name + '" creado');
}

function renderCheckoutResumen() {
    const total = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    document.getElementById('chkTotalDisplay').textContent = formatPrice(total);
    const items = document.getElementById('chkResumenItems');
    items.innerHTML = posCart.map(i => {
        const p = posProducts.find(pr => pr.id === i.id);
        const name = p ? p.name : 'Producto';
        return '<div class="checkout-resumen-item"><span>' + i.qty + 'x ' + name + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>';
    }).join('');
}

function confirmCheckout() {
    if (posCart.length === 0) { showToast('El pedido esta vacio'); return; }
    const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal;
    const custId = document.getElementById('chkCustomerId').value;
    let customerName = 'Cliente mostrador';
    let customerId = '';
    if (custId) {
        const cust = posCustomers.find(c => c.id === custId);
        if (cust) { customerName = cust.name; customerId = custId; }
    }
    const sale = {
        id: posNextSaleId++,
        date: now(),
        items: posCart.map(i => {
            const p = i.isTemp ? null : posProducts.find(pr => pr.id === i.id);
            return { id: i.id, name: i.isTemp ? i.tempName : (p ? p.name : 'Producto'), qty: i.qty, price: i.price, isTemp: i.isTemp || false };
        }),
        subtotal,
        excedente: 0,
        total,
        method: 'Efectivo',
        methodKey: 'cash',
        customer: customerName,
        customerId,
        creditInfo: null,
        ventaPorFuera: true
    };
    posSales.push(sale);
    posCart.forEach(ci => {
        if (ci.isTemp) return;
        const p = posProducts.find(pr => pr.id === ci.id);
        if (p) {
            const prev = p.stock;
            p.stock = Math.max(0, p.stock - ci.qty);
            addInvLog(ci.id, p.name, 'salida', -ci.qty, prev, p.stock, 'Pedido #' + sale.id + ' (Por fuera)', sale.id, true);
        }
    });
    saveSales();
    saveProducts();
    posCart.filter(ci => ci.isTemp).forEach(ci => {
        API.saveTempProduct({ name: ci.tempName, price: ci.price, qty: ci.qty, sale_id: sale.id }).catch(e => console.error('[POS-FUERA] saveTempProduct error:', e));
    });
    clearCart();
    closeCheckoutModal();
    renderOrders();
    renderTpv();
    renderProductTable();
    renderCustomerTable();
    renderSalesTable();
    showReceipt(sale);
    showToast('Pedido #' + sale.id + ' registrado');
}

// ============ ORDERS PANEL ============
let _ordersFilter = 'all';

function setOrdersFilter(f) {
    _ordersFilter = f;
    document.querySelectorAll('.orders-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.of === f));
    renderOrders();
}

function renderOrders() {
    const q = document.getElementById('ordersSearch') ? document.getElementById('ordersSearch').value.toLowerCase().trim() : '';
    let filtered = posSales.filter(s => s.ventaPorFuera).reverse();
    if (_ordersFilter === 'pendiente') filtered = filtered.filter(s => s.creditInfo && s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo && s.creditInfo.pagadas < s.creditInfo.totalCuotas));
    if (_ordersFilter === 'pagado') filtered = filtered.filter(s => !s.creditInfo || (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) >= s.creditInfo.balance) : (s.creditInfo.pagadas >= s.creditInfo.totalCuotas)));
    if (q) filtered = filtered.filter(s => s.id.toString().includes(q) || (s.customer && s.customer.toLowerCase().includes(q)));
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No hay pedidos por fuera</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((s, idx) => {
        const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
        let statusHtml = '';
        if (s.creditInfo) {
            if (s.creditInfo.tipo === 'abono') {
                const pagado = s.creditInfo.payments.reduce((sum, p) => sum + p.amount, 0);
                const balance = s.creditInfo.balance - pagado;
                statusHtml = balance > 0 ? '<span class="tag tag-warning">Pendiente ' + formatPrice(balance) + '</span>' : '<span class="tag tag-success">Pagado</span>';
            } else {
                const pending = (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor;
                statusHtml = pending > 0 ? '<span class="tag tag-warning">' + s.creditInfo.pagadas + '/' + s.creditInfo.totalCuotas + ' cuotas</span>' : '<span class="tag tag-success">Pagado</span>';
            }
        } else {
            statusHtml = '<span class="tag tag-success">Pagado</span>';
        }
        return `<tr>
            <td><strong>#${s.id}</strong></td>
            <td>${formatDate(s.date)}</td>
            <td>${s.customer || 'Mostrador'}</td>
            <td>${qty}</td>
            <td><strong>${formatPrice(s.total)}</strong></td>
            <td>${statusHtml}</td>
            <td class="actions">
                ${s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas)) ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="Registrar Pago" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : ''}
                <button onclick="showReceipt(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>
            </td>
        </tr>`;
    }).join('');
}

// ============ DASHBOARD ============
let _dashPeriod = 'today';

function setDashPeriod(p) {
    _dashPeriod = p;
    document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === p));
    renderDashboard();
}

function getPeriodSales() {
    const now = new Date();
    const todayStr = today();
    if (_dashPeriod === 'today') {
        return posSales.filter(s => s.ventaPorFuera && s.date && s.date.slice(0,10) === todayStr);
    }
    if (_dashPeriod === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return posSales.filter(s => s.ventaPorFuera && s.date && new Date(s.date) >= d);
    }
    return posSales.filter(s => s.ventaPorFuera);
}

function sumSales(list) {
    return { total: list.reduce((s,v) => s + v.total, 0), count: list.length, items: list.reduce((s,v) => s + v.items.reduce((a,i) => a + i.qty, 0), 0), cash: list.filter(s => s.method === 'Efectivo').reduce((s,v) => s + v.total, 0), digital: list.filter(s => s.method !== 'Efectivo' && s.method !== 'Credito').reduce((s,v) => s + v.total, 0), credit: list.filter(s => s.method === 'Credito').reduce((s,v) => s + v.total, 0) };
}

function renderDashboard() {
    const ventasFuera = posSales.filter(s => s.ventaPorFuera);
    const isMonthHistory = _dashPeriod === 'month';
    const isAnnualHistory = _dashPeriod === 'year';
    const isHistory = isMonthHistory || isAnnualHistory;
    let periodSales = isHistory ? ventasFuera : getPeriodSales();
    const periodTotal = periodSales.reduce((sum, s) => sum + s.total, 0);
    const periodCount = periodSales.length;
    const pendingCredit = ventasFuera
        .reduce((sum, s) => {
        if (!s.creditInfo) return sum;
        if (s.creditInfo.tipo === 'abono') {
            const pagado = (s.creditInfo.payments || []).reduce((sp, p) => sp + p.amount, 0);
            return sum + (s.creditInfo.balance - pagado);
        }
        return sum + ((s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor);
    }, 0);

    const paidTotal = periodSales.reduce((sum, s) => {
        if (s.method !== 'Credito') return sum + s.total;
        const pagado = (s.creditInfo && s.creditInfo.payments || []).reduce((sp, p) => sp + p.amount, 0);
        return sum + pagado;
    }, 0);

    const labels = { today: 'Hoy', week: 'Ultimos 7 dias', month: 'Historial mensual', year: 'Historial anual' };
    document.getElementById('dashPeriodLabel').textContent = labels[_dashPeriod] + (isHistory ? '' : ' \u2014 ' + periodCount + ' ventas \u2014 ' + formatPrice(periodTotal));
    const chartLabels = { today: 'Hoy', week: 'Ultimos 7 dias', month: 'Historial mensual', year: 'Historial anual' };
    const chartTitle = document.getElementById('dashChartTitle');
    if (chartTitle) chartTitle.textContent = 'Ventas por (' + chartLabels[_dashPeriod] + ')';

    const totalProducts = posProducts.length;
    const lowStockCount = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outStockCount = posProducts.filter(p => p.stock <= 0).length;
    const avgTicket = periodCount > 0 ? periodTotal / periodCount : 0;
    const filteredCustomers = posCustomers.filter(c => c.tipo === 'fuera');
    const totalCustomers = filteredCustomers.length;
    const salesData = sumSales(periodSales);
    const custWithDebt = filteredCustomers.filter(c => {
        const custSales = ventasFuera.filter(s => s.customerId === c.id);
        return custSales.some(s => s.creditInfo);
    }).length;

    document.getElementById('dashStats').innerHTML = `
        <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><span class="stat-label">VENTAS</span><h3>${formatPrice(paidTotal)}</h3><p>${periodCount} ventas</p></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div><div class="stat-info"><span class="stat-label">Ticket promedio</span><h3>${formatPrice(avgTicket)}</h3><p>Por venta</p></div></div>
        <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><span class="stat-label">Credito pendiente</span><h3>${formatPrice(pendingCredit)}</h3><p>Por cobrar</p></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div><div class="stat-info"><span class="stat-label">Clientes</span><h3>${totalCustomers}</h3><p>${custWithDebt} con credito</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e0f2f1;"><svg viewBox="0 0 24 24" style="fill:#00796b;"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM6 10h12v2H6v-2zm0 4h12v2H6v-2zm0-8h12v2H6V6z"/></svg></div><div class="stat-info"><span class="stat-label">Productos</span><h3>${totalProducts}</h3><p>${lowStockCount} stock bajo, ${outStockCount} agotados</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e8f5e9;"><svg viewBox="0 0 24 24" style="fill:#2e7d32;"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div><div class="stat-info"><span class="stat-label">Efectivo</span><h3>${formatPrice(salesData.cash)}</h3><p>${salesData.count > 0 && paidTotal > 0 ? Math.round(salesData.cash / paidTotal * 100) : 0}% del total</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e3f2fd;"><svg viewBox="0 0 24 24" style="fill:#1565c0;"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div><div class="stat-info"><span class="stat-label">Digital</span><h3>${formatPrice(salesData.digital)}</h3><p>${salesData.count > 0 && paidTotal > 0 ? Math.round(salesData.digital / paidTotal * 100) : 0}% del total</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fff3e0;"><svg viewBox="0 0 24 24" style="fill:#e65100;"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div class="stat-info"><span class="stat-label">Productos vendidos</span><h3>${salesData.items}</h3><p>Unidades en el periodo</p></div></div>
    `;

    document.getElementById('dashMonthsCard').style.display = isMonthHistory ? '' : 'none';
    document.getElementById('dashAnnualCard').style.display = isAnnualHistory ? '' : 'none';

    if (isMonthHistory) renderDashMonthsHistory(periodSales);
    if (isAnnualHistory) renderDashAnnualHistory(periodSales);

    renderDashBarChart(periodSales);
    renderDashPayMethods(periodSales);
    renderDashTopProducts(periodSales);
    renderDashStockAlerts();
    renderDashTopCustomers(periodSales);
    renderDashSummary(periodSales);
    renderDashRecent(periodSales);
}

function renderDashBarChart(periodSales) {
    const el = document.getElementById('dashBarChart');
    let days = [];
    if (_dashPeriod === 'today' || _dashPeriod === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const label = d.toLocaleDateString('es-CO', { weekday:'short', day:'numeric' });
            const total = periodSales.filter(s => s.date && s.date.slice(0,10) === ds).reduce((sum, s) => sum + s.total, 0);
            days.push({ label, total });
        }
    } else if (_dashPeriod === 'month') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString('es-CO', { month:'short' });
            const total = periodSales.filter(s => {
                if (!s.date) return false;
                const sd = new Date(s.date);
                return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
            }).reduce((sum, s) => sum + s.total, 0);
            days.push({ label, total });
        }
    } else if (_dashPeriod === 'year') {
        const years = {};
        periodSales.forEach(s => {
            if (!s.date) return;
            const y = s.date.slice(0,4);
            if (!years[y]) years[y] = 0;
            years[y] += s.total;
        });
        const sorted = Object.entries(years).sort((a, b) => a[0] - b[0]);
        sorted.forEach(([year, total]) => {
            days.push({ label: year, total });
        });
    }
    const maxVal = Math.max(...days.map(d => d.total), 1);
    el.innerHTML = days.map(d => {
        const pct = Math.round((d.total / maxVal) * 100);
        return `<div class="bar-col">
            <div class="bar-value">${d.total > 0 ? formatPrice(d.total) : ''}</div>
            <div class="bar-track"><div class="bar-fill" style="height:${Math.max(pct, 2)}%"></div></div>
            <div class="bar-label">${d.label}</div>
        </div>`;
    }).join('');
}

function renderDashMonthsHistory(periodSales) {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        const sales = periodSales.filter(s => {
            if (!s.date) return false;
            const sd = new Date(s.date);
            return sd.getFullYear() === year && sd.getMonth() === month;
        });
        months.push({ label, ...sumSales(sales) });
    }
    const tbody = document.getElementById('dashMonthsTable');
    tbody.innerHTML = months.map(m => `<tr>
        <td><strong>${m.label}</strong></td>
        <td>${m.count}</td>
        <td>${m.items}</td>
        <td><strong>${formatPrice(m.total)}</strong></td>
        <td>${formatPrice(m.cash)}</td>
        <td>${formatPrice(m.digital)}</td>
        <td>${formatPrice(m.credit)}</td>
        <td>${m.count > 0 ? formatPrice(m.total / m.count) : '$0'}</td>
    </tr>`).join('');
}

function renderDashAnnualHistory(periodSales) {
    const years = {};
    periodSales.forEach(s => {
        if (!s.date) return;
        const y = s.date.slice(0,4);
        if (!years[y]) years[y] = [];
        years[y].push(s);
    });
    const sorted = Object.entries(years).sort((a,b) => b[0] - a[0]);
    const tbody = document.getElementById('dashAnnualTable');
    tbody.innerHTML = sorted.map(([year, sales]) => {
        const d = sumSales(sales);
        return `<tr>
            <td><strong>${year}</strong></td>
            <td>${d.count}</td>
            <td>${d.items}</td>
            <td><strong>${formatPrice(d.total)}</strong></td>
            <td>${formatPrice(d.cash)}</td>
            <td>${formatPrice(d.digital)}</td>
            <td>${formatPrice(d.credit)}</td>
            <td>${d.count > 0 ? formatPrice(d.total / d.count) : '$0'}</td>
        </tr>`;
    }).join('');
}

function renderDashPayMethods(periodSales) {
    const methods = {};
    periodSales.forEach(s => {
        const m = s.method || 'Otro';
        if (!methods[m]) methods[m] = { count: 0, total: 0 };
        methods[m].count++;
        methods[m].total += s.total;
    });
    const total = Object.values(methods).reduce((sum, m) => sum + m.total, 0);
    const colors = { 'Efectivo': '#4caf50', 'Nequi': '#00c853', 'Daviplata': '#f44336', 'Tarjeta': '#2196f3', 'Transferencia': '#9c27b0', 'Credito': '#ff9800' };
    const el = document.getElementById('dashPayMethods');
    const entries = Object.entries(methods).sort((a,b) => b[1].total - a[1].total);
    if (entries.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;">Sin ventas en este periodo</div>';
        return;
    }
    el.innerHTML = entries.map(([name, data]) => {
        const pct = total > 0 ? Math.round((data.total / total) * 100) : 0;
        const color = colors[name] || '#607d8b';
        return `<div class="pay-method-row">
            <div class="pay-method-info">
                <span class="pay-method-dot" style="background:${color}"></span>
                <span class="pay-method-name">${name}</span>
                <span class="pay-method-count">${data.count} venta${data.count > 1 ? 's' : ''}</span>
            </div>
            <div class="pay-method-bar-wrap">
                <div class="pay-method-bar" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="pay-method-total">${formatPrice(data.total)}</div>
        </div>`;
    }).join('');
}

function renderDashTopProducts(periodSales) {
    const sold = {};
    periodSales.forEach(s => {
        (s.items || []).forEach(item => {
            const name = item.name || 'Producto';
            if (!sold[name]) sold[name] = { qty: 0, total: 0 };
            sold[name].qty += item.qty;
            sold[name].total += item.price * item.qty;
        });
    });
    const sorted = Object.entries(sold).sort((a,b) => b[1].total - a[1].total).slice(0, 8);
    const tbody = document.getElementById('dashTopProducts');
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Sin ventas</td></tr>';
        return;
    }
    tbody.innerHTML = sorted.map(([name, data], i) => `<tr>
        <td><span class="rank-badge">${i+1}</span></td>
        <td>${name}</td>
        <td><strong>${data.qty}</strong></td>
        <td><strong>${formatPrice(data.total)}</strong></td>
    </tr>`).join('');
}

function renderDashStockAlerts() {
    const alerts = posProducts.filter(p => p.stock <= 5).sort((a,b) => a.stock - b.stock).slice(0, 8);
    const tbody = document.getElementById('dashStockAlerts');
    if (alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">Todos los productos tienen stock suficiente</td></tr>';
        return;
    }
    tbody.innerHTML = alerts.map(p => {
        const cls = p.stock <= 0 ? 'stock-out' : p.stock <= 2 ? 'stock-critical' : 'stock-low';
        const label = p.stock <= 0 ? 'Agotado' : p.stock <= 2 ? 'Critico' : 'Bajo';
        return `<tr>
            <td>${p.name}</td>
            <td><strong>${p.stock}</strong></td>
            <td><span class="stock-tag ${cls}">${label}</span></td>
        </tr>`;
    }).join('');
}

function renderDashTopCustomers(periodSales) {
    const cust = {};
    periodSales.forEach(s => {
        const name = s.customer;
        if (!name || name === 'Cliente mostrador' || name === 'Mostrador') return;
        if (!cust[name]) cust[name] = { count: 0, total: 0 };
        cust[name].count++;
        cust[name].total += s.total;
    });
    const sorted = Object.entries(cust).sort((a,b) => b[1].total - a[1].total).slice(0, 8);
    const tbody = document.getElementById('dashTopCustomers');
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Sin ventas</td></tr>';
        return;
    }
    tbody.innerHTML = sorted.map(([name, data], i) => `<tr>
        <td><span class="rank-badge">${i+1}</span></td>
        <td>${name}</td>
        <td><strong>${data.count}</strong></td>
        <td><strong>${formatPrice(data.total)}</strong></td>
    </tr>`).join('');
}

function renderDashSummary(periodSales) {
    const total = periodSales.reduce((s, v) => s + v.total, 0);
    const items = periodSales.reduce((s, v) => s + v.items.reduce((a, i) => a + i.qty, 0), 0);
    const cash = periodSales.filter(s => s.method === 'Efectivo').reduce((s, v) => s + v.total, 0);
    const digital = periodSales.filter(s => s.method !== 'Efectivo' && s.method !== 'Credito').reduce((s, v) => s + v.total, 0);
    const credit = periodSales.filter(s => s.method === 'Credito').reduce((s, v) => s + v.total, 0);
    document.getElementById('dashSummary').innerHTML = `
        <div class="summary-rows">
            <div class="summary-row"><span>Total facturado</span><strong>${formatPrice(total)}</strong></div>
            <div class="summary-row"><span>Unidades vendidas</span><strong>${items}</strong></div>
            <div class="summary-row"><span>Efectivo</span><strong>${formatPrice(cash)}</strong></div>
            <div class="summary-row"><span>Digital (Nequi, Davi, Tarjeta, etc)</span><strong>${formatPrice(digital)}</strong></div>
            <div class="summary-row"><span>Credito</span><strong>${formatPrice(credit)}</strong></div>
            <div class="summary-row"><span>Ticket promedio</span><strong>${periodSales.length > 0 ? formatPrice(total / periodSales.length) : '$0'}</strong></div>
            <div class="summary-row"><span>Total transacciones</span><strong>${periodSales.length}</strong></div>
        </div>
    `;
}

function renderDashRecent(periodSales) {
    const recent = periodSales.slice(-10).reverse();
    const tbody = document.getElementById('dashRecentSales');
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas registradas</td></tr>';
        return;
    }
    tbody.innerHTML = recent.map((s, idx) => `<tr>
        <td><strong>#${s.id}</strong></td>
        <td>${formatDate(s.date)}</td>
        <td>${s.customer || 'Mostrador'}</td>
        <td>${s.items.reduce((sum, i) => sum + i.qty, 0)}</td>
        <td><strong>${formatPrice(s.total)}</strong></td>
        <td><span class="tag tag-info">${s.method}</span></td>
    </tr>`).join('');
}

// ============ SALES TABLE ============
function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    let filtered = posSales.filter(s => s.ventaPorFuera).reverse();
    if (q) filtered = filtered.filter(s => s.id.toString().includes(q) || (s.customer && s.customer.toLowerCase().includes(q)));
    const tbody = document.getElementById('salesTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas por fuera registradas</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((s, idx) => {
        const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
        let methodHtml = '<span class="tag tag-info">' + s.method + '</span>';
        if (s.creditInfo) {
            if (s.creditInfo.tipo === 'abono') {
                const pagado = s.creditInfo.payments.reduce((sum, p) => sum + p.amount, 0);
                const balance = s.creditInfo.balance - pagado;
                const status = balance > 0 ? 'tag-warning' : 'tag-success';
                methodHtml = '<span class="tag ' + status + '">' + s.method + ' ' + formatPrice(pagado) + '/' + formatPrice(s.creditInfo.balance) + '</span>';
            } else {
                const pending = (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor;
                const status = pending > 0 ? 'tag-warning' : 'tag-success';
                methodHtml = '<span class="tag ' + status + '">' + s.method + ' ' + s.creditInfo.pagadas + '/' + s.creditInfo.totalCuotas + '</span>';
            }
        }
        return `<tr>
            <td><strong>#${s.id}</strong></td>
            <td>${formatDate(s.date)}</td>
            <td>${s.customer || 'Mostrador'}</td>
            <td>${qty}</td>
            <td><strong>${formatPrice(s.total)}</strong></td>
            <td>${methodHtml}</td>
            <td class="actions">
                ${s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas)) ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="Registrar Pago" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : ''}
                <button onclick="showReceipt(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>
            </td>
        </tr>`;
    }).join('');
}

// ============ RECEIPT ============
function showReceipt(sale) {
    if (typeof sale === 'string') sale = JSON.parse(sale);
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => `<div class="receipt-row"><span>${(i.name || 'Producto').substring(0,22)} x${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join('');
    content.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <img src="LOGO.jpeg" style="height:40px;margin-bottom:4px;" alt="Vida Sana">
                <h4>VIDA SANA</h4>
                <p>Santa Marta, Colombia<br>NIT: 1082954847-4</p>
                <p style="font-size:11px;margin-top:2px;">${shortDate(sale.date)}</p>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Pedido #${sale.id}</span><span>${sale.method}</span></div>
            <div class="receipt-row"><span>Cliente: ${sale.customer || 'Mostrador'}</span></div>
            <div style="font-size:11px;color:var(--warning);text-align:center;margin:4px 0;">PEDIDO POR FUERA</div>
            <div class="receipt-divider"></div>
            ${itemsHtml}
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Subtotal</span><span>${formatPrice(sale.subtotal)}</span></div>
            <div class="receipt-total"><span>TOTAL</span><span>${formatPrice(sale.total)}</span></div>
            <div class="receipt-footer">
                <p>Gracias por su compra!</p>
                <p>tel: 313 6196312</p>
            </div>
        </div>
    `;
    document.getElementById('receiptModal').classList.add('open');
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('open');
}

function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    const win = window.open('', '', 'width=400,height=600');
    win.document.write(`<html><head><style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: "Courier New", monospace; font-size: 14px; padding: 3mm 4mm; margin: 0; line-height: 1.5; width: 72mm; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .receipt-header { text-align: center; margin-bottom: 6px; }
        .receipt-header h4 { font-size: 18px; letter-spacing: 2px; margin: 0 0 2px; text-transform: uppercase; font-weight: bold; }
        .receipt-header p { margin: 1px 0; font-size: 12px; font-weight: bold; }
        .receipt-divider { border-top: 2px solid #000; margin: 6px 0; }
        .receipt-row { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; font-weight: bold; }
        .receipt-row span:first-child { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .receipt-row span:last-child { text-align: right; white-space: nowrap; margin-left: 8px; }
        .receipt-total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin: 8px 0; border-top: 3px solid #000; border-bottom: 2px solid #000; padding: 8px 0; }
        .receipt-footer { text-align: center; font-size: 12px; color: #000; margin-top: 10px; border-top: 2px solid #000; padding-top: 8px; font-weight: bold; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

// ============ PAYMENT MODAL ============
let _paymentTargetSaleId = null;

function openPaymentModal(saleId) {
    const sale = posSales.find(s => s.id === saleId);
    if (!sale) return;
    _paymentTargetSaleId = saleId;
    if (!sale.creditInfo) {
        sale.creditInfo = { tipo: 'fijo', totalCuotas: 1, cuotaValor: sale.total, pagadas: 0, payments: [] };
        saveSales();
    }
    const ci = sale.creditInfo;
    let pending = 0;
    let suggestedAmount = 0;
    let label = '';
    if (ci.tipo === 'abono') {
        const pagado = ci.payments.reduce((s, p) => s + p.amount, 0);
        pending = ci.balance - pagado;
        suggestedAmount = pending;
        label = 'Valor a abonar';
    } else {
        pending = (ci.totalCuotas - ci.pagadas) * ci.cuotaValor;
        suggestedAmount = ci.cuotaValor;
        label = 'Valor a pagar';
    }
    if (pending <= 0) { showToast('Este pedido ya esta pagado'); return; }
    let html = '<div style="margin-bottom:14px;font-size:13px;">';
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Pedido #' + saleId + '</span><span>' + formatPrice(sale.total) + '</span></div>';
    if (ci.tipo === 'abono') {
        const pagado = ci.payments.reduce((s, p) => s + p.amount, 0);
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Total abonado</span><span>' + formatPrice(pagado) + '</span></div>';
    } else {
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Cuotas pagadas</span><span>' + ci.pagadas + '/' + ci.totalCuotas + '</span></div>';
    }
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:700;color:var(--warning);"><span>Saldo pendiente</span><span>' + formatPrice(pending) + '</span></div>';
    html += '</div>';
    html += '<div class="form-group"><label>' + label + '</label><input type="number" id="paymentAmount" value="' + suggestedAmount + '" min="1" max="' + pending + '"></div>';
    if (ci.payments && ci.payments.length > 0) {
        html += '<div style="font-size:12px;color:var(--text-muted);margin-top:10px;"><strong>Pagos registrados:</strong></div>';
        ci.payments.forEach(p => {
            html += '<div style="font-size:12px;display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--border);"><span>' + shortDate(p.date) + '</span><span>' + formatPrice(p.amount) + '</span></div>';
        });
    }
    document.getElementById('paymentModalContent').innerHTML = html;
    document.getElementById('paymentModal').classList.add('open');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('open');
    _paymentTargetSaleId = null;
}

function confirmPayment() {
    const saleId = _paymentTargetSaleId;
    if (!saleId) { showToast('Error: pedido no identificado'); return; }
    const sale = posSales.find(s => s.id === saleId);
    if (!sale) return;
    if (!sale.creditInfo) return;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    if (!amount || amount <= 0) { showToast('Ingresa un valor valido'); return; }
    if (!sale.creditInfo.payments) sale.creditInfo.payments = [];
    sale.creditInfo.payments.push({ date: now(), amount: Math.round(amount) });
    if (sale.creditInfo.tipo === 'abono') {
        const totalPagado = sale.creditInfo.payments.reduce((s, p) => s + p.amount, 0);
        if (totalPagado >= sale.creditInfo.balance) {
            sale.creditInfo.pagadas = 1;
        }
    } else {
        sale.creditInfo.pagadas = sale.creditInfo.payments.length;
        if (sale.creditInfo.pagadas > sale.creditInfo.totalCuotas) sale.creditInfo.pagadas = sale.creditInfo.totalCuotas;
    }
    saveSales();
    if (API.isAvailable) {
        API.addPayment(sale.apiId || saleId, Math.round(amount), 'Pago registrado desde POS Por Fuera').catch(e => { console.error('[POS-FUERA] addPayment error:', e); });
    }
    closePaymentModal();
    refreshCustHistory();
    renderOrders();
    renderSalesTable();
    renderDashboard();
    showToast('Pago registrado con exito');
}

// ============ ESTADO DE CUENTAS ============
function renderAccountStatus() {
    const tbody = document.getElementById('cuentasTableBody');
    if (!tbody) return;
    const q = (document.getElementById('cuentasSearch')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('cuentasFilter')?.value || 'todo';
    const tipoFilter = document.getElementById('cuentasTipoFilter')?.value || 'all';
    let customers = [...posCustomers];
    if (q) customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (filter === 'deuda') customers = customers.filter(c => getCustomerPending(c.id) > 0);
    else if (filter === 'aldia') customers = customers.filter(c => getCustomerPending(c.id) <= 0);
    if (tipoFilter !== 'all') customers = customers.filter(c => (c.tipo || 'local') === tipoFilter);
    customers.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = customers.map(c => {
        const sales = posSales.filter(s => s.customerId === c.id);
        const totalSpent = sales.reduce((sum, s) => sum + s.total, 0);
        const pendingTotal = getCustomerPending(c.id);
        const totalPaid = Math.max(0, totalSpent - pendingTotal);
        const purchases = sales.length;
        const lastDate = sales.length > 0 ? Math.max(...sales.map(s => new Date(s.date || s.created_at || 0))) : null;
        const lastStr = lastDate ? new Date(lastDate).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : 'Nunca';
        const pendingHtml = pendingTotal > 0
            ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(pendingTotal) + '</span>'
            : '<span style="color:var(--success);">Pagado</span>';
        const hasPending = pendingTotal > 0;
        return '<tr>' +
            '<td><strong style="cursor:pointer;" onclick="showCustomerHistory(\'' + c.id + '\')">' + c.name + '</strong></td>' +
            '<td>' + (c.phone || '-') + '</td>' +
            '<td>' + purchases + '</td>' +
            '<td><strong>' + formatPrice(totalSpent) + '</strong></td>' +
            '<td>' + formatPrice(totalPaid) + '</td>' +
            '<td>' + pendingHtml + '</td>' +
            '<td style="font-size:12px;color:var(--text-muted);">' + lastStr + '</td>' +
            '<td class="actions">' +
                '<button class="btn btn-sm btn-outline" onclick="showCustomerHistory(\'' + c.id + '\')" title="Ver historial">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg> Historial' +
                '</button>' +
                (hasPending ? '<button class="btn btn-sm btn-primary" onclick="showCustomerHistory(\'' + c.id + '\')" title="Cobrar" style="margin-left:4px;">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Cobrar' +
                '</button>' : '') +
            '</td>' +
        '</tr>';
    }).join('');
}

// ============ REGISTRAR COMPRA ANTIGUA ============
function openOldPurchaseModal() {
    document.getElementById('oldPurchaseDate').value = new Date().toISOString().split('T')[0];
    const sel = document.getElementById('oldPurchaseCustomer');
    sel.innerHTML = '<option value="">Seleccionar cliente existente...</option>' + posCustomers.map(c => '<option value="' + c.id + '">' + c.name + (c.phone ? ' - ' + c.phone : '') + '</option>').join('');
    sel.value = '';
    document.getElementById('oldPurchaseNewCustSection').classList.remove('open');
    document.getElementById('oldPurchaseNewName').value = '';
    document.getElementById('oldPurchaseNewPhone').value = '';
    document.getElementById('oldPurchaseNewAddress').value = '';
    document.getElementById('oldPurchaseProducts').innerHTML = '';
    document.getElementById('oldPurchaseProdSearch').value = '';
    document.getElementById('oldPurchaseProdResults').style.display = 'none';
    document.getElementById('oldPurchaseStatus').value = 'pagado';
    document.getElementById('oldPurchasePaidGroup').style.display = 'none';
    document.getElementById('oldPurchasePaid').value = '0';
    document.getElementById('oldPurchaseTotal').textContent = '$0';
    document.getElementById('oldPurchaseModal').classList.add('open');
}

function closeOldPurchaseModal() {
    document.getElementById('oldPurchaseModal').classList.remove('open');
}

function onOldPurchaseCustSelect() {
    const sel = document.getElementById('oldPurchaseCustomer');
    if (sel.value) {
        document.getElementById('oldPurchaseNewCustSection').classList.remove('open');
    }
}

function toggleOldPurchaseNewCust() {
    const section = document.getElementById('oldPurchaseNewCustSection');
    const isOpen = section.classList.contains('open');
    if (isOpen) {
        section.classList.remove('open');
    } else {
        section.classList.add('open');
        document.getElementById('oldPurchaseCustomer').value = '';
        document.getElementById('oldPurchaseNewName').focus();
    }
}

function onOldPurchaseProdSearch() {
    const q = document.getElementById('oldPurchaseProdSearch').value.toLowerCase().trim();
    const results = document.getElementById('oldPurchaseProdResults');
    if (!q) { results.style.display = 'none'; return; }
    const matches = posProducts.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q))).slice(0, 8);
    if (matches.length === 0) { results.style.display = 'none'; return; }
    results.innerHTML = matches.map(p => 
        '<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:13px;"' +
        ' onmousedown="selectOldPurchaseProd(\'' + p.id + '\')">' +
        '<span>' + p.name + '</span><span style="font-weight:600;">' + formatPrice(p.price) + '</span></div>'
    ).join('');
    results.style.display = '';
}

function selectOldPurchaseProd(prodId) {
    const p = posProducts.find(pr => pr.id === prodId);
    if (!p) return;
    document.getElementById('oldPurchaseProdSearch').value = '';
    document.getElementById('oldPurchaseProdResults').style.display = 'none';
    const container = document.getElementById('oldPurchaseProducts');
    const row = document.createElement('div');
    row.className = 'old-prod-row';
    row.dataset.prodId = p.id;
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center;';
    row.innerHTML =
        '<input type="text" class="old-prod-name" value="' + p.name.replace(/'/g, '\\\'') + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">' +
        '<input type="number" class="old-prod-price" value="' + p.price + '" min="0" style="width:100px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;" onchange="calcOldPurchaseTotal()">' +
        '<button class="btn btn-sm btn-outline" onclick="removeOldProductRow(this)" style="padding:4px 8px;font-size:16px;line-height:1;">&times;</button>';
    container.appendChild(row);
    calcOldPurchaseTotal();
}

function addOldProductRow() {
    const container = document.getElementById('oldPurchaseProducts');
    const row = document.createElement('div');
    row.className = 'old-prod-row';
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center;';
    row.innerHTML =
        '<input type="text" class="old-prod-name" placeholder="Nombre del producto" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">' +
        '<input type="number" class="old-prod-price" placeholder="Precio" min="0" style="width:100px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;" onchange="calcOldPurchaseTotal()">' +
        '<button class="btn btn-sm btn-outline" onclick="removeOldProductRow(this)" style="padding:4px 8px;font-size:16px;line-height:1;">&times;</button>';
    container.appendChild(row);
}

function removeOldProductRow(btn) {
    const row = btn.parentElement;
    if (document.querySelectorAll('.old-prod-row').length > 1) {
        row.remove();
        calcOldPurchaseTotal();
    }
}

function calcOldPurchaseTotal() {
    const prices = document.querySelectorAll('.old-prod-price');
    let total = 0;
    prices.forEach(inp => { total += parseFloat(inp.value) || 0; });
    document.getElementById('oldPurchaseTotal').textContent = formatPrice(total);
}

function onOldPurchaseStatusChange() {
    const status = document.getElementById('oldPurchaseStatus').value;
    document.getElementById('oldPurchasePaidGroup').style.display = status === 'abono' ? '' : 'none';
    if (status === 'abono') {
        const prices = document.querySelectorAll('.old-prod-price');
        let total = 0;
        prices.forEach(inp => { total += parseFloat(inp.value) || 0; });
        document.getElementById('oldPurchasePaid').value = Math.round(total / 2);
    }
}

let _savingOldPurchase = false;
async function saveOldPurchase() {
    if (_savingOldPurchase) return;
    _savingOldPurchase = true;
    document.querySelector('#oldPurchaseModal .btn-primary').disabled = true;
    const dateVal = document.getElementById('oldPurchaseDate').value;
    if (!dateVal) { _savingOldPurchase = false; document.querySelector('#oldPurchaseModal .btn-primary').disabled = false; showToast('Selecciona una fecha'); return; }
    const sel = document.getElementById('oldPurchaseCustomer');
    let customerId = sel.value || null;
    const newCustSection = document.getElementById('oldPurchaseNewCustSection');
    const newName = document.getElementById('oldPurchaseNewName').value.trim();
    if (!customerId && newCustSection.classList.contains('open') && newName) {
        const existing = posCustomers.find(c => c.name.toLowerCase() === newName.toLowerCase());
        if (existing) {
            customerId = existing.id;
        } else if (API.isAvailable) {
            try {
                const data = await API.saveCustomer({ name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'fuera' });
                customerId = data && data.id ? 'c' + data.id : 'c' + Date.now();
                posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'fuera', created_at: dateVal + 'T00:00:00', _synced: true });
                localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            } catch(e) {
                console.error('[POS-FUERA] saveCustomer error:', e);
                customerId = 'c' + Date.now();
                posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'fuera', created_at: dateVal + 'T00:00:00' });
                localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            }
        } else {
            customerId = 'c' + Date.now();
            posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'fuera', created_at: dateVal + 'T00:00:00' });
            localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
        }
    }
    if (!customerId) { _savingOldPurchase = false; document.querySelector('#oldPurchaseModal .btn-primary').disabled = false; showToast('Selecciona un cliente existente o crea uno nuevo'); return; }
    const productRows = document.querySelectorAll('.old-prod-row');
    const items = [];
    productRows.forEach(row => {
        const name = row.querySelector('.old-prod-name').value.trim();
        const price = parseFloat(row.querySelector('.old-prod-price').value) || 0;
        const prodId = row.dataset.prodId || '';
        if (name && price > 0) items.push({ id: prodId || 'old-' + Date.now() + '-' + items.length, name: name, qty: 1, price: price, isTemp: !prodId });
    });
    if (items.length === 0) { _savingOldPurchase = false; document.querySelector('#oldPurchaseModal .btn-primary').disabled = false; showToast('Agrega al menos un producto con nombre y precio'); return; }
    const total = items.reduce((s, i) => s + i.price, 0);
    const status = document.getElementById('oldPurchaseStatus').value;
    let creditInfo = null;
    if (status === 'pendiente') {
        creditInfo = { tipo: 'abono', totalCuotas: 0, cuotaValor: 0, pagadas: 0, payments: [], balance: total };
    } else if (status === 'abono') {
        const paid = Math.min(parseFloat(document.getElementById('oldPurchasePaid').value) || 0, total);
        creditInfo = { tipo: 'abono', totalCuotas: 0, cuotaValor: 0, pagadas: paid >= total ? 1 : 0, payments: [{ date: dateVal + 'T00:00:00', amount: Math.round(paid) }], balance: total };
    }
    const nextSaleId = posSales.length > 0 ? Math.max(...posSales.map(s => s.id)) + 1 : 1;
    const customerName = newName || (posCustomers.find(c => c.id === customerId)?.name);
    const sale = {
        id: nextSaleId,
        customerId: customerId,
        customer: customerName,
        items: items,
        total: total,
        excedente: 0,
        method: creditInfo ? 'Credito' : 'Efectivo',
        methodKey: creditInfo ? 'credito' : 'cash',
        creditInfo: creditInfo,
        ventaPorFuera: true,
        date: dateVal + 'T12:00:00',
        created_at: dateVal + 'T12:00:00',
        status: 'completada'
    };
    posSales.push(sale);
    saveSales();
    saveProducts();
    closeOldPurchaseModal();
    renderAccountStatus();
    renderCustomerTable();
    renderSalesTable();
    renderDashboard();
    showToast('Compra antigua registrada con exito');
    _savingOldPurchase = false;
    document.querySelector('#oldPurchaseModal .btn-primary').disabled = false;
}

// ============ INIT ============
POS_PANEL_RENDERERS['dashboard'] = renderDashboard;
POS_PANEL_RENDERERS['orders'] = renderOrders;
POS_PANEL_RENDERERS['tpv'] = renderTpv;
POS_PANEL_RENDERERS['products'] = renderProductTable;
POS_PANEL_RENDERERS['customers'] = renderCustomerTable;
POS_PANEL_RENDERERS['categories'] = renderCategoriesTable;
POS_PANEL_RENDERERS['cuentas'] = renderAccountStatus;
POS_PANEL_RENDERERS['inventory'] = renderInventory;
POS_PANEL_RENDERERS['sales'] = renderSalesTable;

function initPOS() {
    (async function() {
        console.log('[POS-FUERA] initPOS iniciando...');
        const available = await API.check();
        if (available) {
            await syncFromApi();
        } else {
            loadData();
        }
        initCatFilter();
        migrateProductSubcats();
        renderDashboard();
        renderTpv();
        renderProductTable();
        renderCustomerTable();
        renderCategoriesTable();
        renderAccountStatus();
        renderSalesTable();
        renderOrders();
        buildMobileMenu();
    })();
}

checkSession();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
