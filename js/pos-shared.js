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
    if (!scope) return log.filter(l => l.synced);
    return log.filter(l => {
        if (!l.synced) return false;
        const isShared = l.reason && (l.reason.startsWith('Movimiento a Bastidas') || l.reason.startsWith('Movimiento a Curinca') || l.reason.startsWith('Movimiento a Liceth'));
        if (isShared) return true;
        return scope === 'local' ? !l.ventaPorFuera : !!l.ventaPorFuera;
    });
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

const DEFAULT_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23e8f5e9' width='200' height='200'/%3E%3Cpath fill='%234caf50' d='M100 40c-33 0-60 27-60 60s27 60 60 60 60-27 60-60-27-60-60-60zm0 110c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z'/%3E%3Cpath fill='%234caf50' d='M90 85h20v40H90zm0-20h20v15H90z'/%3E%3C/svg%3E";
const LOGO_URL = (function() { try { return new URL('Logo_Factura.png', window.location.href).href; } catch(e) { return 'Logo_Factura.png'; } })();
let LOGO_DATA_URL = '';
(function preloadLogo() {
    fetch(LOGO_URL).then(r => r.blob()).then(blob => {
        const reader = new FileReader();
        reader.onload = function() { LOGO_DATA_URL = reader.result; };
        reader.readAsDataURL(blob);
    }).catch(function() {});
})();

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
let labOrders = [];
let nextLabOrderId = 1;
let supplierExpenses = [];
let nextSupplierExpenseId = 1;
let posLabs = [];

let cashBase = 0;
let cashExpenses = [];
let cashDate = today();

function loadData() {
    try {
        posProducts = JSON.parse(localStorage.getItem('posProducts')) || null;
        posSales = JSON.parse(localStorage.getItem('posSales')) || [];
        posCustomers = JSON.parse(localStorage.getItem('posCustomers')) || [];
        posCart = JSON.parse(localStorage.getItem('posCart_' + (typeof POS_SCOPE !== 'undefined' ? POS_SCOPE : 'local'))) || [];
        invLog = JSON.parse(localStorage.getItem('invLog')) || [];
        posSuppliers = JSON.parse(localStorage.getItem('posSuppliers')) || [];
        labOrders = JSON.parse(localStorage.getItem('labOrders')) || [];
        supplierExpenses = JSON.parse(localStorage.getItem('supplierExpenses')) || [];
        posLabs = JSON.parse(localStorage.getItem('posLabs')) || [];
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
    if (labOrders.length > 0) {
        nextLabOrderId = Math.max(...labOrders.map(o => parseInt(String(o.id).replace('lab_', '')) || 0)) + 1;
    }
    if (supplierExpenses.length > 0) {
        nextSupplierExpenseId = Math.max(...supplierExpenses.map(e => parseInt(String(e.id).replace('se_', '')) || 0)) + 1;
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
            const localMap = {};
            posSales.forEach(ls => { localMap[ls.id] = ls; });
            const localUnsynced = posSales.filter(ls => !apiSalesMap[ls.id] && !ls.apiSynced);
            posSales = apiSales.map(s => {
                const local = localMap[s.id];
                const ci = s.credit_info || null;
                if (ci) {
                    if (ci.payments && ci.payments.length > 0) {
                    } else if (s.payments && s.payments.length > 0) {
                        ci.payments = s.payments
                            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                            .map(p => ({ date: p.created_at, amount: p.amount }));
                    } else {
                        ci.payments = [];
                    }
                }
                let apiTotal = parseFloat(s.total);
                let apiItems = (s.items || []).map(i => ({ id: i.product_id, name: i.product_name, qty: i.qty, price: parseFloat(i.price) }));
                if (local && local.apiSynced && local.items && local.items.length > 0) {
                    const localTotal = local.items.reduce((sum, it) => sum + ((parseFloat(it.price) || 0) * (parseInt(it.qty) || 0)), 0);
                    if (Math.abs(localTotal - apiTotal) > 1 && localTotal > 0) {
                        apiTotal = localTotal;
                        apiItems = local.items;
                    }
                }
                return {
                    id: s.id,
                    apiId: s.id,
                    apiSynced: true,
                    date: utcToLocalDate(s.created_at),
                    created_at: s.created_at,
                    items: apiItems,
                    subtotal: apiTotal - parseFloat(s.excedente || 0),
                    excedente: parseFloat(s.excedente || 0),
                    total: apiTotal,
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
            const apiIds = new Set((apiInvLog || []).map(al => al.id));
            if (apiInvLog && apiInvLog.length > 0) {
                apiInvLog.forEach(al => {
                    const existing = invLog.find(l =>
                        l.id === al.id ||
                        l.apiId === al.id ||
                        (l.productId === (String(al.product_id).startsWith('p') ? al.product_id : 'p' + al.product_id) &&
                         l.date && al.created_at &&
                         Math.abs(new Date(l.date) - new Date(al.created_at)) < 60000 &&
                         l.type === al.type &&
                         l.quantity === al.quantity)
                    );
                    if (existing) {
                        existing.synced = true;
                        existing.apiId = al.id;
                        if (!existing.id || existing.id !== al.id) existing.id = al.id;
                    } else {
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
                            unitPrice: al.unit_price || 0,
                            synced: true,
                            apiId: al.id
                        });
                    }
                });
            }
            // Remove entries that have apiId but are no longer in the API (deleted from DB)
            invLog = invLog.filter(l => !l.apiId || apiIds.has(l.apiId));
            // Clean up synced entries without apiId (pre-apiId era) that don't match any API entry by content
            if (apiInvLog) {
                invLog = invLog.filter(l => {
                    if (!(l.synced && !l.apiId)) return true;
                    return apiInvLog.some(al =>
                        l.productId === (String(al.product_id).startsWith('p') ? al.product_id : 'p' + al.product_id) &&
                        l.type === al.type &&
                        l.quantity === al.quantity &&
                        Math.abs(new Date(l.date) - new Date(al.created_at)) < 60000
                    );
                });
            }
            localStorage.setItem('invLog', JSON.stringify(invLog));
            invNextLogId = invLog.reduce((m, l) => Math.max(m, l.id), 0) + 1;
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
        // Sync lab orders from API - always replace with DB data
        try {
            const apiLabOrders = await API.getLabOrders();
            if (apiLabOrders) {
                labOrders = apiLabOrders.map(ao => ({
                    id: 'lab_' + ao.id,
                    lab: ao.lab,
                    date: ao.created_at,
                    status: ao.status || 'pendiente',
                    items: ao.items || [],
                    total: ao.total || 0,
                    notes: ao.notes || '',
                    _synced: true
                }));
                saveLabOrders();
            }
        } catch(e) {}
        // Sync supplier expenses from API - always replace with DB data
        try {
            const apiExpenses = await API.getSupplierExpenses();
            if (apiExpenses) {
                supplierExpenses = apiExpenses.map(e => ({
                    id: 'se_' + e.id,
                    supplier: e.supplier,
                    date: utcToLocalDate(e.created_at),
                    notes: e.notes || '',
                    _synced: true
                }));
                localStorage.setItem('supplierExpenses', JSON.stringify(supplierExpenses));
            }
        } catch(e) {}
        // Sync labs from API - always replace with DB data
        try {
            const apiLabs = await API.getLabs();
            if (apiLabs) {
                posLabs = apiLabs.map(l => ({ id: l.id, name: l.name }));
                localStorage.setItem('posLabs', JSON.stringify(posLabs));
            }
        } catch(e) {}
        saveProducts();
        saveCustomers();
    } catch (e) {
        console.log('API sync skipped, using local data');
    }
}
function saveCart() { localStorage.setItem('posCart_' + (typeof POS_SCOPE !== 'undefined' ? POS_SCOPE : 'local'), JSON.stringify(posCart)); }
function saveInvLog() {
    const json = JSON.stringify(invLog);
    localStorage.setItem('invLog', json);
    if (API.isAvailable) {
        const promises = [];
        invLog.forEach(l => {
            if (!l.synced && !l._sending) {
                l._sending = true;
                const p = API.addInventoryLog({
                    product_id: l.productId,
                    product_name: l.productName,
                    type: l.type,
                    quantity: l.quantity,
                    previous_stock: l.previousStock,
                    new_stock: l.newStock,
                    reason: l.reason || '',
                    sale_id: l.saleId || null,
                    venta_por_fuera: l.ventaPorFuera || false,
                    unit_price: l.unitPrice || 0
                }).then((resp) => {
                    l.synced = true;
                    l._sending = false;
                    if (resp && resp.id) l.apiId = resp.id;
                    localStorage.setItem('invLog', JSON.stringify(invLog));
                }).catch(e => {
                    l._sending = false;
                    if (e && (e.code === '23505' || (e.message && e.message.includes('duplicate')))) {
                        l.synced = true;
                    } else {
                        console.error('[POS] addInventoryLog error:', e.message || e);
                    }
                });
                promises.push(p);
            }
        });
        return Promise.allSettled(promises);
    }
    return Promise.resolve();
}
function addInvLog(productId, productName, type, quantity, previousStock, newStock, reason, saleId, ventaPorFuera, unitPrice) {
    const prod = posProducts.find(p => p.id === productId);
    const category = prod ? prod.category : '';
    const validSaleId = (saleId && posSales.some(s => s.id === saleId && (s.apiSynced || s._synced))) ? saleId : null;
    invLog.push({ id: invNextLogId++, date: now(), productId, productName, type, quantity, previousStock, newStock, reason, saleId: validSaleId, category, ventaPorFuera: ventaPorFuera || false, unitPrice: unitPrice || 0, synced: false });
    saveInvLog();
}

// ============ UTILS ============
function formatPrice(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
function nowLocal() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}
function utcToLocalDate(isoStr) {
    if (!isoStr) return today();
    const d = new Date(isoStr);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}
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
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:30px;">No hay productos</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map((p, idx) => {
        const stockTag = p.stock <= 0 ? 'tag-danger' : p.stock <= 5 ? 'tag-warning' : 'tag-success';
        const stockText = p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Stock Bajo' : 'Disponible';
        const supp = p.supplier ? posSuppliers.find(s => s.id === p.supplier) : null;
        const brandTag = p.brand ? '<span style="background:var(--bg-alt,#e8f5e9);color:var(--primary,#0b513b);padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer;" onclick="assignProductToLab(\'' + p.id + '\')" title="Cambiar laboratorio">' + p.brand + '</span>' : '<button onclick="assignProductToLab(\'' + p.id + '\')" style="background:none;border:1px dashed var(--border);border-radius:10px;padding:2px 8px;font-size:11px;color:var(--text-muted);cursor:pointer;" title="Asignar laboratorio">+ Lab</button>';
        return `<tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${p.name}</strong></td>
            <td>${brandTag}</td>
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

async function openProductModal(id) {
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
    // Setup lab autocomplete
    setupProdBrandAutocomplete();
    _prodMainImg = '';
    document.getElementById('prodMainPreview').style.display = 'none';
    document.getElementById('prodMainUploadStatus').textContent = '';
    updateSubcatSelect();
    // Hide cost for employees
    const costGroup = document.getElementById('prodCostGroup');
    if (costGroup) costGroup.style.display = (currentUser && currentUser.role === 'empleado') ? 'none' : '';
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

function compressImage(file, maxWidth = 600, quality = 0.8) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/') || file.size < 100000) { resolve(file); return; }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(b => {
                if (b && b.size < file.size) {
                    resolve(new File([b], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                } else { resolve(file); }
            }, 'image/jpeg', quality);
        };
        img.src = URL.createObjectURL(file);
    });
}

function uploadMainImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const status = document.getElementById('prodMainUploadStatus');
    status.textContent = 'Comprimiendo...';
    compressImage(file).then(compressed => {
        status.textContent = 'Subiendo...';
        return API.uploadImage(compressed);
    }).then(result => {
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
    status.textContent = 'Comprimiendo ' + files.length + ' imagen(es)...';
    const fileArr = Array.from(files);
    Promise.all(fileArr.map(f => compressImage(f))).then(compressed => {
        status.textContent = 'Subiendo ' + compressed.length + ' imagen(es)...';
        return API.uploadImages(compressed);
    }).then(result => {
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
    const costField = document.getElementById('prodCost');
    const cost = (currentUser && currentUser.role === 'empleado' && id)
        ? (posProducts.find(pr => pr.id === id)?.cost || 0)
        : (parseFloat(costField.value) || 0);
    const stock = parseInt(document.getElementById('prodStock').value) || 0;
    const img = document.getElementById('prodImg').value.trim();
    const desc = document.getElementById('prodDesc').value.trim();
    const supplier = document.getElementById('prodSupplier').value;
    const featured = document.getElementById('prodFeatured').checked;
    const visible = document.getElementById('prodVisible').checked;
    const subcategory = document.getElementById('prodSubcategory').value;

    if (!name) { showToast('Nombre requerido'); return; }
    const normalizedBrand = brand ? brand.trim().replace(/\s+/g, ' ') : '';
    if (normalizedBrand && normalizedBrand !== brand) {
        const lc = normalizedBrand.toLowerCase();
        posProducts.forEach(p => { if (p.brand && p.brand.toLowerCase() === lc) p.brand = normalizedBrand; });
    }
    const images = _prodImages.length > 0 ? _prodImages : undefined;
    const finalImg = _prodMainImg || img || (images && images.length > 0 ? images[0] : '');

    if (id) {
        const p = posProducts.find(pr => pr.id === id);
        if (p) {
            if (p.subcategory && !subcategory) {
                if (!confirm('Estas a punto de quitar la subcategoria "' + (POS_CATEGORIES.find(c => c.key === p.subcategory)?.label || p.subcategory) + '" del producto. Continuar?')) { closeProductModal(); return; }
            }
            const prevStock = p.stock;
            Object.assign(p, { name, catalogName, barcode, brand: normalizedBrand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, visible, subcategory });
            if (stock !== prevStock) {
                const diff = stock - prevStock;
                addInvLog(p.id, p.name, diff > 0 ? 'entrada' : 'salida', diff, prevStock, stock, 'Ajuste manual desde productos', null, getPosScope() === 'fuera');
            }
        }
    } else {
        posProducts.push({ id: 'p' + posNextProductId++, name, catalogName, barcode, brand: normalizedBrand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, visible, subcategory, _synced: false });
    }
    saveProducts();
    // Auto-create lab in DB if new brand
    if (normalizedBrand && !posLabs.some(l => l.name.toLowerCase() === normalizedBrand.toLowerCase())) {
        API.saveLab(normalizedBrand).then(lab => {
            posLabs.push({ id: lab.id, name: normalizedBrand });
            localStorage.setItem('posLabs', JSON.stringify(posLabs));
        }).catch(() => {});
    }
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

function setupProdBrandAutocomplete() {
    const input = document.getElementById('prodBrand');
    const dropdown = document.getElementById('prodBrandDropdown');
    if (!input || !dropdown) return;
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function() { filterProdBrandDropdown(this.value); });
    input.addEventListener('focus', function() { filterProdBrandDropdown(this.value); });
    input.addEventListener('blur', function() { setTimeout(() => dropdown.style.display = 'none', 200); });
}

function filterProdBrandDropdown(query) {
    const dropdown = document.getElementById('prodBrandDropdown');
    if (!dropdown) return;
    const q = (query || '').toLowerCase().trim();
    const brands = {};
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (b) brands[b] = (brands[b] || 0) + 1;
    });
    posLabs.forEach(l => {
        const key = (l.name || '').trim();
        if (key && !brands[key]) brands[key] = 0;
    });
    let list = Object.entries(brands).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    if (q) list = list.filter(b => b.name.toLowerCase().includes(q));
    if (list.length === 0) { dropdown.style.display = 'none'; return; }
    dropdown.innerHTML = list.map(b =>
        '<div onmousedown="document.getElementById(\'prodBrand\').value=\'' + b.name.replace(/'/g, "\\'") + '\';document.getElementById(\'prodBrandDropdown\').style.display=\'none\';" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">' +
        '<span>' + b.name + '</span><span style="color:#999;font-size:12px;">' + b.count + ' productos</span></div>'
    ).join('');
    dropdown.style.display = 'block';
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
        const rowBg = pendingTotal > 30000 ? 'background:rgba(255,165,0,0.20);' : pendingTotal >= 20000 ? 'background:rgba(59,130,246,0.15);' : pendingTotal > 0 ? 'background:rgba(255,165,0,0.10);' : 'background:rgba(34,197,94,0.15);';
        return `<tr style="${rowBg}">
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
            const totalPagadoFijo = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
            const totalSaleFijo = s.creditInfo.totalCuotas * s.creditInfo.cuotaValor;
            return sum + Math.max(0, totalSaleFijo - totalPagadoFijo);
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
    posSales.filter(s => s.customerId === id).forEach(s => {
        const saleApiId = s.id && s.id < 100000 ? s.id : null;
        if (saleApiId && API.isAvailable) API.deleteSale(saleApiId).catch(e => {});
    });
    posSales = posSales.filter(s => s.customerId !== id);
    posCustomers = posCustomers.filter(c => c.id !== id);
    saveSales();
    saveCustomers();
    renderCustomerTable();
    if (typeof renderAccountStatus === 'function') renderAccountStatus();
    showToast('Cliente eliminado');
}

// ============ ACCOUNT EDIT ============
function openAccountEditModal(cId) {
    const customer = posCustomers.find(c => c.id === cId);
    if (!customer) return;
    document.getElementById('accountEditCustId').value = cId;
    document.getElementById('accountEditName').value = customer.name || '';
    document.getElementById('accountEditPhone').value = customer.phone || '';
    const sales = posSales.filter(s => s.customerId === cId && !s.creditInfo?.merged);
    const listEl = document.getElementById('accountEditSalesList');
    if (sales.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">Este cliente no tiene ventas registradas.</p>';
    } else {
        listEl.innerHTML = '<label style="font-weight:600;font-size:13px;margin-bottom:8px;display:block;">Ventas del cliente</label>' +
            sales.map(s => {
                const dateStr = new Date(s.date || s.created_at || '').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
                const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
                const items = (s.items || []);
                const itemsHtml = items.length > 0
                    ? items.map((it, idx) => {
                        const ip = parseFloat(it.price) || 0;
                        const iq = parseInt(it.qty) || 0;
                        return '<div style="display:flex;gap:6px;align-items:center;padding:4px 0;' + (idx < items.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
                            '<span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (it.name || 'Prod') + '">' + (it.name || 'Prod').substring(0, 24) + '</span>' +
                            '<input type="number" min="0" class="acct-edit-item-qty" data-sale-id="' + s.id + '" data-item-idx="' + idx + '" value="' + iq + '" style="width:44px;padding:3px 4px;border:1px solid var(--border);border-radius:4px;font-size:12px;text-align:center;">' +
                            '<span style="font-size:11px;color:var(--text-muted);">x</span>' +
                            '<input type="number" min="0" step="50" class="acct-edit-item-price" data-sale-id="' + s.id + '" data-item-idx="' + idx + '" value="' + ip + '" style="width:80px;padding:3px 4px;border:1px solid var(--border);border-radius:4px;font-size:12px;text-align:right;">' +
                            '<span style="font-size:11px;color:var(--text-muted);min-width:20px;text-align:right;" id="acct-item-sub-' + s.id + '-' + idx + '">' + formatPrice(ip * iq) + '</span>' +
                        '</div>';
                    }).join('')
                    : '<p style="font-size:12px;color:var(--text-muted);padding:4px 0;">Sin productos</p>';
                const saleTotal = parseFloat(s.total) || 0;
                let currentStatus = 'pendiente';
                if (paid >= saleTotal && saleTotal > 0) currentStatus = 'pagada';
                else if (paid > 0) currentStatus = 'abonada';
                return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--bg-alt);">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                        '<div style="display:flex;align-items:center;gap:6px;">' +
                            '<input type="date" class="acct-edit-sale-date" data-sale-id="' + s.id + '" value="' + (s.date || s.created_at || '').split('T')[0] + '" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;">' +
                            '<span style="font-size:12px;color:var(--text-muted);">#' + s.id + '</span>' +
                        '</div>' +
                        '<span style="font-size:13px;font-weight:600;" id="acct-sale-total-' + s.id + '">' + formatPrice(saleTotal) + '</span>' +
                    '</div>' +
                    itemsHtml +
                    '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid var(--border);flex-wrap:wrap;">' +
                        '<label style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Estado:</label>' +
                        '<select class="acct-edit-sale-status" data-sale-id="' + s.id + '" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;font-weight:600;">' +
                            '<option value="pagada"' + (currentStatus === 'pagada' ? ' selected' : '') + '>Pagada</option>' +
                            '<option value="abonada"' + (currentStatus === 'abonada' ? ' selected' : '') + '>Abonada</option>' +
                            '<option value="pendiente"' + (currentStatus === 'pendiente' ? ' selected' : '') + '>Pendiente</option>' +
                        '</select>' +
                        '<button type="button" class="btn btn-sm btn-outline acct-mark-paid-btn" data-sale-id="' + s.id + '" data-sale-total="' + s.total + '" style="font-size:11px;padding:2px 8px;color:var(--success);border-color:var(--success);">Marcar pagada</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        listEl.querySelectorAll('.acct-edit-item-price, .acct-edit-item-qty').forEach(inp => {
            inp.addEventListener('input', function() {
                const saleId = this.dataset.saleId;
                const idx = parseInt(this.dataset.itemIdx);
                const sale = posSales.find(s => String(s.id) === saleId);
                if (!sale || !sale.items[idx]) return;
                const qty = parseFloat(document.querySelector('.acct-edit-item-qty[data-sale-id="' + saleId + '"][data-item-idx="' + idx + '"]').value) || 0;
                const price = parseFloat(document.querySelector('.acct-edit-item-price[data-sale-id="' + saleId + '"][data-item-idx="' + idx + '"]').value) || 0;
                document.getElementById('acct-item-sub-' + saleId + '-' + idx).textContent = formatPrice(price * qty);
                let newTotal = 0;
                document.querySelectorAll('.acct-edit-item-price[data-sale-id="' + saleId + '"]').forEach((p, i) => {
                    const q = parseFloat(document.querySelector('.acct-edit-item-qty[data-sale-id="' + saleId + '"][data-item-idx="' + i + '"]').value) || 0;
                    newTotal += (parseFloat(p.value) || 0) * q;
                });
                document.getElementById('acct-sale-total-' + saleId).textContent = formatPrice(newTotal);
            });
        });
        listEl.querySelectorAll('.acct-mark-paid-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const saleId = this.dataset.saleId;
                const sale = posSales.find(s => String(s.id) === saleId);
                if (!sale) return;
                sale.payments = [{ date: nowLocal(), amount: sale.total }];
                sale.method = 'Efectivo';
                sale.creditInfo = null;
                const apiId = sale.id && sale.id < 100000 ? sale.id : null;
                if (apiId && API.isAvailable) {
                    API.updateSale(apiId, { method: sale.method, credit_info: null, total: sale.total }).catch(e => {});
                }
                sale.apiSynced = true;
                const sel = listEl.querySelector('.acct-edit-sale-status[data-sale-id="' + saleId + '"]');
                if (sel) sel.value = 'pagada';
                showToast('Venta #' + saleId + ' marcada como pagada');
            });
        });
    }
    document.getElementById('accountEditModal').classList.add('open');
}

