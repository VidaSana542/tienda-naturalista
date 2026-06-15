// ============ LOGIN ============
const POS_USERS = [
    { user: 'admin', pass: 'admin123', role: 'admin', name: 'Administrador' },
    { user: 'empleado', pass: 'emp123', role: 'empleado', name: 'Empleado' }
];
let currentUser = null;

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const found = POS_USERS.find(u => u.user === user && u.pass === pass);
    if (!found) {
        document.getElementById('loginError').textContent = 'Usuario o contrasena incorrectos';
        document.getElementById('loginError').style.display = 'block';
        return false;
    }
    currentUser = found;
    localStorage.setItem('posCurrentUser', JSON.stringify(currentUser));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('posApp').style.display = '';
    applyRole();
    initPOS();
    return false;
}

function logout() {
    localStorage.removeItem('posCurrentUser');
    currentUser = null;
    document.getElementById('posApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = '';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
}

function applyRole() {
    if (!currentUser) return;
    document.querySelector('.user-name').textContent = currentUser.name;
    document.querySelector('.user-role').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Empleado';
    document.querySelector('.avatar').textContent = currentUser.name.charAt(0);
    document.querySelectorAll('.nav-item[data-role]').forEach(el => {
        el.style.display = currentUser.role === 'admin' ? '' : 'none';
    });
    document.querySelectorAll('#invActions [data-role]').forEach(el => {
        el.style.display = currentUser.role === 'admin' ? '' : 'none';
    });
    const btnNewCustomer = document.getElementById('btnNewCustomer');
    if (btnNewCustomer) btnNewCustomer.style.display = currentUser.role === 'admin' ? '' : 'none';
}

function checkSession() {
    const saved = localStorage.getItem('posCurrentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('posApp').style.display = '';
            applyRole();
            initPOS();
            if (localStorage.getItem('posSidebarCollapsed') === 'true') {
                document.querySelector('.sidebar').classList.add('collapsed');
            }
            return true;
        } catch(e) {}
    }
    return false;
}

