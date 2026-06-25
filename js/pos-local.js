// ============ POS LOCAL - Config ============
const POS_SCOPE = 'local';
const POS_RESTRICTED_PANELS = ['suppliers','dashboard'];
const POS_PANEL_TITLES = { dashboard:'Dashboard', tpv:'TPV / Punto de Venta', products:'Gestion de Productos', inventory:'Control de Inventario', customers:'Gestion de Clientes', suppliers:'Gestion de Proveedores', categories:'Gestion de Categorias', sales:'Historial de Ventas', cash:'Caja' };
const POS_PANEL_RENDERERS = {};

// ============ TPV ============
function populateTpvFilters() {
    const cats = POS_CATEGORIES.filter(c => !c.parent_key);
    const catSel = document.getElementById('tpvCatFilter');
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

let _barcodeTimer = null;
function setupBarcodeScan() {
    const input = document.getElementById('tpvBarcode');
    input.addEventListener('input', function() {
        clearTimeout(_barcodeTimer);
        const code = this.value.trim();
        if (code.length < 3) return;
        _barcodeTimer = setTimeout(() => {
            const product = posProducts.find(p => p.barcode === code);
            if (product) {
                if (product.stock > 0) {
                    addToCart(product.id);
                    showToast('+ ' + product.name);
                    this.value = '';
                    renderTpvProducts();
                } else {
                    showToast(product.name + ' (agotado)');
                    this.value = '';
                }
            } else {
                showToast('Codigo no encontrado');
                this.select();
            }
        }, 120);
    });
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(_barcodeTimer);
            const code = this.value.trim();
            if (!code) return;
            const product = posProducts.find(p => p.barcode === code);
            if (product) {
                if (product.stock > 0) {
                    addToCart(product.id);
                    showToast('+ ' + product.name);
                    this.value = '';
                    renderTpvProducts();
                } else {
                    showToast(product.name + ' (agotado)');
                    this.value = '';
                }
            } else {
                showToast('Codigo no encontrado');
                this.select();
            }
        }
    });
}

function filterTpvProducts() {
    renderTpvProducts();
}

