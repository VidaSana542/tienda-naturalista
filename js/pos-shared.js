// ============ LOGIN ============
const POS_USERS_DEFAULT = [
    { user: 'empleado', pass: 'emp123', role: 'empleado', name: 'Empleado' }
];
let _posUsersCache = null;
async function getPOSUsers() {
    if (_posUsersCache) return _posUsersCache;
    if (typeof _sb !== 'undefined' && _sb) {
        try {
            const { data, error } = await _sb.from('pos_users').select('*');
            if (!error && data && data.length > 0) {
                const mapped = data.map(u => ({ user: u.username, pass: u.pass, role: u.role, name: u.name }));
                _posUsersCache = [...mapped, ...POS_USERS_DEFAULT];
                localStorage.setItem('posRegisteredUsers', JSON.stringify(data));
                return _posUsersCache;
            }
        } catch(e) { console.error('[Login] Error cargando usuarios:', e); }
    }
    let registered = [];
    try { registered = JSON.parse(localStorage.getItem('posRegisteredUsers')) || []; } catch(e) {}
    _posUsersCache = [...registered, ...POS_USERS_DEFAULT];
    return _posUsersCache;
}
let currentUser = null;

// ============ POS SCOPE (local / fuera) ============
function getPosScope() { return typeof POS_SCOPE !== 'undefined' ? POS_SCOPE : null; }
function isCustomerInScope(c) {
    const scope = getPosScope();
    if (!scope) return true;
    const tipo = c.tipo || 'local';
    return scope === 'local' ? tipo !== 'fuera' : tipo === 'fuera';
}
function isSaleInScope(s) {
    const scope = getPosScope();
    if (!scope) return true;
    return scope === 'local' ? !s.ventaPorFuera : !!s.ventaPorFuera;
}
function filterCustomersByScope(customers) {
    const scope = getPosScope();
    if (!scope) return customers;
    return customers.filter(isCustomerInScope);
}
function filterSalesByScope(sales) {
    const scope = getPosScope();
    if (!scope) return sales;
    return sales.filter(isSaleInScope);
}
function filterInvLogByScope(log) {
    const scope = getPosScope();
    if (!scope) return log;
    return log.filter(l => scope === 'local' ? !l.ventaPorFuera : !!l.ventaPorFuera);
}
function getDefaultCustomerTipo() {
    return getPosScope() === 'fuera' ? 'fuera' : 'local';
}
function applyPosScopeUI() {
    const scope = getPosScope();
    if (!scope) return;
    ['custTipoFilter', 'salesTipoFilter', 'invLogVentaFilter', 'cuentasTipoFilter', 'custSalesTypeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT') el.value = scope;
        el.style.display = 'none';
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const users = await getPOSUsers();
    const found = users.find(u => u.user === user && u.pass === pass);
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
            API.saveCategory({ id: apiId, key: c.key, label: c.label, parent_key: c.parent_key || null, icon: c.icon || '', image: c.image || '', sort_order: c.sort_order || 0, active: c.active !== false }).then(res => {
                if (!c.id && res && res.id) c.id = res.id;
                c._synced = true;
                localStorage.setItem('posCategories', JSON.stringify(POS_CATEGORIES));
            }).catch(e => { console.error('[POS] saveCategory error:', e); });
        });
    }
}
function addCategory(key, label, parent_key, extra) {
    if (!key || !label || POS_CATEGORIES.find(c => c.key === key)) return false;
    const maxSort = POS_CATEGORIES.filter(c => (c.parent_key || null) === (parent_key || null)).reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
    POS_CATEGORIES.push({ key, label, parent_key: parent_key || null, icon: (extra && extra.icon) || '', image: (extra && extra.image) || '', sort_order: (extra && extra.sort_order) || (maxSort + 1), active: true, _synced: false });
    saveCategories();
    return true;
}
function getTopLevelCats() {
    return POS_CATEGORIES.filter(c => !c.parent_key && c.active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}
function getSubCats(parentKey) {
    return POS_CATEGORIES.filter(c => c.parent_key === parentKey && c.active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
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
    const iconInput = document.getElementById('catIconInput');
    if (iconInput) iconInput.value = c ? (c.icon || '') : '';
    const imageInput = document.getElementById('catImageInput');
    if (imageInput) imageInput.value = c ? (c.image || '') : '';
    const sortOrderInput = document.getElementById('catSortOrderInput');
    if (sortOrderInput) sortOrderInput.value = c ? (c.sort_order || 0) : 0;
    modal.classList.add('open');
    setTimeout(() => document.getElementById('catNameInput').focus(), 100);
}
function saveCategoryModal() {
    const key = document.getElementById('catEditKey').value;
    const nameInput = document.getElementById('catNameInput');
    const label = nameInput.value.trim();
    const parentKey = document.getElementById('catParentSelect').value || null;
    const iconEl = document.getElementById('catIconInput');
    const imageEl = document.getElementById('catImageInput');
    const sortOrderEl = document.getElementById('catSortOrderInput');
    const icon = iconEl ? iconEl.value.trim() : '';
    const image = imageEl ? imageEl.value.trim() : '';
    const sortOrder = sortOrderEl ? parseInt(sortOrderEl.value) || 0 : 0;
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
        c.icon = icon;
        c.image = image;
        c.sort_order = sortOrder;
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
        addCategory(newKey, label, parentKey, { icon, image, sort_order: sortOrder });
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
                name: p.name, catalog_name: p.catalogName || '', barcode: p.barcode || '', brand: p.brand || '', category: p.category,
                price: p.price, cost: p.cost || 0, stock: p.stock,
                img: p.img || '', images: p.images || [],
                description: p.desc || '',
                featured: p.featured || false,
                visible: p.visible !== false
            };
            payload.subcategory = p.subcategory || '';
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
        loadData();
        const apiProducts = await API.getProducts();
        if (apiProducts && apiProducts.length > 0) {
            const apiMap = {};
            apiProducts.forEach(p => { apiMap['p' + p.id] = p; });
            posProducts.forEach(lp => {
                const ap = apiMap[lp.id];
                    if (ap) {
                    lp.subcategory = ap.subcategory || '';
                    lp.name = ap.name;
                    lp.catalogName = ap.catalog_name || '';
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
                        catalogName: ap.catalog_name || '',
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
                        visible: ap.visible !== false,
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
                const fc = { id: c.id, key: c.key, label: c.label, parent_key: c.parent_key || null, icon: c.icon || '', image: c.image || '', sort_order: c.sort_order || 0, active: c.active !== false, _synced: true };
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
            const mergeFlags = {};
            posSales.forEach(ls => { if (ls.creditInfo?.merged) mergeFlags[ls.id] = { merged: true, mergedInto: ls.creditInfo.mergedInto }; });
            const apiSalesMap = {};
            apiSales.forEach(s => { apiSalesMap[s.id] = s; });
            const localUnsynced = posSales.filter(ls => !apiSalesMap[ls.id] && !ls.apiSynced);
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
            posSales.forEach(s => { const f = mergeFlags[s.id]; if (f) { if (!s.creditInfo) s.creditInfo = {}; s.creditInfo.merged = f.merged; s.creditInfo.mergedInto = f.mergedInto; } });
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
                            productId: (String(al.product_id).startsWith('p') ? al.product_id : 'p' + al.product_id).toString(),
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
                invNextLogId = invLog.reduce((m, l) => Math.max(m, l.id), 0) + 1;
            }
            saveInvLog();
            const localInvLog = JSON.parse(localStorage.getItem('invLog')) || [];
            localInvLog.forEach(ll => {
                if (!ll.synced && !invLog.some(l => l.id === ll.id)) {
                    delete ll._sending;
                    invLog.push(ll);
                }
            });
            if (localInvLog.some(ll => !ll.synced)) {
                localStorage.setItem('invLog', JSON.stringify(invLog));
            }
        } catch(e) { console.error('InvLog sync error:', e.message || e); }
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
    const json = JSON.stringify(invLog);
    localStorage.setItem('invLog', json);
    if (API.isAvailable) {
        invLog.forEach(l => {
            if (!l.synced && !l._sending) {
                l._sending = true;
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
                }).then(() => {
                    l.synced = true;
                    l._sending = false;
                    localStorage.setItem('invLog', JSON.stringify(invLog));
                }).catch(e => {
                    l._sending = false;
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
    const validSaleId = (saleId && posSales.some(s => s.id === saleId && (s.apiSynced || s._synced))) ? saleId : null;
    invLog.push({ id: invNextLogId++, date: now(), productId, productName, type, quantity, previousStock, newStock, reason, saleId: validSaleId, category, ventaPorFuera: ventaPorFuera || false, synced: false });
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
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
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
    document.getElementById('prodName').oninput = function() {
        const catEl = document.getElementById('prodCatalogName');
        if (catEl && !catEl.value) catEl.value = this.value.split('_')[0].trim();
    };
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
            document.getElementById('prodCatalogName').value = p.catalogName || p.name.split('_')[0].trim();
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
            document.getElementById('prodVisible').checked = p.visible !== false;
            updateSubcatSelect(p.subcategory);
            renderProdImagesPreview(_prodImages);
        }
    } else {
        _prodImages = [];
        document.getElementById('prodName').value = '';
        document.getElementById('prodCatalogName').value = '';
        document.getElementById('prodBarcode').value = '';
        document.getElementById('prodBrand').value = '';
        document.getElementById('prodCategory').value = getTopLevelCats().length > 0 ? getTopLevelCats()[0].key : '';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodCost').value = '';
        document.getElementById('prodStock').value = '';
        document.getElementById('prodImg').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodFeatured').checked = false;
        document.getElementById('prodVisible').checked = true;
        document.getElementById('prodSupplier').value = '';
        document.getElementById('prodMainPreview').style.display = 'none';
        document.getElementById('prodMainUploadStatus').textContent = '';
        renderProdImagesPreview([]);
    }
    modal.classList.add('open');
}
function updateSubcatSelect(subcatValue) {
    const cat = document.getElementById('prodCategory').value;
    const sel = document.getElementById('prodSubcategory');
    const current = subcatValue !== undefined ? subcatValue : sel.value;
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
    const catalogName = document.getElementById('prodCatalogName').value.trim();
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
    const visible = document.getElementById('prodVisible').checked;
    const subcategory = document.getElementById('prodSubcategory').value;

    if (!name) { showToast('Nombre requerido'); return; }
    const images = _prodImages.length > 0 ? _prodImages : undefined;
    const finalImg = _prodMainImg || img || (images && images.length > 0 ? images[0] : '');

    if (id) {
        const p = posProducts.find(pr => pr.id === id);
        if (p) {
            if (p.subcategory && !subcategory) {
                if (!confirm('Estas a punto de quitar la subcategoria "' + (POS_CATEGORIES.find(c => c.key === p.subcategory)?.label || p.subcategory) + '" del producto. Continuar?')) { closeProductModal(); return; }
            }
            const prevStock = p.stock;
            Object.assign(p, { name, catalogName, barcode, brand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, visible, subcategory });
            if (stock !== prevStock) {
                const diff = stock - prevStock;
                addInvLog(p.id, p.name, diff > 0 ? 'entrada' : 'salida', diff, prevStock, stock, 'Ajuste manual desde productos');
            }
        }
    } else {
        posProducts.push({ id: 'p' + posNextProductId++, name, catalogName, barcode, brand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, visible, subcategory, _synced: false });
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
    let filtered = filterCustomersByScope(posCustomers);
    if (q) filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (custFilter !== 'todo') {
        filtered = filtered.filter(c => {
            const p = getCustomerPending(c.id);
            return custFilter === 'aldia' ? p <= 0 : p > 0;
        });
    }
    if (!getPosScope() && custTipoFilter !== 'all') {
        filtered = filtered.filter(c => (c.tipo || 'local') === custTipoFilter);
    }
    if (!getPosScope() && custSalesType !== 'all') {
        filtered = filtered.filter(c => {
            const sales = filterSalesByScope(posSales.filter(s => s.customerId === c.id));
            const hasLocal = sales.some(s => !s.ventaPorFuera);
            const hasFuera = sales.some(s => s.ventaPorFuera);
            return custSalesType === 'local' ? hasLocal : hasFuera;
        });
    }
    const tbody = document.getElementById('custTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((c, idx) => {
        const sales = filterSalesByScope(posSales.filter(s => s.customerId === c.id && !s.creditInfo?.merged));
        const purchases = sales.length;
        const totalSpent = sales.reduce((sum, s) => sum + s.total, 0);
        const pendingTotal = getCustomerPending(c.id);
        const totalPaid = Math.max(0, totalSpent - pendingTotal);
        const lastDate = sales.length > 0 ? Math.max(...sales.map(s => new Date(s.date || s.created_at || 0))) : null;
        const lastStr = lastDate ? new Date(lastDate).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : 'Nunca';
        const pendingHtml = pendingTotal > 0 ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(pendingTotal) + '</span>' : '<span style="color:var(--success);">Al dia</span>';
        return `<tr>
            <td><strong style="cursor:pointer;" onclick="showCustomerHistory('${c.id}')">${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td>${purchases}</td>
            <td><strong>${formatPrice(totalSpent)}</strong></td>
            <td>${formatPrice(totalPaid)}</td>
            <td>${pendingHtml}</td>
            <td style="font-size:12px;color:var(--text-muted);">${lastStr}</td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showCustomerHistory('${c.id}')" title="Historial">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 13h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Historial
                </button>
                ${currentUser && currentUser.role === 'admin' ? `<button class="btn btn-sm btn-outline" onclick="openCustomerModal('${c.id}')" title="Editar" style="margin-left:4px;">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button><button class="btn btn-sm btn-outline" onclick="deleteCustomer('${c.id}')" title="Eliminar" style="margin-left:4px;color:var(--danger);">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function getCustomerPending(cid) {
    const sales = filterSalesByScope(posSales.filter(s => s.customerId === cid && !s.creditInfo?.merged));
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
        document.getElementById('custTipo').value = getDefaultCustomerTipo();
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No hay categorias creadas</td></tr>';
        return;
    }
    tbody.innerHTML = top.map(c => {
        const productCount = posProducts.filter(p => p.category === c.key).length;
        const iconHtml = c.icon ? '<span style="margin-right:4px;">' + c.icon + '</span>' : '';
        return '<tr>' +
            '<td><strong>' + iconHtml + c.label + '</strong></td>' +
            '<td>' + productCount + '</td>' +
            '<td>' + (c.sort_order || 0) + '</td>' +
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No hay subcategorias creadas</td></tr>';
        return;
    }
    tbody.innerHTML = subs.map(s => {
        const parent = POS_CATEGORIES.find(c => c.key === s.parent_key);
        const productCount = posProducts.filter(p => p.subcategory === s.key).length;
        const iconHtml = s.icon ? '<span style="margin-right:4px;">' + s.icon + '</span>' : '';
        return '<tr>' +
            '<td>' + iconHtml + s.label + '</td>' +
            '<td>' + (parent ? parent.label : '-') + '</td>' +
            '<td>' + productCount + '</td>' +
            '<td>' + (s.sort_order || 0) + '</td>' +
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
let _invLogSortDesc = true;
function toggleInvLogSort() {
    _invLogSortDesc = !_invLogSortDesc;
    const btn = document.getElementById('invLogSortBtn');
    if (btn) btn.textContent = _invLogSortDesc ? '⬇ Más reciente' : '⬆ Más antiguo';
    renderInvLog();
}
function renderInvLog() {
    const catFilter = document.getElementById('invLogCatFilter');
    const searchEl = document.getElementById('invLogSearch');
    const typeFilter = document.getElementById('invLogTypeFilter');
    const ventaFilterEl = document.getElementById('invLogVentaFilter');
    const dateFromEl = document.getElementById('invLogDateFrom');
    const dateToEl = document.getElementById('invLogDateTo');
    const tbody = document.getElementById('invLogBody');
    if (!tbody) return;
    if (catFilter && !_invLogCatInit) {
        _invLogCatInit = true;
        catFilter.innerHTML = '<option value="all">Todas las categorias</option>' + catOptsHtml();
    }
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const cat = catFilter ? catFilter.value : 'all';
    const type = typeFilter ? typeFilter.value : 'all';
    const ventaFilter = ventaFilterEl ? ventaFilterEl.value : 'all';
    const dateFrom = dateFromEl ? dateFromEl.value : '';
    const dateTo = dateToEl ? dateToEl.value : '';
    let filtered = filterInvLogByScope(invLog);
    if (q) filtered = filtered.filter(l => l.productName.toLowerCase().includes(q));
    if (cat !== 'all') filtered = filtered.filter(l => l.category === cat);
    if (type !== 'all') filtered = filtered.filter(l => l.type === type);
    if (!getPosScope()) {
        if (ventaFilter === 'local') filtered = filtered.filter(l => (l.type === 'salida' || l.type === 'salida_temp' || l.type === 'venta_ruta') && !l.ventaPorFuera);
        else if (ventaFilter === 'fuera') filtered = filtered.filter(l => (l.type === 'salida' || l.type === 'salida_temp' || l.type === 'venta_ruta') && l.ventaPorFuera);
    }
    if (dateFrom) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) >= dateFrom);
    if (dateTo) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) <= dateTo);
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Sin movimientos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = (_invLogSortDesc ? filtered.slice().reverse() : filtered).slice(0, 200).map(l => {
        const typeLabels = { entrada: 'Entrada', salida: 'Salida', salida_temp: 'Salida Temp.', venta_ruta: 'Venta Ruta', ajuste: 'Ajuste', retorno: 'Retorno' };
        const typeColors = { entrada: 'var(--success)', salida: 'var(--danger)', salida_temp: '#e65100', venta_ruta: '#1565c0', ajuste: 'var(--warning)', retorno: '#7b1fa2' };
        const typeLabel = '<span style="color:' + (typeColors[l.type] || 'var(--warning)') + ';font-weight:600;">' + (typeLabels[l.type] || l.type) + '</span>';
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
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q)));
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
        const lastSale = filterSalesByScope(posSales.filter(s => s.items.some(i => i.id === p.id))).pop();
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
    const modal = document.getElementById('invMovModal');
    const searchEl = document.getElementById('invMovProductSearch');
    const sel = document.getElementById('invMovProduct');
    const typeEl = document.getElementById('invMovType');
    const qtyEl = document.getElementById('invMovQty');
    const noteEl = document.getElementById('invMovNote');
    const reasonSel = document.getElementById('invMovReason');
    const titleIcon = document.getElementById('invMovTitleIcon');
    const titleText = document.getElementById('invMovTitleText');
    const confirmBtn = document.getElementById('invMovConfirmBtn');
    if (!modal || !sel || !typeEl || !reasonSel) { showToast('No se pudo abrir el formulario de inventario'); return; }
    if (searchEl) searchEl.value = '';
    sel.innerHTML = (Array.isArray(posProducts) ? posProducts : []).map(p => '<option value="' + p.id + '">' + p.name + ' (Stock: ' + p.stock + ')</option>').join('');
    typeEl.value = type;
    if (qtyEl) qtyEl.value = '1';
    if (noteEl) noteEl.value = '';
    const iconPath = titleIcon && titleIcon.tagName === 'path' ? titleIcon : (titleIcon ? titleIcon.querySelector('path') : null);
    if (type === 'entrada') {
        if (iconPath) { iconPath.style.fill = 'var(--success)'; iconPath.setAttribute('d', 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'); }
        else if (titleIcon) titleIcon.style.fill = 'var(--success)';
        if (titleText) titleText.textContent = 'Registrar Entrada';
        if (confirmBtn) { confirmBtn.textContent = 'Guardar Entrada'; confirmBtn.className = 'btn btn-primary'; confirmBtn.style.cssText = ''; }
        reasonSel.innerHTML =
            '<option value="Registro de pedido">Registro de pedido</option>' +
            '<option value="Compra a proveedor">Compra a proveedor</option>' +
            '<option value="Devolucion de cliente">Devolucion de cliente</option>' +
            '<option value="Transferencia entrante">Transferencia entrante</option>' +
            '<option value="Ajuste por inventario inicial">Ajuste por inventario inicial</option>' +
            '<option value="Otro">Otro</option>';
    } else {
        if (iconPath) { iconPath.style.fill = 'var(--danger)'; iconPath.setAttribute('d', 'M19 13H5v-2h14v2z'); }
        else if (titleIcon) titleIcon.style.fill = 'var(--danger)';
        if (titleText) titleText.textContent = 'Registrar Salida';
        if (confirmBtn) { confirmBtn.textContent = 'Guardar Salida'; confirmBtn.className = 'btn'; confirmBtn.style.cssText = 'background:var(--danger);color:#fff;'; }
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
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeInvMovModal() {
    const modal = document.getElementById('invMovModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    document.body.style.overflow = '';
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
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

function openMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const menu = document.querySelector('.mobile-menu');
    if (!sidebar || !overlay || !menu) return;
    // Show elements first (no transition yet)
    menu.style.display = 'block';
    overlay.style.display = 'block';
    // Force reflow so the browser picks up the display change
    void menu.offsetHeight;
    void overlay.offsetHeight;
    // Then add classes to trigger transitions
    sidebar.classList.add('mobile-open');
    overlay.classList.add('open');
    menu.classList.add('open');
    document.body.style.overflow = 'hidden';
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
    // Wait for transition to finish, then hide
    setTimeout(function() {
        if (!menu.classList.contains('open')) {
            menu.style.display = 'none';
            overlay.style.display = 'none';
        }
    }, 500);
}

function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    if (hamburger && !hamburger.dataset.mobileInit) {
        hamburger.dataset.mobileInit = '1';
        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleMobileMenu();
        });
    }
    const overlay = document.querySelector('.mobile-menu-overlay');
    if (overlay && !overlay.dataset.mobileInit) {
        overlay.dataset.mobileInit = '1';
        overlay.addEventListener('click', function(e) {
            e.stopPropagation();
            closeMobileMenu();
        });
    }
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
        // Skip admin-only items for empleado
        if (item.dataset.role && currentUser && currentUser.role !== 'admin') return;
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
    initMobileMenu();
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
        ? ci.payments.map(p => '<div class="receipt-row" style="font-size:12px;"><span>' + shortDate(p.date) + '</span><span style="color:var(--success);font-weight:600;">' + formatPrice(p.amount) + '</span></div>').join('')
        : '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:4px 0;">Sin pagos registrados</div>';
    const progressBar = sale.total > 0 ? Math.round((pagado / sale.total) * 100) : 0;
    const statusColor = isPaid ? 'var(--success)' : 'var(--warning)';
    const statusLabel = isPaid ? 'CANCELADA' : 'PENDIENTE';
    document.getElementById('receiptContent').innerHTML = '' +
        '<div class="receipt">' +
            '<div class="receipt-header">' +
                '<img src="Logo_Factura.png" style="max-width:160px;height:auto;margin-bottom:6px;" alt="Logo">' +
                '<h4 style="font-size:15px;margin:2px 0;">ESTADO DE CUENTA</h4>' +
                '<p style="font-size:11px;margin:2px 0;">Factura #' + sale.id + '</p>' +
                '<p style="font-size:11px;margin:2px 0;">' + new Date(sale.date).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) + '</p>' +
                '<div style="margin:6px auto;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;display:inline-block;background:' + (isPaid ? '#f0fdf4' : '#fffbe6') + ';color:' + statusColor + ';border:1px solid ' + (isPaid ? '#bbf7d0' : '#fde68a') + ';">' + statusLabel + '</div>' +
            '</div>' +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-row"><span>Cliente</span><span style="font-weight:600;">' + (sale.customer || 'Mostrador') + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Metodo</span><span>' + sale.method + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Credito</span><span>' + (ci.tipo === 'abono' ? 'Abono libre' : 'Cuotas fijas (' + ci.totalCuotas + ')') + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Productos</div>' +
            sale.items.map(i => '<div class="receipt-row" style="font-size:12px;"><span>' + (i.name || 'Producto').substring(0,20) + ' x' + i.qty + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>').join('') +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-total"><span>TOTAL VENTA</span><span>' + formatPrice(sale.total) + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Resumen de pagos</div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Total pagado</span><span style="color:var(--success);font-weight:600;">' + formatPrice(pagado) + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;' + (isPaid ? '' : 'color:var(--warning);font-weight:700;') + '"><span>Saldo pendiente</span><span>' + formatPrice(Math.max(0, pendiente)) + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Historial de pagos</div>' +
            paymentsHtml +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-footer">' +
                '<p>Documento generado el ' + new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</p>' +
                '<p style="margin-top:4px;">Gracias por su compra!</p>' +
            '</div>' +
        '</div>';
    document.getElementById('receiptModal').classList.add('open');
    const btnInv = document.getElementById('btnDownloadInv');
    if (btnInv) btnInv.style.display = 'none';
}

// ============ CUSTOMER HISTORY / CUENTA DE COBRO ============
let _custHistoryCustomerId = null;
let _mergeSelection = [];

function showCustomerHistory(custId) {
    const cust = posCustomers.find(c => c.id === custId);
    if (!cust) return;
    document.getElementById('custHistoryTitle').textContent = 'Cuenta de Cobro: ' + cust.name;
    const allSales = filterSalesByScope(posSales.filter(s => s.customerId === custId));
    const activeSales = allSales.filter(s => !s.creditInfo?.merged);
    const creditSales = activeSales.filter(s => s.creditInfo);
    const totalOwedGlobal = creditSales.reduce((sum, s) => {
        if (s.creditInfo.merged) return sum;
        if (s.creditInfo.tipo === 'abono') {
            const pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
            return sum + Math.max(0, s.creditInfo.balance - pagado);
        }
        return sum + Math.max(0, (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor);
    }, 0);
    let html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--hover);border-radius:10px;margin-bottom:16px;">';
    html += '<div><div style="font-weight:600;font-size:15px;">' + cust.name + '</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);">' + (cust.phone || '') + (cust.phone && cust.email ? ' | ' : '') + (cust.email || '') + '</div></div>';
    html += '<div style="text-align:right;"><div style="font-size:11px;color:var(--text-muted);">Saldo pendiente total</div><div style="font-size:20px;font-weight:700;' + (totalOwedGlobal > 0 ? 'color:var(--warning);' : 'color:var(--success);') + '">' + formatPrice(totalOwedGlobal) + '</div></div>';
    html += '</div>';
    if (allSales.length === 0) {
        html += '<div class="empty-state" style="padding:40px;"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg><p>Sin compras registradas</p></div>';
    } else {
        const contadoSales = activeSales.filter(s => !s.creditInfo).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
        if (contadoSales.length > 0) {
            html += '<details open style="margin-bottom:12px;"><summary style="font-size:13px;font-weight:600;color:var(--text-muted);cursor:pointer;user-select:none;padding:4px 0;">Compras de contado (' + contadoSales.length + ')</summary>';
            contadoSales.forEach(s => {
                const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
                html += '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px;">';
                html += '<span>#' + s.id + ' <span style="color:var(--text-muted);">' + shortDate(s.date) + '</span></span>';
                html += '<span>' + qty + ' prod \u00b7 ' + formatPrice(s.total) + ' \u00b7 <span style="color:var(--success);">Pagado</span></span>';
                html += '</div>';
            });
            html += '</details>';
        }
        if (creditSales.length > 0) {
            html += '<details open style="margin-bottom:12px;"><summary style="font-size:13px;font-weight:600;color:var(--text-muted);cursor:pointer;user-select:none;padding:4px 0;">Creditos y Cuentas de Cobro (' + creditSales.length + ')</summary>';
            creditSales.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0)).forEach(s => {
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
                const checked = _mergeSelection.includes(s.id) ? ' checked' : '';
                const disabled = isPaid ? ' disabled' : '';
                const mergedInto = s.creditInfo.merged ? s.creditInfo.mergedInto : null;
                html += '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;' + (checked && !isPaid ? 'border-color:var(--primary);box-shadow:0 0 0 2px rgba(37,99,235,0.2);' : '') + '">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:' + (isPaid ? '#f0fdf4' : '#fffbe6') + ';border-bottom:1px solid var(--border);">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                if (!isPaid) {
                    html += '<input type="checkbox" class="merge-check" data-sale="' + s.id + '" onchange="toggleMergeSelect(' + s.id + ', this.checked)"' + checked + ' style="width:16px;height:16px;cursor:pointer;">';
                }
                html += '<div><strong>#' + s.id + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + shortDate(s.date) + '</span></div>';
                html += '</div>';
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
                } else if (mergedInto) {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--text-muted);font-weight:500;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--text-muted);vertical-align:middle;margin-right:2px;"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg> Unida en #' + mergedInto + '</span>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-outline" onclick="showFinalInvoice(' + s.id + ')">Factura</button>' : '') + '</div>';
                } else {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--success);font-weight:600;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--success);vertical-align:middle;margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Pagado</span>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura</button>' : '') + '</div>';
                }
                html += '</div></div>';
            });
            html += '</details>';
        }
        const mergedSales = allSales.filter(s => s.creditInfo?.merged).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
        if (mergedSales.length > 0) {
            html += '<details style="margin-bottom:12px;"><summary style="font-size:13px;font-weight:600;color:var(--text-muted);cursor:pointer;user-select:none;padding:4px 0;">Facturas unidas (' + mergedSales.length + ')</summary>';
            mergedSales.forEach(s => {
                const qty = s.items ? s.items.reduce((sum, i) => sum + i.qty, 0) : 0;
                const pagado = s.creditInfo.payments ? s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0) : 0;
                html += '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--hover);border-bottom:1px solid var(--border);">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<span style="font-size:11px;padding:2px 8px;background:#f3f4f6;border-radius:4px;color:var(--text-muted);">UNIDA</span>';
                html += '<div><strong>#' + s.id + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + shortDate(s.date) + '</span></div>';
                html += '</div>';
                html += '<div style="font-weight:600;font-size:13px;">' + formatPrice(s.total) + '</div>';
                html += '</div>';
                if (s.items && s.items.length > 0) {
                    html += '<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);">';
                    html += s.items.map(i => (i.name || 'Producto').substring(0, 20) + ' x' + i.qty).join(' \u00b7 ');
                    html += '</div>';
                }
                if (s.creditInfo.payments && s.creditInfo.payments.length > 0) {
                    html += '<div style="padding:4px 12px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--border);">';
                    html += 'Pagos: ' + s.creditInfo.payments.map(p => formatPrice(p.amount)).join(' + ');
                    html += '</div>';
                }
                html += '</div>';
            });
            html += '</details>';
        }
        // Merge action bar
        const unpaidCount = creditSales.filter(s => {
            let pending = 0;
            if (s.creditInfo.tipo === 'abono') {
                pending = s.creditInfo.balance - s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
            } else {
                pending = (s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor;
            }
            return pending > 0;
        }).length;
        if (unpaidCount >= 2) {
            html += '<div id="mergeBar" style="display:none;margin-top:16px;padding:12px 16px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div><span style="font-weight:600;font-size:14px;" id="mergeCount">0 seleccionadas</span><span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Selecciona las facturas que deseas unir</span></div>';
            html += '<button class="btn btn-primary" id="mergeBtn" disabled onclick="mergeSelectedSales()" style="font-size:13px;padding:8px 16px;">Unir seleccionadas</button>';
            html += '</div></div>';
        }
    }
    document.getElementById('custHistoryContent').innerHTML = html;
    document.getElementById('custHistoryModal').classList.add('open');
    _custHistoryCustomerId = custId;
    updateMergeBar();
}