// ============ CATEGORIES ============
function loadCategories() {
    const saved = localStorage.getItem('posCategories');
    if (saved) { try { return JSON.parse(saved); } catch(e) {} }
    return [];
}
let POS_CATEGORIES = loadCategories();
function saveCategories() {
    localStorage.setItem('posCategories', JSON.stringify(POS_CATEGORIES));
    if (API.isAvailable) {
        POS_CATEGORIES.forEach(c => {
            if (c._synced) return;
            const apiId = c.id || null;
            API.saveCategory({ id: apiId, key: c.key, label: c.label, parent_key: c.parent_key || null }).then(res => {
                if (!c.id && res && res.id) c.id = res.id;
                c._synced = true;
                localStorage.setItem('posCategories', JSON.stringify(POS_CATEGORIES));
            }).catch(e => { console.error('[POS] saveCategory error:', e); });
        });
    }
}
function addCategory(key, label, parent_key) {
    if (!key || !label || POS_CATEGORIES.find(c => c.key === key)) return false;
    POS_CATEGORIES.push({ key, label, parent_key: parent_key || null, _synced: false });
    saveCategories();
    return true;
}
function getTopLevelCats() {
    return POS_CATEGORIES.filter(c => !c.parent_key);
}
function getSubCats(parentKey) {
    return POS_CATEGORIES.filter(c => c.parent_key === parentKey);
}
function getCatLabel(key) {
    const c = POS_CATEGORIES.find(cat => cat.key === key);
    if (!c) return key;
    if (c.parent_key) {
        const p = POS_CATEGORIES.find(cat => cat.key === c.parent_key);
        return (p ? p.label + ' / ' : '') + c.label;
    }
    return c.label;
}
function openCategoryModal(key, asSub) {
    const modal = document.getElementById('categoryModal');
    if (!modal) return;
    document.getElementById('catEditKey').value = key || '';
    const c = key ? POS_CATEGORIES.find(cat => cat.key === key) : null;
    const isSub = c ? !!c.parent_key : !!asSub;
    document.getElementById('catModalTitle').textContent = key ? (isSub ? 'Editar Subcategoria' : 'Editar Categoria') : (asSub ? 'Nueva Subcategoria' : 'Nueva Categoria');
    document.getElementById('catNameInput').value = c ? c.label : '';
    document.getElementById('catNameLabel').textContent = isSub ? 'Nombre de la subcategoria' : 'Nombre de la categoria';
    document.getElementById('catParentLabel').textContent = 'Categoria padre';
    const parentSel = document.getElementById('catParentSelect');
    const editingSelf = c && !isSub ? c.key : null;
    parentSel.innerHTML = '<option value="">' + (isSub ? 'Selecciona una categoria' : 'Ninguna (categoria principal)') + '</option>' +
        POS_CATEGORIES.filter(t => !t.parent_key && t.key !== editingSelf).map(t => `<option value="${t.key}">${t.label}</option>`).join('');
    parentSel.value = c && c.parent_key ? c.parent_key : '';
    document.getElementById('catParentGroup').style.display = isSub ? '' : 'none';
    modal.classList.add('open');
    setTimeout(() => document.getElementById('catNameInput').focus(), 100);
}
function saveCategoryModal() {
    const key = document.getElementById('catEditKey').value;
    const nameInput = document.getElementById('catNameInput');
    const label = nameInput.value.trim();
    const parentKey = document.getElementById('catParentSelect').value || null;
    if (!label) { showToast('Ingresa un nombre para la categoria'); nameInput.focus(); return; }
    if (key) {
        const c = POS_CATEGORIES.find(cat => cat.key === key);
        if (!c) return;
        c.label = label;
        if (c.parent_key !== parentKey) {
            const hasSubs = getSubCats(key).length > 0;
            if (hasSubs && parentKey) { showToast('No puedes mover una categoria que tiene subcategorias'); return; }
        }
        c.parent_key = parentKey;
        c._synced = false;
        saveCategories();
        refreshCategorySelect();
        refreshProdCatFilter();
        if (typeof _invStockCatInit !== 'undefined') _invStockCatInit = false;
        if (typeof _invLogCatInit !== 'undefined') _invLogCatInit = false;
        if (typeof renderInventory === 'function') renderInventory();
        if (typeof renderCategoriesTable === 'function') renderCategoriesTable();
        showToast((parentKey ? 'Subcategoria' : 'Categoria') + ' actualizada');
    } else {
        let newKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (!newKey) { showToast('Nombre invalido'); return; }
        if (parentKey) newKey = parentKey + '_' + newKey;
        if (POS_CATEGORIES.find(c => c.key === newKey)) { showToast('Ya existe ' + (parentKey ? 'una subcategoria' : 'una categoria') + ' con ese nombre'); return; }
        if (document.getElementById('catParentGroup').style.display !== 'none' && !parentKey) { showToast('Selecciona la categoria padre'); return; }
        if (parentKey && POS_CATEGORIES.find(c => c.key === parentKey && c.parent_key)) { showToast('No puedes crear subcategorias de una subcategoria'); return; }
        addCategory(newKey, label, parentKey);
        refreshCategorySelect();
        refreshProdCatFilter();
        if (typeof _invStockCatInit !== 'undefined') _invStockCatInit = false;
        if (typeof _invLogCatInit !== 'undefined') _invLogCatInit = false;
        if (typeof renderInventory === 'function') renderInventory();
        if (typeof renderCategoriesTable === 'function') renderCategoriesTable();
        showToast((parentKey ? 'Subcategoria' : 'Categoria') + ' creada');
    }
    closeCategoryModal();
}
function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('open');
}
function catOptsHtml() {
    return getTopLevelCats().map(c => `<option value="${c.key}">${c.label}</option>`).join('');
}
function refreshCategorySelect() {
    const sel = document.getElementById('prodCategory');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = catOptsHtml();
    if (POS_CATEGORIES.find(c => c.key === current)) sel.value = current;
}
function refreshProdCatFilter() {
    const sel = document.getElementById('prodCatFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">Todas las categorias</option>' + catOptsHtml();
    if (POS_CATEGORIES.find(c => c.key === current)) sel.value = current;
}

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=200&q=80';

// ============ STATE ============
let posProducts = [];
let posSales = [];
let posCustomers = [];
let posSuppliers = [];
let posCart = [];
let invLog = [];
let invNextLogId = 1;

let posNextProductId = 1;
let posNextCustomerId = 1;
let posNextSupplierId = 1;
let posNextSaleId = 1;

let cashBase = 0;
let cashExpenses = [];
let cashDate = today();

function loadData() {
    try {
        posProducts = JSON.parse(localStorage.getItem('posProducts')) || null;
        posSales = JSON.parse(localStorage.getItem('posSales')) || [];
        posCustomers = JSON.parse(localStorage.getItem('posCustomers')) || [];
        posCart = JSON.parse(localStorage.getItem('posCart')) || [];
        invLog = JSON.parse(localStorage.getItem('invLog')) || [];
        posSuppliers = JSON.parse(localStorage.getItem('posSuppliers')) || [];
        const savedCats = JSON.parse(localStorage.getItem('posCategories'));
        if (savedCats && savedCats.length > 0) POS_CATEGORIES = savedCats;
    } catch(e) {}
    if (!posProducts) {
        posProducts = [];
        posNextProductId = 1;
    } else {
        posNextProductId = posProducts.reduce((m, p) => Math.max(m, parseInt(p.id.replace('p',''))), 0) + 1;
    }
    if (posCustomers.length > 0) {
        posNextCustomerId = posCustomers.reduce((m, c) => Math.max(m, parseInt(c.id.replace(/^c/i,''))), 0) + 1;
    }
    if (posSales.length > 0) {
        posNextSaleId = posSales.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    }
    if (invLog.length > 0) {
        invNextLogId = invLog.reduce((m, l) => Math.max(m, l.id), 0) + 1;
    }
    if (posSuppliers.length > 0) {
        posNextSupplierId = posSuppliers.reduce((m, s) => Math.max(m, parseInt(s.id.replace('s',''))), 0) + 1;
    }
    migrateProductSubcats();
    if (typeof loadCashLocal === 'function') loadCashLocal();
}
function migrateProductSubcats() {
    let changed = false;
    const allSubKeys = POS_CATEGORIES.filter(c => c.parent_key).map(c => c.key);
    posProducts.forEach(p => {
        if (!p.subcategory) return;
        if (allSubKeys.includes(p.subcategory)) return;
        const newKey = (p.category || '') + '_' + p.subcategory;
        if (allSubKeys.includes(newKey)) {
            p.subcategory = newKey;
            changed = true;
        }
    });
    if (changed) saveProducts();
}

function saveProducts() {
    localStorage.setItem('posProducts', JSON.stringify(posProducts));
    if (API.isAvailable) {
        posProducts.forEach(p => {
            const apiId = p.id && p.id.startsWith('p') ? parseInt(p.id.replace('p','')) : null;
            if (apiId === null) return;
            const payload = {
                id: apiId,
                name: p.name, barcode: p.barcode || '', brand: p.brand || '', category: p.category,
                price: p.price, cost: p.cost || 0, stock: p.stock,
                img: p.img || '', images: p.images || [],
                description: p.desc || '',
                featured: p.featured || false
            };
            if (p.subcategory) payload.subcategory = p.subcategory;
            API.saveProduct(payload).then(res => {
                if (res && res.id) { p.id = 'p' + res.id; p._synced = true; localStorage.setItem('posProducts', JSON.stringify(posProducts)); }
            }).catch(e => { console.error('[POS] saveProduct error:', e); });
        });
    }
}
function saveSales() {
    localStorage.setItem('posSales', JSON.stringify(posSales));
    if (API.isAvailable) {
        const unsynced = posSales.filter(s => s.id && !s.apiSynced);
        unsynced.forEach(s => {
                API.saveSale({
                    customer_id: s.customerId ? parseInt(s.customerId.replace(/^c/i,'')) : null,
                    customer_name: s.customer,
                    total: s.total,
                    excedente: s.excedente,
                    method: s.method,
                    method_key: s.methodKey,
                    date: s.date || null,
                    created_at: s.created_at || null,
                    venta_por_fuera: s.ventaPorFuera || false,
                    credit_info: s.creditInfo || null,
                    items: s.items || []
                }).then(res => { if (res && res.id) { s.apiSynced = true; s.id = res.id; posNextSaleId = Math.max(posNextSaleId, res.id + 1); localStorage.setItem('posSales', JSON.stringify(posSales)); } }).catch(e => { console.error('[POS] saveSale error:', e); });
            });
    }
}
function saveCustomers() {
    localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
    if (API.isAvailable) {
        posCustomers.forEach(c => {
            const apiId = c.id && /^c/i.test(c.id) ? parseInt(c.id.replace(/^c/i,'')) : null;
            if (apiId === null) return;
            const payload = { name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', tipo: c.tipo || 'local' };
            if (c._synced === false) {
                API.saveCustomer(payload).then(res => {
                    if (res && res.id) { c.id = 'c' + res.id; c._synced = true; localStorage.setItem('posCustomers', JSON.stringify(posCustomers)); }
                }).catch(e => { console.error('[POS] saveCustomer(insert) error:', e); });
            } else {
                payload.id = apiId;
                API.saveCustomer(payload).catch(e => { console.error('[POS] saveCustomer(update) error:', e); });
            }
        });
    }
}
function saveSuppliers() {
    localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers));
    if (API.isAvailable) {
        posSuppliers.forEach(s => {
            const apiId = s.id && s.id.startsWith('s') ? parseInt(s.id.replace('s','')) : null;
            if (apiId === null) return;
            const payload = { name: s.name, nit: s.nit || '', contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '' };
            if (s._synced === false) {
                API.saveSupplier(payload).then(res => {
                    if (res && res.id) { s.id = 's' + res.id; s._synced = true; localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers)); }
                }).catch(e => { console.error('[POS] saveSupplier(insert) error:', e); });
            } else {
                payload.id = apiId;
                API.saveSupplier(payload).catch(e => { console.error('[POS] saveSupplier(update) error:', e); });
            }
        });
    }
}
async function syncFromApi() {
    try {
        const apiProducts = await API.getProducts();
        if (apiProducts && apiProducts.length > 0) {
            const apiMap = {};
            apiProducts.forEach(p => { apiMap['p' + p.id] = p; });
            posProducts.forEach(lp => {
                const ap = apiMap[lp.id];
                if (ap) {
                    lp.subcategory = ap.subcategory || '';
                    lp.name = ap.name;
                    lp.price = parseFloat(ap.price) || lp.price;
                    lp.stock = parseInt(ap.stock) ?? lp.stock;
                    if (ap.img && ap.img !== lp.img) lp.img = ap.img;
                    lp._synced = true;
                }
            });
            apiProducts.forEach(ap => {
                if (!posProducts.find(lp => lp.id === 'p' + ap.id)) {
                    posProducts.push({
                        id: 'p' + ap.id,
                        name: ap.name,
                        barcode: ap.barcode || '',
                        brand: ap.brand || '',
                        category: ap.category || 'suplementos',
                        price: parseFloat(ap.price) || 0,
                        cost: parseFloat(ap.cost) || 0,
                        stock: parseInt(ap.stock) || 0,
                        img: ap.img || DEFAULT_IMG,
                        images: ap.images || [],
                        desc: ap.description || '',
                        featured: ap.featured || false,
                        subcategory: ap.subcategory || '',
                        _synced: true
                    });
                } else {
                    const lp = posProducts.find(lp => lp.id === 'p' + ap.id);
                    if (lp) lp._synced = true;
                }
            });
            posProducts = posProducts.filter(p => p._synced === false || apiMap[p.id]);
            localStorage.setItem('posProducts', JSON.stringify(posProducts));
            posNextProductId = posProducts.reduce((m, p) => Math.max(m, parseInt(p.id.replace('p',''))), 0) + 1;
        }
        const apiCustomers = await API.getCustomers();
        if (apiCustomers) {
            posCustomers = apiCustomers.map(c => ({
                id: 'c' + c.id,
                name: c.name,
                phone: c.phone || '',
                email: c.email || '',
                address: c.address || '',
                tipo: c.tipo || 'local',
                _synced: true
            }));
            localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            posNextCustomerId = posCustomers.reduce((m, c) => Math.max(m, parseInt(c.id.replace(/^c/i,''))), 0) + 1;
        }
        const apiSuppliers = await API.getSuppliers();
        if (apiSuppliers) {
            posSuppliers = apiSuppliers.map(s => ({
                id: 's' + s.id,
                name: s.name,
                nit: s.nit || '',
                contact: s.contact || '',
                phone: s.phone || '',
                email: s.email || '',
                address: s.address || '',
                _synced: true
            }));
            localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers));
            posNextSupplierId = posSuppliers.reduce((m, s) => Math.max(m, parseInt(s.id.replace('s',''))), 0) + 1;
        }
        const apiCategories = await API.getCategories();
        if (apiCategories) {
            const apiKeys = apiCategories.map(c => c.key);
            POS_CATEGORIES = POS_CATEGORIES.filter(c => c._synced === false || apiKeys.includes(c.key));
            apiCategories.forEach(c => {
                const fc = { id: c.id, key: c.key, label: c.label, parent_key: c.parent_key || null, _synced: true };
                const idx = POS_CATEGORIES.findIndex(lc => lc.key === fc.key);
                if (idx >= 0) {
                    POS_CATEGORIES[idx] = fc;
                } else {
                    POS_CATEGORIES.push(fc);
                }
            });
            localStorage.setItem('posCategories', JSON.stringify(POS_CATEGORIES));
        }
        const apiSales = await API.getSales();
        if (apiSales && Array.isArray(apiSales)) {
            const apiSalesMap = {};
            apiSales.forEach(s => { apiSalesMap[s.id] = s; });
            const localUnsynced = posSales.filter(ls => !apiSalesMap[ls.id] && ls.id < 100000);
            posSales = apiSales.map(s => {
                const ci = s.credit_info || null;
                if (ci) {
                    const supabasePayments = (s.payments || [])
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map(p => ({ date: p.created_at, amount: p.amount }));
                    const localPayments = ci.payments || [];
                    const newLocal = localPayments.filter(lp => {
                        return !supabasePayments.some(sp => sp.amount === lp.amount && Math.abs(new Date(sp.date) - new Date(lp.date)) < 60000);
                    });
                    ci.payments = [...supabasePayments, ...newLocal];
                }
                return {
                    id: s.id,
                    apiId: s.id,
                    apiSynced: true,
                    date: s.date || s.created_at,
                    created_at: s.created_at,
                    items: (s.items || []).map(i => ({ id: i.product_id, name: i.product_name, qty: i.qty, price: parseFloat(i.price) })),
                    subtotal: parseFloat(s.total) - parseFloat(s.excedente || 0),
                    excedente: parseFloat(s.excedente || 0),
                    total: parseFloat(s.total),
                    method: s.method,
                    methodKey: s.method_key,
                    customer: s.customer_name,
                    customerId: s.customer_id ? 'c' + s.customer_id : '',
                    creditInfo: ci,
                    ventaPorFuera: s.venta_por_fuera || false
                };
            });
            posSales = [...posSales, ...localUnsynced];
            localStorage.setItem('posSales', JSON.stringify(posSales));
            const maxApiId = apiSales.reduce((m, s) => Math.max(m, s.id), 0);
            posNextSaleId = Math.max(posNextSaleId, maxApiId + 1);
        }
        try {
            const apiInvLog = await API.getInventoryLog();
            if (apiInvLog && apiInvLog.length > 0) {
                const apiLogMap = {};
                apiInvLog.forEach(l => { apiLogMap[l.id] = l; });
                const localIds = new Set(invLog.map(l => l.id));
                apiInvLog.forEach(al => {
                    if (!localIds.has(al.id)) {
                        invLog.push({
                            id: al.id,
                            date: al.created_at,
                            productId: al.product_id,
                            productName: al.product_name,
                            type: al.type,
                            quantity: al.quantity,
                            previousStock: al.previous_stock,
                            newStock: al.new_stock,
                            reason: al.reason,
                            saleId: al.sale_id,
                            category: al.category || '',
                            ventaPorFuera: al.venta_por_fuera || false,
                            synced: true
                        });
                    }
                });
                invLog.forEach(l => { l.synced = true; });
                localStorage.setItem('invLog', JSON.stringify(invLog));
            }
            saveInvLog();
        } catch(e) {}
        if (typeof loadCashLocal === 'function') loadCashLocal();
        if (typeof syncCashFromApi === 'function') await syncCashFromApi();
        try {
            if (typeof cashDateStr === 'function') {
                await API.saveCashBase(cashDateStr(), cashBase);
            }
            for (const e of cashExpenses) {
                if (!e._apiId) {
                    const synced = await API.saveExpense({ date: typeof cashDateStr === 'function' ? cashDateStr() : today(), description: e.description, amount: e.amount, category: e.category });
                    if (synced && synced.id) e._apiId = synced.id;
                }
            }
            if (typeof saveCashLocal === 'function') saveCashLocal();
        } catch(e) {}
        saveProducts();
        saveCustomers();
    } catch (e) {
        console.log('API sync skipped, using local data');
    }
}
function saveCart() { localStorage.setItem('posCart', JSON.stringify(posCart)); }
function saveInvLog() {
    localStorage.setItem('invLog', JSON.stringify(invLog));
    if (API.isAvailable) {
        invLog.forEach(l => {
            if (!l.synced) {
                API.addInventoryLog({
                    product_id: l.productId,
                    product_name: l.productName,
                    type: l.type,
                    quantity: l.quantity,
                    previous_stock: l.previousStock,
                    new_stock: l.newStock,
                    reason: l.reason || '',
                    sale_id: l.saleId || null,
                    venta_por_fuera: l.ventaPorFuera || false
                }).then(() => { l.synced = true; }).catch(e => {
                    if (e && (e.code === '23505' || (e.message && e.message.includes('duplicate')))) {
                        l.synced = true;
                    } else {
                        console.error('[POS] addInventoryLog error:', e.message || e);
                    }
                });
            }
        });
    }
}
function addInvLog(productId, productName, type, quantity, previousStock, newStock, reason, saleId, ventaPorFuera) {
    const prod = posProducts.find(p => p.id === productId);
    const category = prod ? prod.category : '';
    invLog.push({ id: invNextLogId++, date: now(), productId, productName, type, quantity, previousStock, newStock, reason, saleId: saleId || null, category, ventaPorFuera: ventaPorFuera || false, synced: false });
    saveInvLog();
}

