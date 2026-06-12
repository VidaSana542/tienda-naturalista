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
    if (currentUser.role === 'empleado') {
        switchPanel('tpv');
    }
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

// ============ DATA ============
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
            const apiId = c.id || null;
            API.saveCategory({ id: apiId, key: c.key, label: c.label, parent_key: c.parent_key || null }).then(res => {
                if (!c.id && res && res.id) c.id = res.id;
            }).catch(() => {});
        });
    }
}
function addCategory(key, label, parent_key) {
    if (!key || !label || POS_CATEGORIES.find(c => c.key === key)) return false;
    POS_CATEGORIES.push({ key, label, parent_key: parent_key || null });
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
        saveCategories();
        refreshCategorySelect();
        refreshProdCatFilter();
        _invStockCatInit = false;
        _invLogCatInit = false;
        renderInventory();
        renderCategoriesTable();
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
        _invStockCatInit = false;
        _invLogCatInit = false;
        renderInventory();
        renderCategoriesTable();
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

function loadData() {
    try {
        posProducts = JSON.parse(localStorage.getItem('posProducts')) || null;
        posSales = JSON.parse(localStorage.getItem('posSales')) || [];
        posCustomers = JSON.parse(localStorage.getItem('posCustomers')) || [];
        posCart = JSON.parse(localStorage.getItem('posCart')) || [];
        invLog = JSON.parse(localStorage.getItem('invLog')) || [];
        posSuppliers = JSON.parse(localStorage.getItem('posSuppliers')) || [];
    } catch(e) {}
    if (!posProducts) {
        posProducts = [];
        posNextProductId = 1;
    } else {
        posNextProductId = posProducts.reduce((m, p) => Math.max(m, parseInt(p.id.replace('p',''))), 0) + 1;
    }
    if (posCustomers.length > 0) {
        posNextCustomerId = posCustomers.reduce((m, c) => Math.max(m, parseInt(c.id.replace('c',''))), 0) + 1;
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
    console.log('[POS] saveProducts: API.isAvailable =', API.isAvailable);
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
            API.saveProduct(payload).catch(e => { console.error('[POS] saveProduct error:', e); });
        });
    }
}
function saveSales() {
    localStorage.setItem('posSales', JSON.stringify(posSales));
    console.log('[POS] saveSales: API.isAvailable =', API.isAvailable, ', ventas:', posSales.length);
    if (API.isAvailable) {
        const unsynced = posSales.filter(s => s.id && !s.apiSynced);
        console.log('[POS] saveSales: no sincronizadas =', unsynced.length);
        unsynced.forEach(s => {
                API.saveSale({
                    customer_id: s.customerId ? parseInt(s.customerId.replace('c','')) : null,
                    customer_name: s.customer,
                    total: s.total,
                    excedente: s.excedente,
                    method: s.method,
                    method_key: s.methodKey,
                    venta_por_fuera: s.ventaPorFuera || false,
                    credit_info: s.creditInfo || null,
                    items: s.items || []
                }).then(res => { if (res && res.id) { s.apiSynced = true; s.id = res.id; posNextSaleId = Math.max(posNextSaleId, res.id + 1); localStorage.setItem('posSales', JSON.stringify(posSales)); } }).catch(e => { console.error('[POS] saveSale error:', e); });
            });
    }
}
function saveCustomers() {
    localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
    console.log('[POS] saveCustomers: API.isAvailable =', API.isAvailable);
    if (API.isAvailable) {
        posCustomers.forEach(c => {
            const apiId = c.id && c.id.startsWith('c') ? parseInt(c.id.replace('c','')) : null;
            API.saveCustomer({
                id: apiId,
                name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', tipo: c.tipo || 'local'
            }).catch(e => { console.error('[POS] saveCustomer error:', e); });
        });
    }
}
function saveSuppliers() {
    localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers));
    if (API.isAvailable) {
        posSuppliers.forEach(s => {
            const apiId = s.id && s.id.startsWith('s') ? parseInt(s.id.replace('s','')) : null;
            API.saveSupplier({
                id: apiId,
                name: s.name, nit: s.nit || '', contact: s.contact || '',
                phone: s.phone || '', email: s.email || '', address: s.address || ''
            }).catch(() => {});
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
                        subcategory: ap.subcategory || ''
                    });
                }
            });
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
                tipo: c.tipo || 'local'
            }));
            localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
            posNextCustomerId = posCustomers.reduce((m, c) => Math.max(m, parseInt(c.id.replace('c',''))), 0) + 1;
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
                address: s.address || ''
            }));
            localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers));
            posNextSupplierId = posSuppliers.reduce((m, s) => Math.max(m, parseInt(s.id.replace('s',''))), 0) + 1;
        }
        const apiCategories = await API.getCategories();
        if (apiCategories && apiCategories.length > 0) {
            const freshCats = apiCategories.map(c => ({ id: c.id, key: c.key, label: c.label, parent_key: c.parent_key || null }));
            const existingKeys = POS_CATEGORIES.map(c => c.key);
            freshCats.forEach(fc => {
                const idx = POS_CATEGORIES.findIndex(c => c.key === fc.key);
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
                // Merge payments: Supabase payments table is source of truth, but keep any local-only payments
                if (ci) {
                    const supabasePayments = (s.payments || [])
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map(p => ({ date: p.created_at, amount: p.amount }));
                    const localPayments = ci.payments || [];
                    // Find local payments not yet in Supabase (by checking amount + approximate time)
                    const newLocal = localPayments.filter(lp => {
                        return !supabasePayments.some(sp => sp.amount === lp.amount && Math.abs(new Date(sp.date) - new Date(lp.date)) < 60000);
                    });
                    ci.payments = [...supabasePayments, ...newLocal];
                }
                return {
                    id: s.id,
                    apiId: s.id,
                    apiSynced: true,
                    date: s.created_at,
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
            // Add back local unsynced sales
            posSales = [...posSales, ...localUnsynced];
            localStorage.setItem('posSales', JSON.stringify(posSales));
            // Smart: use the highest Supabase sale ID, not local counter
            const maxApiId = apiSales.reduce((m, s) => Math.max(m, s.id), 0);
            posNextSaleId = Math.max(posNextSaleId, maxApiId + 1);
        }
        // Sync inventory log from Supabase
        try {
            const apiInvLog = await API.getInventoryLog();
            if (apiInvLog && apiInvLog.length > 0) {
                const apiLogMap = {};
                apiInvLog.forEach(l => { apiLogMap[l.id] = l; });
                // Merge: keep local entries not in API, add API entries not in local
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
                // Mark all as synced
                invLog.forEach(l => { l.synced = true; });
                localStorage.setItem('invLog', JSON.stringify(invLog));
            }
            // Push local unsynced inventory entries
            saveInvLog();
        } catch(e) {}
        // Push local changes up to API so Supabase is always up to date
        saveProducts();
        saveCustomers();
    } catch (e) {
        console.log('API sync skipped, using local data');
    }
}
function generateSampleCustomers() {
    const names = ['Maria Gomez','Carlos Mendoza','Ana Rodriguez','Luis Fernando Perez','Diana Martinez','Jorge Ivan Lopez','Carmen Elena Ruiz','Andres Felipe Torres','Laura Patricia Garcia','Diego Alejandro Castro','Sofia del Pilar Ramirez','Juan Esteban Morales','Valentina Ortiz','Jose David Herrera','Paola Andrea Vargas','Felipe Santiago Rojas','Marcela Aguirre','Oscar Mauricio Jimenez','Claudia Patricia Medina','Ricardo Andres Guerrero','Liliana del Rosario Arias','Hector Fabio Vega','Natalia Sanchez','William Esteban Rios','Adriana Lucia Pardo','Jhon Jairo Velasquez','Martha Cecilia Cruz','Sebastian Cardona','Carolina Monroy','Mauricio Arenas','Tatiana Murillo','Gustavo Adolfo Salazar','Angela Maria PeÃ±a','Ramon Arturo Vera','Yenny Paola Cifuentes','Raul Eduardo Parra','Bibiana Lucia Cortes','Omar Dario Quintero','Eliana Marcela Ruiz','Pedro Nel Zapata','Luz Marina Rengifo','Cristian Camilo Calle','Sandra Milena Giraldo','Jairo Alonso Lopera','Johana Patrica Arango','Edwin Alexander Garzon','Gloria Yaneth Castillo','Harold Mauricio Osorio','Deisy Johanna PatiÃ±o','Wilmer Alexander Pineda','Nelly del Socorro Lozano','Yulieth Paola Cardozo','Nelson Ricardo MuÃ±oz','Zulma Milena Avila','Jeferson Stiven ZuÃ±iga','Maria Fernanda Zambrano','Alex Mauricio Cortes','Edilma Rosa Acosta','Edwin Duvan Cardenas','Paula Andrea Gaviria','Julio Cesar Herrera','Dora Elsy Sepulveda','Gerson Stiven Correa','Irene Delgado Florez','Jorge EliÃ©cer Bautista','Leidy Johanna Palacios','Manuel David Ospina','Nancy Elena Agudelo','Fabian Leonardo Aguirre','Rosa Elena Velez','Jhonatan Alexander Tobon','Jacqueline Alzate Tirado','Edwar Mauricio Zuluaga','Nury del Socorro Yepes','German Dario Restrepo','Adriana Milena Figueroa','Rafael Antonio Pereira','Alba Lucia Cardenas','Miller Eduardo Pineda','Paola Jimena MuÃ±oz','Yesid Fernando Ballesteros','Ana Judith Moreno','Geovanny Andres Cardona','Diana Marcela Velasquez','Hernan Dario Penagos','Angie Paola Isaza','Jose Albeiro Aguirre','Clara Elena Triana','Brayan Stiven Ospina','Alix Rocio Tabares','Ruben Dario Quiceno','Eliana Patricia Chavarria','Jhon Fredy Gallego','Lina Maria Sanchez','Didier Alexander Giraldo','Xiomara Patricia Rendon','Leonardo Fabio Estrada','Miriam Lucia Mosquera','Brayan Alexis Mosquera','Luz Elena Cuesta'];
    const domains = ['gmail.com','hotmail.com','outlook.com','yahoo.com','correo.com'];
    const prefijos = ['300','310','311','312','313','314','315','316','317','318','320','321','322','323','350','351','352'];
    const dirs = ['Cra ','Cll ','Av ','Calle ','Carrera ','Transv '];
    const calles = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','20','25','30','34','40','45','50','60','70','80','90','100','110'];
    const letras = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z'];
    return names.map((name, i) => {
        const id = 'c' + (i + 1);
        const prefijo = prefijos[Math.floor(Math.random() * prefijos.length)];
        const num = String(Math.floor(1000000 + Math.random() * 9000000));
        const phone = prefijo + num;
        const email = name.toLowerCase().replace(/ /g,'.') + (i + 1) + '@' + domains[Math.floor(Math.random() * domains.length)];
        const dir = dirs[Math.floor(Math.random() * dirs.length)] + calles[Math.floor(Math.random() * calles.length)] + ' #' + Math.floor(Math.random() * 50 + 1) + '-' + Math.floor(Math.random() * 99 + 1) + ' ' + letras[Math.floor(Math.random() * letras.length)];
        return { id, name, phone, email, address: dir + ', Santa Marta', tipo: Math.random() > 0.3 ? 'local' : 'fuera' };
    });
}
function saveCart() { localStorage.setItem('posCart', JSON.stringify(posCart)); }
function saveInvLog() { 
    localStorage.setItem('invLog', JSON.stringify(invLog)); 
    console.log('[POS] saveInvLog: API.isAvailable =', API.isAvailable);
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

function formatPrice(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function now() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); }
function formatDate(d) { const dt = new Date(d); return dt.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function shortDate(d) { const dt = new Date(d); return dt.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }); }