function closeAccountEditModal() {
    document.getElementById('accountEditModal').classList.remove('open');
}

function saveAccountEdit() {
    const cId = document.getElementById('accountEditCustId').value;
    const customer = posCustomers.find(c => c.id === cId);
    if (!customer) return;
    customer.name = document.getElementById('accountEditName').value.trim() || customer.name;
    customer.phone = document.getElementById('accountEditPhone').value.trim();
    document.querySelectorAll('.acct-edit-item-qty').forEach(inp => {
        const sale = posSales.find(s => String(s.id) === inp.dataset.saleId);
        if (sale && sale.items && sale.items[inp.dataset.itemIdx]) {
            sale.items[inp.dataset.itemIdx].qty = parseFloat(inp.value) || 0;
        }
    });
    document.querySelectorAll('.acct-edit-item-price').forEach(inp => {
        const sale = posSales.find(s => String(s.id) === inp.dataset.saleId);
        if (sale && sale.items && sale.items[inp.dataset.itemIdx]) {
            sale.items[inp.dataset.itemIdx].price = parseFloat(inp.value) || 0;
        }
    });
    posSales.filter(s => s.customerId === cId && !s.creditInfo?.merged).forEach(s => {
        const dateInput = document.querySelector('.acct-edit-sale-date[data-sale-id="' + s.id + '"]');
        if (dateInput && dateInput.value) {
            const newDate = dateInput.value + 'T12:00:00';
            if (newDate !== s.date) s.date = newDate;
        }
        if (s.items && s.items.length > 0) {
            s.total = s.items.reduce((sum, it) => sum + ((parseFloat(it.price) || 0) * (parseInt(it.qty) || 0)), 0);
        } else {
            s.total = parseFloat(s.total) || 0;
        }
    });
    document.querySelectorAll('.acct-edit-sale-status').forEach(sel => {
        const sale = posSales.find(s => String(s.id) === sel.dataset.saleId);
        if (!sale) return;
        const status = sel.value;
        sale.payments = sale.payments || [];
        const currentPaid = sale.payments.reduce((s, p) => s + (p.amount || 0), 0);
        if (status === 'pagada') {
            if (currentPaid < sale.total) {
                sale.payments.push({ date: nowLocal(), amount: sale.total - currentPaid });
            }
            if (sale.method === 'Credito') sale.method = 'Efectivo';
            sale.creditInfo = null;
        } else if (status === 'pendiente') {
            sale.payments = [];
            sale.method = 'Credito';
            sale.creditInfo = { tipo: 'fijo', totalCuotas: 1, cuotaValor: sale.total, pagadas: 0, payments: [], balance: sale.total };
        } else if (status === 'abonada') {
            if (currentPaid <= 0) {
                sale.payments = [{ date: nowLocal(), amount: Math.round(sale.total * 0.5) }];
            }
            sale.method = 'Credito';
            sale.creditInfo = { tipo: 'abono', totalCuotas: 0, cuotaValor: 0, pagadas: 0, payments: sale.payments.map(p => ({date: p.date, amount: p.amount})), balance: sale.total };
        }
    });
    saveCustomers();
    const salesToSync = posSales.filter(s => s.customerId === cId && !s.creditInfo?.merged);
    salesToSync.forEach(s => {
        const apiId = s.id && s.id < 100000 ? s.id : null;
        if (apiId && API.isAvailable) {
            API.updateSale(apiId, { total: s.total, date: s.date, method: s.method, credit_info: s.creditInfo }).catch(e => { console.error('[POS] updateSale saveAccountEdit error:', e); });
            if (s.items && s.items.length > 0) {
                API.updateSaleItems(apiId, s.items).catch(e => { console.error('[POS] updateSaleItems saveAccountEdit error:', e); });
            }
            s.apiSynced = true;
        }
    });
    saveSales();
    closeAccountEditModal();
    if (typeof renderAccountStatus === 'function') renderAccountStatus();
    renderCustomerTable();
    showToast('Cambios guardados');
}