// ============ UTILS ============
function formatPrice(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function now() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); }
function formatDate(d) { const dt = new Date(d); return dt.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function shortDate(d) { const dt = new Date(d); return dt.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }); }

// ============ NAV ============
function switchPanel(id) {
    if (currentUser && currentUser.role === 'empleado' && typeof POS_RESTRICTED_PANELS !== 'undefined' && POS_RESTRICTED_PANELS.includes(id)) {
        showToast('No tienes acceso a esta seccion');
        return;
    }
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + id).classList.add('active');
    document.querySelector('[data-panel="' + id + '"]').classList.add('active');
    if (typeof POS_PANEL_TITLES !== 'undefined') {
        document.getElementById('panelTitle').textContent = POS_PANEL_TITLES[id] || id;
    }
    if (typeof POS_PANEL_RENDERERS !== 'undefined' && POS_PANEL_RENDERERS[id]) {
        POS_PANEL_RENDERERS[id]();
    }
    if (typeof closeMobileMenu === 'function') closeMobileMenu();
}

// ============ PRODUCTS ============
function renderProductTable() {
    const searchEl = document.getElementById('prodSearch');
    const catEl = document.getElementById('prodCatFilter');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const cat = catEl ? catEl.value : 'all';
    let filtered = posProducts;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    if (cat !== 'all') {
        const subKeys = getSubCats(cat).map(s => s.key);
        filtered = filtered.filter(p => p.category === cat || subKeys.includes(p.subcategory));
    }
    const tbody = document.getElementById('prodTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px;">No hay productos</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((p, idx) => {
        const stockTag = p.stock <= 0 ? 'tag-danger' : p.stock <= 5 ? 'tag-warning' : 'tag-success';
        const stockText = p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Stock Bajo' : 'Disponible';
        const supp = p.supplier ? posSuppliers.find(s => s.id === p.supplier) : null;
        return `<tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${p.name}</strong><br><span style="font-size:11px;color:var(--text-muted);">${p.brand}</span></td>
            <td>${getCatLabel(p.category)}</td>
            <td style="font-size:12px;color:var(--text-muted);">${p.subcategory ? (POS_CATEGORIES.find(c => c.key === p.subcategory)?.label || p.subcategory) : '-'}</td>
            <td>${formatPrice(p.price)}</td>
            <td>${p.stock}</td>
            <td><span class="tag ${stockTag}">${stockText}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${supp ? supp.name : '-'}</td>
            <td class="actions">
                <button class="edit" onclick="openProductModal('${p.id}')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="del" onclick="deleteProduct('${p.id}')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
            </td>
        </tr>`;
    }).join('');
}