function toggleMergeSelect(saleId, checked) {
    const idx = _mergeSelection.indexOf(saleId);
    if (checked && idx === -1) {
        _mergeSelection.push(saleId);
    } else if (!checked && idx >= 0) {
        _mergeSelection.splice(idx, 1);
    }
    updateMergeBar();
}

function updateMergeBar() {
    const bar = document.getElementById('mergeBar');
    const btn = document.getElementById('mergeBtn');
    const count = document.getElementById('mergeCount');
    if (bar) bar.style.display = _mergeSelection.length > 0 ? '' : 'none';
    if (btn) btn.disabled = _mergeSelection.length < 2;
    if (count) count.textContent = _mergeSelection.length + ' seleccionada' + (_mergeSelection.length !== 1 ? 's' : '');
}

async function mergeSelectedSales() {
    if (_mergeSelection.length < 2) return;
    const custId = _custHistoryCustomerId;
    const cust = posCustomers.find(c => c.id === custId);
    if (!cust) return;

    const sales = filterSalesByScope(posSales.filter(s => _mergeSelection.includes(s.id)));
    if (sales.length < 2) return;

    showMergeConfirmModal(cust.name, sales.length, async () => {
    try {
        const combinedTotal = sales.reduce((sum, s) => sum + s.total, 0);
        const allItems = [];
        sales.forEach(s => { if (s.items) s.items.forEach(item => allItems.push({ ...item })); });
        const combinedPayments = [];
        sales.forEach(s => { if (s.creditInfo && s.creditInfo.payments) combinedPayments.push(...s.creditInfo.payments); });

        const nextSaleId = posSales.length > 0 ? Math.max(...posSales.map(s => s.id)) + 1 : 1;
        const mergedFromIds = sales.map(s => s.id);
        const mergedSale = {
            id: nextSaleId,
            customerId: custId,
            customer: cust.name,
            items: allItems,
            total: combinedTotal,
            excedente: 0,
            method: 'Credito',
            methodKey: 'credito',
            creditInfo: {
                tipo: 'abono',
                totalCuotas: 0,
                cuotaValor: 0,
                pagadas: 0,
                payments: combinedPayments,
                balance: combinedTotal,
                mergedFrom: mergedFromIds
            },
            ventaPorFuera: sales[0].ventaPorFuera || false,
            date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            status: 'completada'
        };

        if (API.isAvailable) {
            try {
                const savedSale = await API.saveSale({
                    customer_id: parseInt(cust.id.replace('c', '')),
                    customer_name: cust.name,
                    total: combinedTotal,
                    excedente: 0,
                    method: 'Credito',
                    method_key: 'credito',
                    credit_info: mergedSale.creditInfo,
                    venta_por_fuera: mergedSale.ventaPorFuera,
                    created_at: mergedSale.created_at,
                    items: allItems
                });
                if (savedSale && savedSale.id) {
                    mergedSale.id = savedSale.id;
                    mergedSale.apiSynced = true;
                }
            } catch (e) {
                console.error('[POS] API saveSale error:', e);
            }
        }

        for (const s of sales) {
            s.creditInfo = { ...s.creditInfo, merged: true, mergedInto: mergedSale.id, balance: 0, payments: s.creditInfo.payments || [] };
            if (API.isAvailable) {
                try {
                    await API.updateSale(s.id, { credit_info: s.creditInfo });
                } catch (e) {
                    console.error('[POS] API updateSale error:', e);
                }
            }
        }

        posSales.push(mergedSale);
        saveSales();
        showToast('Facturas unidas exitosamente como #' + mergedSale.id);
        _mergeSelection = [];
        showCustomerHistory(custId);
    } catch (e) {
        showToast('Error al unir facturas: ' + e.message);
        console.error(e);
    }
    });
}