// ============ SALE EDIT (single sale) ============
function openSaleEditModal(saleId) {
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale) { showToast('Venta no encontrada'); return; }
    document.getElementById('saleEditSaleId').value = sale.id;
    document.getElementById('saleEditId').textContent = sale.id;
    const items = sale.items || [];
    const container = document.getElementById('saleEditItems');
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">Esta venta no tiene productos.</p>';
    } else {
        container.innerHTML = '<label style="font-weight:600;font-size:13px;margin-bottom:8px;display:block;">Productos</label>' +
            items.map((it, idx) => {
                const ip = parseFloat(it.price) || 0;
                const iq = parseInt(it.qty) || 0;
                return '<div style="display:flex;gap:6px;align-items:center;padding:6px 0;' + (idx < items.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
                    '<span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (it.name || 'Prod') + '">' + (it.name || 'Prod').substring(0, 28) + '</span>' +
                    '<input type="number" min="0" class="se-item-qty" data-idx="' + idx + '" value="' + iq + '" style="width:48px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:13px;text-align:center;">' +
                    '<span style="font-size:12px;color:var(--text-muted);">x</span>' +
                    '<input type="number" min="0" step="50" class="se-item-price" data-idx="' + idx + '" value="' + ip + '" style="width:90px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:13px;text-align:right;">' +
                    '<span style="font-size:12px;color:var(--text-muted);min-width:60px;text-align:right;" id="se-item-sub-' + idx + '">' + formatPrice(ip * iq) + '</span>' +
                '</div>';
            }).join('');
        recalcSaleEditTotal();
        container.querySelectorAll('.se-item-price, .se-item-qty').forEach(inp => {
            inp.addEventListener('input', recalcSaleEditTotal);
        });
    }
    const paid = (sale.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const total = parseFloat(sale.total) || 0;
    let currentStatus = 'pendiente';
    if (paid >= total && total > 0) currentStatus = 'pagada';
    else if (paid > 0) currentStatus = 'abonada';
    document.getElementById('saleEditStatus').value = currentStatus;
    const abonoInput = document.getElementById('saleEditAbonoAmount');
    if (abonoInput) {
        abonoInput.value = paid > 0 ? paid : Math.round(total * 0.5);
        toggleSaleEditAbono();
    }
    const markBtn = document.getElementById('saleEditMarkPaidBtn');
    markBtn.onclick = function() {
        sale.payments = [{ date: nowLocal(), amount: sale.total }];
        sale.method = 'Efectivo';
        sale.creditInfo = null;
        const apiId = sale.id && sale.id < 100000 ? sale.id : null;
        if (apiId && API.isAvailable) {
            API.updateSale(apiId, { method: sale.method, credit_info: null, total: sale.total }).catch(e => {});
        }
        sale.apiSynced = true;
        document.getElementById('saleEditStatus').value = 'pagada';
        showToast('Venta #' + sale.id + ' marcada como pagada');
    };
    document.getElementById('saleEditModal').classList.add('open');
}

function recalcSaleEditTotal() {
    const saleId = document.getElementById('saleEditSaleId').value;
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale || !sale.items) return;
    let newTotal = 0;
    sale.items.forEach((it, idx) => {
        const qty = parseFloat(document.querySelector('.se-item-qty[data-idx="' + idx + '"]')?.value) || 0;
        const price = parseFloat(document.querySelector('.se-item-price[data-idx="' + idx + '"]')?.value) || 0;
        const sub = document.getElementById('se-item-sub-' + idx);
        if (sub) sub.textContent = formatPrice(price * qty);
        newTotal += price * qty;
    });
    document.getElementById('saleEditTotal').textContent = formatPrice(newTotal);
}

function toggleSaleEditAbono() {
    const sel = document.getElementById('saleEditStatus');
    const section = document.getElementById('saleEditAbonoSection');
    if (section) section.style.display = sel.value === 'abonada' ? '' : 'none';
}

function closeSaleEditModal() {
    document.getElementById('saleEditModal').classList.remove('open');
}

function saveSaleEdit() {
    const saleId = document.getElementById('saleEditSaleId').value;
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale) return;
    const items = sale.items || [];
    // Snapshot old quantities before edit
    const oldQtys = {};
    items.forEach((it, idx) => { oldQtys[idx] = parseInt(it.qty) || 0; });
    // Read new quantities from DOM and validate stock
    const newQtys = {};
    document.querySelectorAll('.se-item-qty').forEach(inp => {
        const idx = parseInt(inp.dataset.idx);
        newQtys[idx] = parseFloat(inp.value) || 0;
    });
    for (const idx in newQtys) {
        const oldQty = oldQtys[idx] || 0;
        const newQty = newQtys[idx] || 0;
        const diff = newQty - oldQty;
        if (diff <= 0) continue;
        const item = items[parseInt(idx)];
        if (!item) continue;
        const prod = posProducts.find(p => String(p.id) === String(item.id));
        if (prod && prod.stock < diff) {
            showToast('Stock insuficiente para ' + (item.name || prod.name) + ' (disponible: ' + prod.stock + ', necesario: ' + diff + ')', 'error');
            return;
        }
    }
    // Apply changes
    items.forEach((it, idx) => {
        if (newQtys[idx] !== undefined) it.qty = newQtys[idx];
    });
    document.querySelectorAll('.se-item-price').forEach(inp => {
        const idx = parseInt(inp.dataset.idx);
        if (items[idx]) items[idx].price = parseFloat(inp.value) || 0;
    });
    if (sale.items && sale.items.length > 0) {
        sale.total = sale.items.reduce((sum, it) => sum + ((parseFloat(it.price) || 0) * (parseInt(it.qty) || 0)), 0);
    }
    // Adjust inventory for quantity changes
    items.forEach((item, idx) => {
        const oldQty = oldQtys[idx] || 0;
        const newQty = parseInt(item.qty) || 0;
        const diff = newQty - oldQty;
        if (diff === 0) return;
        const prod = posProducts.find(p => String(p.id) === String(item.id));
        if (prod) {
            const prev = prod.stock;
            prod.stock -= diff;
            const type = diff > 0 ? 'salida' : 'retorno';
            addInvLog(item.id, prod.name, type, diff > 0 ? -diff : Math.abs(diff), prev, prod.stock, 'Edicion Venta #' + saleId + ' (' + (item.name || prod.name) + ': ' + oldQty + '→' + newQty + ')', null, sale.ventaPorFuera || false);
        }
    });
    const status = document.getElementById('saleEditStatus').value;
    sale.payments = sale.payments || [];
    const currentPaid = sale.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    if (status === 'pagada') {
        if (currentPaid < sale.total) {
            sale.payments.push({ date: nowLocal(), amount: sale.total - currentPaid });
        }
        if (sale.method === 'Credito') sale.method = 'Efectivo';
        sale.creditInfo = null;
    } else if (status === 'pendiente') {
        sale.payments = [];
        sale.method = 'Credito';
        sale.creditInfo = { tipo: 'fijo', totalCuotas: 1, cuotaValor: sale.total, pagadas: 0, payments: [], balance: sale.total };
    } else if (status === 'abonada') {
        const abonoAmount = parseFloat(document.getElementById('saleEditAbonoAmount')?.value) || Math.round(sale.total * 0.5);
        sale.payments = [{ date: nowLocal(), amount: Math.min(abonoAmount, sale.total) }];
        sale.method = 'Credito';
        sale.creditInfo = { tipo: 'abono', totalCuotas: 0, cuotaValor: 0, pagadas: 0, payments: sale.payments.map(p => ({date: p.date, amount: p.amount})), balance: sale.total };
    }
    const apiId = sale.id && sale.id < 100000 ? sale.id : null;
    if (apiId && API.isAvailable) {
        API.updateSale(apiId, { method: sale.method, credit_info: sale.creditInfo, total: sale.total }).catch(e => {});
        if (sale.items && sale.items.length > 0) {
            API.updateSaleItems(apiId, sale.items).catch(e => {});
        }
    }
    sale.apiSynced = true;
    saveSales();
    saveProducts();
    closeSaleEditModal();
    if (typeof renderSalesTable === 'function') renderSalesTable();
    if (typeof renderAccountStatus === 'function') renderAccountStatus();
    if (typeof renderInventory === 'function') renderInventory();
    showToast('Venta #' + saleId + ' actualizada');
}

// ============ VOID SALE ============
function voidSale(saleId) {
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale) { showToast('Venta no encontrada', 'error'); return; }
    if (!confirm('Anular venta #' + saleId + '? Se devolveran los productos al inventario.')) return;
    if (!confirm('Confirmar anulacion de venta #' + saleId + '? Esta accion no se puede deshacer.')) return;
    (sale.items || []).forEach(item => {
        if (item.isTemp) return;
        const prod = posProducts.find(p => String(p.id) === String(item.id));
        if (prod) {
            const prev = prod.stock;
            prod.stock += parseInt(item.qty) || 0;
            addInvLog(item.id, prod.name, 'retorno', parseInt(item.qty) || 0, prev, prod.stock, 'Anulacion Venta #' + saleId, null, sale.ventaPorFuera || false);
        }
    });
    const apiId = sale.id && sale.id < 100000 ? sale.id : null;
    if (apiId && API.isAvailable) {
        API.deleteSale(apiId).catch(e => console.error('[POS] deleteSale error:', e));
    }
    posSales = posSales.filter(s => String(s.id) !== String(saleId));
    saveSales();
    saveProducts();
    if (typeof renderSalesTable === 'function') renderSalesTable();
    if (typeof renderAccountStatus === 'function') renderAccountStatus();
    if (typeof renderInventory === 'function') renderInventory();
    showToast('Venta #' + saleId + ' anulada');
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
function toggleInvLogReasonFilter() {
    const typeFilter = document.getElementById('invLogTypeFilter');
    const container = document.getElementById('invLogReasonChips');
    if (!typeFilter || !container) return;
    const type = typeFilter.value;
    if (type === 'salida' || type === 'entrada') {
        container.style.display = '';
        populateReasonDropdown(type);
    } else {
        container.style.display = 'none';
        resetReasonDropdown();
    }
}
function populateReasonDropdown(type) {
    const reasons = type === 'entrada'
        ? ['Registro de pedido','Compra a proveedor','Devolucion de cliente','Ajuste por inventario inicial','Otro']
        : ['Movimiento a Bastidas','Movimiento a Curinca','Movimiento a Liceth','Venta directa','Merma / Deterioro','Vencimiento','Donacion','Transferencia saliente','Otro'];
    const dd = document.getElementById('invLogReasonDropdown');
    if (!dd) return;
    dd.innerHTML = '<label style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;font-weight:600;font-size:13px;border-bottom:1px solid #eee;"><input type="checkbox" class="inv-dd-check" value="all" checked onchange="reasonDropdownAll(this)" style="margin:0;"> Todas</label>' +
        reasons.map(r => '<label style="display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;font-size:13px;"><input type="checkbox" class="inv-dd-check" value="' + r + '" onchange="reasonDropdownChanged()" style="margin:0;"> ' + r + '</label>').join('');
    resetReasonDropdown();
}
function toggleReasonDropdown() {
    const dd = document.getElementById('invLogReasonDropdown');
    if (!dd) return;
    dd.style.display = dd.style.display === 'none' ? '' : 'none';
}
function closeReasonDropdown(e) {
    const dd = document.getElementById('invLogReasonDropdown');
    const btn = document.getElementById('invLogReasonBtn');
    if (dd && !dd.contains(e.target) && e.target !== btn) dd.style.display = 'none';
}
document.addEventListener('click', closeReasonDropdown);
function reasonDropdownAll(allCb) {
    if (allCb.checked) {
        document.querySelectorAll('.inv-dd-check:not([value="all"])').forEach(cb => cb.checked = false);
    }
    updateReasonDropdownLabel();
    renderInvLog();
}
function reasonDropdownChanged() {
    const allCb = document.querySelector('.inv-dd-check[value="all"]');
    if (allCb) allCb.checked = false;
    if (document.querySelectorAll('.inv-dd-check:not([value="all"]):checked').length === 0) {
        if (allCb) allCb.checked = true;
    }
    updateReasonDropdownLabel();
    renderInvLog();
}
function updateReasonDropdownLabel() {
    const btn = document.getElementById('invLogReasonBtn');
    if (!btn) return;
    const allCb = document.querySelector('.inv-dd-check[value="all"]');
    if (allCb && allCb.checked) { btn.textContent = 'Razón ( Todas ) ▾'; return; }
    const checked = document.querySelectorAll('.inv-dd-check:not([value="all"]):checked');
    if (checked.length === 0) { btn.textContent = 'Razón ( Todas ) ▾'; return; }
    if (checked.length === 1) { btn.textContent = 'Razón ( ' + checked[0].value.split(' ').pop() + ' ) ▾'; return; }
    btn.textContent = 'Razón ( ' + checked.length + ' seleccionadas ) ▾';
}
function resetReasonDropdown() {
    document.querySelectorAll('.inv-dd-check').forEach(cb => cb.checked = false);
    const allCb = document.querySelector('.inv-dd-check[value="all"]');
    if (allCb) allCb.checked = true;
    updateReasonDropdownLabel();
    const dd = document.getElementById('invLogReasonDropdown');
    if (dd) dd.style.display = 'none';
}
function getSelectedTableReasons() {
    const allCb = document.querySelector('.inv-dd-check[value="all"]');
    if (allCb && allCb.checked) return [];
    const selected = [];
    document.querySelectorAll('.inv-dd-check:not([value="all"]):checked').forEach(cb => selected.push(cb.value));
    return selected;
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
    const selectedReasons = getSelectedTableReasons();
    if (selectedReasons.length > 0) filtered = filtered.filter(l => selectedReasons.some(r => (l.reason || '').startsWith(r)));
    if (!getPosScope()) {
        if (ventaFilter === 'local') filtered = filtered.filter(l => (l.type === 'salida' || l.type === 'salida_temp' || l.type === 'venta_ruta') && !l.ventaPorFuera);
        else if (ventaFilter === 'fuera') filtered = filtered.filter(l => (l.type === 'salida' || l.type === 'salida_temp' || l.type === 'venta_ruta') && l.ventaPorFuera);
    }
    if (dateFrom) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) >= dateFrom);
    if (dateTo) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) <= dateTo);
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:20px;">Sin movimientos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = (_invLogSortDesc ? filtered.slice().reverse() : filtered).slice(0, 200).map(l => {
        const typeLabels = { entrada: 'Entrada', salida: 'Salida', salida_temp: 'Salida Temp.', venta_ruta: 'Venta Ruta', ajuste: 'Ajuste', retorno: 'Retorno' };
        const typeColors = { entrada: 'var(--success)', salida: 'var(--danger)', salida_temp: '#e65100', venta_ruta: '#1565c0', ajuste: 'var(--warning)', retorno: '#7b1fa2' };
        const typeLabel = '<span style="color:' + (typeColors[l.type] || 'var(--warning)') + ';font-weight:600;">' + (typeLabels[l.type] || l.type) + '</span>';
        const vpfTag = l.ventaPorFuera ? ' <span class="tag tag-warning" style="font-size:10px;">Por fuera</span>' : '';
        const up = l.unitPrice || 0;
        const total = up > 0 ? up * Math.abs(l.quantity) : 0;
        return '<tr>' +
            '<td>' + shortDate(l.date) + '</td>' +
            '<td><strong>' + l.productName + '</strong></td>' +
            '<td>' + getCatLabel(l.category) + '</td>' +
            '<td>' + typeLabel + '</td>' +
            '<td style="font-weight:600;' + ((l.type === 'entrada' || l.type === 'retorno') ? 'color:var(--success);' : 'color:var(--danger);') + '">' + ((l.type === 'entrada' || l.type === 'retorno') ? '+' : '-') + Math.abs(l.quantity) + '</td>' +
            '<td>' + (up > 0 ? formatPrice(up) : '-') + '</td>' +
            '<td>' + (total > 0 ? formatPrice(total) : '-') + '</td>' +
            '<td>' + l.previousStock + '</td>' +
            '<td>' + l.newStock + '</td>' +
            '<td style="font-size:12px;color:var(--text-muted);">' + (l.reason || '-') + vpfTag + '</td>' +
            '<td class="actions"><button class="edit" onclick="openInvLogEditModal(' + l.id + ')" title="Editar" style="color:var(--primary);"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></td>' +
            '</tr>';
    }).join('');
}
function clearInvLog() {
    if (!confirm('Esto eliminara todo el historial de entradas y salidas. Continuar?')) return;
    invLog = [];
    invNextLogId = 1;
    if (API.isAvailable) {
        API.clearInventoryLog().catch(e => console.error('[POS] clearInvLog API error:', e));
    }
    saveInvLog();
    renderInventory();
    showToast('Historial de inventario limpiado');
}