function openProductModal(id) {
    const modal = document.getElementById('productModal');
    document.getElementById('prodEditId').value = id || '';
    document.getElementById('prodModalTitle').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
    const catSelect = document.getElementById('prodCategory');
    catSelect.innerHTML = catOptsHtml();
    catSelect.onchange = updateSubcatSelect;
    const suppSelect = document.getElementById('prodSupplier');
    suppSelect.innerHTML = '<option value="">Sin proveedor</option>' + posSuppliers.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
    _prodMainImg = '';
    document.getElementById('prodMainPreview').style.display = 'none';
    document.getElementById('prodMainUploadStatus').textContent = '';
    updateSubcatSelect();
    if (id) {
        const p = posProducts.find(pr => pr.id === id);
        if (p) {
            _prodImages = (p.images && p.images.length > 0) ? [...p.images] : [];
            document.getElementById('prodName').value = p.name;
            document.getElementById('prodBarcode').value = p.barcode || '';
            document.getElementById('prodBrand').value = p.brand;
            document.getElementById('prodCategory').value = p.category;
            document.getElementById('prodPrice').value = p.price;
            document.getElementById('prodCost').value = p.cost || 0;
            document.getElementById('prodStock').value = p.stock;
            document.getElementById('prodImg').value = p.img || '';
            document.getElementById('prodDesc').value = p.desc || '';
            document.getElementById('prodSupplier').value = p.supplier || '';
            document.getElementById('prodFeatured').checked = p.featured || false;
            updateSubcatSelect();
            document.getElementById('prodSubcategory').value = p.subcategory || '';
            renderProdImagesPreview(_prodImages);
        }
    } else {
        _prodImages = [];
        document.getElementById('prodName').value = '';
        document.getElementById('prodBarcode').value = '';
        document.getElementById('prodBrand').value = '';
        document.getElementById('prodCategory').value = getTopLevelCats().length > 0 ? getTopLevelCats()[0].key : '';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodCost').value = '';
        document.getElementById('prodStock').value = '';
        document.getElementById('prodImg').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodFeatured').checked = false;
        document.getElementById('prodSupplier').value = '';
        document.getElementById('prodMainPreview').style.display = 'none';
        document.getElementById('prodMainUploadStatus').textContent = '';
        renderProdImagesPreview([]);
    }
    modal.classList.add('open');
}
function updateSubcatSelect() {
    const cat = document.getElementById('prodCategory').value;
    const sel = document.getElementById('prodSubcategory');
    const current = sel.value;
    const subs = getSubCats(cat);
    let opts = '<option value="">Ninguna</option>' + subs.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
    const found = subs.find(s => s.key === current);
    if (current && !found) {
        const catLabel = POS_CATEGORIES.find(c => c.key === current)?.label || current;
        opts += `<option value="${current}" selected>${catLabel} (anterior)</option>`;
    }
    sel.innerHTML = opts;
    if (found) sel.value = current;
}

function renderProdImagesPreview(images) {
    const container = document.getElementById('prodImagesPreview');
    if (!images || images.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = images.map((img, i) =>
        `<div style="position:relative;width:56px;height:56px;flex-shrink:0;">
            <img src="${img}" class="img-thumb">
            <div onclick="removeProdImage(${i})" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--danger);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;line-height:1;box-shadow:0 2px 4px rgba(0,0,0,0.2);">&times;</div>
        </div>`
    ).join('');
}

let _prodMainImg = '';
let _prodImages = [];

function uploadMainImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const status = document.getElementById('prodMainUploadStatus');
    status.textContent = 'Subiendo...';
    API.uploadImage(file).then(result => {
        _prodMainImg = result.url;
        const preview = document.getElementById('prodMainPreview');
        const previewImg = document.getElementById('prodMainPreviewImg');
        preview.style.display = '';
        previewImg.src = result.url;
        document.getElementById('prodImg').value = '';
        status.textContent = 'Imagen subida';
        setTimeout(() => status.textContent = '', 3000);
    }).catch(err => {
        status.textContent = 'Error: ' + err.message;
    });
}

function uploadProdImages(files) {
    const status = document.getElementById('prodUploadStatus');
    if (!files || files.length === 0) return;
    status.textContent = 'Subiendo ' + files.length + ' imagen(es)...';
    API.uploadImages(Array.from(files)).then(result => {
        _prodImages = _prodImages.concat(result.map(r => r.url));
        renderProdImagesPreview(_prodImages);
        status.textContent = 'Subidas exitosamente';
        setTimeout(() => status.textContent = '', 3000);
    }).catch(err => {
        status.textContent = 'Error al subir: ' + err.message;
    });
}

function removeProdImage(idx) {
    _prodImages.splice(idx, 1);
    renderProdImagesPreview(_prodImages);
    document.getElementById('prodUploadStatus').textContent = 'Imagen eliminada';
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
}

function saveProduct() {
    const id = document.getElementById('prodEditId').value;
    const name = document.getElementById('prodName').value.trim();
    const barcode = document.getElementById('prodBarcode').value.trim();
    const brand = document.getElementById('prodBrand').value.trim();
    const category = document.getElementById('prodCategory').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const cost = parseFloat(document.getElementById('prodCost').value) || 0;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;
    const img = document.getElementById('prodImg').value.trim();
    const desc = document.getElementById('prodDesc').value.trim();
    const supplier = document.getElementById('prodSupplier').value;
    const featured = document.getElementById('prodFeatured').checked;
    const subcategory = document.getElementById('prodSubcategory').value;

    if (!name || !price || price <= 0) { showToast('Nombre y precio requeridos'); return; }
    const images = _prodImages.length > 0 ? _prodImages : undefined;
    const finalImg = _prodMainImg || img || (images && images.length > 0 ? images[0] : '');

    if (id) {
        const p = posProducts.find(pr => pr.id === id);
        if (p) {
            if (p.subcategory && !subcategory) {
                if (!confirm('Estas a punto de quitar la subcategoria "' + (POS_CATEGORIES.find(c => c.key === p.subcategory)?.label || p.subcategory) + '" del producto. Continuar?')) { closeProductModal(); return; }
            }
            const prevStock = p.stock;
            Object.assign(p, { name, barcode, brand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, subcategory });
            if (stock !== prevStock) {
                const diff = stock - prevStock;
                addInvLog(p.id, p.name, diff > 0 ? 'entrada' : 'salida', diff, prevStock, stock, 'Ajuste manual desde productos');
            }
        }
    } else {
        posProducts.push({ id: 'p' + posNextProductId++, name, barcode, brand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, subcategory, _synced: false });
    }
    saveProducts();
    closeProductModal();
    renderProductTable();
    if (typeof renderInventory === 'function') renderInventory();
    showToast('Producto guardado');
}

function deleteProduct(id) {
    if (!confirm('Eliminar este producto?')) return;
    const apiId = id && id.startsWith('p') ? parseInt(id.replace('p','')) : null;
    if (apiId && API.isAvailable) API.deleteProduct(apiId).catch(e => { console.error('[POS] deleteProduct error:', e); });
    posProducts = posProducts.filter(p => p.id !== id);
    saveProducts();
    renderProductTable();
    if (typeof renderInventory === 'function') renderInventory();
    showToast('Producto eliminado');
}