// ============ NAV ============
function switchInvTab(tab) {
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.toggle('active', t.dataset.invtab === tab));
    document.getElementById('invStockSection').style.display = tab === 'stock' ? '' : 'none';
    document.getElementById('invLogSection').style.display = tab === 'log' ? '' : 'none';
    if (tab === 'log') renderInvLog();
}
function switchPanel(id) {
    if (currentUser && currentUser.role === 'empleado' && ['products','suppliers','categories'].includes(id)) {
        showToast('No tienes acceso a esta seccion');
        return;
    }
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + id).classList.add('active');
    document.querySelector('[data-panel="' + id + '"]').classList.add('active');
    const titles = { dashboard:'Dashboard', tpv:'TPV / Punto de Venta', products:'Gestion de Productos', inventory:'Control de Inventario', customers:'Gestion de Clientes', suppliers:'Gestion de Proveedores', categories:'Gestion de Categorias', sales:'Historial de Ventas' };
    document.getElementById('panelTitle').textContent = titles[id] || id;
    if (id === 'dashboard') renderDashboard();
    if (id === 'tpv') renderTpv();
    if (id === 'products') renderProductTable();
    if (id === 'inventory') renderInventory();
    if (id === 'customers') renderCustomerTable();
    if (id === 'suppliers') renderSupplierTable();
    if (id === 'categories') renderCategoriesTable();
    if (id === 'sales') renderSalesTable();
}