// ============ INVENTORY PRINT TICKET ============
function openInvPrintModal() {
    const modal = document.getElementById('invPrintModal');
    if (!modal) return;
    document.getElementById('invPrintDateFrom').value = today();
    document.getElementById('invPrintDateTo').value = today();
    document.getElementById('invPrintType').value = 'all';
    document.getElementById('invPrintReasonGroup').style.display = 'none';
    document.getElementById('invPrintReasonChecks').innerHTML = '';
    modal.classList.add('open');
    modal.style.display = 'flex';
}
function closeInvPrintModal() {
    const modal = document.getElementById('invPrintModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
}
function toggleInvPrintReason() {
    const type = document.getElementById('invPrintType').value;
    const group = document.getElementById('invPrintReasonGroup');
    if (!group) return;
    if (type === 'salida' || type === 'entrada') {
        group.style.display = '';
        populatePrintReasonChips(type);
    } else {
        group.style.display = 'none';
    }
}
function populatePrintReasonChips(type) {
    const reasons = type === 'entrada'
        ? ['Registro de pedido','Compra a proveedor','Devolucion de cliente','Ajuste por inventario inicial','Otro']
        : ['Movimiento a Bastidas','Movimiento a Curinca','Movimiento a Liceth','Venta directa','Merma / Deterioro','Vencimiento','Donacion','Transferencia saliente','Otro'];
    const container = document.getElementById('invPrintReasonChecks');
    if (!container) return;
    container.innerHTML = '<button type="button" class="inv-reason-chip active" onclick="toggleReasonChip(this)">Todas</button>' +
        reasons.map(r => '<button type="button" class="inv-reason-chip" onclick="toggleReasonChip(this)" data-reason="' + r + '">' + r + '</button>').join('');
}
function resetReasonChips() {
    document.querySelectorAll('.inv-reason-chip').forEach(c => c.classList.remove('active'));
    const todas = document.querySelector('.inv-reason-chip');
    if (todas) todas.classList.add('active');
}
function toggleReasonChip(btn) {
    const isTodas = !btn.dataset.reason;
    if (isTodas) {
        document.querySelectorAll('.inv-reason-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    } else {
        document.querySelector('.inv-reason-chip:not([data-reason])').classList.remove('active');
        btn.classList.toggle('active');
        const anyActive = document.querySelectorAll('.inv-reason-chip.active:not([data-reason])').length > 0;
        if (!anyActive && document.querySelectorAll('.inv-reason-chip.active[data-reason]').length === 0) {
            document.querySelector('.inv-reason-chip:not([data-reason])').classList.add('active');
        }
    }
}
function getSelectedReasons() {
    const todas = document.querySelector('.inv-reason-chip:not([data-reason])');
    if (todas && todas.classList.contains('active')) return [];
    const selected = [];
    document.querySelectorAll('.inv-reason-chip.active[data-reason]').forEach(c => selected.push(c.dataset.reason));
    return selected;
}
function confirmPrintInvMovements() {
    const dateFrom = document.getElementById('invPrintDateFrom').value;
    const dateTo = document.getElementById('invPrintDateTo').value;
    const typeFilter = document.getElementById('invPrintType').value;
    const selectedReasons = (typeFilter === 'salida' || typeFilter === 'entrada') ? getSelectedReasons() : [];
    if (!dateFrom || !dateTo) { showToast('Selecciona las fechas'); return; }
    let filtered = filterInvLogByScope(invLog);
    if (dateFrom) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) >= dateFrom);
    if (dateTo) filtered = filtered.filter(l => l.date && l.date.substring(0, 10) <= dateTo);
    if (typeFilter !== 'all') filtered = filtered.filter(l => l.type === typeFilter);
    if (selectedReasons.length > 0) filtered = filtered.filter(l => selectedReasons.some(r => (l.reason || '').startsWith(r)));
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (filtered.length === 0) { showToast('No hay movimientos para esas fechas'); return; }
    closeInvPrintModal();
    const typeLabels = { entrada: 'Entrada', salida: 'Salida', salida_temp: 'Salida Temp.', venta_ruta: 'Venta Ruta', ajuste: 'Ajuste', retorno: 'Retorno' };
    const scope = getPosScope();
    const scopeLabel = scope === 'fuera' ? 'Por Fuera' : scope === 'local' ? 'Local' : 'General';
    let totalEntradas = 0, totalSalidas = 0, totalValor = 0;
    filtered.forEach(l => {
        const absQty = Math.abs(l.quantity);
        if (l.type === 'entrada' || l.type === 'retorno') totalEntradas += absQty;
        else totalSalidas += absQty;
        const up = l.unitPrice || 0;
        if (up > 0) totalValor += up * absQty;
    });
    const dateLabelFrom = new Date(dateFrom + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateLabelTo = new Date(dateTo + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    let rowsHtml = filtered.slice(0, 80).map(l => {
        const d = l.date ? new Date(l.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) : '--';
        const tLabel = typeLabels[l.type] || l.type;
        const isEntrada = l.type === 'entrada' || l.type === 'retorno';
        const absQty = Math.abs(l.quantity);
        const qtyStr = (isEntrada ? '+' : '-') + absQty;
        const up = l.unitPrice || 0;
        const total = up > 0 ? up * absQty : 0;
        return '<div style="padding:3px 0;border-bottom:1px dashed #eee;">' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;">' +
                '<span style="flex:1.2;">' + d + '</span>' +
                '<span style="flex:2.0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + l.productName + '</span>' +
                '<span style="flex:1.0;text-align:center;">' + tLabel + '</span>' +
                '<span style="flex:0.7;text-align:right;font-weight:600;color:' + (isEntrada ? 'var(--success)' : 'var(--danger)') + ';">' + qtyStr + '</span>' +
                '<span style="flex:0.8;text-align:right;">' + (total > 0 ? '$' + total.toLocaleString('es-CO') : '') + '</span>' +
            '</div>' +
            (l.reason ? '<div style="font-size:9px;color:#888;padding-left:2px;">' + l.reason + '</div>' : '') +
        '</div>';
    }).join('');
    document.getElementById('receiptContent').innerHTML =
        '<div class="receipt">' +
            '<div class="receipt-header">' +
                '<img src="' + (typeof LOGO_DATA_URL !== 'undefined' && LOGO_DATA_URL ? LOGO_DATA_URL : (typeof LOGO_URL !== 'undefined' ? LOGO_URL : 'LOGO.jpeg')) + '" style="max-width:140px;height:auto;margin-bottom:6px;" alt="Logo">' +
                '<h4 style="font-size:14px;margin:2px 0;">REPORTE DE INVENTARIO</h4>' +
                '<p style="font-size:11px;margin:2px 0;color:var(--text-muted);">TPV ' + scopeLabel + '</p>' +
            '</div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;margin-bottom:6px;">' +
                '<span>Desde: <strong>' + dateLabelFrom + '</strong></span> &nbsp;|&nbsp; ' +
                '<span>Hasta: <strong>' + dateLabelTo + '</strong></span>' +
            '</div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Total movimientos</span><span style="font-weight:700;">' + filtered.length + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span style="color:var(--success);">Entradas</span><span style="font-weight:700;color:var(--success);">+' + totalEntradas + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span style="color:var(--danger);">Salidas</span><span style="font-weight:700;color:var(--danger);">-' + totalSalidas + '</span></div>' +
            (totalValor > 0 ? '<div class="receipt-row" style="font-size:12px;"><span>Total vendido local</span><span style="font-weight:700;">$' + totalValor.toLocaleString('es-CO') + '</span></div>' : '') +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Detalle</div>' +
            rowsHtml +
            (filtered.length > 80 ? '<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:4px;">... y ' + (filtered.length - 80) + ' movimientos mas</div>' : '') +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-footer">' +
                '<p>Impreso el ' + new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</p>' +
            '</div>' +
        '</div>';
    document.getElementById('receiptModal').classList.add('open');
    const btnInv = document.getElementById('btnDownloadInv');
    if (btnInv) btnInv.style.display = 'none';
    setTimeout(() => { window.print(); }, 400);
}

// ============ INVENTORY LOG EDIT ============
function openInvLogEditModal(id) {
    const entry = invLog.find(l => l.id === id);
    if (!entry) { showToast('Movimiento no encontrado', 'error'); return; }
    document.getElementById('invLogEditId').value = entry.id;
    document.getElementById('invLogEditType').value = entry.type === 'salida_temp' || entry.type === 'venta_ruta' ? 'salida' : entry.type;
    document.getElementById('invLogEditQty').value = Math.abs(entry.quantity);
    document.getElementById('invLogEditReason').value = entry.reason || '';
    const upEdit = document.getElementById('invLogEditUnitPrice');
    if (upEdit) upEdit.value = entry.unitPrice || 0;
    const priceGroup = document.getElementById('invLogEditPriceGroup');
    if (priceGroup) {
        const isBastCur = entry.reason && (entry.reason.includes('Bastidas') || entry.reason.includes('Curinca'));
        priceGroup.style.display = isBastCur ? '' : 'none';
    }
    const prodSelect = document.getElementById('invLogEditProduct');
    if (prodSelect) {
        prodSelect.innerHTML = posProducts.map(p => '<option value="' + p.id + '" ' + (String(p.id) === String(entry.productId) ? 'selected' : '') + '>' + p.name + '</option>').join('');
    }
    document.getElementById('invLogEditModal').style.display = 'flex';
}
function closeInvLogEditModal() {
    document.getElementById('invLogEditModal').style.display = 'none';
}
function filterInvLogEditProduct() {
    const search = document.getElementById('invLogEditProductSearch').value.toLowerCase().trim();
    const sel = document.getElementById('invLogEditProduct');
    const currentVal = sel.value;
    sel.innerHTML = posProducts.filter(p => !search || p.name.toLowerCase().includes(search)).map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');
    if (currentVal && posProducts.some(p => String(p.id) === currentVal)) sel.value = currentVal;
}
function saveInvLogEdit() {
    const id = parseInt(document.getElementById('invLogEditId').value);
    const entry = invLog.find(l => l.id === id);
    if (!entry) { showToast('Movimiento no encontrado', 'error'); return; }
    const newProductId = document.getElementById('invLogEditProduct').value;
    const newType = document.getElementById('invLogEditType').value;
    const newQty = parseInt(document.getElementById('invLogEditQty').value) || 0;
    const newReason = document.getElementById('invLogEditReason').value.trim();
    const newUnitPrice = parseFloat(document.getElementById('invLogEditUnitPrice')?.value) || 0;
    const oldType = entry.type;
    const oldQty = entry.quantity;
    const oldProdId = entry.productId;
    const product = posProducts.find(p => String(p.id) === String(newProductId));
    if (!product) { showToast('Selecciona un producto valido', 'error'); return; }
    if (newQty <= 0) { showToast('La cantidad debe ser mayor a 0', 'error'); return; }

    // Undo old effect on old product stock
    const oldProd = posProducts.find(p => String(p.id) === String(oldProdId));
    if (oldProd) {
        if (oldType === 'entrada' || oldType === 'retorno') oldProd.stock -= oldQty;
        else oldProd.stock += oldQty;
    }

    // Apply new effect on new product stock
    if (newType === 'entrada' || newType === 'retorno') product.stock += newQty;
    else product.stock -= newQty;

    // Calculate previous/new stock for audit
    let newPrevStock, newNewStock;
    if (String(newProductId) === String(oldProdId)) {
        newPrevStock = entry.previousStock;
        newNewStock = newPrevStock + (newType === 'entrada' || newType === 'retorno' ? newQty : -newQty);
    } else {
        newPrevStock = product.stock + (newType === 'entrada' || newType === 'retorno' ? -newQty : newQty);
        newNewStock = product.stock;
    }

    if (newPrevStock < 0) {
        // Revert
        if (oldProd) {
            if (oldType === 'entrada' || oldType === 'retorno') oldProd.stock += oldQty;
            else oldProd.stock -= oldQty;
        }
        if (newType === 'entrada' || newType === 'retorno') product.stock -= newQty;
        else product.stock += newQty;
        showToast('El stock no puede quedar negativo', 'error');
        return;
    }

    entry.productId = newProductId;
    entry.productName = product.name;
    entry.category = product.category || '';
    entry.type = newType;
    entry.quantity = (newType === 'salida' || newType === 'salida_temp' || newType === 'venta_ruta') ? -newQty : newQty;
    entry.previousStock = newPrevStock;
    entry.newStock = newNewStock;
    entry.reason = newReason;
    entry.unitPrice = newUnitPrice;
    entry.synced = false;

    if (entry.apiId) {
        API.updateInventoryLog(entry.apiId, {
            product_id: entry.productId,
            product_name: entry.productName,
            type: entry.type,
            quantity: entry.quantity,
            previous_stock: entry.previousStock,
            new_stock: entry.newStock,
            reason: entry.reason,
            sale_id: entry.saleId || null,
            venta_por_fuera: entry.ventaPorFuera || false,
            unit_price: entry.unitPrice || 0
        }).catch(e => console.error('[POS] updateInventoryLog error:', e));
    }

    saveInvLog();
    saveProducts();
    renderInventory();
    renderInvLog();
    closeInvLogEditModal();
    showToast('Movimiento actualizado');
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
    const q = document.getElementById('invMovProductSearch').value.toLowerCase().trim();
    const sel = document.getElementById('invMovProduct');
    const prevVal = sel.value;
    const products = Array.isArray(posProducts) ? posProducts : [];
    const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
    sel.innerHTML = filtered.map(p => '<option value="' + p.id + '">' + p.name + ' (Stock: ' + p.stock + ')</option>').join('');
    if (prevVal && filtered.some(p => String(p.id) === String(prevVal))) sel.value = prevVal;
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
    const priceGroup = document.getElementById('invMovPriceGroup');
    const priceEl = document.getElementById('invMovPrice');
    if (priceGroup) priceGroup.style.display = 'none';
    if (priceEl) priceEl.value = '0';
    reasonSel.onchange = function() { toggleInvMovPrice(); };
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
            '<option value="Movimiento a Liceth">Movimiento a Liceth</option>' +
            '<option value="Ajuste por inventario final">Ajuste por inventario final</option>' +
            '<option value="Otro">Otro</option>';
        if (currentUser && currentUser.role === 'empleado') {
            reasonSel.innerHTML =
                '<option value="Movimiento a Bastidas">Movimiento a Bastidas</option>' +
                '<option value="Movimiento a Curinca">Movimiento a Curinca</option>' +
                '<option value="Movimiento a Liceth">Movimiento a Liceth</option>';
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
function toggleInvMovPrice() {
    const reason = document.getElementById('invMovReason').value;
    const priceGroup = document.getElementById('invMovPriceGroup');
    if (!priceGroup) return;
    const showPrice = reason === 'Movimiento a Bastidas' || reason === 'Movimiento a Curinca';
    priceGroup.style.display = showPrice ? '' : 'none';
}
function confirmInvMov() {
    const type = document.getElementById('invMovType').value;
    const pid = document.getElementById('invMovProduct').value;
    const qty = parseInt(document.getElementById('invMovQty').value);
    const reason = document.getElementById('invMovReason').value;
    const note = document.getElementById('invMovNote').value.trim();
    const fullReason = note ? reason + ' - ' + note : reason;
    const unitPrice = parseFloat(document.getElementById('invMovPrice').value) || 0;
    if (!pid || !qty || qty <= 0) { showToast('Selecciona un producto y cantidad valida'); return; }
    if (posProducts.length === 0) { showToast('No hay productos disponibles'); return; }
    const p = posProducts.find(pr => String(pr.id) === String(pid));
    if (!p) { showToast('Producto no encontrado'); return; }
    const prev = p.stock;
    if (type === 'entrada') {
        p.stock += qty;
        addInvLog(pid, p.name, 'entrada', qty, prev, p.stock, fullReason, null, getPosScope() === 'fuera', unitPrice);
        saveProducts();
        closeInvMovModal();
        renderInventory();
        renderProductTable();
        showToast('Entrada registrada: +' + qty + ' ' + p.name);
    } else {
        if (p.stock < qty) { showToast('Stock insuficiente (disponible: ' + p.stock + ')'); return; }
        p.stock -= qty;
        addInvLog(pid, p.name, 'salida', -qty, prev, p.stock, fullReason, null, getPosScope() === 'fuera', unitPrice);
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
    html += `<a class="nav-item" onclick="refreshSystem()"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg><span>Actualizar</span></a>`;
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
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale) return;
    const ci = sale.creditInfo;
    const isContado = !ci;
    const pagado = isContado ? sale.total : (ci.payments ? ci.payments.reduce((s, p) => s + p.amount, 0) : 0);
    const pendiente = isContado ? 0 : sale.total - pagado;
    const isPaid = isContado || pendiente <= 0;
    const paymentsHtml = isContado
        ? '<div class="receipt-row" style="font-size:12px;"><span>' + shortDate(sale.date) + '</span><span style="color:var(--success);font-weight:600;">' + formatPrice(sale.total) + '</span></div>'
        : (ci.payments && ci.payments.length > 0
            ? ci.payments.map(p => '<div class="receipt-row" style="font-size:12px;"><span>' + shortDate(p.date) + (p.method ? ' <span style="color:var(--text-muted);font-size:10px;">' + p.method + '</span>' : '') + '</span><span style="color:var(--success);font-weight:600;">' + formatPrice(p.amount) + '</span></div>').join('')
            : '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:4px 0;">Sin pagos registrados</div>');
    const statusColor = isPaid ? 'var(--success)' : 'var(--warning)';
    const statusLabel = isPaid ? 'PAGADA' : 'Pendiente: ' + formatPrice(pendiente);
    const methodLabel = isContado ? sale.method : (ci.tipo === 'abono' ? 'Abono libre' : 'Cuotas fijas (' + ci.totalCuotas + ')');
    document.getElementById('receiptContent').innerHTML = '' +
        '<div class="receipt">' +
            '<div class="receipt-header">' +
                '<img src="' + (LOGO_DATA_URL || LOGO_URL) + '" style="max-width:160px;height:auto;margin-bottom:6px;" alt="Logo">' +
                '<h4 style="font-size:15px;margin:2px 0;">FACTURA DE VENTA</h4>' +
                '<p style="font-size:11px;margin:2px 0;">Factura #' + sale.id + '</p>' +
                '<p style="font-size:11px;margin:2px 0;">' + new Date(sale.date).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) + '</p>' +
                '<div style="margin:6px auto;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;display:inline-block;' + (isPaid ? 'background:#f0fdf4;color:var(--success);border:1px solid #bbf7d0;' : 'background:#fef9c3;color:#a16207;border:1px solid #fde68a;') + '">' + statusLabel + '</div>' +
            '</div>' +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-row"><span>Cliente</span><span style="font-weight:600;">' + (sale.customer || 'Mostrador') + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Metodo</span><span>' + sale.method + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Tipo</span><span>' + (isContado ? 'Contado' : methodLabel) + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Productos</div>' +
            sale.items.map(i => '<div class="receipt-row" style="font-size:12px;"><span>' + (i.name || 'Producto').substring(0,20) + ' x' + i.qty + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>').join('') +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-total"><span>TOTAL VENTA</span><span>' + formatPrice(sale.total) + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Pago</div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Total pagado</span><span style="color:var(--success);font-weight:600;">' + formatPrice(pagado) + '</span></div>' +
            paymentsHtml +
            (!isPaid ? '<div class="receipt-row" style="font-size:12px;font-weight:700;"><span>Saldo pendiente</span><span style="color:var(--warning);font-weight:700;">' + formatPrice(pendiente) + '</span></div>' : '') +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-footer">' +
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

function renderCreditSaleHistory(s) {
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
        const totalPagadoFijo = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
        const totalSale = s.creditInfo.totalCuotas * s.creditInfo.cuotaValor;
        pending = Math.max(0, totalSale - totalPagadoFijo);
        pagado = totalPagadoFijo;
        isPaid = pending <= 0;
        label = isPaid ? 'Pagado' : 'Pendiente: ' + formatPrice(pending);
    }
    const checked = _mergeSelection.includes(s.id) ? ' checked' : '';
    const mergedInto = s.creditInfo.merged ? s.creditInfo.mergedInto : null;
    let h = '';
    h += '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;' + (checked && !isPaid ? 'border-color:var(--primary);box-shadow:0 0 0 2px rgba(37,99,235,0.2);' : '') + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:' + (isPaid ? '#f0fdf4' : '#fffbe6') + ';border-bottom:1px solid var(--border);">';
    h += '<div style="display:flex;align-items:center;gap:8px;">';
    if (!isPaid) {
        h += '<input type="checkbox" class="merge-check" data-sale="' + s.id + '" onchange="toggleMergeSelect(' + s.id + ', this.checked)"' + checked + ' style="width:16px;height:16px;cursor:pointer;">';
    }
    h += '<div><strong>#' + s.id + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + shortDate(s.date) + '</span></div>';
    h += '</div>';
    h += '<div style="font-weight:600;font-size:15px;">' + formatPrice(s.total) + '</div>';
    h += '</div>';
    if (s.items && s.items.length > 0) {
        h += '<details style="font-size:11px;"><summary style="cursor:pointer;padding:4px 14px;color:var(--text-muted);user-select:none;list-style:none;">\u25b8 Productos</summary><div style="padding:0 14px 6px;color:var(--text-muted);">';
        h += s.items.map(i => (i.name || 'Producto').substring(0, 20) + ' x' + i.qty).join(' \u00b7 ');
        h += '</div></details>';
    }
    if (s.creditInfo.payments && s.creditInfo.payments.length > 0) {
        h += '<div style="padding:6px 14px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--hover);">Pagos registrados:</div>';
        s.creditInfo.payments.forEach((p, pIdx) => {
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 14px;font-size:13px;border-bottom:1px solid var(--border);">';
            h += '<span>' + shortDate(p.date) + (p.method ? ' <span style="color:var(--text-muted);font-size:11px;">(' + p.method + ')</span>' : '') + '</span>';
            h += '<div style="display:flex;align-items:center;gap:6px;">';
            h += '<span style="font-weight:500;color:var(--success);">' + formatPrice(p.amount) + '</span>';
            h += '<button onclick="editSalePayment(' + s.id + ',' + pIdx + ')" title="Editar" style="background:none;border:none;cursor:pointer;padding:2px;color:var(--primary);"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>';
            h += '<button onclick="deleteSalePayment(' + s.id + ',' + pIdx + ')" title="Eliminar" style="background:none;border:none;cursor:pointer;padding:2px;color:var(--danger);"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>';
            h += '</div></div>';
        });
    }
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;">';
    h += '<div><span style="font-size:12px;color:var(--text-muted);">' + label + '</span></div>';
    if (!isPaid) {
        h += '<div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm btn-primary" onclick="openPaymentModalCust(' + s.id + ')">Registrar ' + (s.creditInfo.tipo === 'abono' ? 'Abono' : 'Pago') + '</button>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-outline" onclick="showFinalInvoice(' + s.id + ')">Ver Factura</button>' : '') + '</div>';
    } else if (mergedInto) {
        h += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--text-muted);font-weight:500;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--text-muted);vertical-align:middle;margin-right:2px;"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg> Unida en #' + mergedInto + '</span>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-outline" onclick="showFinalInvoice(' + s.id + ')">Factura</button>' : '') + '</div>';
    } else {
        h += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--success);font-weight:600;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--success);vertical-align:middle;margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Pagado</span>' + (typeof showFinalInvoice === 'function' ? '<button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura</button>' : '') + '</div>';
    }
    h += '</div></div>';
    return h;
}

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
        const totalPagadoFijo = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
        const totalSaleFijo = s.creditInfo.totalCuotas * s.creditInfo.cuotaValor;
        return sum + Math.max(0, totalSaleFijo - totalPagadoFijo);
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
            html += '<div style="margin-bottom:12px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">';
            html += '<span style="font-size:13px;font-weight:600;color:var(--text-muted);">Compras de contado (' + contadoSales.length + ')</span>';
            html += '<button id="togglePaidContado" onclick="document.getElementById(\'paidContadoList\').style.display=document.getElementById(\'paidContadoList\').style.display===\'none\'?\'block\':\'none\';this.textContent=document.getElementById(\'paidContadoList\').style.display===\'none\'?\'Mostrar pagadas (\' + ' + contadoSales.length + ' + \')\':\'Ocultar pagadas\'" style="font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text-muted);">Mostrar pagadas (' + contadoSales.length + ')</button>';
            html += '</div>';
            html += '<div id="paidContadoList" style="display:none;">';
            contadoSales.forEach(s => {
                const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px;">';
                html += '<span>#' + s.id + ' <span style="color:var(--text-muted);">' + shortDate(s.date) + '</span></span>';
                html += '<div style="display:flex;align-items:center;gap:6px;">';
                html += '<span>' + qty + ' prod \u00b7 ' + formatPrice(s.total) + ' \u00b7 <span style="color:var(--success);">Pagado</span></span>';
                if (typeof showFinalInvoice === 'function') html += '<button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura</button>';
                html += '</div></div>';
            });
            html += '</div></div>';
        }
        if (creditSales.length > 0) {
            const unpaidCreditSales = [];
            const paidCreditSales = [];
            creditSales.forEach(s => {
                let isPaid = false;
                if (s.creditInfo.tipo === 'abono') {
                    const pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
                    isPaid = (s.creditInfo.balance - pagado) <= 0;
                } else {
                    const totalPagadoFijo = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
                    const totalSale = s.creditInfo.totalCuotas * s.creditInfo.cuotaValor;
                    isPaid = Math.max(0, totalSale - totalPagadoFijo) <= 0;
                }
                if (isPaid) paidCreditSales.push(s); else unpaidCreditSales.push(s);
            });
            if (unpaidCreditSales.length > 0) {
                html += '<details open style="margin-bottom:12px;"><summary style="font-size:13px;font-weight:600;color:var(--text-muted);cursor:pointer;user-select:none;padding:4px 0;">Creditos y Cuentas de Cobro (' + unpaidCreditSales.length + ')</summary>';
                unpaidCreditSales.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0)).forEach(s => {
                    html += renderCreditSaleHistory(s);
                });
                html += '</details>';
            }
            if (paidCreditSales.length > 0) {
                html += '<div style="margin-bottom:12px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">';
                html += '<span style="font-size:13px;font-weight:600;color:var(--text-muted);">Creditos pagados (' + paidCreditSales.length + ')</span>';
                html += '<button onclick="document.getElementById(\'paidCreditList\').style.display=document.getElementById(\'paidCreditList\').style.display===\'none\'?\'block\':\'none\';this.textContent=document.getElementById(\'paidCreditList\').style.display===\'none\'?\'Mostrar pagados (\' + ' + paidCreditSales.length + ' + \')\':\'Ocultar pagados\'" style="font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;color:var(--text-muted);">Mostrar pagados (' + paidCreditSales.length + ')</button>';
                html += '</div>';
                html += '<div id="paidCreditList" style="display:none;">';
                paidCreditSales.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0)).forEach(s => {
                    html += renderCreditSaleHistory(s);
                });
                html += '</div></div>';
            }
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
                const totalPagadoFijo = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
                const totalSaleFijo = s.creditInfo.totalCuotas * s.creditInfo.cuotaValor;
                pending = Math.max(0, totalSaleFijo - totalPagadoFijo);
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
            date: nowLocal(),
            created_at: nowLocal(),
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