// ============ CUSTOMERS ============
function renderCustomerTable() {
    const searchEl = document.getElementById('custSearch');
    const filterEl = document.getElementById('custFilter');
    const salesTypeEl = document.getElementById('custSalesTypeFilter');
    const tipoEl = document.getElementById('custTipoFilter');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const custFilter = filterEl ? filterEl.value : 'todo';
    const custSalesType = salesTypeEl ? salesTypeEl.value : 'all';
    const custTipoFilter = tipoEl ? tipoEl.value : 'all';
    let filtered = posCustomers;
    if (q) filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (custFilter !== 'todo') {
        filtered = filtered.filter(c => {
            const p = getCustomerPending(c.id);
            return custFilter === 'aldia' ? p <= 0 : p > 0;
        });
    }
    if (custTipoFilter !== 'all') {
        filtered = filtered.filter(c => (c.tipo || 'local') === custTipoFilter);
    }
    if (custSalesType !== 'all') {
        filtered = filtered.filter(c => {
            const sales = posSales.filter(s => s.customerId === c.id);
            const hasLocal = sales.some(s => !s.ventaPorFuera);
            const hasFuera = sales.some(s => s.ventaPorFuera);
            return custSalesType === 'local' ? hasLocal : hasFuera;
        });
    }
    const tbody = document.getElementById('custTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:30px;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((c, idx) => {
        const sales = posSales.filter(s => s.customerId === c.id);
        const purchases = sales.length;
        const localCount = sales.filter(s => !s.ventaPorFuera).length;
        const fueraCount = sales.filter(s => s.ventaPorFuera).length;
        const totalSpent = sales.reduce((sum, s) => sum + s.total, 0);
        const pendingTotal = getCustomerPending(c.id);
        const pendingHtml = pendingTotal > 0 ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(pendingTotal) + '</span>' : '<span style="color:var(--success);">Al dia</span>';
        const tipoLabel = c.tipo === 'fuera' ? '<span class="tag tag-warning" style="font-size:10px;">Por fuera</span>' : '<span class="tag tag-success" style="font-size:10px;">Local</span>';
        return `<tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong style="cursor:pointer;" onclick="showCustomerHistory('${c.id}')">${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
            <td>${tipoLabel}</td>
            <td>${purchases}</td>
            <td><span style="color:var(--green);font-weight:600;">${localCount}</span></td>
            <td><span style="color:var(--warning);font-weight:600;">${fueraCount}</span></td>
            <td><strong>${formatPrice(totalSpent)}</strong></td>
            <td>${pendingHtml}</td>
            <td class="actions">
                <button class="edit" onclick="showCustomerHistory('${c.id}')" title="Historial"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></button>
                ${currentUser && currentUser.role === 'admin' ? `<button class="edit" onclick="openCustomerModal('${c.id}')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="del" onclick="deleteCustomer('${c.id}')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function getCustomerPending(cid) {
    const sales = posSales.filter(s => s.customerId === cid);
    return sales.reduce((sum, s) => {
            if (!s.creditInfo) return sum;
            if (s.creditInfo.tipo === 'abono') {
                const pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
                return sum + (s.creditInfo.balance - pagado);
            }
            const pend = (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor;
            return sum + pend;
        }, 0);
}

function openCustomerModal(id) {
    const modal = document.getElementById('customerModal');
    document.getElementById('custEditId').value = id || '';
    document.getElementById('custModalTitle').textContent = id ? 'Editar Cliente' : 'Nuevo Cliente';
    if (id) {
        const c = posCustomers.find(cu => cu.id === id);
        if (c) {
            document.getElementById('custName').value = c.name;
            document.getElementById('custPhone').value = c.phone || '';
            document.getElementById('custEmail').value = c.email || '';
            document.getElementById('custAddress').value = c.address || '';
            const tipo = c.tipo || 'local';
            document.getElementById('custTipo').value = tipo;
            document.querySelectorAll('[name="custTipo"]').forEach(r => {
                r.checked = r.value === tipo;
                const label = r.closest('label');
                if (label) label.style.borderColor = r.value === tipo ? (tipo === 'fuera' ? 'var(--warning)' : 'var(--green)') : 'var(--border)';
            });
        }
    } else {
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        document.getElementById('custEmail').value = '';
        document.getElementById('custAddress').value = '';
        document.getElementById('custTipo').value = 'local';
    }
    modal.classList.add('open');
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('open');
}

function saveCustomer() {
    const id = document.getElementById('custEditId').value;
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const tipo = document.getElementById('custTipo').value;
    if (!name) { showToast('Nombre requerido'); return; }
    if (id) {
        const c = posCustomers.find(cu => cu.id === id);
        if (c) Object.assign(c, { name, phone, email, address, tipo });
    } else {
        posCustomers.push({ id: 'c' + posNextCustomerId++, name, phone, email, address, tipo, _synced: false });
    }
    saveCustomers();
    closeCustomerModal();
    renderCustomerTable();
    showToast('Cliente guardado');
}

function deleteCustomer(id) {
    if (!confirm('Eliminar este cliente?')) return;
    const apiId = id && /^c/i.test(id) ? parseInt(id.replace(/^c/i,'')) : null;
    if (apiId && API.isAvailable) API.deleteCustomer(apiId).catch(e => { console.error('[POS] deleteCustomer error:', e); });
    posCustomers = posCustomers.filter(c => c.id !== id);
    saveCustomers();
    renderCustomerTable();
    showToast('Cliente eliminado');
}

// ============ SUPPLIERS ============
function renderSupplierTable() {
    const q = document.getElementById('suppSearch').value.toLowerCase().trim();
    let filtered = posSuppliers;
    if (q) filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q) || (s.nit && s.nit.includes(q)) || (s.contact && s.contact.toLowerCase().includes(q)));
    const tbody = document.getElementById('suppTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay proveedores registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((s, idx) => {
        const productCount = posProducts.filter(p => p.supplier === s.id).length;
        return '<tr>' +
            '<td><strong>#' + (idx + 1) + '</strong></td>' +
            '<td><strong>' + s.name + '</strong></td>' +
            '<td>' + (s.nit || '-') + '</td>' +
            '<td>' + (s.contact || '-') + '</td>' +
            '<td>' + (s.phone || '-') + '</td>' +
            '<td>' + (s.email || '-') + '</td>' +
            '<td>' + productCount + '</td>' +
            '<td class="actions">' +
                '<button class="edit" onclick="openSupplierModal(\'' + s.id + '\')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>' +
                '<button class="del" onclick="deleteSupplier(\'' + s.id + '\')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
            '</td>' +
        '</tr>';
    }).join('');
}
function openSupplierModal(id) {
    const modal = document.getElementById('supplierModal');
    document.getElementById('suppEditId').value = id || '';
    document.getElementById('suppModalTitle').textContent = id ? 'Editar Proveedor' : 'Nuevo Proveedor';
    if (id) {
        const s = posSuppliers.find(su => su.id === id);
        if (s) {
            document.getElementById('suppName').value = s.name;
            document.getElementById('suppNit').value = s.nit || '';
            document.getElementById('suppContact').value = s.contact || '';
            document.getElementById('suppPhone').value = s.phone || '';
            document.getElementById('suppEmail').value = s.email || '';
            document.getElementById('suppAddress').value = s.address || '';
        }
    } else {
        document.getElementById('suppName').value = '';
        document.getElementById('suppNit').value = '';
        document.getElementById('suppContact').value = '';
        document.getElementById('suppPhone').value = '';
        document.getElementById('suppEmail').value = '';
        document.getElementById('suppAddress').value = '';
    }
    modal.classList.add('open');
}
function closeSupplierModal() {
    document.getElementById('supplierModal').classList.remove('open');
}
function saveSupplier() {
    const id = document.getElementById('suppEditId').value;
    const name = document.getElementById('suppName').value.trim();
    const nit = document.getElementById('suppNit').value.trim();
    const contact = document.getElementById('suppContact').value.trim();
    const phone = document.getElementById('suppPhone').value.trim();
    const email = document.getElementById('suppEmail').value.trim();
    const address = document.getElementById('suppAddress').value.trim();
    if (!name) { showToast('Nombre requerido'); return; }
    if (id) {
        const s = posSuppliers.find(su => su.id === id);
        if (s) Object.assign(s, { name, nit, contact, phone, email, address });
    } else {
        posSuppliers.push({ id: 's' + posNextSupplierId++, name, nit, contact, phone, email, address, _synced: false });
    }
    saveSuppliers();
    closeSupplierModal();
    renderSupplierTable();
    showToast('Proveedor guardado');
}
function deleteSupplier(id) {
    if (!confirm('Eliminar este proveedor?')) return;
    const apiId = id && id.startsWith('s') ? parseInt(id.replace('s','')) : null;
    if (apiId && API.isAvailable) API.deleteSupplier(apiId).catch(e => { console.error('[POS] deleteSupplier error:', e); });
    posSuppliers = posSuppliers.filter(s => s.id !== id);
    saveSuppliers();
    renderSupplierTable();
    showToast('Proveedor eliminado');
}

// ============ CATEGORIES TABLE ============
function switchCatTab(tab) {
    document.querySelectorAll('[data-cattab]').forEach(t => t.classList.toggle('active', t.dataset.cattab === tab));
    document.getElementById('catCatsSection').style.display = tab === 'cats' ? '' : 'none';
    document.getElementById('catSubsSection').style.display = tab === 'subs' ? '' : 'none';
    const btn = document.getElementById('catNewBtn');
    if (tab === 'subs') {
        btn.textContent = '+ Nueva Subcategoria';
        btn.onclick = () => openCategoryModal(null, true);
    } else {
        btn.textContent = '+ Nueva Categoria';
        btn.onclick = () => openCategoryModal();
    }
}