// ============ DASHBOARD ============
let _dashPeriod = 'today';
let _dashType = 'all';

function setDashType(t) {
    _dashType = t;
    document.querySelectorAll('.dash-type-btn').forEach(b => b.classList.toggle('active', b.dataset.dtype === t));
    renderDashboard();
}

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
    const isMonthHistory = _dashPeriod === 'month';
    const isAnnualHistory = _dashPeriod === 'year';
    const isHistory = isMonthHistory || isAnnualHistory;
    let periodSales = isHistory ? posSales : getPeriodSales();
    if (_dashType === 'local') periodSales = periodSales.filter(s => !s.ventaPorFuera);
    else if (_dashType === 'fuera') periodSales = periodSales.filter(s => s.ventaPorFuera);
    const periodTotal = periodSales.reduce((sum, s) => sum + s.total, 0);
    const periodCount = periodSales.length;
    const pendingCredit = posSales.reduce((sum, s) => {
        if (!s.creditInfo) return sum;
        if (s.creditInfo.tipo === 'abono') {
            const pagado = (s.creditInfo.payments || []).reduce((sp, p) => sp + p.amount, 0);
            return sum + (s.creditInfo.balance - pagado);
        }
        return sum + ((s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor);
    }, 0);

    const labels = { today: 'Hoy', week: 'Ultimos 7 dias', month: 'Historial mensual', year: 'Historial anual' };
    const typeLabels = { all: '', local: ' — Local', fuera: ' — Por fuera' };
    document.getElementById('dashPeriodLabel').textContent = labels[_dashPeriod] + typeLabels[_dashType] + (isHistory ? '' : ' \u2014 ' + periodCount + ' ventas \u2014 ' + formatPrice(periodTotal));

    const totalProducts = posProducts.length;
    const lowStockCount = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outStockCount = posProducts.filter(p => p.stock <= 0).length;
    const avgTicket = periodCount > 0 ? periodTotal / periodCount : 0;
    const totalCustomers = posCustomers.length;
    const salesData = sumSales(periodSales);
    const custWithDebt = posCustomers.filter(c => {
        const sales = posSales.filter(s => s.customerId === c.id);
        return sales.some(s => s.creditInfo);
    }).length;

    document.getElementById('dashStats').innerHTML = `
        <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><span class="stat-label">Ventas del dia</span><h3>${formatPrice(periodTotal)}</h3><p>${periodCount} ventas</p></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div><div class="stat-info"><span class="stat-label">Ticket promedio</span><h3>${formatPrice(avgTicket)}</h3><p>Por venta</p></div></div>
        <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><span class="stat-label">Credito pendiente</span><h3>${formatPrice(pendingCredit)}</h3><p>Por cobrar</p></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div><div class="stat-info"><span class="stat-label">Clientes</span><h3>${totalCustomers}</h3><p>${custWithDebt} con credito</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e0f2f1;"><svg viewBox="0 0 24 24" style="fill:#00796b;"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM6 10h12v2H6v-2zm0 4h12v2H6v-2zm0-8h12v2H6V6z"/></svg></div><div class="stat-info"><span class="stat-label">Productos</span><h3>${totalProducts}</h3><p>${lowStockCount} stock bajo, ${outStockCount} agotados</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e8f5e9;"><svg viewBox="0 0 24 24" style="fill:#2e7d32;"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div><div class="stat-info"><span class="stat-label">Efectivo</span><h3>${formatPrice(salesData.cash)}</h3><p>${salesData.count > 0 ? Math.round(salesData.cash / periodTotal * 100) : 0}% del total</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e3f2fd;"><svg viewBox="0 0 24 24" style="fill:#1565c0;"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div><div class="stat-info"><span class="stat-label">Digital</span><h3>${formatPrice(salesData.digital)}</h3><p>${salesData.count > 0 ? Math.round(salesData.digital / periodTotal * 100) : 0}% del total</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fff3e0;"><svg viewBox="0 0 24 24" style="fill:#e65100;"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div class="stat-info"><span class="stat-label">Productos vendidos</span><h3>${salesData.items}</h3><p>Unidades en el periodo</p></div></div>
    `;

    document.getElementById('dashMonthsCard').style.display = isMonthHistory ? '' : 'none';
    document.getElementById('dashAnnualCard').style.display = isAnnualHistory ? '' : 'none';

    if (isMonthHistory) renderDashMonthsHistory();
    if (isAnnualHistory) renderDashAnnualHistory();

    renderDashBarChart();
    renderDashPayMethods();
    renderDashTopProducts();
    renderDashStockAlerts();
    renderDashTopCustomers();
    renderDashSummary();
    renderDashRecent();
}