function editSalePayment(saleId, paymentIdx) {
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale || !sale.creditInfo || !sale.creditInfo.payments || !sale.creditInfo.payments[paymentIdx]) return;
    const p = sale.creditInfo.payments[paymentIdx];
    document.getElementById('paymentEditSaleId').value = saleId;
    document.getElementById('paymentEditIdx').value = paymentIdx;
    document.getElementById('paymentEditDate').value = p.date ? p.date.split('T')[0] : today();
    document.getElementById('paymentEditAmount').value = p.amount || '';
    document.getElementById('paymentEditModal').classList.add('open');
}

function saveEditPayment() {
    const saleId = document.getElementById('paymentEditSaleId').value;
    const idx = parseInt(document.getElementById('paymentEditIdx').value);
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale || !sale.creditInfo || !sale.creditInfo.payments || !sale.creditInfo.payments[idx]) return;
    const p = sale.creditInfo.payments[idx];
    const newDate = document.getElementById('paymentEditDate').value;
    const newAmount = parseFloat(document.getElementById('paymentEditAmount').value);
    if (isNaN(newAmount) || newAmount < 0) { showToast('Monto invalido', 'error'); return; }
    const oldAmount = p.amount;
    const newDateStr = newDate ? newDate + 'T12:00:00' : p.date;
    const changed = oldAmount !== Math.round(newAmount) || p.date !== newDateStr;
    p.amount = Math.round(newAmount);
    p.date = newDateStr;
    saveSales();
    if (API.isAvailable) {
        const numericId = parseInt(String(sale.id).replace(/^p/i, ''));
        API.updateSale(numericId, { credit_info: sale.creditInfo }).catch(e => {
            console.error('[POS] editPayment API update error:', e);
        });
        if (changed) {
            API.deletePaymentBySaleAndAmount(numericId, oldAmount).then(() => {
                return API.addPayment(numericId, p.amount, 'Editado desde POS', p.date);
            }).catch(e => {
                console.error('[POS] editPayment payments table sync error:', e);
            });
        }
    }
    closeEditPaymentModal();
    if (_custHistoryCustomerId) showCustomerHistory(_custHistoryCustomerId);
    renderAccountStatus();
    renderCustomerTable();
    showToast('Pago actualizado');
}