function renderCategoriesTable() {
    const tbody = document.getElementById('catTableBody');
    if (!tbody) return;
    const top = getTopLevelCats();
    if (top.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:30px;">No hay categorias creadas</td></tr>';
        return;
    }
    tbody.innerHTML = top.map(c => {
        const productCount = posProducts.filter(p => p.category === c.key).length;
        return '<tr>' +
            '<td><strong>' + c.label + '</strong></td>' +
            '<td>' + productCount + '</td>' +
            '<td class="actions">' +
                '<button class="edit" onclick="editCategory(\'' + c.key + '\')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>' +
                '<button class="del" onclick="deleteCategory(\'' + c.key + '\')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
            '</td>' +
        '</tr>';
    }).join('');
    renderSubcategoriesTable();
}
function renderSubcategoriesTable() {
    const tbody = document.getElementById('catSubsBody');
    if (!tbody) return;
    const filterSel = document.getElementById('catSubFilter');
    if (filterSel && filterSel.options.length <= 1) {
        const top = getTopLevelCats();
        filterSel.innerHTML = '<option value="">Todas</option>' + top.map(c => '<option value="' + c.key + '">' + c.label + '</option>').join('');
    }
    const filterVal = filterSel ? filterSel.value : '';
    const subs = POS_CATEGORIES.filter(c => c.parent_key && (!filterVal || c.parent_key === filterVal));
    if (subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No hay subcategorias creadas</td></tr>';
        return;
    }
    tbody.innerHTML = subs.map(s => {
        const parent = POS_CATEGORIES.find(c => c.key === s.parent_key);
        const productCount = posProducts.filter(p => p.subcategory === s.key).length;
        return '<tr>' +
            '<td>' + s.label + '</td>' +
            '<td>' + (parent ? parent.label : '-') + '</td>' +
            '<td>' + productCount + '</td>' +
            '<td class="actions">' +
                '<button class="edit" onclick="editCategory(\'' + s.key + '\')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>' +
                '<button class="del" onclick="deleteCategory(\'' + s.key + '\')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function editCategory(key) {
    if (POS_CATEGORIES.find(cat => cat.key === key)) openCategoryModal(key);
}

function deleteCategory(key) {
    const c = POS_CATEGORIES.find(cat => cat.key === key);
    if (!c) return;
    const subs = getSubCats(key);
    const isSub = !!c.parent_key;
    const productCount = isSub
        ? posProducts.filter(p => p.subcategory === key).length
        : posProducts.filter(p => p.category === key).length;
    let msg = 'Eliminar ' + (isSub ? 'subcategoria' : 'categoria') + ' "' + c.label + '"?';
    if (!isSub && subs.length > 0) msg += ' Tambien se eliminaran ' + subs.length + ' subcategorias.';
    if (productCount > 0) msg += ' Hay ' + productCount + ' producto(s) ' + (isSub ? 'con esta subcategoria' : 'en esta categoria') + '. Se marcaran como "Sin categoria".';
    if (!confirm(msg)) return;
    if (isSub) {
        if (API.isAvailable && (c._synced || c.id)) API.deleteCategory(c.id).catch(e => { console.error('[POS] deleteCategory error:', e); });
        POS_CATEGORIES = POS_CATEGORIES.filter(cat => cat.key !== key);
        posProducts.forEach(p => { if (p.subcategory === key) p.subcategory = ''; });
    } else {
        subs.forEach(s => {
            posProducts.forEach(p => { if (p.subcategory === s.key) p.subcategory = ''; });
            if (API.isAvailable && (s._synced || s.id)) API.deleteCategory(s.id).catch(e => { console.error('[POS] deleteCategory sub error:', e); });
        });
        if (API.isAvailable && (c._synced || c.id)) API.deleteCategory(c.id).catch(e => { console.error('[POS] deleteCategory error:', e); });
        POS_CATEGORIES = POS_CATEGORIES.filter(cat => cat.key !== key && cat.parent_key !== key);
        posProducts.forEach(p => { if (p.category === key) p.category = ''; });
    }
    saveCategories();
    saveProducts();
    renderCategoriesTable();
    renderSubcategoriesTable();
    refreshCategorySelect();
    refreshProdCatFilter();
    if (typeof _invStockCatInit !== 'undefined') _invStockCatInit = false;
    if (typeof _invLogCatInit !== 'undefined') _invLogCatInit = false;
    if (typeof renderInventory === 'function') renderInventory();
    renderProductTable();
    showToast((isSub ? 'Subcategoria' : 'Categoria') + ' eliminada');
}

// ============ INVENTORY LOG ============
let _invLogCatInit = false;
function renderInvLog() {
    const catFilter = document.getElementById('invLogCatFilter');
    if (!_invLogCatInit) {
        _invLogCatInit = true;
        catFilter.innerHTML = '<option value="all">Todas las categorias</option>' + catOptsHtml();
    }
    const q = document.getElementById('invLogSearch').value.toLowerCase().trim();
    const cat = catFilter.value;
    const type = document.getElementById('invLogTypeFilter').value;
    const ventaFilter = document.getElementById('invLogVentaFilter').value;
    let filtered = invLog;
    if (q) filtered = filtered.filter(l => l.productName.toLowerCase().includes(q));
    if (cat !== 'all') filtered = filtered.filter(l => l.category === cat);
    if (type !== 'all') filtered = filtered.filter(l => l.type === type);
    if (ventaFilter === 'local') filtered = filtered.filter(l => l.type === 'salida' && !l.ventaPorFuera);
    else if (ventaFilter === 'fuera') filtered = filtered.filter(l => l.type === 'salida' && l.ventaPorFuera);
    const tbody = document.getElementById('invLogBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Sin movimientos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.slice().reverse().slice(0, 200).map(l => {
        const typeLabel = l.type === 'entrada' ? '<span style="color:var(--success);font-weight:600;">Entrada</span>' : l.type === 'salida' ? '<span style="color:var(--danger);font-weight:600;">Salida</span>' : '<span style="color:var(--warning);font-weight:600;">Ajuste</span>';
        const vpfTag = l.ventaPorFuera ? ' <span class="tag tag-warning" style="font-size:10px;">Por fuera</span>' : '';
        return '<tr>' +
            '<td>' + shortDate(l.date) + '</td>' +
            '<td><strong>' + l.productName + '</strong></td>' +
            '<td>' + getCatLabel(l.category) + '</td>' +
            '<td>' + typeLabel + '</td>' +
            '<td style="font-weight:600;' + (l.quantity > 0 ? 'color:var(--success);' : 'color:var(--danger);') + '">' + (l.quantity > 0 ? '+' : '') + l.quantity + '</td>' +
            '<td>' + l.previousStock + '</td>' +
            '<td>' + l.newStock + '</td>' +
            '<td style="font-size:12px;color:var(--text-muted);">' + (l.reason || '-') + vpfTag + '</td>' +
            '</tr>';
    }).join('');
}
function clearInvLog() {
    if (!confirm('Esto eliminara todo el historial de entradas y salidas. Continuar?')) return;
    invLog = [];
    invNextLogId = 1;
    saveInvLog();
    renderInventory();
    showToast('Historial de inventario limpiado');
}

// ============ INVENTORY STOCK TABLE ============
let _invStockCatInit = false;
function renderInventory() {
    const total = posProducts.length;
    const available = posProducts.filter(p => p.stock > 0).length;
    const low = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = posProducts.filter(p => p.stock <= 0).length;
    const statsEl = document.getElementById('invStats');
    if (statsEl) statsEl.innerHTML = '' +
        '<div class="inv-stat"><span class="inv-stat-val">' + total + '</span><span class="inv-stat-label">Total</span></div>' +
        '<div class="inv-stat"><span class="inv-stat-val" style="color:var(--green);">' + available + '</span><span class="inv-stat-label">Disponibles</span></div>' +
        '<div class="inv-stat"><span class="inv-stat-val" style="color:var(--warning);">' + low + '</span><span class="inv-stat-label">Stock Bajo</span></div>' +
        '<div class="inv-stat"><span class="inv-stat-val" style="color:var(--danger);">' + out + '</span><span class="inv-stat-label">Agotados</span></div>';
    const catFilter = document.getElementById('invStockCatFilter');
    if (catFilter && !_invStockCatInit) {
        _invStockCatInit = true;
        catFilter.innerHTML = '<option value="all">Todas las categorias</option>' + catOptsHtml();
    }
    const searchEl = document.getElementById('invStockSearch');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const cat = catFilter ? catFilter.value : 'all';
    let filtered = posProducts;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)));
    if (cat !== 'all') {
        const subKeys = getSubCats(cat).map(s => s.key);
        filtered = filtered.filter(p => p.category === cat || subKeys.includes(p.subcategory));
    }
    const tbody = document.getElementById('invTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Sin productos</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(p => {
        const lastSale = posSales.filter(s => s.items.some(i => i.id === p.id)).pop();
        const tag = p.stock <= 0 ? 'tag-danger' : p.stock <= 5 ? 'tag-warning' : 'tag-success';
        const text = p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Stock Bajo' : 'OK';
        return '<tr>' +
            '<td><strong>' + p.name + '</strong></td>' +
            '<td>' + getCatLabel(p.category) + '</td>' +
            '<td><strong>' + p.stock + '</strong></td>' +
            '<td><span class="tag ' + tag + '">' + text + '</span></td>' +
            '<td>' + (lastSale ? shortDate(lastSale.date) : 'Sin ventas') + '</td>' +
        '</tr>';
    }).join('');
    renderInvLog();
}

function switchInvTab(tab) {
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.toggle('active', t.dataset.invtab === tab));
    const stockSection = document.getElementById('invStockSection');
    const logSection = document.getElementById('invLogSection');
    if (stockSection) stockSection.style.display = tab === 'stock' ? '' : 'none';
    if (logSection) logSection.style.display = tab === 'log' ? '' : 'none';
    if (tab === 'log') renderInvLog();
}