function showMergeConfirmModal(customerName, count, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div class="modal" style="max-width:440px;text-align:center;">
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            <div style="padding:16px 0 8px;">
                <svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:var(--warning);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <h3 style="margin:12px 0 4px;font-size:18px;">Unir Facturas</h3>
                <p style="color:var(--text-muted);font-size:14px;line-height:1.5;margin:8px 0;">
                    Se unirán <strong>${count} facturas</strong> de <strong>${customerName}</strong> en una nueva factura con el total combinado.
                    Las originales quedarán como registro.
                </p>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;padding:16px 0 8px;">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()" style="padding:10px 24px;font-size:14px;">Cancelar</button>
                <button class="btn btn-primary" id="mergeConfirmBtn" style="padding:10px 24px;font-size:14px;">Unir facturas</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('mergeConfirmBtn').addEventListener('click', function() {
        overlay.remove();
        callback();
    });
}

function closeCustHistory() {
    document.getElementById('custHistoryModal').classList.remove('open');
    _custHistoryCustomerId = null;
    _mergeSelection = [];
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

// ============ MERGE DUPLICATE CATEGORIES & SUBCATEGORIES ============
function mergeDuplicateSubcats() {
    let merged = 0;
    // 1) Merge duplicate PARENT categories (same label)
    const parentsByLabel = {};
    POS_CATEGORIES.filter(c => !c.parent_key).forEach(c => {
        if (!parentsByLabel[c.label]) parentsByLabel[c.label] = [];
        parentsByLabel[c.label].push(c);
    });
    Object.entries(parentsByLabel).forEach(([label, groups]) => {
        if (groups.length <= 1) return;
        const keep = groups[0];
        for (let i = 1; i < groups.length; i++) {
            const removeKey = groups[i].key;
            // Reassign subcategories pointing to removed parent
            POS_CATEGORIES.forEach(c => {
                if (c.parent_key === removeKey) c.parent_key = keep.key;
            });
            // Reassign products with this category
            posProducts.forEach(p => {
                if (p.category === removeKey) p.category = keep.key;
            });
            const idx = POS_CATEGORIES.findIndex(c => c.key === removeKey);
            if (idx >= 0) POS_CATEGORIES.splice(idx, 1);
            merged++;
        }
    });
    // 2) Merge duplicate SUBCATEGORIES (same label)
    const subsByLabel = {};
    POS_CATEGORIES.filter(c => c.parent_key).forEach(c => {
        if (!subsByLabel[c.label]) subsByLabel[c.label] = [];
        subsByLabel[c.label].push(c);
    });
    Object.entries(subsByLabel).forEach(([label, groups]) => {
        if (groups.length <= 1) return;
        const keep = groups[0];
        for (let i = 1; i < groups.length; i++) {
            const removeKey = groups[i].key;
            posProducts.forEach(p => {
                if (p.subcategory === removeKey) p.subcategory = keep.key;
            });
            const idx = POS_CATEGORIES.findIndex(c => c.key === removeKey);
            if (idx >= 0) POS_CATEGORIES.splice(idx, 1);
            merged++;
        }
    });
    if (merged) {
        saveProducts();
        saveCategories();
        refreshProdCatFilter();
        renderProductTable();
    }
    return merged;
}

// ============ IMPORT PRODUCTS ============
function importProductsFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data) || data.length === 0) { alert('El archivo no contiene productos.'); return; }
            // Auto-create categories from products
            const catLabels = {
                'suplementos': 'Suplementos', 'belleza_y_bienestar': 'Belleza y bienestar',
                'salud_y_bienestar': 'Salud y bienestar', 'vitaminas': 'Vitaminas'
            };
            const subLabels = {
                'suplementos_complejo-b': 'Complejo B', 'suplementos_salud-sanguinea': 'Salud sanguínea',
                'vitaminas_antioxidantes': 'Antioxidantes', 'salud_limpieza-intestinal': 'Limpieza intestinal',
                'suplementos_sistema-inmunologico': 'Sistema inmunológico', 'belleza_calendula': 'Calendula',
                'belleza_colageno': 'Colageno', 'suplementos_potencia-masculina': 'Potencia Masculina',
                'salud_rinones': 'Riñones y vías urinarias', 'salud_gastritis': 'Gastritis y acidez',
                'belleza_glucosamina': 'Glucosamina', 'suplementos_balance-hormonal': 'Balance hormonal',
                'suplementos_perdida-de-peso': 'Pérdida de peso', 'vitaminas_magnesio': 'Magnecio',
                'vitaminas_vitamina-e': 'Vitamina E', 'vitaminas_calcio': 'Calcio',
                'suplementos_creatina': 'Creatina', 'suplementos_proteina': 'Proteina',
                'vitaminas_vitamina-c': 'Vitamina C', 'salud_desparasitacion': 'Desparasitación',
                'suplementos_resveratrol': 'Resveratrol', 'vitaminas_multivitaminicos': 'Multivitamínicos',
                'salud_rendimiento-mental': 'Rendimiento mental', 'belleza_articulaciones': 'Articulaciones',
                'salud_salud-sueno': 'Salud de sueño', 'salud_higado': 'Hígado y Vesícula',
                'salud_diabetes': 'Diabetes', 'salud_prostata': 'Próstata',
                'salud_laxante': 'Laxante', 'suplementos_energia': 'Energía',
                'salud_omega': 'Omega', 'vitaminas_vitamina-b': 'Vitaminas B',
                'vitaminas_vitamina-d': 'Vitamina D', 'vitaminas_vitamina-a': 'Vitamina A',
                'vitaminas_zinc': 'Zinc', 'vitaminas_biotina': 'Biotina',
                'salud_circulacion': 'Circulación', 'suplementos_sexualidad': 'Sexualidad',
                'salud_inflamacion': 'Inflamación', 'salud_digestion': 'Digestión'
            };
            let catsAdded = 0;
            for (const [key, label] of Object.entries(catLabels)) {
                if (!POS_CATEGORIES.find(c => c.key === key)) {
                    POS_CATEGORIES.push({ key, label, _synced: false });
                    catsAdded++;
                }
            }
            for (const [key, label] of Object.entries(subLabels)) {
                if (!POS_CATEGORIES.find(c => c.key === key)) {
                    const parentKey = key.split('_')[0];
                    POS_CATEGORIES.push({ key, label, parent_key: parentKey, _synced: false });
                    catsAdded++;
                }
            }
            if (catsAdded) saveCategories();
            // Import products (skip duplicates by name+brand, but update images)
            let nextId = posProducts.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace('p',''))), 0) + 1;
            let imported = 0, updated = 0, skipped = 0;
            for (const p of data) {
                const dup = posProducts.find(x => x.name.toLowerCase() === p.name.toLowerCase() && (x.brand||'').toLowerCase() === (p.brand||'').toLowerCase());
                if (dup) {
                    if (p.img && p.img !== dup.img) { dup.img = p.img; updated++; }
                    skipped++;
                    continue;
                }
                p.id = 'p' + (nextId++);
                posProducts.push(p);
                imported++;
            }
            saveProducts();
            refreshProdCatFilter();
            renderProductTable();
            // Auto-merge duplicate subcategories
            const merged = mergeDuplicateSubcats();
            alert(imported + ' productos nuevos!' + (updated ? '\n' + updated + ' imágenes actualizadas.' : '') + (skipped ? '\n' + skipped + ' duplicados omitidos.' : '') + (merged ? '\n' + merged + ' subcategorías unidas.' : '') + (catsAdded ? '\n' + catsAdded + ' categorías creadas.' : ''));
        } catch(err) { alert('Error al leer archivo: ' + err.message); }
    };
    reader.readAsText(file);
}

// ============ DATE DISPLAY ============
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

function initCatFilter() {
    refreshProdCatFilter();
    mergeDuplicateSubcats();
}