function closeEditPaymentModal() {
    document.getElementById('paymentEditModal').classList.remove('open');
}

function deleteSalePayment(saleId, paymentIdx) {
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale || !sale.creditInfo || !sale.creditInfo.payments || !sale.creditInfo.payments[paymentIdx]) return;
    const p = sale.creditInfo.payments[paymentIdx];
    if (!confirm('Eliminar pago de ' + formatPrice(p.amount) + ' del ' + shortDate(p.date) + '?')) return;
    const deletedAmount = p.amount;
    sale.creditInfo.payments.splice(paymentIdx, 1);
    if (sale.creditInfo.tipo === 'abono') {
        const totalPagado = sale.creditInfo.payments.reduce((sp, pay) => sp + pay.amount, 0);
        sale.creditInfo.pagadas = totalPagado >= sale.creditInfo.balance ? 1 : 0;
    } else {
        const totalPagadoFijo = sale.creditInfo.payments.reduce((sp, pay) => sp + pay.amount, 0);
        sale.creditInfo.pagadas = Math.min(sale.creditInfo.totalCuotas, Math.floor(totalPagadoFijo / sale.creditInfo.cuotaValor));
    }
    saveSales();
    if (API.isAvailable) {
        const numericId = parseInt(String(sale.id).replace(/^p/i, ''));
        API.updateSale(numericId, { credit_info: sale.creditInfo }).catch(e => {
            console.error('[POS] deletePayment API update error:', e);
        });
        API.deletePaymentBySaleAndAmount(numericId, deletedAmount).then(() => {
            console.log('[POS] Payment deleted from payments table');
        }).catch(e => {
            console.error('[POS] deletePayment from payments table error:', e);
        });
    }
    if (_custHistoryCustomerId) showCustomerHistory(_custHistoryCustomerId);
    renderAccountStatus();
    renderCustomerTable();
    showToast('Pago eliminado');
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

// ============ DAILY CLOSING ============
function printDailyClosing() {
    _closingType = 'sales';
    const todayStr = today();
    document.getElementById('closingDateInput').value = todayStr;
    document.getElementById('closingDateModal').classList.add('open');
}

function closeClosingDateModal() {
    document.getElementById('closingDateModal').classList.remove('open');
}

function confirmPrintClosing() {
    if (typeof _closingType !== 'undefined' && _closingType === 'payments' && typeof confirmPrintPaymentsClosing === 'function') {
        _closingType = 'sales';
        return confirmPrintPaymentsClosing();
    }
    _closingType = 'sales';
    const selectedDate = document.getElementById('closingDateInput').value;
    if (!selectedDate) { showToast('Selecciona una fecha'); return; }
    closeClosingDateModal();
    const scope = getPosScope();
    const scopedSales = posSales.filter(s => {
        const saleDate = (s.date || s.created_at || '').split('T')[0];
        const matchesDate = saleDate === selectedDate;
        const matchesScope = scope === 'fuera' ? s.ventaPorFuera : !s.ventaPorFuera;
        return matchesDate && matchesScope && !s.creditInfo?.merged;
    });
    if (scopedSales.length === 0) { showToast('No hay ventas para esa fecha'); return; }
    let totalGeneral = 0;
    const methodTotals = {};
    scopedSales.forEach(s => {
        totalGeneral += s.total || 0;
        const mk = s.methodKey || s.method || 'Otro';
        methodTotals[mk] = (methodTotals[mk] || 0) + (s.total || 0);
    });
    let itemsHtml = scopedSales.map(s => {
        const qty = (s.items || []).reduce((a, i) => a + i.qty, 0);
        const cli = s.customer || 'Mostrador';
        return '<div class="receipt-row" style="font-size:12px;"><span>#' + s.id + ' ' + cli + ' (' + qty + 'p)</span><span style="font-weight:600;">' + formatPrice(s.total) + '</span></div>';
    }).join('');
    let methodsHtml = Object.entries(methodTotals).map(([k, v]) => {
        const labels = { cash: 'Efectivo', mixed: 'Mixto', bolt: 'BOLT', card: 'Tarjeta', nequi: 'Nequi', daviplata: 'Daviplata', otro: 'Otro' };
        return '<div class="receipt-row" style="font-size:12px;"><span>' + (labels[k] || k) + '</span><span style="font-weight:600;">' + formatPrice(v) + '</span></div>';
    }).join('');
    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
    document.getElementById('receiptContent').innerHTML =
        '<div class="receipt">' +
            '<div class="receipt-header">' +
                '<img src="' + (LOGO_DATA_URL || LOGO_URL) + '" style="max-width:160px;height:auto;margin-bottom:6px;" alt="Logo">' +
                '<h4 style="font-size:15px;margin:2px 0;">CIERRE DEL DIA</h4>' +
                '<p style="font-size:11px;margin:2px 0;">' + dateLabel + '</p>' +
                '<p style="font-size:11px;margin:2px 0;color:var(--text-muted);">' + (scope === 'fuera' ? 'TPV Por Fuera' : 'TPV Local') + '</p>' +
            '</div>' +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-row" style="font-weight:700;"><span>Total vendido</span><span>' + formatPrice(totalGeneral) + '</span></div>' +
            '<div class="receipt-row" style="font-size:12px;"><span>Cantidad de ventas</span><span>' + scopedSales.length + '</span></div>' +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Por metodo de pago</div>' +
            methodsHtml +
            '<div class="receipt-divider"></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Detalle de ventas</div>' +
            itemsHtml +
            '<div class="receipt-divider"></div>' +
            '<div class="receipt-footer">' +
                '<p>Cierre generado el ' + new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</p>' +
            '</div>' +
        '</div>';
    document.getElementById('receiptModal').classList.add('open');
    const btnInv = document.getElementById('btnDownloadInv');
    if (btnInv) btnInv.style.display = 'none';
    setTimeout(() => { window.print(); }, 400);
}

// ============ LAB ORDERS ============
function saveLabOrders() {
    localStorage.setItem('labOrders', JSON.stringify(labOrders));
}

async function getUniqueBrands() {
    try {
        const apiLabs = await API.getLabs();
        posLabs = apiLabs.map(l => ({ id: l.id, name: l.name }));
        localStorage.setItem('posLabs', JSON.stringify(posLabs));
    } catch(e) {}
    const brands = {};
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (b) brands[b] = (brands[b] || 0) + 1;
    });
    posLabs.forEach(l => {
        const key = (l.name || '').trim();
        if (key && !brands[key]) brands[key] = 0;
    });
    return Object.entries(brands).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function renderLabOrders() {
    const tbody = document.getElementById('labOrdersBody');
    if (!tbody) return;
    const searchEl = document.getElementById('labOrderSearch');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    let filtered = [...labOrders];
    if (q) filtered = filtered.filter(o => o.lab.toLowerCase().includes(q) || (o.notes || '').toLowerCase().includes(q));
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No hay pedidos a laboratorios</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(o => {
        return '<tr>' +
            '<td><strong>' + shortDate(o.date) + '</strong></td>' +
            '<td><strong>' + o.lab + '</strong></td>' +
            '<td style="font-size:13px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (o.notes || '-') + '</td>' +
            '<td class="actions" style="white-space:nowrap;">' +
                '<button class="edit" onclick="viewLabOrder(\'' + o.id + '\')" title="Ver" style="color:var(--primary);margin-right:4px;"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>' +
                '<button class="edit" onclick="editLabOrder(\'' + o.id + '\')" title="Editar" style="color:var(--primary);margin-right:4px;"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>' +
                '<button class="edit" onclick="deleteLabOrder(\'' + o.id + '\')" title="Eliminar" style="color:var(--danger);"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
            '</td></tr>';
    }).join('');
}