function filterInvMovProduct() {
    const q = document.getElementById('invMovProductSearch').value.toLowerCase();
    const sel = document.getElementById('invMovProduct');
    for (const opt of sel.options) {
        opt.style.display = !q || opt.text.toLowerCase().includes(q) ? '' : 'none';
    }
}
function openInvMovModal(type) {
    document.getElementById('invMovProductSearch').value = '';
    const sel = document.getElementById('invMovProduct');
    sel.innerHTML = posProducts.map(p => '<option value="' + p.id + '">' + p.name + ' (Stock: ' + p.stock + ')</option>').join('');
    document.getElementById('invMovType').value = type;
    document.getElementById('invMovQty').value = '1';
    document.getElementById('invMovNote').value = '';
    const reasonSel = document.getElementById('invMovReason');
    if (type === 'entrada') {
        document.getElementById('invMovTitleIcon').style.fill = 'var(--success)';
        document.getElementById('invMovTitleIcon').setAttribute('d', 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z');
        document.getElementById('invMovTitleText').textContent = 'Registrar Entrada';
        document.getElementById('invMovConfirmBtn').textContent = 'Guardar Entrada';
        document.getElementById('invMovConfirmBtn').className = 'btn btn-primary';
        reasonSel.innerHTML =
            '<option value="Compra a proveedor">Compra a proveedor</option>' +
            '<option value="Devolucion de cliente">Devolucion de cliente</option>' +
            '<option value="Transferencia entrante">Transferencia entrante</option>' +
            '<option value="Ajuste por inventario inicial">Ajuste por inventario inicial</option>' +
            '<option value="Otro">Otro</option>';
    } else {
        document.getElementById('invMovTitleIcon').style.fill = 'var(--danger)';
        document.getElementById('invMovTitleIcon').setAttribute('d', 'M19 13H5v-2h14v2z');
        document.getElementById('invMovTitleText').textContent = 'Registrar Salida';
        document.getElementById('invMovConfirmBtn').textContent = 'Guardar Salida';
        document.getElementById('invMovConfirmBtn').className = 'btn';
        document.getElementById('invMovConfirmBtn').style.cssText = 'background:var(--danger);color:#fff;';
        reasonSel.innerHTML =
            '<option value="Venta directa">Venta directa</option>' +
            '<option value="Merma / Deterioro">Merma / Deterioro</option>' +
            '<option value="Vencimiento">Vencimiento</option>' +
            '<option value="Robo / Perdida">Robo / Perdida</option>' +
            '<option value="Donacion">Donacion</option>' +
            '<option value="Transferencia saliente">Transferencia saliente</option>' +
            '<option value="Movimiento a Bastidas">Movimiento a Bastidas</option>' +
            '<option value="Movimiento a Curinca">Movimiento a Curinca</option>' +
            '<option value="Ajuste por inventario final">Ajuste por inventario final</option>' +
            '<option value="Otro">Otro</option>';
        if (currentUser && currentUser.role === 'empleado') {
            reasonSel.innerHTML =
                '<option value="Movimiento a Bastidas">Movimiento a Bastidas</option>' +
                '<option value="Movimiento a Curinca">Movimiento a Curinca</option>';
        }
    }
    document.getElementById('invMovModal').classList.add('open');
}
function closeInvMovModal() {
    document.getElementById('invMovModal').classList.remove('open');
}
function confirmInvMov() {
    const type = document.getElementById('invMovType').value;
    const pid = document.getElementById('invMovProduct').value;
    const qty = parseInt(document.getElementById('invMovQty').value);
    const reason = document.getElementById('invMovReason').value;
    const note = document.getElementById('invMovNote').value.trim();
    const fullReason = note ? reason + ' - ' + note : reason;
    if (!pid || !qty || qty <= 0) { showToast('Selecciona un producto y cantidad valida'); return; }
    if (posProducts.length === 0) { showToast('No hay productos disponibles'); return; }
    const p = posProducts.find(pr => String(pr.id) === String(pid));
    if (!p) { showToast('Producto no encontrado'); return; }
    const prev = p.stock;
    if (type === 'entrada') {
        p.stock += qty;
        addInvLog(pid, p.name, 'entrada', qty, prev, p.stock, fullReason);
        saveProducts();
        closeInvMovModal();
        renderInventory();
        renderProductTable();
        showToast('Entrada registrada: +' + qty + ' ' + p.name);
    } else {
        if (p.stock < qty) { showToast('Stock insuficiente (disponible: ' + p.stock + ')'); return; }
        p.stock -= qty;
        addInvLog(pid, p.name, 'salida', -qty, prev, p.stock, fullReason);
        saveProducts();
        closeInvMovModal();
        renderInventory();
        renderProductTable();
        showToast('Salida registrada: -' + qty + ' ' + p.name);
    }
}

// ============ TOAST ============
function showToast(msg) {
    let t = document.getElementById('posToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'posToast';
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0b513b;color:#fff;padding:12px 24px;border-radius:30px;font-family:"Outfit",sans-serif;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;opacity:0;transform:translateY(20px);transition:all 0.3s;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; }, 3000);
}

// ============ SIDEBAR ============
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('posSidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const menu = document.querySelector('.mobile-menu');
    if (!sidebar || !overlay || !menu) return;
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('open');
        menu.classList.remove('open');
        document.body.style.overflow = '';
    } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('open');
        menu.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const menu = document.querySelector('.mobile-menu');
    if (!sidebar || !overlay || !menu) return;
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('open');
    menu.classList.remove('open');
    document.body.style.overflow = '';
}

function buildMobileMenu() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const menu = document.querySelector('.mobile-menu');
    if (!menu || navItems.length === 0) return;
    let html = '<div class="mobile-menu-handle"></div>';
    html += '<div class="nav-section">Menu</div>';
    navItems.forEach(item => {
        const panel = item.dataset.panel;
        const isActive = item.classList.contains('active');
        const svg = item.querySelector('svg');
        const span = item.querySelector('span');
        const badge = item.querySelector('.badge');
        if (!panel || !span) return;
        html += `<a class="nav-item${isActive ? ' active' : ''}" data-panel="${panel}" onclick="switchPanel('${panel}');closeMobileMenu();">`;
        if (svg) html += svg.outerHTML;
        html += `<span>${span.textContent}</span>`;
        if (badge) html += badge.outerHTML;
        html += '</a>';
    });
    html += '<div class="mobile-menu-footer">';
    html += `<a class="nav-item" href="pos.html"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg><span>Volver</span></a>`;
    html += `<a class="nav-item" onclick="if(confirm('Cerrar sesion?')){localStorage.removeItem('posUser');location.reload();}"><svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg><span>Cerrar Sesion</span></a>`;
    html += '</div>';
    menu.innerHTML = html;
}