function renderDashBarChart() {
    const el = document.getElementById('dashBarChart');
    let days = [];
    if (_dashPeriod === 'today' || _dashPeriod === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const label = d.toLocaleDateString('es-CO', { weekday:'short', day:'numeric' });
            const total = posSales.filter(s => s.date && s.date.slice(0,10) === ds).reduce((sum, s) => sum + s.total, 0);
            days.push({ label, total });
        }
    } else if (_dashPeriod === 'month') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString('es-CO', { month:'short' });
            const total = posSales.filter(s => {
                if (!s.date) return false;
                const sd = new Date(s.date);
                return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
            }).reduce((sum, s) => sum + s.total, 0);
            days.push({ label, total });
        }
    } else if (_dashPeriod === 'year') {
        const years = {};
        posSales.forEach(s => {
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

function renderDashMonthsHistory() {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        const sales = posSales.filter(s => {
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

function renderDashAnnualHistory() {
    const years = {};
    posSales.forEach(s => {
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

function renderDashPayMethods() {
    const methods = {};
    getPeriodSales().forEach(s => {
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

function renderDashTopProducts() {
    const sold = {};
    getPeriodSales().forEach(s => {
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

function renderDashTopCustomers() {
    const cust = {};
    getPeriodSales().forEach(s => {
        const name = s.customer || 'Cliente mostrador';
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

function renderDashSummary() {
    const ps = getPeriodSales();
    const total = ps.reduce((s, v) => s + v.total, 0);
    const items = ps.reduce((s, v) => s + v.items.reduce((a, i) => a + i.qty, 0), 0);
    const cash = ps.filter(s => s.method === 'Efectivo').reduce((s, v) => s + v.total, 0);
    const digital = ps.filter(s => s.method !== 'Efectivo' && s.method !== 'Credito').reduce((s, v) => s + v.total, 0);
    const credit = ps.filter(s => s.method === 'Credito').reduce((s, v) => s + v.total, 0);
    const excedente = ps.reduce((s, v) => s + (v.excedente || 0), 0);
    document.getElementById('dashSummary').innerHTML = `
        <div class="summary-rows">
            <div class="summary-row"><span>Total facturado</span><strong>${formatPrice(total)}</strong></div>
            <div class="summary-row"><span>Unidades vendidas</span><strong>${items}</strong></div>
            <div class="summary-row"><span>Efectivo</span><strong>${formatPrice(cash)}</strong></div>
            <div class="summary-row"><span>Digital (Nequi, Davi, Tarjeta, etc)</span><strong>${formatPrice(digital)}</strong></div>
            <div class="summary-row"><span>Credito</span><strong>${formatPrice(credit)}</strong></div>
            <div class="summary-row"><span>Excedente cobrado</span><strong>${formatPrice(excedente)}</strong></div>
            <div class="summary-row"><span>Ticket promedio</span><strong>${ps.length > 0 ? formatPrice(total / ps.length) : '$0'}</strong></div>
            <div class="summary-row"><span>Total transacciones</span><strong>${ps.length}</strong></div>
        </div>
    `;
}

function renderDashRecent() {
    const recent = posSales.slice(-10).reverse();
    const tbody = document.getElementById('dashRecentSales');
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas registradas</td></tr>';
        return;
    }
    tbody.innerHTML = recent.map((s, idx) => `<tr>
        <td><strong>#${posSales.length - idx}</strong></td>
        <td>${formatDate(s.date)}</td>
        <td>${s.customer || 'Cliente mostrador'}</td>
        <td>${s.items.reduce((sum, i) => sum + i.qty, 0)}</td>
        <td><strong>${formatPrice(s.total)}</strong></td>
        <td><span class="tag tag-info">${s.method}</span></td>
    </tr>`).join('');
}

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

// ============ TPV ============
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
        const p = posProducts.find(pr => pr.id === item.id);
        if (!p) return '';
        const priceDiff = item.price !== p.price;
        return `<div class="tpv-cart-item">
            <div class="tpv-ci-info">
                <div class="tpv-ci-name">${p.name}</div>
                <div class="tpv-ci-price" onclick="editCartItemPrice(${idx})" title="Clic para editar precio" style="cursor:pointer;${priceDiff ? 'color:var(--primary);font-weight:700;' : ''}">${formatPrice(item.price)}${priceDiff ? ' ✎' : ''}</div>
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
function editCartItemPrice(idx) {
    if (!posCart[idx]) return;
    const prod = posProducts.find(p => p.id === posCart[idx].id);
    const currentPrice = posCart[idx].price;
    const newPrice = prompt('Precio unitario para este producto:', currentPrice);
    if (newPrice === null) return;
    const parsed = parseInt(newPrice);
    if (isNaN(parsed) || parsed <= 0) { showToast('Precio invalido'); return; }
    posCart[idx].price = parsed;
    saveCart();
    renderTpvCart();
    if (prod && parsed !== prod.price) {
        showToast('Precio ajustado: ' + formatPrice(parsed) + ' (original: ' + formatPrice(prod.price) + ')');
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('posSidebarCollapsed', sidebar.classList.contains('collapsed'));
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

// ============ CHECKOUT MODAL ============
const PAY_OPTS = [
    { key: 'cash', label: 'Efectivo', icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
    { key: 'card', label: 'Tarjeta', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z' },
    { key: 'transfer', label: 'Transferencia', icon: 'M21 18v3H3v-3h18zM19 7v3l-7-5-7 5V7l7-5 7 5z' },
    { key: 'mixed', label: 'Mixto', icon: 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z' },
    { key: 'credito', label: 'Credito', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6v-2zm0 4h8v2H6v-2z' }
];
let chkPayMethod = 'cash';
let chkCreditType = 'fijo';
let isVentaPorFuera = false;

function toggleVentaPorFuera() {
    isVentaPorFuera = !isVentaPorFuera;
    const btn = document.getElementById('btnVentaPorFuera');
    if (btn) {
        btn.classList.toggle('active', isVentaPorFuera);
    }
}

function openCheckoutModal() {
    if (posCart.length === 0) { showToast('Agrega productos al carrito'); return; }
    chkPayMethod = 'cash';
    chkCreditType = 'fijo';
    document.getElementById('chkCustomerId').value = '';
    document.getElementById('chkCustomerInput').value = '';
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
    const filtered = q ? posCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))) : posCustomers;
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
function renderCheckoutPayGrid() {
    const grid = document.getElementById('chkPayGrid');
    grid.innerHTML = PAY_OPTS.map(p => '<div class="checkout-pay-opt' + (p.key === chkPayMethod ? ' selected' : '') + '" onclick="pickCheckoutPay(\'' + p.key + '\')">' +
        '<svg viewBox="0 0 24 24"><path d="' + p.icon + '"/></svg>' +
        '<span class="p-label">' + p.label + '</span>' +
        '</div>').join('');
}
function pickCheckoutPay(key) {
    chkPayMethod = key;
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
    } else {
        summary.innerHTML = '';
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
    const methods = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto', credito: 'Credito' };
    const custId = document.getElementById('chkCustomerId').value;
    let customerName = 'Cliente mostrador';
    let customerId = '';
    if (custId) {
        const cust = posCustomers.find(c => c.id === custId);
        if (cust) { customerName = cust.name; customerId = custId; }
    }
    const creditInfo = getCheckoutCreditInfo(total);
    if (chkPayMethod === 'credito' && !creditInfo) return;
    const sale = {
        id: posNextSaleId++,
        date: now(),
        items: posCart.map(i => {
            const p = posProducts.find(pr => pr.id === i.id);
            return { id: i.id, name: p ? p.name : 'Producto', qty: i.qty, price: i.price };
        }),
        subtotal,
        excedente,
        total,
        method: methods[chkPayMethod] || 'Efectivo',
        methodKey: chkPayMethod,
        customer: customerName,
        customerId,
        creditInfo,
        ventaPorFuera: isVentaPorFuera
    };
    posSales.push(sale);
    posCart.forEach(ci => {
        const p = posProducts.find(pr => pr.id === ci.id);
        if (p) {
            const prev = p.stock;
            p.stock = Math.max(0, p.stock - ci.qty);
            addInvLog(ci.id, p.name, 'salida', -ci.qty, prev, p.stock, 'Venta #' + sale.id + (sale.ventaPorFuera ? ' (Por fuera)' : ''), sale.id, sale.ventaPorFuera);
        }
    });
    saveSales();
    saveProducts();
    clearCart();
    isVentaPorFuera = false;
    const btnVPF = document.getElementById('btnVentaPorFuera');
    if (btnVPF) btnVPF.classList.remove('active');
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

// ============ PRODUCTOS ============
function renderProductTable() {
    const q = document.getElementById('prodSearch').value.toLowerCase().trim();
    const cat = document.getElementById('prodCatFilter').value;
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

    const apiPayload = { name, barcode, brand, category, price, cost, stock, img: finalImg, images, description: desc, supplier_id: supplier ? parseInt(supplier.replace('s','')) : null, featured, subcategory };

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
            if (API.isAvailable) {
                API.saveProduct({ id: parseInt(id.replace('p','')), ...apiPayload }).catch(() => {});
            }
        }
    } else {
        const newId = 'p' + posNextProductId++;
        posProducts.push({ id: newId, name, barcode, brand, category, price, cost, stock, img: finalImg, images, desc, supplier, featured, subcategory });
        if (API.isAvailable) {
            API.saveProduct(apiPayload).then(r => {
                if (r && r.id) { const p = posProducts.find(pr => pr.id === newId); if (p) p.id = 'p' + r.id; }
            }).catch(() => {});
        }
    }
    saveProducts();
    closeProductModal();
    renderProductTable();
    renderInventory();
    showToast('Producto guardado');
}

function deleteProduct(id) {
    if (!confirm('Eliminar este producto?')) return;
    posProducts = posProducts.filter(p => p.id !== id);
    saveProducts();
    renderProductTable();
    renderInventory();
    showToast('Producto eliminado');
}

// ============ INVENTARIO ============
let _invStockCatInit = false;
function renderInventory() {
    const total = posProducts.length;
    const available = posProducts.filter(p => p.stock > 0).length;
    const low = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = posProducts.filter(p => p.stock <= 0).length;
    document.getElementById('invStats').innerHTML = `
        <div class="inv-stat"><span class="inv-stat-val">${total}</span><span class="inv-stat-label">Total</span></div>
        <div class="inv-stat"><span class="inv-stat-val" style="color:var(--green);">${available}</span><span class="inv-stat-label">Disponibles</span></div>
        <div class="inv-stat"><span class="inv-stat-val" style="color:var(--warning);">${low}</span><span class="inv-stat-label">Stock Bajo</span></div>
        <div class="inv-stat"><span class="inv-stat-val" style="color:var(--danger);">${out}</span><span class="inv-stat-label">Agotados</span></div>
    `;
    const catFilter = document.getElementById('invStockCatFilter');
    if (!_invStockCatInit) {
        _invStockCatInit = true;
        catFilter.innerHTML = '<option value="all">Todas las categorias</option>' + catOptsHtml();
    }
    const q = document.getElementById('invStockSearch').value.toLowerCase().trim();
    const cat = catFilter.value;
    let filtered = posProducts;
    if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)));
    if (cat !== 'all') {
        const subKeys = getSubCats(cat).map(s => s.key);
        filtered = filtered.filter(p => p.category === cat || subKeys.includes(p.subcategory));
    }
    const tbody = document.getElementById('invTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Sin productos</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(p => {
        const lastSale = posSales.filter(s => s.items.some(i => i.id === p.id)).pop();
        const tag = p.stock <= 0 ? 'tag-danger' : p.stock <= 5 ? 'tag-warning' : 'tag-success';
        const text = p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Stock Bajo' : 'OK';
        return `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${getCatLabel(p.category)}</td>
            <td><strong>${p.stock}</strong></td>
            <td><span class="tag ${tag}">${text}</span></td>
            <td>${lastSale ? shortDate(lastSale.date) : 'Sin ventas'}</td>
        </tr>`;
    }).join('');
    document.getElementById('invLogCount').textContent = '(' + invLog.length + ')';
    renderInvLog();
}

// ============ PROVEEDORES ============
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
        posSuppliers.push({ id: 's' + posNextSupplierId++, name, nit, contact, phone, email, address });
    }
    saveSuppliers();
    closeSupplierModal();
    renderSupplierTable();
    showToast('Proveedor guardado');
}
function deleteSupplier(id) {
    if (!confirm('Eliminar este proveedor?')) return;
    posSuppliers = posSuppliers.filter(s => s.id !== id);
    saveSuppliers();
    renderSupplierTable();
    showToast('Proveedor eliminado');
}

// ============ CATEGORIAS ============
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
        POS_CATEGORIES = POS_CATEGORIES.filter(cat => cat.key !== key);
        posProducts.forEach(p => { if (p.subcategory === key) p.subcategory = ''; });
    } else {
        subs.forEach(s => {
            posProducts.forEach(p => { if (p.subcategory === s.key) p.subcategory = ''; });
            if (API.isAvailable && s.id) API.deleteCategory(s.id).catch(() => {});
        });
        POS_CATEGORIES = POS_CATEGORIES.filter(cat => cat.key !== key && cat.parent_key !== key);
        posProducts.forEach(p => { if (p.category === key) p.category = ''; });
    }
    saveCategories();
    saveProducts();
    renderCategoriesTable();
    renderSubcategoriesTable();
    refreshCategorySelect();
    refreshProdCatFilter();
    _invStockCatInit = false;
    _invLogCatInit = false;
    renderInventory();
    renderProductTable();
    if (API.isAvailable && c.id) {
        API.deleteCategory(c.id).catch(() => {});
    }
    showToast((isSub ? 'Subcategoria' : 'Categoria') + ' eliminada');
}

// ============ INVENTARIO LOG ============
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
    document.getElementById('invLogCount').textContent = '(' + invLog.length + ')';
}
function clearInvLog() {
    if (!confirm('Esto eliminara todo el historial de entradas y salidas. Continuar?')) return;
    invLog = [];
    invNextLogId = 1;
    saveInvLog();
    renderInventory();
    showToast('Historial de inventario limpiado');
}
function openInvMovModal(type) {
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
            '<option value="Ajuste por inventario final">Ajuste por inventario final</option>' +
            '<option value="Otro">Otro</option>';
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

// ============ CLIENTES ============
function renderCustomerTable() {
    const q = document.getElementById('custSearch').value.toLowerCase().trim();
    const custFilter = document.getElementById('custFilter').value;
    const custSalesType = document.getElementById('custSalesTypeFilter').value;
    const custTipoFilter = document.getElementById('custTipoFilter').value;
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
        posCustomers.push({ id: 'c' + posNextCustomerId++, name, phone, email, address, tipo });
    }
    saveCustomers();
    closeCustomerModal();
    renderCustomerTable();
    showToast('Cliente guardado');
}

function deleteCustomer(id) {
    if (!confirm('Eliminar este cliente?')) return;
    posCustomers = posCustomers.filter(c => c.id !== id);
    saveCustomers();
    renderCustomerTable();
    showToast('Cliente eliminado');
}

let _paymentTargetSaleId = null;

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
    // Customer info header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--hover);border-radius:10px;margin-bottom:16px;">';
    html += '<div><div style="font-weight:600;font-size:15px;">' + cust.name + '</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);">' + (cust.phone || '') + (cust.phone && cust.email ? ' | ' : '') + (cust.email || '') + '</div></div>';
    html += '<div style="text-align:right;"><div style="font-size:11px;color:var(--text-muted);">Saldo pendiente total</div><div style="font-size:20px;font-weight:700;' + (totalOwedGlobal > 0 ? 'color:var(--warning);' : 'color:var(--success);') + '">' + formatPrice(totalOwedGlobal) + '</div></div>';
    html += '</div>';
    if (sales.length === 0) {
        html += '<div class="empty-state" style="padding:40px;"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg><p>Sin compras registradas</p></div>';
    } else {
        // Sales without credit (contado)
        const contadoSales = sales.filter(s => !s.creditInfo);
        if (contadoSales.length > 0) {
            html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-muted);">Compras de contado (' + contadoSales.length + ')</div>';
            contadoSales.slice(-3).reverse().forEach(s => {
                const qty = s.items.reduce((sum, i) => sum + i.qty, 0);
                html += '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px;">';
                html += '<span>#' + s.id + ' <span style="color:var(--text-muted);">' + shortDate(s.date) + '</span></span>';
                html += '<span>' + qty + ' prod Â· ' + formatPrice(s.total) + ' Â· <span style="color:var(--success);">Pagado</span></span>';
                html += '</div>';
            });
        }
        // Credit sales grouped
        if (creditSales.length > 0) {
            html += '<div style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text-muted);">Creditos y Cuentas de Cobro (' + creditSales.length + ')</div>';
            creditSales.slice().reverse().forEach(s => {
                let isPaid = false;
                let pending = 0;
                let pagado = 0;
                let label = '';
                let detailHtml = '';
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
                // Card
                html += '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">';
                // Header
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:' + (isPaid ? '#f0fdf4' : '#fffbe6') + ';border-bottom:1px solid var(--border);">';
                html += '<div><strong>#' + s.id + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + shortDate(s.date) + '</span></div>';
                html += '<div style="font-weight:600;font-size:15px;">' + formatPrice(s.total) + '</div>';
                html += '</div>';
                // Products
                if (s.items && s.items.length > 0) {
                    html += '<details style="font-size:11px;"><summary style="cursor:pointer;padding:4px 14px;color:var(--text-muted);user-select:none;list-style:none;">▸ Productos</summary><div style="padding:0 14px 6px;color:var(--text-muted);">';
                    html += s.items.map(i => (i.name || 'Producto').substring(0, 20) + ' x' + i.qty).join(' · ');
                    html += '</div></details>';
                }
                // Payments table
                if (s.creditInfo.payments && s.creditInfo.payments.length > 0) {
                    html += '<div style="padding:6px 14px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--hover);">Pagos registrados:</div>';
                    s.creditInfo.payments.forEach(p => {
                        html += '<div style="display:flex;justify-content:space-between;padding:5px 14px;font-size:13px;border-bottom:1px solid var(--border);">';
                        html += '<span>' + shortDate(p.date) + '</span>';
                        html += '<span style="font-weight:500;color:var(--success);">' + formatPrice(p.amount) + '</span>';
                        html += '</div>';
                    });
                }
                // Footer
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;">';
                html += '<div><span style="font-size:12px;color:var(--text-muted);">' + label + '</span></div>';
                if (!isPaid) {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm btn-primary" onclick="openPaymentModalCust(' + s.id + ')">Registrar ' + (s.creditInfo.tipo === 'abono' ? 'Abono' : 'Pago') + '</button><button class="btn btn-sm btn-outline" onclick="showFinalInvoice(' + s.id + ')">Ver Factura</button></div>';
                } else {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--success);font-weight:600;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--success);vertical-align:middle;margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Pagado</span><button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura</button></div>';
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

let _custHistoryCustomerId = null;

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

function showFinalInvoice(saleId) {
    const sale = posSales.find(s => s.id === saleId);
    if (!sale) return;
    const ci = sale.creditInfo;
    if (!ci) return;
    const pagado = ci.payments ? ci.payments.reduce((s, p) => s + p.amount, 0) : 0;
    const pendiente = sale.total - pagado;
    const isPaid = pendiente <= 0;

    const paymentsHtml = ci.payments && ci.payments.length > 0
        ? ci.payments.map((p, i) => `<tr><td>${i + 1}</td><td>${shortDate(p.date)}</td><td style="text-align:right;color:#166534;font-weight:600;">${formatPrice(p.amount)}</td></tr>`).join('')
        : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Sin pagos registrados</td></tr>';

    const progressPct = sale.total > 0 ? Math.min(Math.round((pagado / sale.total) * 100), 100) : 0;

    const content = document.getElementById('receiptContent');
    content.innerHTML = `
        <div class="invoice-print" id="invoicePrintArea">
            <div class="inv-header">
                <div class="inv-logo"><img src="LOGO.jpeg" alt="Logo"></div>
                <div class="inv-business">
                    <h3>TIENDA NATURALISTA</h3>
                    <p>Santa Marta, Colombia<br>NIT: 123.456.789-0<br>Tel: 321 917 4696</p>
                </div>
                <div class="inv-doc-info">
                    <div class="inv-doc-type">ESTADO DE CUENTA</div>
                    <div class="inv-doc-num">Factura #${sale.id}</div>
                    <div class="inv-doc-date">${new Date(sale.date).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })}</div>
                </div>
            </div>

            <div class="inv-status ${isPaid ? 'inv-status-paid' : 'inv-status-pending'}">
                ${isPaid ? 'CUENTA CANCELADA' : 'CUENTA PENDIENTE'}
            </div>

            <div class="inv-section">
                <div class="inv-section-title">DATOS DEL CLIENTE</div>
                <div class="inv-customer-grid">
                    <div><span>Nombre:</span> <strong>${sale.customer || 'Cliente mostrador'}</strong></div>
                    <div><span>Metodo de pago:</span> <strong>${sale.method}</strong></div>
                    <div><span>Tipo de credito:</span> <strong>${ci.tipo === 'abono' ? 'Abono libre' : 'Cuotas fijas (' + ci.totalCuotas + ' cuotas)'}</strong></div>
                </div>
            </div>

            <div class="inv-section">
                <div class="inv-section-title">PRODUCTOS COMPRADOS</div>
                <table class="inv-table">
                    <thead><tr><th>#</th><th>Producto</th><th>Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
                    <tbody>
                        ${sale.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.name || 'Producto'}</td><td>${item.qty}</td><td style="text-align:right">${formatPrice(item.price)}</td><td style="text-align:right;font-weight:600;">${formatPrice(item.price * item.qty)}</td></tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="inv-total-row"><td colspan="4">TOTAL VENTA</td><td style="text-align:right">${formatPrice(sale.total)}</td></tr>
                    </tfoot>
                </table>
            </div>

            <div class="inv-section">
                <div class="inv-section-title">RESUMEN DE PAGOS</div>
                <div class="inv-summary-grid">
                    <div class="inv-summary-box inv-total-box"><div class="inv-summary-label">Total de la compra</div><div class="inv-summary-val">${formatPrice(sale.total)}</div></div>
                    <div class="inv-summary-box inv-paid-box"><div class="inv-summary-label">Total pagado</div><div class="inv-summary-val">${formatPrice(pagado)}</div></div>
                    <div class="inv-summary-box inv-pending-box"><div class="inv-summary-label">Saldo pendiente</div><div class="inv-summary-val">${formatPrice(Math.max(0, pendiente))}</div></div>
                </div>
                <div class="inv-progress-wrap">
                    <div class="inv-progress-bar"><div class="inv-progress-fill" style="width:${progressPct}%"></div></div>
                    <div class="inv-progress-text">${progressPct}% pagado</div>
                </div>
            </div>

            <div class="inv-section">
                <div class="inv-section-title">HISTORIAL DE PAGOS</div>
                <table class="inv-table inv-payments-table">
                    <thead><tr><th>#</th><th>Fecha</th><th style="text-align:right">Monto</th></tr></thead>
                    <tbody>${paymentsHtml}</tbody>
                    <tfoot>
                        <tr class="inv-paid-row"><td colspan="2">TOTAL ABONADO</td><td style="text-align:right">${formatPrice(pagado)}</td></tr>
                        ${!isPaid ? '<tr class="inv-pending-foot-row"><td colspan="2">SALDO PENDIENTE</td><td style="text-align:right">' + formatPrice(pendiente) + '</td></tr>' : ''}
                    </tfoot>
                </table>
            </div>

            <div class="inv-footer">
                <p>Documento generado el ${new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                <p style="margin-top:4px;">Gracias por su compra — TIENDA NATURALISTA</p>
            </div>
        </div>
    `;
    document.getElementById('receiptModal').classList.add('open');
    document.getElementById('btnDownloadInv').style.display = '';
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
        API.addPayment(sale.apiId || saleId, Math.round(amount), 'Pago registrado desde POS').catch(() => {});
    }
    closePaymentModal();
    refreshCustHistory();
    renderCustomerTable();
    renderDashboard();
    showToast('Pago registrado con exito');
}

// ============ VENTAS ============
function toggleSaleItems(btn) {
    const row = btn.closest('tr');
    const itemsRow = row.nextElementSibling;
    if (itemsRow && itemsRow.classList.contains('sale-items-row')) {
        const visible = itemsRow.style.display !== 'none';
        itemsRow.style.display = visible ? 'none' : '';
        btn.textContent = visible ? '▾' : '▴';
    }
}
let _salesTypeFilter = 'all';

function setSalesTypeFilter(type) {
    _salesTypeFilter = type;
    document.querySelectorAll('.sales-type-filter').forEach(b => b.classList.toggle('active', b.dataset.stype === type));
    renderSalesTable();
}

function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    let filtered = [...posSales].reverse();
    if (_salesTypeFilter === 'local') filtered = filtered.filter(s => !s.ventaPorFuera);
    else if (_salesTypeFilter === 'fuera') filtered = filtered.filter(s => s.ventaPorFuera);
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
            <td><strong>#${idx + 1}</strong> ${s.ventaPorFuera ? '<span class="tag tag-warning" style="font-size:10px;margin-left:4px;">Fuera</span>' : ''}</td>
            <td>${formatDate(s.date)}</td>
            <td>${s.customer || 'Mostrador'}</td>
            <td>${qty}</td>
            <td><strong>${formatPrice(s.total)}</strong></td>
            <td>${s.excedente ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(s.excedente) + '</span>' : '-'}</td>
            <td>${methodHtml}</td>
            <td class="actions">
                ${s.items && s.items.length > 0 ? '<button class="edit" onclick="toggleSaleItems(this)" title="Ver productos" style="color:var(--text-muted);font-size:14px;">▾</button>' : ''}
                ${s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas)) ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="' + (s.creditInfo.tipo === 'abono' ? 'Registrar Abono' : 'Registrar Pago') + '" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : ''}
                <button onclick="showReceipt(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>
            </td>
        </tr>
        <tr class="sale-items-row" style="display:none;"><td colspan="8" style="padding:4px 12px 8px;background:var(--bg);font-size:12px;color:var(--text-muted);">${s.items ? s.items.map(i => '<span style="display:inline-block;margin:2px 4px;padding:2px 8px;background:#fff;border:1px solid var(--border);border-radius:6px;">' + (i.name || 'Producto').substring(0, 22) + ' x' + i.qty + ' — ' + formatPrice(i.price * i.qty) + '</span>').join('') : ''}</td></tr>`;
    }).join('');
}

// ============ RECIBO ============
function showReceipt(sale) {
    if (typeof sale === 'string') sale = JSON.parse(sale);
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => `<div class="receipt-row"><span>${(i.name || 'Producto').substring(0,22)} x${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join('');
    content.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <h4>LOPEZTECH NATU</h4>
                <p>Santa Marta, Colombia<br>NIT: 123.456.789-0</p>
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
            <div class="receipt-footer">
                <p>Gracias por su compra!</p>
                <p>tel: 300 123 4567</p>
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

// ============ INIT ============
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

// Category filter for products page
function initCatFilter() {
    refreshProdCatFilter();
}

function initPOS() {
    (async function() {
        console.log('[POS] initPOS iniciando...');
        const available = await API.check();
        console.log('[POS] API available:', available, 'API.isAvailable:', API.isAvailable);
        if (available) {
            console.log('[POS] Cargando desde Supabase...');
            await syncFromApi();
        } else {
            console.log('[POS] Supabase no disponible, cargando desde localStorage');
            loadData();
        }
        initCatFilter();
        migrateProductSubcats();
        renderDashboard();
        renderTpv();
        setupBarcodeScan();
        renderProductTable();
        renderInventory();
        renderCustomerTable();
        renderSupplierTable();
        renderCategoriesTable();
        renderSalesTable();
    })();
}

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

checkSession();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