async function filterLabOrderLabs() {
    const q = document.getElementById('labOrderLabSearch').value.toLowerCase().trim();
    const brands = await getUniqueBrands();
    const filtered = q ? brands.filter(b => b.name.toLowerCase().includes(q)) : brands;
    const dd = document.getElementById('labOrderLabDropdown');
    if (filtered.length === 0) {
        dd.innerHTML = '<div style="padding:10px 12px;color:var(--text-muted);font-size:13px;">No se encontraron laboratorios</div>';
    } else {
        dd.innerHTML = filtered.map(b => '<div onclick="selectLabOrderLab(\'' + b.name.replace(/'/g, "\\'") + '\')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;" onmouseover="this.style.background=\'#f0f7f0\'" onmouseout="this.style.background=\'#fff\'">' + b.name + ' <span style="color:#888;">(' + b.count + ')</span></div>').join('');
    }
    dd.style.display = 'block';
}

function selectLabOrderLab(name) {
    document.getElementById('labOrderLabSearch').value = name;
    document.getElementById('labOrderLabSelect').value = name;
    document.getElementById('labOrderLabDropdown').style.display = 'none';
}

function openNewLabOrderModal() {
    document.getElementById('labOrderLabSearch').value = '';
    document.getElementById('labOrderLabSelect').value = '';
    document.getElementById('labOrderLabDropdown').style.display = 'none';
    document.getElementById('labOrderNotes').value = '';
    document.getElementById('newLabOrderModal').classList.add('open');
}

function deleteLabOrder(orderId) {
    const order = labOrders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    if (!confirm('Eliminar pedido de "' + order.lab + '"?')) return;
    const apiId = String(order.id).replace('lab_', '');
    labOrders = labOrders.filter(o => String(o.id) !== String(orderId));
    saveLabOrders();
    renderLabOrders();
    if (API.isAvailable && apiId && !isNaN(apiId)) {
        API.deleteLabOrder(parseInt(apiId)).then(() => {
            syncFromApi().then(() => renderLabOrders());
        }).catch(e => {});
    }
    showToast('Pedido eliminado');
}

function viewLabOrder(orderId) {
    const order = labOrders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    let html = '<div style="padding:4px 0;">' +
        '<p><strong>Laboratorio:</strong> ' + order.lab + '</p>' +
        '<p><strong>Fecha:</strong> ' + shortDate(order.date) + '</p>' +
        (order.notes ? '<p><strong>Notas:</strong> ' + order.notes + '</p>' : '<p style="color:var(--text-muted);">Sin notas</p>') +
        '</div>';
    const modal = document.getElementById('labOrderViewModal');
    modal.querySelector('.lab-order-view-content').innerHTML = html;
    modal.classList.add('open');
}

function closeLabOrderViewModal() {
    document.getElementById('labOrderViewModal').classList.remove('open');
}

let _editingLabOrderId = null;

async function editLabOrder(orderId) {
    const order = labOrders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    _editingLabOrderId = orderId;
    const brands = await getUniqueBrands();
    const searchEl = document.getElementById('labOrderLabSearch');
    const selectEl = document.getElementById('labOrderLabSelect');
    searchEl.value = order.lab;
    document.getElementById('labOrderNotes').value = order.notes || '';
    document.getElementById('newLabOrderModal').classList.add('open');
    document.querySelector('#newLabOrderModal .modal-header h3').textContent = 'Editar Pedido';
    document.querySelector('#newLabOrderModal .btn-primary').textContent = 'Guardar cambios';
}

function closeNewLabOrderModal() {
    document.getElementById('newLabOrderModal').classList.remove('open');
    const dd = document.getElementById('labOrderLabDropdown');
    if (dd) dd.style.display = 'none';
    _editingLabOrderId = null;
    document.querySelector('#newLabOrderModal .modal-header h3').textContent = 'Nuevo Pedido a Laboratorio';
    document.querySelector('#newLabOrderModal .btn-primary').textContent = 'Guardar';
}

function saveNewLabOrder() {
    const lab = document.getElementById('labOrderLabSelect').value;
    if (!lab) { showToast('Selecciona un laboratorio', 'error'); return; }
    const notes = document.getElementById('labOrderNotes').value.trim();
    if (!notes) { showToast('Escribe una nota', 'error'); return; }

    if (_editingLabOrderId) {
        const order = labOrders.find(o => String(o.id) === String(_editingLabOrderId));
        if (order) {
            order.lab = lab;
            order.notes = notes;
            saveLabOrders();
            const apiId = String(order.id).replace('lab_', '');
            if (API.isAvailable && apiId && !isNaN(apiId)) {
                API.updateLabOrder(parseInt(apiId), { lab, notes }).catch(e => {});
            }
            renderLabOrders();
            showToast('Pedido actualizado');
        }
        closeNewLabOrderModal();
        return;
    }

    const order = {
        id: 'lab_' + nextLabOrderId++,
        lab,
        date: now(),
        notes
    };
    labOrders.unshift(order);
    saveLabOrders();
    if (API.isAvailable) {
        API.saveLabOrder({ ...order, id: undefined }).then(res => {
            if (res && res.id) {
                order.id = 'lab_' + res.id;
                order._synced = true;
                saveLabOrders();
                renderLabOrders();
            }
        }).catch(e => {});
    }
    closeNewLabOrderModal();
    renderLabOrders();
    showToast('Pedido registrado para ' + lab);
}

// ============ SUPPLIER EXPENSES ============
function saveSupplierExpenses() {
    localStorage.setItem('supplierExpenses', JSON.stringify(supplierExpenses));
}

function renderSupplierExpenses() {
    const tbody = document.getElementById('supplierExpensesBody');
    if (!tbody) return;
    const searchEl = document.getElementById('supplierExpenseSearch');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    let filtered = [...supplierExpenses];
    if (q) filtered = filtered.filter(e => e.supplier.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q));
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No hay gastos a proveedores</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(e => {
        return '<tr>' +
            '<td><strong>' + shortDate(e.date) + '</strong></td>' +
            '<td><strong>' + e.supplier + '</strong></td>' +
            '<td style="font-size:13px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (e.notes || '-') + '</td>' +
            '<td class="actions" style="white-space:nowrap;">' +
                '<button class="edit" onclick="viewSupplierExpense(\'' + e.id + '\')" title="Ver" style="color:var(--primary);margin-right:4px;"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>' +
                '<button class="edit" onclick="editSupplierExpense(\'' + e.id + '\')" title="Editar" style="color:var(--primary);margin-right:4px;"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>' +
                '<button class="edit" onclick="deleteSupplierExpense(\'' + e.id + '\')" title="Eliminar" style="color:var(--danger);"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
            '</td></tr>';
    }).join('');
}

function filterSupplierExpenseSuppliers() {
    const q = document.getElementById('supplierExpenseSupSearch').value.toLowerCase().trim();
    const suppliers = posSuppliers.map(s => s.name).filter(n => n);
    const filtered = q ? suppliers.filter(n => n.toLowerCase().includes(q)) : suppliers;
    const dd = document.getElementById('supplierExpenseSupDropdown');
    if (filtered.length === 0) {
        dd.innerHTML = '<div style="padding:10px 12px;color:var(--text-muted);font-size:13px;">No se encontraron proveedores</div>';
    } else {
        dd.innerHTML = filtered.map(name => '<div onclick="selectSupplierExpenseSupplier(\'' + name.replace(/'/g, "\\'") + '\')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;" onmouseover="this.style.background=\'#f0f7f0\'" onmouseout="this.style.background=\'#fff\'">' + name + '</div>').join('');
    }
    dd.style.display = 'block';
}

function selectSupplierExpenseSupplier(name) {
    document.getElementById('supplierExpenseSupSearch').value = name;
    document.getElementById('supplierExpenseSupSelect').value = name;
    document.getElementById('supplierExpenseSupDropdown').style.display = 'none';
}

function openNewSupplierExpenseModal() {
    document.getElementById('supplierExpenseSupSearch').value = '';
    document.getElementById('supplierExpenseSupSelect').value = '';
    document.getElementById('supplierExpenseSupDropdown').style.display = 'none';
    document.getElementById('supplierExpenseNotes').value = '';
    document.getElementById('newSupplierExpenseModal').classList.add('open');
}

function deleteSupplierExpense(expenseId) {
    const expense = supplierExpenses.find(e => String(e.id) === String(expenseId));
    if (!expense) return;
    if (!confirm('Eliminar gasto de "' + expense.supplier + '"?')) return;
    const apiId = String(expense.id).replace('se_', '');
    supplierExpenses = supplierExpenses.filter(e => String(e.id) !== String(expenseId));
    saveSupplierExpenses();
    renderSupplierExpenses();
    if (API.isAvailable && apiId && !isNaN(apiId)) {
        API.deleteSupplierExpense(parseInt(apiId)).then(() => {
            syncFromApi().then(() => renderSupplierExpenses());
        }).catch(e => {});
    }
    showToast('Gasto eliminado');
}

function viewSupplierExpense(expenseId) {
    const expense = supplierExpenses.find(e => String(e.id) === String(expenseId));
    if (!expense) return;
    let html = '<div style="padding:4px 0;">' +
        '<p><strong>Proveedor:</strong> ' + expense.supplier + '</p>' +
        '<p><strong>Fecha:</strong> ' + shortDate(expense.date) + '</p>' +
        (expense.notes ? '<p><strong>Notas:</strong> ' + expense.notes + '</p>' : '<p style="color:var(--text-muted);">Sin notas</p>') +
        '</div>';
    const modal = document.getElementById('supplierExpenseViewModal');
    modal.querySelector('.supplier-expense-view-content').innerHTML = html;
    modal.classList.add('open');
}

function closeSupplierExpenseViewModal() {
    document.getElementById('supplierExpenseViewModal').classList.remove('open');
}

let _editingSupplierExpenseId = null;

function editSupplierExpense(expenseId) {
    const expense = supplierExpenses.find(e => String(e.id) === String(expenseId));
    if (!expense) return;
    _editingSupplierExpenseId = expenseId;
    document.getElementById('supplierExpenseSupSearch').value = expense.supplier;
    document.getElementById('supplierExpenseSupSelect').value = expense.supplier;
    document.getElementById('supplierExpenseNotes').value = expense.notes || '';
    document.getElementById('newSupplierExpenseModal').classList.add('open');
    document.querySelector('#newSupplierExpenseModal .modal-header h3').textContent = 'Editar Gasto a Proveedor';
    document.querySelector('#newSupplierExpenseModal .btn-primary').textContent = 'Guardar cambios';
}

function closeNewSupplierExpenseModal() {
    document.getElementById('newSupplierExpenseModal').classList.remove('open');
    const dd = document.getElementById('supplierExpenseSupDropdown');
    if (dd) dd.style.display = 'none';
    _editingSupplierExpenseId = null;
    document.querySelector('#newSupplierExpenseModal .modal-header h3').textContent = 'Nuevo Gasto a Proveedor';
    document.querySelector('#newSupplierExpenseModal .btn-primary').textContent = 'Guardar';
}

function saveNewSupplierExpense() {
    const supplier = document.getElementById('supplierExpenseSupSelect').value;
    if (!supplier) { showToast('Selecciona un proveedor', 'error'); return; }
    const notes = document.getElementById('supplierExpenseNotes').value.trim();
    if (!notes) { showToast('Escribe una nota', 'error'); return; }

    if (_editingSupplierExpenseId) {
        const expense = supplierExpenses.find(e => String(e.id) === String(_editingSupplierExpenseId));
        if (expense) {
            expense.supplier = supplier;
            expense.notes = notes;
            saveSupplierExpenses();
            const apiId = String(expense.id).replace('se_', '');
            if (API.isAvailable && apiId && !isNaN(apiId)) {
                API.updateSupplierExpense(parseInt(apiId), { supplier, notes }).catch(e => {});
            }
            renderSupplierExpenses();
            showToast('Gasto actualizado');
        }
        closeNewSupplierExpenseModal();
        return;
    }

    const expense = {
        id: 'se_' + nextSupplierExpenseId++,
        supplier,
        date: now(),
        notes
    };
    supplierExpenses.unshift(expense);
    saveSupplierExpenses();
    if (API.isAvailable) {
        API.saveSupplierExpense({ ...expense, id: undefined }).then(res => {
            if (res && res.id) {
                expense.id = 'se_' + res.id;
                expense._synced = true;
                saveSupplierExpenses();
                renderSupplierExpenses();
            }
        }).catch(e => {});
    }
    closeNewSupplierExpenseModal();
    renderSupplierExpenses();
    showToast('Gasto registrado para ' + supplier);
}

// ============ LABS MANAGEMENT (Brands) ============
function switchProdTab(tab) {
    document.querySelectorAll('[data-prodtab]').forEach(t => t.classList.toggle('active', t.dataset.prodtab === tab));
    const isLabs = tab === 'labs';
    document.getElementById('prodSection').style.display = isLabs ? 'none' : '';
    document.getElementById('prodSectionActions').style.display = isLabs ? 'none' : 'flex';
    document.getElementById('labSection').style.display = isLabs ? '' : 'none';
    document.getElementById('labSectionActions').style.display = isLabs ? 'flex' : 'none';
    if (isLabs) renderLabsList();
    else renderProductTable();
}

async function renderLabsList() {
    const tbody = document.getElementById('labsListBody');
    if (!tbody) return;
    const q = document.getElementById('labSearch') ? document.getElementById('labSearch').value.toLowerCase().trim() : '';
    // Fetch labs from API (source of truth)
    try {
        const apiLabs = await API.getLabs();
        posLabs = apiLabs.map(l => ({ id: l.id, name: l.name }));
        localStorage.setItem('posLabs', JSON.stringify(posLabs));
    } catch(e) {}
    // Count products per lab from posProducts
    const productCounts = {};
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (!b) return;
        const key = b.toLowerCase();
        if (!productCounts[key]) productCounts[key] = { total: 0, low: 0, out: 0, variants: {} };
        productCounts[key].total++;
        productCounts[key].variants[b] = (productCounts[key].variants[b] || 0) + 1;
        if (p.stock <= 0) productCounts[key].out++;
        else if (p.stock <= 5) productCounts[key].low++;
    });
    // Build list from DB labs only
    let list = posLabs.map(l => {
        const key = l.name.toLowerCase();
        const pc = productCounts[key] || { total: 0, low: 0, out: 0, variants: {} };
        return { id: l.id, name: l.name, canonical: l.name, total: pc.total, low: pc.low, out: pc.out, variants: pc.variants };
    });
    list.sort((a, b) => a.canonical.localeCompare(b.canonical));
    if (q) list = list.filter(l => l.canonical.toLowerCase().includes(q));
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No hay laboratorios creados. Crea uno con "+ Nuevo Laboratorio"</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(l => {
        const lowTag = l.low > 0 ? '<span style="color:#e65100;font-weight:600;">' + l.low + '</span>' : '<span style="color:var(--text-muted);">0</span>';
        const outTag = l.out > 0 ? '<span style="color:var(--danger);font-weight:600;">' + l.out + '</span>' : '<span style="color:var(--text-muted);">0</span>';
        const variantCount = Object.keys(l.variants).length;
        const variantTag = variantCount > 1 ? ' <span style="color:#e65100;font-size:10px;" title="Variantes: ' + Object.keys(l.variants).join(', ') + '">⚠ ' + variantCount + ' variantes</span>' : '';
        return '<tr>' +
            '<td><strong>' + l.canonical + '</strong>' + variantTag + '</td>' +
            '<td>' + l.total + '</td>' +
            '<td>' + lowTag + '</td>' +
            '<td>' + outTag + '</td>' +
            '<td class="actions" style="white-space:nowrap;">' +
                '<button onclick="viewLabProducts(\'' + l.canonical.replace(/'/g, "\\'") + '\')" title="Ver productos" style="background:var(--primary);color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;margin-right:4px;">Ver</button>' +
                (variantCount > 1 ? '<button onclick="mergeLabVariants(\'' + l.canonical.replace(/'/g, "\\'") + '\')" title="Unir variantes" style="background:#e65100;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;margin-right:4px;">Unir</button>' : '') +
                '<button onclick="renameLab(\'' + l.canonical.replace(/'/g, "\\'") + '\')" title="Renombrar" style="background:#f5f5f5;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;margin-right:4px;">Renombrar</button>' +
                '<button onclick="deleteLab(\'' + l.canonical.replace(/'/g, "\\'") + '\')" title="Eliminar" style="background:var(--danger);color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;">Eliminar</button>' +
            '</td></tr>';
    }).join('');
}

function mergeLabVariants(canonical) {
    const brands = {};
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (!b) return;
        const key = b.toLowerCase();
        if (!brands[key]) brands[key] = [];
        brands[key].push(b);
    });
    const key = canonical.toLowerCase();
    const variants = [...new Set(brands[key] || [])];
    if (variants.length <= 1) { showToast('No hay variantes para unir', 'error'); return; }
    if (!confirm('Unir variantes de "' + canonical + '"?\n\nVariantes: ' + variants.join(', ') + '\n\nTodas se cambiaran a "' + canonical + '".')) return;
    let count = 0;
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (b.toLowerCase() === key && b !== canonical) {
            p.brand = canonical;
            count++;
        }
    });
    saveProducts();
    showToast(count + ' productos unidos bajo "' + canonical + '"');
    renderLabsList();
}

function mergeLabs() {
    const list = posLabs.map(l => {
        const key = l.name.toLowerCase();
        const count = posProducts.filter(p => (p.brand || '').trim().toLowerCase() === key).length;
        return { name: l.name, count, id: l.id };
    }).sort((a, b) => a.name.localeCompare(b.name));
    if (list.length < 2) { showToast('Necesitas al menos 2 laboratorios para unir', 'error'); return; }
    const tbody = document.getElementById('mergeLabsList');
    tbody.innerHTML = '<div style="padding:8px;border-bottom:1px solid var(--border);"><input type="text" id="mergeLabsSearchInput" placeholder="Buscar laboratorio..." oninput="filterMergeLabsList()" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;"></div>' +
        list.map(l =>
        '<label class="merge-lab-item" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;">' +
        '<input type="checkbox" class="merge-lab-check" value="' + l.name.replace(/"/g, '&quot;') + '">' +
        '<span><strong>' + l.name + '</strong> <span style="color:var(--text-muted);font-size:12px;">(' + l.count + ' productos)</span></span>' +
        '</label>'
    ).join('');
    document.getElementById('mergeLabsNewName').value = '';
    document.getElementById('mergeLabsModal').classList.add('open');
}

function closeMergeLabsModal() {
    document.getElementById('mergeLabsModal').classList.remove('open');
}

function filterMergeLabsList() {
    const q = document.getElementById('mergeLabsSearchInput') ? document.getElementById('mergeLabsSearchInput').value.toLowerCase().trim() : '';
    document.querySelectorAll('.merge-lab-item').forEach(el => {
        const name = el.querySelector('strong').textContent.toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
    });
}

async function executeMergeLabs() {
    const checked = document.querySelectorAll('.merge-lab-check:checked');
    const newName = document.getElementById('mergeLabsNewName').value.trim();
    if (checked.length < 2) { showToast('Selecciona al menos 2 laboratorios', 'error'); return; }
    if (!newName) { showToast('Escribe el nombre nuevo para el laboratorio', 'error'); return; }
    const selected = Array.from(checked).map(cb => cb.value);
    const display = selected.join('", "') + '" → "' + newName + '"';
    if (!confirm('Unir laboratorios?\n\n"' + display + '\n\n' + selected.length + ' laboratorios se fusionaran en uno solo.')) return;
    let count = 0;
    const changed = [];
    posProducts.forEach(p => {
        const b = (p.brand || '').trim();
        if (selected.some(s => s.toLowerCase() === b.toLowerCase())) {
            p.brand = newName;
            count++;
            changed.push(p);
        }
    });
    saveProducts();
    // Also save changed products to API immediately
    if (API.isAvailable && changed.length > 0) {
        changed.forEach(p => {
            const apiId = p.id && p.id.startsWith('p') ? parseInt(p.id.replace('p','')) : null;
            if (!apiId) return;
            API.saveProduct({
                id: apiId, name: p.name, brand: newName, category: p.category,
                price: p.price, cost: p.cost || 0, stock: p.stock,
                img: p.img || '', images: p.images || [], barcode: p.barcode || '',
                description: p.desc || '', featured: p.featured || false, visible: p.visible !== false
            }).catch(e => console.error('merge lab save error:', e));
        });
    }
    closeMergeLabsModal();
    const mergedLabs = posLabs.filter(l => selected.some(s => s.toLowerCase() === l.name.toLowerCase()) && l.id);
    for (const l of mergedLabs) { try { await API.deleteLab(l.id); } catch(e) { console.error('merge labs api error:', e); } }
    posLabs = posLabs.filter(l => !selected.some(s => s.toLowerCase() === l.name.toLowerCase()));
    localStorage.setItem('posLabs', JSON.stringify(posLabs));
    renderLabsList();
    showToast(count + ' productos unidos bajo "' + newName + '"');
}

// ---- Lab Prompt/Confirm Modals ----
let _labPromptResolve = null;
function labPrompt(title, msg, defaultValue) {
    return new Promise(resolve => {
        _labPromptResolve = resolve;
        document.getElementById('labPromptTitle').textContent = title;
        document.getElementById('labPromptMsg').textContent = msg;
        const input = document.getElementById('labPromptInput');
        input.value = defaultValue || '';
        input.placeholder = msg;
        document.getElementById('labPromptModal').classList.add('open');
        setTimeout(() => input.focus(), 100);
    });
}
function closeLabPrompt(submit) {
    document.getElementById('labPromptModal').classList.remove('open');
    const val = document.getElementById('labPromptInput').value;
    if (_labPromptResolve) { _labPromptResolve(submit ? val : null); _labPromptResolve = null; }
}

let _labConfirmResolve = null;
function labConfirm(title, msg, okText) {
    return new Promise(resolve => {
        _labConfirmResolve = resolve;
        document.getElementById('labConfirmTitle').textContent = title;
        document.getElementById('labConfirmMsg').textContent = msg;
        if (okText) document.getElementById('labConfirmOkBtn').textContent = okText;
        document.getElementById('labConfirmModal').classList.add('open');
    });
}
function closeLabConfirm(ok) {
    document.getElementById('labConfirmModal').classList.remove('open');
    if (_labConfirmResolve) { _labConfirmResolve(ok); _labConfirmResolve = null; }
}

function selectPaymentMethod(el, method) {
    const sec = document.getElementById('paymentMethodSecondary');
    const isSecondary = sec && sec.contains(el);
    document.getElementById('paymentMethod').value = method;
    document.querySelectorAll('#paymentMethodGrid [data-method], #paymentMethodSecondary [data-method]').forEach(btn => {
        btn.style.borderColor = btn.dataset.method === method ? 'var(--primary)' : 'var(--border)';
        btn.style.background = btn.dataset.method === method ? 'rgba(11,81,59,0.06)' : '#fff';
    });
    if (sec) {
        const showSecondary = el.closest('#paymentMethodGrid') && method === 'Transferencia' || isSecondary;
        sec.style.display = showSecondary ? 'grid' : 'none';
    }
}

async function createNewLab() {
    const name = await labPrompt('Nuevo Laboratorio', 'Nombre del nuevo laboratorio:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const exists = posProducts.some(p => (p.brand || '').trim().toLowerCase() === trimmed.toLowerCase()) || posLabs.some(l => l.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) { showToast('Ya existe un laboratorio con ese nombre', 'error'); return; }
    try {
        const lab = await API.saveLab(trimmed);
        posLabs.push({ id: lab.id, name: trimmed });
    } catch(e) {
        posLabs.push({ id: Date.now(), name: trimmed });
    }
    localStorage.setItem('posLabs', JSON.stringify(posLabs));
    showToast('Laboratorio "' + trimmed + '" creado');
    renderLabsList();
}

async function renameLab(oldName) {
    const newName = await labPrompt('Renombrar Laboratorio', 'Nuevo nombre para "' + oldName + '":', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    const exists = posProducts.some(p => (p.brand || '').trim().toLowerCase() === trimmed.toLowerCase() && (p.brand || '').trim().toLowerCase() !== oldName.toLowerCase()) || posLabs.some(l => l.name.toLowerCase() === trimmed.toLowerCase() && l.name.toLowerCase() !== oldName.toLowerCase());
    if (exists) { showToast('Ya existe un laboratorio con ese nombre', 'error'); return; }
    let count = 0;
    const changed = [];
    posProducts.forEach(p => {
        if ((p.brand || '').trim().toLowerCase() === oldName.toLowerCase()) {
            p.brand = trimmed;
            count++;
            changed.push(p);
        }
    });
    const lab = posLabs.find(l => l.name.toLowerCase() === oldName.toLowerCase());
    if (lab) {
        lab.name = trimmed;
        localStorage.setItem('posLabs', JSON.stringify(posLabs));
        if (lab.id) { try { await API.updateLab(lab.id, trimmed); } catch(e) { console.error('rename lab api error:', e); } }
    }
    saveProducts();
    if (API.isAvailable && changed.length > 0) {
        changed.forEach(p => {
            const apiId = p.id && p.id.startsWith('p') ? parseInt(p.id.replace('p','')) : null;
            if (!apiId) return;
            API.saveProduct({
                id: apiId, name: p.name, brand: trimmed, category: p.category,
                price: p.price, cost: p.cost || 0, stock: p.stock,
                img: p.img || '', images: p.images || [], barcode: p.barcode || '',
                description: p.desc || '', featured: p.featured || false, visible: p.visible !== false
            }).catch(e => console.error('rename lab save error:', e));
        });
    }
    showToast(count + ' productos renombrados de "' + oldName + '" a "' + trimmed + '"');
    renderLabsList();
}

async function deleteLab(name) {
    const confirmed = await labConfirm('Eliminar Laboratorio', 'Eliminar laboratorio "' + name + '"?\nSe quitara la marca de todos sus productos.', 'Eliminar');
    if (!confirmed) return;
    let count = 0;
    const changed = [];
    posProducts.forEach(p => {
        if ((p.brand || '').trim().toLowerCase() === name.toLowerCase()) {
            p.brand = '';
            count++;
            changed.push(p);
        }
    });
    saveProducts();
    if (API.isAvailable && changed.length > 0) {
        changed.forEach(p => {
            const apiId = p.id && p.id.startsWith('p') ? parseInt(p.id.replace('p','')) : null;
            if (!apiId) return;
            API.saveProduct({
                id: apiId, name: p.name, brand: '', category: p.category,
                price: p.price, cost: p.cost || 0, stock: p.stock,
                img: p.img || '', images: p.images || [], barcode: p.barcode || '',
                description: p.desc || '', featured: p.featured || false, visible: p.visible !== false
            }).catch(e => console.error('delete lab save error:', e));
        });
    }
    showToast(count + ' productos quedaron sin laboratorio');
    const lab = posLabs.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (lab && lab.id) { try { await API.deleteLab(lab.id); } catch(e) { console.error('delete lab api error:', e); } }
    posLabs = posLabs.filter(l => l.name.toLowerCase() !== name.toLowerCase());
    localStorage.setItem('posLabs', JSON.stringify(posLabs));
    renderLabsList();
}

function viewLabProducts(brand) {
    switchProdTab('products');
    const searchEl = document.getElementById('prodSearch');
    if (searchEl) { searchEl.value = brand; renderProductTable(); }
}

async function assignProductToLab(productId) {
    const prod = posProducts.find(p => String(p.id) === String(productId));
    if (!prod) return;
    const current = (prod.brand || '').trim();
    const brands = getUniqueBrands();
    const list = brands.map(b => b.name).join(', ');
    const name = prompt('Asignar laboratorio a "' + prod.name + '"\n\nLaboratorios existentes: ' + (list || 'Ninguno') + '\n\nEscribe el nombre del laboratorio:', current);
    if (!name || name.trim() === current) return;
    const newName = name.trim();
    prod.brand = newName;
    saveProducts();
    // Ensure lab exists in DB
    if (newName && !posLabs.some(l => l.name.toLowerCase() === newName.toLowerCase())) {
        try {
            const lab = await API.saveLab(newName);
            posLabs.push({ id: lab.id, name: newName });
            localStorage.setItem('posLabs', JSON.stringify(posLabs));
        } catch(e) {}
    }
    if (API.isAvailable) {
        const apiId = prod.id && prod.id.startsWith('p') ? parseInt(prod.id.replace('p','')) : null;
        if (apiId) {
            API.saveProduct({
                id: apiId, name: prod.name, brand: prod.brand, category: prod.category,
                price: prod.price, cost: prod.cost || 0, stock: prod.stock,
                img: prod.img || '', images: prod.images || [], barcode: prod.barcode || '',
                description: prod.desc || '', featured: prod.featured || false, visible: prod.visible !== false
            }).catch(e => console.error('assign lab save error:', e));
        }
    }
    renderProductTable();
    showToast('"' + prod.name + '" asignado a "' + prod.brand + '"');
}
async function refreshSystem() {
    const btn = document.getElementById('refreshBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
        const available = await API.check();
        if (available) {
            await syncFromApi();
        } else {
            loadData();
        }
        if (typeof loadSalidas === 'function') await loadSalidas();
        applyPosScopeUI();
        initCatFilter();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderTpv === 'function') renderTpv();
        if (typeof renderProductTable === 'function') renderProductTable();
        if (typeof renderCustomerTable === 'function') renderCustomerTable();
        if (typeof renderCategoriesTable === 'function') renderCategoriesTable();
        if (typeof renderAccountStatus === 'function') renderAccountStatus();
        if (typeof renderSalesTable === 'function') renderSalesTable();
        if (typeof renderInventory === 'function') renderInventory();
        if (typeof renderInvLog === 'function') renderInvLog();
        if (typeof renderSalidas === 'function') renderSalidas();
        if (typeof renderLabOrders === 'function') renderLabOrders();
        if (typeof renderSupplierExpenses === 'function') renderSupplierExpenses();
        showToast('Sistema actualizado');
    } catch(e) {
        showToast('Error al actualizar: ' + (e.message || e), 'error');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>'; }
}