// ============ EXPORT ============
function exportPosData() {
    const data = {
        posProducts: JSON.parse(localStorage.getItem('posProducts')) || [],
        posCategories: JSON.parse(localStorage.getItem('posCategories')) || [],
        posCustomers: JSON.parse(localStorage.getItem('posCustomers')) || [],
        posSuppliers: JSON.parse(localStorage.getItem('posSuppliers')) || [],
        posSales: JSON.parse(localStorage.getItem('posSales')) || [],
        invLog: JSON.parse(localStorage.getItem('invLog')) || []
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pos-data.json';
    a.click();
    showToast('Datos exportados: ' + data.posProducts.length + ' productos, ' + data.posCustomers.length + ' clientes');
}

// ============ FINAL INVOICE / STATE OF ACCOUNT ============
function showFinalInvoice(saleId) {
    const sale = posSales.find(s => s.id === saleId);
    if (!sale) return;
    const ci = sale.creditInfo;
    if (!ci) return;
    const pagado = ci.payments ? ci.payments.reduce((s, p) => s + p.amount, 0) : 0;
    const pendiente = sale.total - pagado;
    const isPaid = pendiente <= 0;
    const paymentsHtml = ci.payments && ci.payments.length > 0
        ? ci.payments.map((p, i) => '<tr><td>' + (i + 1) + '</td><td>' + shortDate(p.date) + '</td><td style="text-align:right;color:#166534;font-weight:600;">' + formatPrice(p.amount) + '</td></tr>').join('')
        : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Sin pagos registrados</td></tr>';
    const progressPct = sale.total > 0 ? Math.min(Math.round((pagado / sale.total) * 100), 100) : 0;
    document.getElementById('receiptContent').innerHTML = '' +
        '<div class="invoice-print" id="invoicePrintArea">' +
            '<div class="inv-header">' +
                '<div class="inv-logo"><img src="LOGO.jpeg" alt="Logo"></div>' +
                '<div class="inv-business">' +
                    '<h3>TIENDA NATURISTA</h3>' +
                    '<p>Santa Marta, Colombia</p>' +
                '</div>' +
                '<div class="inv-doc-info">' +
                    '<div class="inv-doc-type">ESTADO DE CUENTA</div>' +
                    '<div class="inv-doc-num">Factura #' + sale.id + '</div>' +
                    '<div class="inv-doc-date">' + new Date(sale.date).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="inv-status ' + (isPaid ? 'inv-status-paid' : 'inv-status-pending') + '">' +
                (isPaid ? 'CUENTA CANCELADA' : 'CUENTA PENDIENTE') +
            '</div>' +
            '<div class="inv-section">' +
                '<div class="inv-section-title">DATOS DEL CLIENTE</div>' +
                '<div class="inv-customer-grid">' +
                    '<div><span>Nombre:</span> <strong>' + (sale.customer || 'Cliente mostrador') + '</strong></div>' +
                    '<div><span>Metodo de pago:</span> <strong>' + sale.method + '</strong></div>' +
                    '<div><span>Tipo de credito:</span> <strong>' + (ci.tipo === 'abono' ? 'Abono libre' : 'Cuotas fijas (' + ci.totalCuotas + ' cuotas)') + '</strong></div>' +
                '</div>' +
            '</div>' +
            '<div class="inv-section">' +
                '<div class="inv-section-title">PRODUCTOS COMPRADOS</div>' +
                '<table class="inv-table">' +
                    '<thead><tr><th>#</th><th>Producto</th><th>Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>' +
                    '<tbody>' + sale.items.map((item, i) => '<tr><td>' + (i + 1) + '</td><td>' + (item.name || 'Producto') + '</td><td>' + item.qty + '</td><td style="text-align:right">' + formatPrice(item.price) + '</td><td style="text-align:right;font-weight:600;">' + formatPrice(item.price * item.qty) + '</td></tr>').join('') + '</tbody>' +
                    '<tfoot>' +
                        '<tr class="inv-total-row"><td colspan="4">TOTAL VENTA</td><td style="text-align:right">' + formatPrice(sale.total) + '</td></tr>' +
                    '</tfoot>' +
                '</table>' +
            '</div>' +
            '<div class="inv-section">' +
                '<div class="inv-section-title">RESUMEN DE PAGOS</div>' +
                '<div class="inv-summary-grid">' +
                    '<div class="inv-summary-box inv-total-box"><div class="inv-summary-label">Total de la compra</div><div class="inv-summary-val">' + formatPrice(sale.total) + '</div></div>' +
                    '<div class="inv-summary-box inv-paid-box"><div class="inv-summary-label">Total pagado</div><div class="inv-summary-val">' + formatPrice(pagado) + '</div></div>' +
                    '<div class="inv-summary-box inv-pending-box"><div class="inv-summary-label">Saldo pendiente</div><div class="inv-summary-val">' + formatPrice(Math.max(0, pendiente)) + '</div></div>' +
                '</div>' +
                '<div class="inv-progress-wrap">' +
                    '<div class="inv-progress-bar"><div class="inv-progress-fill" style="width:' + progressPct + '%"></div></div>' +
                    '<div class="inv-progress-text">' + progressPct + '% pagado</div>' +
                '</div>' +
            '</div>' +
            '<div class="inv-section">' +
                '<div class="inv-section-title">HISTORIAL DE PAGOS</div>' +
                '<table class="inv-table inv-payments-table">' +
                    '<thead><tr><th>#</th><th>Fecha</th><th style="text-align:right">Monto</th></tr></thead>' +
                    '<tbody>' + paymentsHtml + '</tbody>' +
                    '<tfoot>' +
                        '<tr class="inv-paid-row"><td colspan="2">TOTAL ABONADO</td><td style="text-align:right">' + formatPrice(pagado) + '</td></tr>' +
                        (!isPaid ? '<tr class="inv-pending-foot-row"><td colspan="2">SALDO PENDIENTE</td><td style="text-align:right">' + formatPrice(pendiente) + '</td></tr>' : '') +
                    '</tfoot>' +
                '</table>' +
            '</div>' +
            '<div class="inv-footer">' +
                '<p>Documento generado el ' + new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</p>' +
                '<p style="margin-top:4px;">Gracias por su compra</p>' +
            '</div>' +
        '</div>';
    document.getElementById('receiptModal').classList.add('open');
    const btnInv = document.getElementById('btnDownloadInv');
    if (btnInv) btnInv.style.display = '';
}

// ============ CUSTOMER HISTORY / CUENTA DE COBRO ============
let _custHistoryCustomerId = null;

function showCustomerHistory(custId) {
    const cust = posCustomers.find(c => c.id === custId);
    if (!cust) return;
    document.getElementById('custHistoryTitle').textContent = 'Cuenta de Cobro: ' + cust.name;
    const sales = posSales.filter(s => s.customerId === custId);
    const creditSales = sales.filter(s => s.creditInfo);
    const totalOwedGlobal = creditSales.reduce((sum, s) => {
        if (s.creditInfo.tipo === 'abono') {
            const pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
            return sum + (s.creditInfo.balance - pagado);
        }
        return sum + ((s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor);
    }, 0);
    let html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--hover);border-radius:10px;margin-bottom:16px;">';
    html += '<div><div style="font-weight:600;font-size:15px;">' + cust.name + '</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);">' + (cust.phone || '') + (cust.phone && cust.email ? ' | ' : '') + (cust.email || '') + '</div></div>';
    html += '<div style="text-align:right;"><div style="font-size:11px;color:var(--text-muted);">Saldo pendiente total</div><div style="font-size:20px;font-weight:700;' + (totalOwedGlobal > 0 ? 'color:var(--warning);' : 'color:var(--success);') + '">' + formatPrice(totalOwedGlobal) + '</div></div>';
    html += '</div>';
    if (sales.length === 0) {
        html += '<div class="empty-state" style="padding:40px;"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg><p>Sin compras registradas</p></div>';
    } else {
        const contadoSales = sales.filter(s => !s.creditInfo);
        if (contadoSales.length > 0) {
            html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-muted);">Compras de contado (' + contadoSales.length + ')</div>';
            contadoSales.slice(-3).reverse().forEach(s => {
                const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
                html += '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px;">';
                html += '<span>#' + s.id + ' <span style="color:var(--text-muted);">' + shortDate(s.date) + '</span></span>';
                html += '<span>' + qty + ' prod \u00b7 ' + formatPrice(s.total) + ' \u00b7 <span style="color:var(--success);">Pagado</span></span>';
                html += '</div>';
            });
        }
        if (creditSales.length > 0) {
            html += '<div style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text-muted);">Creditos y Cuentas de Cobro (' + creditSales.length + ')</div>';
            creditSales.slice().reverse().forEach(s => {
                let isPaid = false;
                let pending = 0;
                let pagado = 0;
                let label = '';
                if (s.creditInfo.tipo === 'abono') {
                    pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
                    pending = s.creditInfo.balance - pagado;
                    isPaid = pending <= 0;
                    label = isPaid ? 'Pagado' : 'Saldo: ' + formatPrice(pending);
                } else {
                    pending = (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor;
                    pagado = s.creditInfo.pagadas * s.creditInfo.cuotaValor;
                    isPaid = pending <= 0;
                    label = isPaid ? 'Pagado' : 'Pendiente: ' + formatPrice(pending);
                }
                html += '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:' + (isPaid ? '#f0fdf4' : '#fffbe6') + ';border-bottom:1px solid var(--border);">';
                html += '<div><strong>#' + s.id + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + shortDate(s.date) + '</span></div>';
                html += '<div style="font-weight:600;font-size:15px;">' + formatPrice(s.total) + '</div>';
                html += '</div>';
                if (s.items && s.items.length > 0) {
                    html += '<details style="font-size:11px;"><summary style="cursor:pointer;padding:4px 14px;color:var(--text-muted);user-select:none;list-style:none;">\u25b8 Productos</summary><div style="padding:0 14px 6px;color:var(--text-muted);">';
                    html += s.items.map(i => (i.name || 'Producto').substring(0, 20) + ' x' + i.qty).join(' \u00b7 ');
                    html += '</div></details>';
                }
                if (s.creditInfo.payments && s.creditInfo.payments.length > 0) {
                    html += '<div style="padding:6px 14px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--hover);">Pagos registrados:</div>';
                    s.creditInfo.payments.forEach(p => {
                        html += '<div style="display:flex;justify-content:space-between;padding:5px 14px;font-size:13px;border-bottom:1px solid var(--border);">';
                        html += '<span>' + shortDate(p.date) + '</span>';
                        html += '<span style="font-weight:500;color:var(--success);">' + formatPrice(p.amount) + '</span>';
                        html += '</div>';
                    });
                }
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;">';
                html += '<div><span style="font-size:12px;color:var(--text-muted);">' + label + '</span></div>';
                if (!isPaid) {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm btn-primary" onclick="openPaymentModalCust(' + s.id + ')">Registrar ' + (s.creditInfo.tipo === 'abono' ? 'Abono' : 'Pago') + '</button>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-outline" onclick="showFinalInvoice(' + s.id + ')">Ver Factura</button>' : '') + '</div>';
                } else {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--success);font-weight:600;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--success);vertical-align:middle;margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Pagado</span>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura</button>' : '') + '</div>';
                }
                html += '</div></div>';
            });
        }
    }
    document.getElementById('custHistoryContent').innerHTML = html;
    document.getElementById('custHistoryModal').classList.add('open');
    _custHistoryCustomerId = custId;
}

function closeCustHistory() {
    document.getElementById('custHistoryModal').classList.remove('open');
    _custHistoryCustomerId = null;
}

function openPaymentModalCust(saleId) {
    const sale = posSales.find(s => s.id === saleId);
    _custHistoryCustomerId = sale ? sale.customerId || null : null;
    openPaymentModal(saleId);
}

function refreshCustHistory() {
    if (_custHistoryCustomerId) {
        const cust = posCustomers.find(c => c.id === _custHistoryCustomerId);
        if (cust) showCustomerHistory(_custHistoryCustomerId);
    }
    renderSalesTable();
}

// ============ DATE DISPLAY ============
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

function initCatFilter() {
    refreshProdCatFilter();
}