function renderTpvProducts() {
    const q = document.getElementById('tpvSearch').value.toLowerCase().trim();
    const catFilter = document.getElementById('tpvCatFilter').value;
    const subcatFilter = document.getElementById('tpvSubcatFilter').value;
    let filtered = posProducts;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);
    if (subcatFilter) filtered = filtered.filter(p => (p.subcategory || '') === subcatFilter);
    const grid = document.getElementById('tpvGrid');
    grid.innerHTML = filtered.map(p => {
        const out = p.stock <= 0;
        return `<div class="tpv-item ${out ? 'out-of-stock' : ''}" onclick="${out ? '' : "addToCart('" + p.id + "')"}">
            <div class="thumb"><img src="${p.img || DEFAULT_IMG}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.style.display='none'"></div>
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
        container.innerHTML = '<div class="tpv-cart-empty"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg><p>Agrega productos al carrito</p></div>';
        count.textContent = '0';
        subtotal.textContent = '$0';
        totalEl.textContent = '$0';
        if (barTotal) barTotal.textContent = '$0';
        btn.innerHTML = 'Cobrar $0';
        btn.disabled = true;
        badge.textContent = '0';
        return;
    }

    const totalQty = posCart.reduce((s, i) => s + i.qty, 0);
    const sub = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const excedente = parseFloat(document.getElementById('tpvExcedente').value) || 0;
    const total = sub + excedente;

    count.textContent = totalQty;
    subtotal.textContent = formatPrice(sub);
    totalEl.textContent = formatPrice(total);
    if (barTotal) barTotal.textContent = formatPrice(total);
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Cobrar ' + formatPrice(total);
    btn.disabled = false;
    badge.textContent = totalQty;

    const exInput = document.getElementById('tpvExcedente');
    if (excedente > 0) exInput.classList.add('ex-active');
    else exInput.classList.remove('ex-active');

    container.innerHTML = posCart.map((item, idx) => {
        const p = item.isTemp ? null : posProducts.find(pr => pr.id === item.id);
        const name = item.isTemp ? item.tempName : (p ? p.name : 'Producto');
        const priceDiff = !item.isTemp && p && item.price !== p.price;
        return `<div class="tpv-cart-item">
            <div class="tpv-ci-info">
                <div class="tpv-ci-name">${name}${item.isTemp ? ' <span style="font-size:10px;color:var(--warning);">(temp)</span>' : ''}</div>
                <div class="tpv-ci-price" onclick="${item.isTemp ? '' : 'openEditPriceModal(' + idx + ')'}" title="${item.isTemp ? 'Producto temporal' : 'Clic para editar precio'}" style="cursor:${item.isTemp ? 'default' : 'pointer'};${priceDiff ? 'color:var(--primary);font-weight:700;' : ''}">${formatPrice(item.price)}${priceDiff ? ' ✎' : ''}</div>
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
    document.getElementById('tpvExcedente').value = '0';
    calcTotalExcedente();
    saveCart();
    renderTpvCart();
}

function toggleExcedente() {
    const inp = document.getElementById('tpvExcedente');
    if (parseFloat(inp.value) > 0) {
        inp.value = '0';
    } else {
        inp.value = '5000';
    }
    calcTotalExcedente();
}

function calcTotalExcedente() {
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

let _editPriceIndex = null;

function openEditPriceModal(idx) {
    if (!posCart[idx]) return;
    const modal = document.getElementById('editPriceModal');
    const priceInput = document.getElementById('editPriceInput');
    const productName = document.getElementById('editPriceProdName');
    const item = posCart[idx];
    const prod = item.isTemp ? null : posProducts.find(p => p.id === item.id);

    _editPriceIndex = idx;
    if (!modal || !priceInput || !productName) return;
    productName.textContent = item.isTemp ? item.tempName : (prod ? prod.name : 'Producto');
    priceInput.value = item.price.toFixed(2);
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => priceInput.focus(), 100);
}

function closeEditPriceModal() {
    const modal = document.getElementById('editPriceModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    _editPriceIndex = null;
}

function saveEditPriceModal() {
    if (_editPriceIndex === null) return;
    const priceInput = document.getElementById('editPriceInput');
    const value = priceInput ? priceInput.value.trim() : '';
    const parsed = Math.round(parseFloat(value) * 100) / 100;
    if (isNaN(parsed) || parsed <= 0) {
        showToast('Precio invalido');
        return;
    }
    const item = posCart[_editPriceIndex];
    if (!item) return;
    const prod = item.isTemp ? null : posProducts.find(p => p.id === item.id);
    item.price = parsed;
    saveCart();
    renderTpvCart();
    closeEditPriceModal();
    if (prod && parsed !== prod.price) {
        showToast('Precio ajustado: ' + formatPrice(parsed) + ' (original: ' + formatPrice(prod.price) + ')');
    } else {
        showToast('Precio actualizado: ' + formatPrice(parsed));
    }
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

// ============ CHECKOUT MODAL ============
const PAY_OPTS = [
    { key: 'cash', label: 'Efectivo', icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
    { key: 'card', label: 'Tarjeta', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z' },
    { key: 'transfer', label: 'Transferencia', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' },
    { key: 'mixed', label: 'Mixto', icon: 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z' },
    { key: 'credito', label: 'Credito', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z' }
];
const TRANSFER_OPTS = [
    { key: 'transferencia', label: 'Transferencia' },
    { key: 'nequi', label: 'Nequi' },
    { key: 'daviplata', label: 'Daviplata' },
    { key: 'bolt', label: 'Bolt' }
];
const MIXED_METHODS = [
    { key: 'cash', label: 'Efectivo', icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
    { key: 'card', label: 'Tarjeta', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z' },
    { key: 'transferencia', label: 'Transferencia', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' },
    { key: 'nequi', label: 'Nequi', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' },
    { key: 'daviplata', label: 'Daviplata', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' },
    { key: 'bolt', label: 'Bolt', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' }
];
let chkPayMethod = 'cash';
let chkCreditType = 'fijo';


function openCheckoutModal() {
    if (posCart.length === 0) { showToast('Agrega productos al carrito'); return; }
    chkPayMethod = 'cash';
    chkCreditType = 'fijo';
    document.getElementById('chkCustomerId').value = '';
    document.getElementById('chkCustomerInput').value = '';
    const el = document.getElementById('chkQuickAdd');
    if (el) el.style.display = 'none';
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    renderCheckoutCustomers();
    renderCheckoutPayGrid();
    renderCheckoutResumen();
    document.getElementById('chkCreditConfig').classList.remove('open');
}
function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('open');
}
function renderCheckoutCustomers() {
    const q = document.getElementById('chkCustomerInput').value.toLowerCase().trim();
    const list = document.getElementById('chkCustomerList');
    const selectedId = document.getElementById('chkCustomerId').value;
    const filtered = q ? filterCustomersByScope(posCustomers).filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))) : filterCustomersByScope(posCustomers);
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
function quickAddCheckoutCustomer() {
    const el = document.getElementById('chkQuickAdd');
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') {
        document.getElementById('chkQuickName').value = '';
        document.getElementById('chkQuickPhone').value = '';
        document.getElementById('chkQuickName').focus();
    }
}
function cancelQuickAddCustomer() {
    document.getElementById('chkQuickAdd').style.display = 'none';
}
function saveQuickCheckoutCustomer() {
    const name = document.getElementById('chkQuickName').value.trim();
    if (!name) { showToast('Nombre requerido'); document.getElementById('chkQuickName').focus(); return; }
    const phone = document.getElementById('chkQuickPhone').value.trim();
    const tipo = getDefaultCustomerTipo();
    const cust = { id: 'c' + posNextCustomerId++, name, phone, email: '', address: '', tipo, _synced: false };
    posCustomers.push(cust);
    saveCustomers();
    pickCheckoutCustomer(cust.id);
    document.getElementById('chkQuickAdd').style.display = 'none';
    showToast('Cliente agregado');
}
function renderCheckoutMixedHtml() {
    return '<div class="checkout-mixed-section">' +
        '<div class="checkout-mixed-title">Distribuir pago</div>' +
        MIXED_METHODS.map(m => '<div class="checkout-mixed-row">' +
            '<span class="checkout-mixed-label">' + m.label + '</span>' +
            '<input type="number" class="checkout-mixed-input" data-method="' + m.key + '" data-label="' + m.label + '" value="" min="0" placeholder="$0" oninput="onMixedInputChange()">' +
            '</div>').join('') +
        '<div class="checkout-mixed-total">' +
            '<span>Total asignado</span><span id="chkMixedAssigned">$0</span>' +
        '</div>' +
        '<div class="checkout-mixed-remaining" id="chkMixedRemaining">' +
            '<span>Restante</span><span id="chkMixedRestante">$0</span>' +
        '</div>' +
        '<div class="checkout-mixed-cambio" id="chkMixedCambioRow" style="display:none;color:var(--success);font-weight:700;font-size:13px;padding:4px 0 0;border-top:1px solid var(--border);margin-top:4px;">' +
            '<span>Cambio (Efectivo)</span><span id="chkMixedCambioAmount">$0</span>' +
        '</div>' +
        '</div>';
}
function calcMixedTotal() {
    const inputs = document.querySelectorAll('.checkout-mixed-input');
    let sum = 0;
    inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
    return sum;
}
function getCashMixedAmount() {
    const cashInput = document.querySelector('.checkout-mixed-input[data-method="cash"]');
    return cashInput ? (parseFloat(cashInput.value) || 0) : 0;
}
function getNonCashSum() {
    const inputs = document.querySelectorAll('.checkout-mixed-input');
    let sum = 0;
    inputs.forEach(inp => {
        if (inp.dataset.method !== 'cash') sum += parseFloat(inp.value) || 0;
    });
    return sum;
}
function onMixedInputChange() {
    const total = getCheckoutTotal();
    const assigned = calcMixedTotal();
    const nonCashSum = getNonCashSum();
    const cashBill = getCashMixedAmount();
    const cashAssigned = Math.max(0, total - nonCashSum);
    const cambio = Math.max(0, cashBill - cashAssigned);
    document.getElementById('chkMixedAssigned').textContent = formatPrice(assigned);
    const remEl = document.getElementById('chkMixedRestante');
    const missing = Math.max(0, cashAssigned - cashBill);
    if (cashBill > 0 && missing > 0) {
        remEl.textContent = formatPrice(missing);
        remEl.style.color = 'var(--danger)';
    } else if (cashBill > 0 && cambio > 0) {
        remEl.textContent = '$0';
        remEl.style.color = 'var(--success)';
    } else {
        const restante = total - assigned;
        remEl.textContent = formatPrice(Math.abs(restante));
        remEl.style.color = restante > 0 ? 'var(--warning)' : (restante === 0 ? 'var(--success)' : 'var(--danger)');
    }
    const cambioRow = document.getElementById('chkMixedCambioRow');
    if (cambio > 0) {
        cambioRow.style.display = 'flex';
        document.getElementById('chkMixedCambioAmount').textContent = formatPrice(cambio);
    } else {
        cambioRow.style.display = 'none';
    }
}
function getMixedBreakdown() {
    const inputs = document.querySelectorAll('.checkout-mixed-input');
    const total = getCheckoutTotal();
    const nonCashSum = getNonCashSum();
    const cashAssigned = Math.max(0, total - nonCashSum);
    const breakdown = [];
    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0 && inp.dataset.method !== 'cash') {
            breakdown.push({ method: inp.dataset.label, methodKey: inp.dataset.method, amount: val });
        }
    });
    if (cashAssigned > 0) {
        breakdown.push({ method: 'Efectivo', methodKey: 'cash', amount: cashAssigned });
    }
    return breakdown;
}
function renderCheckoutPayGrid() {
    const grid = document.getElementById('chkPayGrid');
    const isTransfer = chkPayMethod === 'transfer' || ['transferencia','nequi','daviplata','bolt'].includes(chkPayMethod);
    const isMixed = chkPayMethod === 'mixed';
    grid.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
        PAY_OPTS.map(p => '<div class="checkout-pay-opt' + ((p.key === chkPayMethod || (p.key === 'transfer' && isTransfer)) ? ' selected' : '') + '" onclick="pickCheckoutPay(\'' + p.key + '\')">' +
            '<svg viewBox="0 0 24 24"><path d="' + p.icon + '"/></svg>' +
            '<span class="p-label">' + p.label + '</span>' +
            '</div>').join('') +
        '</div>' +
        (isTransfer ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px;background:var(--hover);border-radius:8px;">' +
            TRANSFER_OPTS.map(t => '<div class="checkout-pay-subopt' + (t.key === chkPayMethod ? ' selected' : '') + '" onclick="pickCheckoutSubPay(\'' + t.key + '\', \'' + t.label + '\')" style="display:flex;align-items:center;justify-content:center;padding:8px;border:2px solid ' + (t.key === chkPayMethod ? 'var(--primary)' : 'var(--border)') + ';border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.15s;background:' + (t.key === chkPayMethod ? 'rgba(11,81,59,0.06)' : '#fff') + ';">' + t.label + '</div>').join('') +
            '</div>' : '') +
        (isMixed ? renderCheckoutMixedHtml() : '') +
        '</div>';
}
function pickCheckoutPay(key) {
    if (key === 'credito' && !document.getElementById('chkCustomerId').value) {
        showToast('Selecciona un cliente primero para vender a credito');
        return;
    }
    chkPayMethod = key;
    if (key !== 'transfer') {
        chkPayMethod = key;
    }
    renderCheckoutPayGrid();
    const cfg = document.getElementById('chkCreditConfig');
    if (key === 'credito') {
        cfg.classList.add('open');
        renderCheckoutCredit();
    } else {
        cfg.classList.remove('open');
    }
    renderCheckoutResumen();
}
function pickCheckoutSubPay(key, label) {
    chkPayMethod = key;
    renderCheckoutPayGrid();
    renderCheckoutResumen();
}
function switchCreditType(type) {
    chkCreditType = type;
    document.querySelectorAll('.credit-tab').forEach(t => t.classList.toggle('active', t.dataset.ctype === type));
    renderCheckoutCredit();
    renderCheckoutResumen();
}
function renderCheckoutCredit() {
    const body = document.getElementById('chkCreditBody');
    if (chkCreditType === 'fijo') {
        const total = getCheckoutTotal();
        body.innerHTML = '<div class="form-group"><label>Numero de cuotas</label><select onchange="renderCheckoutResumen()"><option value="1">1 cuota</option><option value="2">2 cuotas</option><option value="3">3 cuotas</option><option value="4">4 cuotas</option><option value="5">5 cuotas</option><option value="6">6 cuotas</option></select></div>' +
            '<div class="form-group"><label>Valor por cuota</label><div class="cuota-valor-readonly">' + formatPrice(Math.ceil(total / 1)) + '</div></div>';
    } else {
        body.innerHTML = '<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">' +
            '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#16a34a;vertical-align:middle;margin-right:6px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
            'El cliente podra abonar cualquier valor cuando quiera. Se generara una cuenta de cobro con el saldo pendiente.' +
            '</div>';
    }
}
function getCheckoutTotal() {
    const sub = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const excedente = parseFloat(document.getElementById('tpvExcedente').value) || 0;
    return sub + excedente;
}
function calcCambio() {
    const total = getCheckoutTotal();
    const paga = parseFloat(document.getElementById('chkPagaCon').value) || 0;
    const cambio = Math.max(0, paga - total);
    document.getElementById('chkCambioDisplay').textContent = formatPrice(cambio);
}

function renderCheckoutResumen() {
    const total = getCheckoutTotal();
    document.getElementById('chkTotalDisplay').textContent = formatPrice(total);
    const items = document.getElementById('chkResumenItems');
    items.innerHTML = posCart.map(i => {
        const p = posProducts.find(pr => pr.id === i.id);
        const name = p ? p.name : 'Producto';
        return '<div class="checkout-resumen-item"><span>' + i.qty + 'x ' + name + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>';
    }).join('');
    const summary = document.getElementById('chkCreditSummary');
    if (chkPayMethod === 'credito') {
        let html = '';
        if (chkCreditType === 'fijo') {
            const sel = document.querySelector('#chkCreditBody select');
            const cuotas = sel ? parseInt(sel.value) : 1;
            const cv = Math.ceil(total / cuotas);
            html = '<div class="cs-row"><span>Cuotas fijas</span><span>' + cuotas + ' x ' + formatPrice(cv) + '</span></div>';
        } else {
            html = '<div class="cs-row" style="color:#166534;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#16a34a;vertical-align:middle;margin-right:4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Cuenta de cobro: <strong>' + formatPrice(total) + '</strong></div>';
        }
        summary.innerHTML = html;
    } else if (chkPayMethod === 'mixed') {
        const assigned = calcMixedTotal();
        const restante = total - assigned;
        const color = restante > 0 ? 'var(--warning)' : (restante === 0 ? 'var(--success)' : 'var(--danger)');
        summary.innerHTML = '<div class="cs-row" style="color:' + color + ';font-weight:600;"><span>Restante</span><span>' + formatPrice(Math.abs(restante)) + '</span></div>';
    } else {
        summary.innerHTML = '';
    }
    const section = document.getElementById('chkCambioSection');
    if (chkPayMethod === 'cash') {
        section.style.display = '';
        calcCambio();
    } else {
        section.style.display = 'none';
        document.getElementById('chkPagaCon').value = '';
        document.getElementById('chkCambioDisplay').textContent = '$0';
    }
}
function getCheckoutCreditInfo(total) {
    if (chkPayMethod !== 'credito') return null;
    if (chkCreditType === 'fijo') {
        const sel = document.querySelector('#chkCreditBody select');
        const cuotas = sel ? parseInt(sel.value) : 1;
        const cuotaValor = Math.ceil(total / cuotas);
        return { tipo: 'fijo', totalCuotas: cuotas, cuotaValor, pagadas: 0, payments: [] };
    } else {
        return { tipo: 'abono', totalCuotas: 0, cuotaValor: 0, pagadas: 0, payments: [], balance: total };
    }
}
function confirmCheckout() {
    if (posCart.length === 0) { showToast('El carrito esta vacio'); return; }
    const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const excedente = parseFloat(document.getElementById('tpvExcedente').value) || 0;
    const total = subtotal + excedente;
    const methods = { cash: 'Efectivo', card: 'Tarjeta', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', bolt: 'Bolt', mixed: 'Mixto', credito: 'Credito' };
    const custId = document.getElementById('chkCustomerId').value;
    let customerName = 'Cliente mostrador';
    let customerId = '';
    if (custId) {
        const cust = posCustomers.find(c => c.id === custId);
        if (cust) { customerName = cust.name; customerId = custId; }
    }
    const creditInfo = getCheckoutCreditInfo(total);
    if (chkPayMethod === 'credito' && !creditInfo) return;
    let paymentBreakdown = null;
    let pagaCon = total;
    let cambio = 0;
    let pagaConCash = null;
    let cambioCash = null;
    if (chkPayMethod === 'mixed') {
        const nonCashSum = getNonCashSum();
        const cashBill = getCashMixedAmount();
        const cashAssigned = Math.max(0, total - nonCashSum);
        if (cashBill > 0 && cashBill < cashAssigned) {
            showToast('El billete de efectivo ($' + formatPrice(cashBill) + ') no cubre la parte de efectivo ($' + formatPrice(cashAssigned) + ')');
            return;
        }
        paymentBreakdown = getMixedBreakdown();
        const assignedTotal = paymentBreakdown.reduce((s, p) => s + p.amount, 0);
        if (assignedTotal !== total) {
            showToast('La suma de los metodos (' + formatPrice(assignedTotal) + ') debe ser igual al total (' + formatPrice(total) + ')');
            return;
        }
        if (cashBill > 0) {
            pagaConCash = cashBill;
            cambioCash = Math.max(0, cashBill - cashAssigned);
        }
    } else if (chkPayMethod === 'cash') {
        pagaCon = parseFloat(document.getElementById('chkPagaCon').value) || total;
        cambio = Math.max(0, pagaCon - total);
    }
    const sale = {
        id: posNextSaleId++,
        date: now(),
        items: posCart.map(i => {
            const p = i.isTemp ? null : posProducts.find(pr => pr.id === i.id);
            return { id: i.id, name: i.isTemp ? i.tempName : (p ? p.name : 'Producto'), qty: i.qty, price: i.price, isTemp: i.isTemp || false };
        }),
        subtotal,
        excedente,
        total,
        pagaCon,
        cambio,
        pagaConCash,
        cambioCash,
        method: methods[chkPayMethod] || 'Efectivo',
        methodKey: chkPayMethod,
        paymentBreakdown,
        customer: customerName,
        customerId,
        creditInfo,
        ventaPorFuera: false
    };
    posSales.push(sale);
    posCart.forEach(ci => {
        if (ci.isTemp) return;
        const p = posProducts.find(pr => pr.id === ci.id);
        if (p) {
            const prev = p.stock;
            p.stock = Math.max(0, p.stock - ci.qty);
            addInvLog(ci.id, p.name, 'salida', -ci.qty, prev, p.stock, 'Venta #' + sale.id, sale.id, false);
        }
    });
    saveSales();
    saveProducts();
    posCart.filter(ci => ci.isTemp).forEach(ci => {
        API.saveTempProduct({ name: ci.tempName, price: ci.price, qty: ci.qty, sale_id: sale.id }).catch(e => console.error('[POS] saveTempProduct error:', e));
    });
    clearCart();
    closeCheckoutModal();
    renderDashboard();
    renderTpv();
    renderProductTable();
    renderInventory();
    renderCustomerTable();
    renderSalesTable();
    showReceipt(sale);
    showToast('Venta #' + sale.id + ' registrada');
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
        return posSales.filter(s => s.date && s.date.slice(0,10) === todayStr);
    }
    if (_dashPeriod === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return posSales.filter(s => s.date && new Date(s.date) >= d);
    }
    return posSales;
}

function sumSales(list) {
    return { total: list.reduce((s,v) => s + v.total, 0), count: list.length, items: list.reduce((s,v) => s + v.items.reduce((a,i) => a + i.qty, 0), 0), cash: list.filter(s => s.method === 'Efectivo').reduce((s,v) => s + v.total, 0), digital: list.filter(s => s.method !== 'Efectivo' && s.method !== 'Credito').reduce((s,v) => s + v.total, 0), credit: list.filter(s => s.method === 'Credito').reduce((s,v) => s + v.total, 0) };
}

function renderDashboard() {
    const localSales = posSales.filter(s => !s.ventaPorFuera);
    const localCustomers = posCustomers.filter(c => (c.tipo || 'local') !== 'fuera');
    const isMonthHistory = _dashPeriod === 'month';
    const isAnnualHistory = _dashPeriod === 'year';
    const isHistory = isMonthHistory || isAnnualHistory;
    let periodSales = isHistory ? localSales : getPeriodSales();
    if (!isHistory) periodSales = periodSales.filter(s => !s.ventaPorFuera);
    const periodTotal = periodSales.reduce((sum, s) => sum + s.total, 0);
    const periodCount = periodSales.length;
    const pendingCredit = localSales
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
    const filteredCustomers = localCustomers;
    const totalCustomers = filteredCustomers.length;
    const salesData = sumSales(periodSales);
    const custWithDebt = filteredCustomers.filter(c => {
        const custSales = localSales.filter(s => s.customerId === c.id);
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
    const colors = {
        'Efectivo': '#4caf50', 'Nequi': '#00c853', 'Daviplata': '#f44336',
        'Tarjeta': '#2196f3', 'Transferencia': '#9c27b0', 'Bolt': '#ff6d00', 'Credito': '#ff9800'
    };
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
    const excedente = periodSales.reduce((s, v) => s + (v.excedente || 0), 0);
    document.getElementById('dashSummary').innerHTML = `
        <div class="summary-rows">
            <div class="summary-row"><span>Total facturado</span><strong>${formatPrice(total)}</strong></div>
            <div class="summary-row"><span>Unidades vendidas</span><strong>${items}</strong></div>
            <div class="summary-row"><span>Efectivo</span><strong>${formatPrice(cash)}</strong></div>
            <div class="summary-row"><span>Digital (Nequi, Davi, Tarjeta, etc)</span><strong>${formatPrice(digital)}</strong></div>
            <div class="summary-row"><span>Credito</span><strong>${formatPrice(credit)}</strong></div>
            <div class="summary-row"><span>Excedente cobrado</span><strong>${formatPrice(excedente)}</strong></div>
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
        <td><strong>#${periodSales.length - idx}</strong></td>
        <td>${formatDate(s.date)}</td>
        <td>${s.customer || 'Cliente mostrador'}</td>
        <td>${s.items.reduce((sum, i) => sum + i.qty, 0)}</td>
        <td><strong>${formatPrice(s.total)}</strong></td>
        <td><span class="tag tag-info">${s.method}</span></td>
    </tr>`).join('');
}

// ============ SALES TABLE ============
function toggleSaleItems(btn) {
    const row = btn.closest('tr');
    const itemsRow = row.nextElementSibling;
    if (itemsRow && itemsRow.classList.contains('sale-items-row')) {
        const visible = itemsRow.style.display !== 'none';
        itemsRow.style.display = visible ? 'none' : '';
        btn.textContent = visible ? '▾' : '▴';
    }
}

function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    let filtered = posSales.filter(s => !s.ventaPorFuera).reverse();
    if (q) filtered = filtered.filter((s, idx) => (idx + 1).toString().includes(q) || s.id.toString().includes(q) || (s.customer && s.customer.toLowerCase().includes(q)));
    const tbody = document.getElementById('salesTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas registradas</td></tr>';
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
            <td><strong>#${idx + 1}</strong></td>
            <td>${formatDate(s.date)}</td>
            <td>${s.customer || 'Mostrador'}</td>
            <td>${qty}</td>
            <td><strong>${formatPrice(s.total)}</strong></td>
            <td>${s.excedente ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(s.excedente) + '</span>' : '-'}</td>
            <td>${methodHtml}</td>
            <td class="actions">
                ${s.items && s.items.length > 0 ? '<button class="edit" onclick="toggleSaleItems(this)" title="Ver productos" style="color:var(--text-muted);font-size:14px;">▾</button>' : ''}
                ${s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas)) ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="' + (s.creditInfo.tipo === 'abono' ? 'Registrar Abono' : 'Registrar Pago') + '" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : ''}
                <button class="edit" onclick="openSaleEditModal(${s.id})" title="Editar venta" style="color:var(--primary);"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="edit" onclick="voidSale(${s.id})" title="Anular venta" style="color:var(--danger);"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg></button>
                <button onclick="showReceipt(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>
            </td>
        </tr>
        <tr class="sale-items-row" style="display:none;"><td colspan="8" style="padding:4px 12px 8px;background:var(--bg);font-size:12px;color:var(--text-muted);">${s.items ? s.items.map(i => '<span style="display:inline-block;margin:2px 4px;padding:2px 8px;background:#fff;border:1px solid var(--border);border-radius:6px;">' + (i.name || 'Producto').substring(0, 22) + ' x' + i.qty + ' — ' + formatPrice(i.price * i.qty) + '</span>').join('') : ''}</td></tr>`;
    }).join('');
}

// ============ RECEIPT ============
function showReceipt(sale) {
    if (typeof sale === 'string') sale = JSON.parse(sale);
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => `<div class="receipt-row"><span>${(i.name || 'Producto').substring(0,22)} x${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join('');
    const breakdownHtml = sale.paymentBreakdown ? sale.paymentBreakdown.map(p =>
        '<div class="receipt-row" style="font-size:12px;"><span style="padding-left:8px;">' + p.method + '</span><span>' + formatPrice(p.amount) + '</span></div>'
    ).join('') : '';
    let pagaHtml = sale.pagaCon && !sale.paymentBreakdown ? '<div class="receipt-row"><span>Paga con</span><span>' + formatPrice(sale.pagaCon) + '</span></div>' : '';
    let cambioHtml = sale.cambio ? '<div class="receipt-row" style="color:var(--success);font-weight:700;"><span>Cambio</span><span>' + formatPrice(sale.cambio) + '</span></div>' : '';
    if (sale.pagaConCash) {
        pagaHtml = '<div class="receipt-row"><span>Paga con (Efectivo)</span><span>' + formatPrice(sale.pagaConCash) + '</span></div>';
    }
    if (sale.cambioCash) {
        cambioHtml = '<div class="receipt-row" style="color:var(--success);font-weight:700;"><span>Cambio (Efectivo)</span><span>' + formatPrice(sale.cambioCash) + '</span></div>';
    }
    content.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <img src="Logo_Factura.png" style="max-width:180px;height:auto;margin-bottom:6px;" alt="Logo">
                <p>Santa Marta, Colombia<br>NIT: 1082954847-4</p>
                <p style="font-size:11px;margin-top:2px;">${shortDate(sale.date)}</p>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Factura #${sale.id}</span><span>${sale.method}</span></div>
            <div class="receipt-row"><span>Cliente: ${sale.customer || 'Mostrador'}</span></div>
            <div class="receipt-divider"></div>
            ${itemsHtml}
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Subtotal</span><span>${formatPrice(sale.subtotal)}</span></div>
            ${sale.excedente ? '<div class="receipt-row"><span>Excedente</span><span>' + formatPrice(sale.excedente) + '</span></div>' : ''}
            ${sale.creditInfo ? (sale.creditInfo.tipo === 'abono' ? '<div class="receipt-row"><span>Cuenta de cobro</span><span>' + formatPrice(sale.creditInfo.balance) + '</span></div>' : '<div class="receipt-row"><span>Cuotas</span><span>' + sale.creditInfo.pagadas + '/' + sale.creditInfo.totalCuotas + '</span></div>') : ''}
            <div class="receipt-total"><span>TOTAL</span><span>${formatPrice(sale.total)}</span></div>
            ${sale.paymentBreakdown ? '<div class="receipt-divider"></div><div class="receipt-row" style="font-size:12px;color:var(--text-muted);"><span>Desglose de pago</span></div>' + breakdownHtml : ''}
            ${pagaHtml}
            ${cambioHtml}
            <div class="receipt-footer">
                <p>Gracias por su compra!</p>
                <p>tel: 313 6196312</p>
            </div>
        </div>
    `;
    document.getElementById('receiptModal').classList.add('open');
    document.getElementById('btnDownloadInv').style.display = 'none';
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('open');
}

function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    if (content.includes('invoice-print')) {
        printInvoice();
        return;
    }
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

function printInvoice() {
    const area = document.getElementById('invoicePrintArea');
    if (!area) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write('<html><head><title>Factura</title><style>' +
        'body{font-family:Arial,sans-serif;margin:20px;color:#333;font-size:13px;}' +
        'h3{margin:0;font-size:18px;}' +
        '.inv-header{display:flex;gap:20px;align-items:flex-start;border-bottom:3px solid #2e7d32;padding-bottom:16px;margin-bottom:16px;}' +
        '.inv-logo img{height:60px;border-radius:8px;}' +
        '.inv-business{flex:1;}' +
        '.inv-business p{margin:4px 0 0;font-size:12px;color:#666;}' +
        '.inv-doc-info{text-align:right;}' +
        '.inv-doc-type{background:#2e7d32;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:1px;}' +
        '.inv-doc-num{font-size:16px;font-weight:700;margin-top:6px;}' +
        '.inv-doc-date{font-size:12px;color:#666;}' +
        '.inv-status{text-align:center;padding:10px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:16px;}' +
        '.inv-status-paid{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;}' +
        '.inv-status-pending{background:#fffbe6;color:#92400e;border:1px solid #fde68a;}' +
        '.inv-section{margin-bottom:16px;}' +
        '.inv-section-title{font-size:11px;font-weight:700;color:#666;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb;}' +
        '.inv-customer-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;}' +
        '.inv-customer-grid span{color:#666;}' +
        '.inv-table{width:100%;border-collapse:collapse;font-size:12px;}' +
        '.inv-table th{background:#f9fafb;padding:8px;text-align:left;font-size:11px;color:#666;border-bottom:2px solid #e5e7eb;}' +
        '.inv-table td{padding:7px 8px;border-bottom:1px solid #f3f4f6;}' +
        '.inv-total-row td{font-weight:700;font-size:14px;border-top:2px solid #333;border-bottom:none;padding-top:10px;}' +
        '.inv-summary-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}' +
        '.inv-summary-box{padding:12px;border-radius:8px;text-align:center;}' +
        '.inv-summary-label{font-size:11px;color:#666;margin-bottom:4px;}' +
        '.inv-summary-val{font-size:18px;font-weight:700;}' +
        '.inv-total-box{background:#f3f4f6;}' +
        '.inv-paid-box{background:#f0fdf4;}.inv-paid-box .inv-summary-val{color:#166534;}' +
        '.inv-pending-box{background:#fffbe6;}.inv-pending-box .inv-summary-val{color:#92400e;}' +
        '.inv-progress-wrap{margin-top:8px;text-align:center;}' +
        '.inv-progress-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;}' +
        '.inv-progress-fill{height:100%;background:#2e7d32;border-radius:5px;transition:width 0.5s;}' +
        '.inv-progress-text{font-size:12px;color:#666;margin-top:4px;}' +
        '.inv-payments-table thead th{background:#f0fdf4;}' +
        '.inv-paid-row td{font-weight:700;border-top:2px solid #2e7d32;color:#166534;}' +
        '.inv-pending-foot-row td{font-weight:700;color:#92400e;}' +
        '.inv-footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;}' +
        '</style></head><body>' + area.innerHTML + '</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
}

function downloadInvoice() {
    const area = document.getElementById('invoicePrintArea');
    if (!area) return;
    const saleId = area.querySelector('.inv-doc-num') ? area.querySelector('.inv-doc-num').textContent.replace(/\D/g,'') : 'doc';
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write('<html><head><title>Factura #' + saleId + '</title><style>' +
        '@page{size:letter;margin:15mm;}' +
        'body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
        'h3{margin:0;font-size:18px;}' +
        '.inv-header{display:flex;gap:20px;align-items:flex-start;border-bottom:3px solid #2e7d32;padding-bottom:16px;margin-bottom:16px;}' +
        '.inv-logo img{height:60px;border-radius:8px;}' +
        '.inv-business{flex:1;}' +
        '.inv-business p{margin:4px 0 0;font-size:12px;color:#666;}' +
        '.inv-doc-info{text-align:right;}' +
        '.inv-doc-type{background:#2e7d32;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:1px;}' +
        '.inv-doc-num{font-size:16px;font-weight:700;margin-top:6px;}' +
        '.inv-doc-date{font-size:12px;color:#666;}' +
        '.inv-status{text-align:center;padding:10px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:16px;}' +
        '.inv-status-paid{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;}' +
        '.inv-status-pending{background:#fffbe6;color:#92400e;border:1px solid #fde68a;}' +
        '.inv-section{margin-bottom:16px;}' +
        '.inv-section-title{font-size:11px;font-weight:700;color:#666;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb;}' +
        '.inv-customer-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;}' +
        '.inv-customer-grid span{color:#666;}' +
        '.inv-table{width:100%;border-collapse:collapse;font-size:12px;}' +
        '.inv-table th{background:#f9fafb;padding:8px;text-align:left;font-size:11px;color:#666;border-bottom:2px solid #e5e7eb;}' +
        '.inv-table td{padding:7px 8px;border-bottom:1px solid #f3f4f6;}' +
        '.inv-total-row td{font-weight:700;font-size:14px;border-top:2px solid #333;border-bottom:none;padding-top:10px;}' +
        '.inv-summary-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}' +
        '.inv-summary-box{padding:12px;border-radius:8px;text-align:center;}' +
        '.inv-summary-label{font-size:11px;color:#666;margin-bottom:4px;}' +
        '.inv-summary-val{font-size:18px;font-weight:700;}' +
        '.inv-total-box{background:#f3f4f6;}' +
        '.inv-paid-box{background:#f0fdf4;}.inv-paid-box .inv-summary-val{color:#166534;}' +
        '.inv-pending-box{background:#fffbe6;}.inv-pending-box .inv-summary-val{color:#92400e;}' +
        '.inv-progress-wrap{margin-top:8px;text-align:center;}' +
        '.inv-progress-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;}' +
        '.inv-progress-fill{height:100%;background:#2e7d32;border-radius:5px;}' +
        '.inv-progress-text{font-size:12px;color:#666;margin-top:4px;}' +
        '.inv-payments-table thead th{background:#f0fdf4;}' +
        '.inv-paid-row td{font-weight:700;border-top:2px solid #2e7d32;color:#166534;}' +
        '.inv-pending-foot-row td{font-weight:700;color:#92400e;}' +
        '.inv-footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;}' +
        '</style></head><body>' + area.innerHTML + '</body></html>');
    win.document.close();
    setTimeout(() => {
        win.print();
        showToast('Selecciona "Guardar como PDF" en el dialogo de impresion');
    }, 400);
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
    if (pending <= 0) { showToast('Esta venta ya esta pagada'); return; }
    let html = '<div style="margin-bottom:14px;font-size:13px;">';
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Factura #' + saleId + '</span><span>' + formatPrice(sale.total) + '</span></div>';
    if (sale.items && sale.items.length > 0) {
        html += '<details style="margin:6px 0;"><summary style="cursor:pointer;font-size:11px;color:var(--text-muted);user-select:none;list-style:none;">▸ Productos</summary><div style="padding:4px 0;font-size:12px;color:var(--text-muted);">' + sale.items.map(i => (i.name || 'Producto').substring(0, 20) + ' x' + i.qty + ' — ' + formatPrice(i.price * i.qty)).join('<br>') + '</div></details>';
    }
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
    if (!saleId) { showToast('Error: venta no identificada'); return; }
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
        API.addPayment(sale.apiId || saleId, Math.round(amount), 'Pago registrado desde POS').catch(e => { console.error('[POS] addPayment error:', e); });
    }
    closePaymentModal();
    refreshCustHistory();
    renderCustomerTable();
    renderDashboard();
    showToast('Pago registrado con exito');
}


// ============ CAJA / CASH MANAGEMENT ============
function cashDateStr() { return cashDate || today(); }

function loadCashLocal() {
    try {
        const d = cashDateStr();
        cashBase = parseFloat(localStorage.getItem('cashBase_' + d)) || 0;
        cashExpenses = JSON.parse(localStorage.getItem('cashExpenses_' + d)) || [];
    } catch(e) { cashBase = 0; cashExpenses = []; }
}

function saveCashLocal() {
    const d = cashDateStr();
    localStorage.setItem('cashBase_' + d, cashBase);
    localStorage.setItem('cashExpenses_' + d, JSON.stringify(cashExpenses));
}

function totalExpenses() { return cashExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0); }
function availableCash() { return (parseFloat(cashBase) || 0) - totalExpenses(); }

async function syncCashFromApi() {
    try {
        const apiCashBase = await API.getCashBase(cashDateStr());
        if (apiCashBase !== null && apiCashBase !== undefined) {
            cashBase = parseFloat(apiCashBase.base_amount) || 0;
        }
        const apiExpenses = await API.getExpenses(cashDateStr());
        if (apiExpenses && apiExpenses.length > 0) {
            const apiMap = {};
            apiExpenses.forEach(e => { apiMap[e.id] = e; });
            const localKeys = new Set(cashExpenses.map(e => e._apiId));
            const localContentKeys = new Set(cashExpenses.map(e => e.description + '|' + e.amount + '|' + e.date));
            cashExpenses = cashExpenses.filter(e => !e._apiId || apiMap[e._apiId]);
            apiExpenses.forEach(e => {
                if (!localKeys.has(e.id) && !localContentKeys.has(e.description + '|' + parseFloat(e.amount) + '|' + e.date)) {
                    cashExpenses.push({
                        _apiId: e.id,
                        description: e.description,
                        amount: parseFloat(e.amount),
                        category: e.category,
                        date: e.date
                    });
                }
            });
        }
        saveCashLocal();
    } catch(e) {
        console.warn('[Caja] No se pudo sincronizar desde Supabase');
    }
}


function renderCashPanel() {
    loadCashLocal();
    document.getElementById('cashDateLabel').textContent = 'Fecha: ' + cashDateStr();
    document.getElementById('cashBaseDisplay').textContent = '$' + (parseFloat(cashBase) || 0).toLocaleString('es-CO');
    document.getElementById('cashExpensesDisplay').textContent = '$' + totalExpenses().toLocaleString('es-CO');
    document.getElementById('cashAvailableDisplay').textContent = '$' + availableCash().toLocaleString('es-CO');
    const baseCard = document.querySelector('#panel-cash .card:nth-child(2)');
    if (baseCard) baseCard.style.display = currentUser?.role === 'admin' ? '' : 'none';
    const tbody = document.getElementById('cashExpensesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (cashExpenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No hay gastos registrados hoy</td></tr>';
    } else {
        const catLabels = { suministros:'Suministros', servicios:'Servicios', transporte:'Transporte', otros:'Otros' };
        cashExpenses.forEach((e, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + e.description + '</td><td>' + (catLabels[e.category] || e.category) + '</td><td>$' + (parseFloat(e.amount)||0).toLocaleString('es-CO') + '</td><td><button class="btn btn-danger" style="padding:4px 12px;font-size:12px;" onclick="deleteExpense(' + i + ')">Eliminar</button></td>';
            tbody.appendChild(tr);
        });
    }
    syncCashFromApi().then(() => {
        document.getElementById('cashBaseDisplay').textContent = '$' + (parseFloat(cashBase) || 0).toLocaleString('es-CO');
        document.getElementById('cashExpensesDisplay').textContent = '$' + totalExpenses().toLocaleString('es-CO');
        document.getElementById('cashAvailableDisplay').textContent = '$' + availableCash().toLocaleString('es-CO');
        tbody.innerHTML = '';
        if (cashExpenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No hay gastos registrados hoy</td></tr>';
        } else {
            const catLabels = { suministros:'Suministros', servicios:'Servicios', transporte:'Transporte', otros:'Otros' };
            cashExpenses.forEach((e, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td>' + e.description + '</td><td>' + (catLabels[e.category] || e.category) + '</td><td>$' + (parseFloat(e.amount)||0).toLocaleString('es-CO') + '</td><td><button class="btn btn-danger" style="padding:4px 12px;font-size:12px;" onclick="deleteExpense(' + i + ')">Eliminar</button></td>';
                tbody.appendChild(tr);
            });
        }
    });
}

function showCashSubTab(tab) {
    document.querySelectorAll('.cash-subtab').forEach(el => {
        el.style.color = 'var(--text-muted)';
        el.style.borderBottomColor = 'transparent';
    });
    document.querySelector('.cash-subtab[data-cash-tab="' + tab + '"]').style.color = 'var(--text)';
    document.querySelector('.cash-subtab[data-cash-tab="' + tab + '"]').style.borderBottomColor = 'var(--primary)';
    document.getElementById('cash-sub-main').style.display = tab === 'main' ? '' : 'none';
    document.getElementById('cash-sub-history').style.display = tab === 'history' ? '' : 'none';
    if (tab === 'history') renderCashHistory();
}

function setCashBase() {
    if (currentUser && currentUser.role === 'empleado') { showToast('Solo el administrador puede establecer la base'); return; }
    const inp = document.getElementById('cashBaseInput');
    const val = parseFloat(inp.value);
    if (isNaN(val) || val < 0) { showToast('Ingrese un valor valido'); return; }
    cashBase = val;
    saveCashLocal();
    inp.value = '';
    addCashHistoryEntry('base', 'Base de caja establecida', val);
    renderCashPanel();
    showToast('Base de caja actualizada: $' + val.toLocaleString('es-CO'));
    API.saveCashBase(cashDateStr(), cashBase).then(() => {}).catch(() => {});
}

function addExpense() {
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const cat = document.getElementById('expenseCat').value;
    if (!desc) { showToast('Ingrese una descripcion'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Ingrese un valor valido'); return; }
    API.saveExpense({ date: cashDateStr(), description: desc, amount: amount, category: cat }).then(synced => {
        const exp = { description: desc, amount: amount, category: cat, date: cashDateStr() };
        if (synced && synced.id) exp._apiId = synced.id;
        cashExpenses.push(exp);
        saveCashLocal();
        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmount').value = '';
        addCashHistoryEntry('expense', desc, amount);
        renderCashPanel();
        showToast('Gasto registrado: $' + amount.toLocaleString('es-CO'));
    }).catch(() => {
        const exp = { description: desc, amount: amount, category: cat, date: cashDateStr() };
        cashExpenses.push(exp);
        saveCashLocal();
        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmount').value = '';
        addCashHistoryEntry('expense', desc, amount);
        renderCashPanel();
        showToast('Gasto guardado localmente (sync a nube fallo)');
    });
}

function deleteExpense(idx) {
    const e = cashExpenses[idx];
    if (!e) return;
    if (!confirm('Eliminar gasto "' + e.description + '" por $' + (parseFloat(e.amount)||0).toLocaleString('es-CO') + '?')) return;
    const apiId = e._apiId;
    cashExpenses.splice(idx, 1);
    saveCashLocal();
    renderCashPanel();
    if (apiId) API.deleteExpense(apiId).catch(() => {});
    showToast('Gasto eliminado');
}

// ============ LOCAL OVERRIDE (inventory log uses shared scope filter) ============
// renderInvLog inherited from pos-shared.js with POS_SCOPE = 'local'

// ============ ESTADO DE CUENTAS (local only) ============
function renderAccountStatus() {
    const tbody = document.getElementById('cuentasTableBody');
    if (!tbody) return;
    const q = (document.getElementById('cuentasSearch')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('cuentasFilter')?.value || 'todo';
    let customers = filterCustomersByScope(posCustomers);
    if (q) customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (filter === 'deuda') customers = customers.filter(c => getCustomerPending(c.id) > 0);
    else if (filter === 'aldia') customers = customers.filter(c => getCustomerPending(c.id) <= 0);
    customers.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = customers.map(c => {
        const sales = filterSalesByScope(posSales.filter(s => s.customerId === c.id && !s.creditInfo?.merged));
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
                '<button class="btn btn-sm btn-outline" onclick="deleteCustomer(\'' + c.id + '\')" title="Eliminar" style="margin-left:4px;color:var(--danger);">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" fill="var(--danger)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
                '</button>' +
                '<button class="btn btn-sm btn-outline" onclick="openAccountEditModal(\'' + c.id + '\')" title="Editar" style="margin-left:4px;color:var(--primary);">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" fill="var(--primary)"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
                '</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

// ============ COMPRA ANTIGUA ============
function openOldPurchaseModal() {
    document.getElementById('oldPurchaseDate').value = new Date().toISOString().split('T')[0];
    const sel = document.getElementById('oldPurchaseCustomer');
    sel.innerHTML = '<option value="">Seleccionar cliente existente...</option>' + filterCustomersByScope(posCustomers).map(c => '<option value="' + c.id + '">' + c.name + (c.phone ? ' - ' + c.phone : '') + '</option>').join('');
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
    const matches = posProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
    if (matches.length === 0) { results.style.display = 'none'; return; }
    results.innerHTML = matches.map(p => '<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;" onmouseover="this.style.background=\'var(--hover)\'" onmouseout="this.style.background=\'\'" onclick="selectOldPurchaseProduct(\'' + p.id + '\',\'' + p.name.replace(/'/g, "\\'") + '\',' + p.price + ')">' + p.name + ' — <strong>$' + p.price.toLocaleString() + '</strong></div>').join('');
    results.style.display = 'block';
}

function selectOldPurchaseProduct(id, name, price) {
    const container = document.getElementById('oldPurchaseProducts');
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'old-prod-row';
    row.dataset.prodId = id;
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    row.innerHTML = '<input type="text" class="old-prod-name" value="' + name + '" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;" readonly>' +
        '<input type="number" class="old-prod-qty" value="1" min="1" style="width:50px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" onchange="updateOldPurchaseTotal()">' +
        '<input type="number" class="old-prod-price" value="' + price + '" min="0" style="width:90px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;" onchange="updateOldPurchaseTotal()">' +
        '<button class="btn btn-sm btn-outline" onclick="removeOldProductRow(this)" style="padding:4px 8px;font-size:16px;line-height:1;">&times;</button>';
    container.appendChild(row);
    document.getElementById('oldPurchaseProdSearch').value = '';
    document.getElementById('oldPurchaseProdResults').style.display = 'none';
    updateOldPurchaseTotal();
}

function addOldProductRow() {
    const container = document.getElementById('oldPurchaseProducts');
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'old-prod-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    row.innerHTML = '<input type="text" class="old-prod-name" placeholder="Nombre del producto" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;">' +
        '<input type="number" class="old-prod-qty" value="1" min="1" style="width:50px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" onchange="updateOldPurchaseTotal()">' +
        '<input type="number" class="old-prod-price" value="0" min="0" style="width:90px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;" onchange="updateOldPurchaseTotal()">' +
        '<button class="btn btn-sm btn-outline" onclick="removeOldProductRow(this)" style="padding:4px 8px;font-size:16px;line-height:1;">&times;</button>';
    container.appendChild(row);
}

function removeOldProductRow(btn) {
    btn.closest('.old-prod-row').remove();
    updateOldPurchaseTotal();
}

function updateOldPurchaseTotal() {
    const rows = document.querySelectorAll('.old-prod-row');
    let total = 0;
    rows.forEach(r => {
        const qty = parseFloat(r.querySelector('.old-prod-qty')?.value) || 1;
        const price = parseFloat(r.querySelector('.old-prod-price').value) || 0;
        total += qty * price;
    });
    document.getElementById('oldPurchaseTotal').textContent = formatPrice(total);
}

function onOldPurchaseStatusChange() {
    const status = document.getElementById('oldPurchaseStatus').value;
    document.getElementById('oldPurchasePaidGroup').style.display = status === 'abono' ? '' : 'none';
    if (status === 'abono') {
        const existing = document.getElementById('oldPurchaseTotal').textContent.replace(/[^0-9]/g, '');
        document.getElementById('oldPurchasePaid').value = Math.round(parseInt(existing) / 2);
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
                const data = await API.saveCustomer({ name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'local' });
                customerId = data && data.id ? 'c' + data.id : 'c' + Date.now();
                posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'local', created_at: dateVal + 'T00:00:00', _synced: true });
                localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            } catch(e) {
                console.error('[POS-LOCAL] saveCustomer error:', e);
                customerId = 'c' + Date.now();
                posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'local', created_at: dateVal + 'T00:00:00' });
                localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            }
        } else {
            customerId = 'c' + Date.now();
            posCustomers.push({ id: customerId, name: newName, phone: document.getElementById('oldPurchaseNewPhone').value.trim(), email: '', address: document.getElementById('oldPurchaseNewAddress').value.trim(), tipo: 'local', created_at: dateVal + 'T00:00:00' });
            localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
        }
    }
    if (!customerId) { _savingOldPurchase = false; document.querySelector('#oldPurchaseModal .btn-primary').disabled = false; showToast('Selecciona un cliente existente o crea uno nuevo'); return; }
    const productRows = document.querySelectorAll('.old-prod-row');
    const items = [];
    productRows.forEach(row => {
        const name = row.querySelector('.old-prod-name').value.trim();
        const price = parseFloat(row.querySelector('.old-prod-price').value) || 0;
        const qty = parseInt(row.querySelector('.old-prod-qty')?.value) || 1;
        const prodId = row.dataset.prodId || '';
        if (name && price > 0) items.push({ id: prodId || 'old-' + Date.now() + '-' + items.length, name: name, qty: qty, price: price, isTemp: !prodId });
    });
    if (items.length === 0) { _savingOldPurchase = false; document.querySelector('#oldPurchaseModal .btn-primary').disabled = false; showToast('Agrega al menos un producto con nombre y precio'); return; }
    const total = items.reduce((s, i) => s + (i.price * i.qty), 0);
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
        ventaPorFuera: false,
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
POS_PANEL_RENDERERS['tpv'] = renderTpv;
POS_PANEL_RENDERERS['products'] = renderProductTable;
POS_PANEL_RENDERERS['inventory'] = renderInventory;
POS_PANEL_RENDERERS['customers'] = renderCustomerTable;
POS_PANEL_RENDERERS['suppliers'] = renderSupplierTable;
POS_PANEL_RENDERERS['categories'] = renderCategoriesTable;
POS_PANEL_RENDERERS['sales'] = renderSalesTable;
POS_PANEL_RENDERERS['cuentas'] = renderAccountStatus;
POS_PANEL_RENDERERS['cash'] = renderCashPanel;
POS_PANEL_RENDERERS['labOrders'] = renderLabOrders;

function initPOS() {
    (async function() {
        console.log('[POS-LOCAL] initPOS iniciando...');
        const available = await API.check();
        if (available) {
            await syncFromApi();
        } else {
            loadData();
        }
        initCatFilter();
        migrateProductSubcats();
        applyPosScopeUI();
        renderDashboard();
        renderTpv();
        setupBarcodeScan();
        renderProductTable();
        renderInventory();
        renderCustomerTable();
        renderSupplierTable();
        renderCategoriesTable();
        renderSalesTable();
        buildMobileMenu();
    })();
}

checkSession();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
