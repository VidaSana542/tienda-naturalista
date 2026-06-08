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
    if (posCustomers.length < 100) {
        posCustomers = generateSampleCustomers();
        saveCustomers();
        posNextCustomerId = 101;
    } else {
        posNextCustomerId = posCustomers.reduce((m, c) => Math.max(m, parseInt(c.id.replace('c',''))), 0) + 1;
    }
    if (posSales.length > 0) {
        const minId = posSales.reduce((m, s) => Math.min(m, s.id), Infinity);
        if (minId >= 1000) {
            posSales.sort((a, b) => a.id - b.id).forEach((s, i) => s.id = i + 1);
            saveSales();
        }
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
            API.saveProduct(payload).catch(() => {});
        });
    }
}
function saveSales() {
    localStorage.setItem('posSales', JSON.stringify(posSales));
}
function saveCustomers() {
    localStorage.setItem('posCustomers', JSON.stringify(posCustomers));
    if (API.isAvailable) {
        posCustomers.forEach(c => API.saveCustomer({
            name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || ''
        }).catch(() => {}));
    }
}
function saveSuppliers() {
    localStorage.setItem('posSuppliers', JSON.stringify(posSuppliers));
    if (API.isAvailable) {
        posSuppliers.forEach(s => API.saveSupplier({
            name: s.name, nit: s.nit || '', contact: s.contact || '',
            phone: s.phone || '', email: s.email || '', address: s.address || ''
        }).catch(() => {}));
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
                address: c.address || ''
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
        const apiSales = await API.get('/sales');
        if (apiSales && Array.isArray(apiSales)) {
            posSales = apiSales.map(s => ({
                id: s.id,
                date: s.created_at,
                items: (s.items || []).map(i => ({ id: i.product_id, name: i.product_name, qty: i.qty, price: parseFloat(i.price) })),
                subtotal: parseFloat(s.total) - parseFloat(s.excedente || 0),
                excedente: parseFloat(s.excedente || 0),
                total: parseFloat(s.total),
                method: s.method,
                methodKey: s.method_key,
                customer: s.customer_name,
                customerId: s.customer_id ? 'c' + s.customer_id : '',
                creditInfo: s.credit_info
            }));
            localStorage.setItem('posSales', JSON.stringify(posSales));
            posNextSaleId = posSales.length > 0 ? Math.max(...posSales.map(s => s.id)) + 1 : 1;
        }
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
        return { id, name, phone, email, address: dir + ', Santa Marta' };
    });
}
function saveCart() { localStorage.setItem('posCart', JSON.stringify(posCart)); }
function saveInvLog() { localStorage.setItem('invLog', JSON.stringify(invLog)); }
function addInvLog(productId, productName, type, quantity, previousStock, newStock, reason, saleId) {
    const prod = posProducts.find(p => p.id === productId);
    const category = prod ? prod.category : '';
    invLog.push({ id: invNextLogId++, date: now(), productId, productName, type, quantity, previousStock, newStock, reason, saleId: saleId || null, category });
    saveInvLog();
}

function formatPrice(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
function today() { return new Date().toISOString().slice(0,10); }
function now() { return new Date().toISOString(); }
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
    if (currentUser && currentUser.role === 'empleado' && ['dashboard','products','inventory','suppliers','categories'].includes(id)) {
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
function renderDashboard() {
    const todaySales = posSales.filter(s => s.date.slice(0,10) === today());
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const todayExcedente = todaySales.reduce((sum, s) => sum + (s.excedente || 0), 0);
    const todayCount = todaySales.length;
    const totalProducts = posProducts.length;
    const lowStock = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const totalCustomers = posCustomers.length;
    const pendingCredit = posSales.reduce((sum, s) => {
        if (!s.creditInfo) return sum;
        if (s.creditInfo.tipo === 'abono') {
            const pagado = s.creditInfo.payments.reduce((sp, p) => sp + p.amount, 0);
            return sum + (s.creditInfo.balance - pagado);
        }
        return sum + ((s.creditInfo.totalCuotas - s.creditInfo.pagadas) * s.creditInfo.cuotaValor);
    }, 0);
    document.getElementById('dashStats').innerHTML = `
        <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><h3>${formatPrice(todayTotal)}</h3><p>Ventas Hoy (${todayCount})</p></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM8 12H6v-2h2v2zm3 0H9v-2h2v2zm3 0h-2v-2h2v2z"/></svg></div><div class="stat-info"><h3>${totalProducts}</h3><p>Productos</p></div></div>
        <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-info"><h3>${formatPrice(todayExcedente)}</h3><p>Excedente Hoy</p></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div><div class="stat-info"><h3>${formatPrice(pendingCredit)}</h3><p>Pendiente Credito</p></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#f3e5f5;"><svg viewBox="0 0 24 24" style="fill:#7b1fa2;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div><div class="stat-info"><h3>${totalCustomers}</h3><p>Clientes</p></div></div>
    `;
    const recent = posSales.slice(-5).reverse();
    const tbody = document.getElementById('dashRecentSales');
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas registradas</td></tr>';
    } else {
        tbody.innerHTML = recent.map(s => `<tr>
            <td><strong>#${s.id}</strong></td>
            <td>${s.customer || 'Cliente mostrador'}</td>
            <td>${s.items.reduce((sum, i) => sum + i.qty, 0)}</td>
            <td><strong>${formatPrice(s.total)}</strong></td>
            <td>${s.excedente ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(s.excedente) + '</span>' : '-'}</td>
            <td><span class="tag tag-info">${s.method}</span></td>
            <td>${formatDate(s.date)}</td>
        </tr>`).join('');
    }
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

    if (posCart.length === 0) {
        container.innerHTML = '<div class="tpv-cart-empty"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg><p>Agrega productos al carrito</p></div>';
        count.textContent = '0';
        subtotal.textContent = '$0';
        totalEl.textContent = '$0';
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
    items.innerHTML = posCart.map(i => '<div class="checkout-resumen-item"><span>' + i.qty + 'x ' + i.name + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>').join('');
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
        creditInfo
    };
    posSales.push(sale);
    posCart.forEach(ci => {
        const p = posProducts.find(pr => pr.id === ci.id);
        if (p) {
            const prev = p.stock;
            p.stock = Math.max(0, p.stock - ci.qty);
            addInvLog(ci.id, p.name, 'salida', -ci.qty, prev, p.stock, 'Venta #' + sale.id, sale.id);
        }
    });
    saveSales();
    saveProducts();
    if (API.isAvailable) {
        API.saveSale({
            customer_id: sale.customerId ? parseInt(sale.customerId.replace('c','')) : null,
            customer_name: sale.customer,
            total: sale.total,
            excedente: sale.excedente,
            method: sale.method,
            method_key: sale.methodKey,
            credit_info: sale.creditInfo ? {
                tipo: sale.creditInfo.tipo,
                totalCuotas: sale.creditInfo.totalCuotas,
                cuotaValor: sale.creditInfo.cuotaValor,
                pagadas: sale.creditInfo.pagadas,
                balance: sale.creditInfo.balance,
                payments: sale.creditInfo.payments || []
            } : null,
            items: sale.items
        }).then(apiSale => {
            if (apiSale && apiSale.id) sale.apiId = apiSale.id;
        }).catch(() => {});
    }
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
    tbody.innerHTML = filtered.map(p => {
        const stockTag = p.stock <= 0 ? 'tag-danger' : p.stock <= 5 ? 'tag-warning' : 'tag-success';
        const stockText = p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Stock Bajo' : 'Disponible';
        const supp = p.supplier ? posSuppliers.find(s => s.id === p.supplier) : null;
        return `<tr>
            <td><strong>${p.id}</strong></td>
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
    tbody.innerHTML = filtered.map(s => {
        const productCount = posProducts.filter(p => p.supplier === s.id).length;
        return '<tr>' +
            '<td><strong>' + s.id + '</strong></td>' +
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
    let filtered = invLog;
    if (q) filtered = filtered.filter(l => l.productName.toLowerCase().includes(q));
    if (cat !== 'all') filtered = filtered.filter(l => l.category === cat);
    if (type !== 'all') filtered = filtered.filter(l => l.type === type);
    const tbody = document.getElementById('invLogBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Sin movimientos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.slice().reverse().slice(0, 200).map(l => {
        const typeLabel = l.type === 'entrada' ? '<span style="color:var(--success);font-weight:600;">Entrada</span>' : l.type === 'salida' ? '<span style="color:var(--danger);font-weight:600;">Salida</span>' : '<span style="color:var(--warning);font-weight:600;">Ajuste</span>';
        return '<tr>' +
            '<td>' + shortDate(l.date) + '</td>' +
            '<td><strong>' + l.productName + '</strong></td>' +
            '<td>' + getCatLabel(l.category) + '</td>' +
            '<td>' + typeLabel + '</td>' +
            '<td style="font-weight:600;' + (l.quantity > 0 ? 'color:var(--success);' : 'color:var(--danger);') + '">' + (l.quantity > 0 ? '+' : '') + l.quantity + '</td>' +
            '<td>' + l.previousStock + '</td>' +
            '<td>' + l.newStock + '</td>' +
            '<td style="font-size:12px;color:var(--text-muted);">' + (l.reason || '-') + '</td>' +
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
    let filtered = posCustomers;
    if (q) filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (custFilter !== 'todo') {
        filtered = filtered.filter(c => {
            const p = getCustomerPending(c.id);
            return custFilter === 'aldia' ? p <= 0 : p > 0;
        });
    }
    const tbody = document.getElementById('custTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay clientes registrados</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(c => {
        const sales = posSales.filter(s => s.customerId === c.id);
        const purchases = sales.length;
        const totalSpent = sales.reduce((sum, s) => sum + s.total, 0);
        const pendingTotal = getCustomerPending(c.id);
        const pendingHtml = pendingTotal > 0 ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(pendingTotal) + '</span>' : '<span style="color:var(--success);">Al dia</span>';
        return `<tr>
            <td><strong>${c.id}</strong></td>
            <td><strong style="cursor:pointer;" onclick="showCustomerHistory('${c.id}')">${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
            <td>${purchases}</td>
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
        }
    } else {
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        document.getElementById('custEmail').value = '';
        document.getElementById('custAddress').value = '';
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
    if (!name) { showToast('Nombre requerido'); return; }
    if (id) {
        const c = posCustomers.find(cu => cu.id === id);
        if (c) Object.assign(c, { name, phone, email, address });
    } else {
        posCustomers.push({ id: 'c' + posNextCustomerId++, name, phone, email, address });
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
                    html += s.items.map(i => i.name.substring(0, 20) + ' x' + i.qty).join(' · ');
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
                    html += '<button class="btn btn-sm btn-success" onclick="openPaymentModalCust(' + s.id + ')">Registrar ' + (s.creditInfo.tipo === 'abono' ? 'Abono' : 'Pago') + '</button>';
                } else {
                    html += '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--success);font-weight:600;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:var(--success);vertical-align:middle;margin-right:2px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Pagado</span><button class="btn btn-sm btn-primary" onclick="showFinalInvoice(' + s.id + ')">Factura Final</button></div>';
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
    const isFullyPaid = sale.creditInfo && (
        sale.creditInfo.tipo === 'abono'
            ? (sale.creditInfo.payments.reduce((s, p) => s + p.amount, 0) >= sale.creditInfo.balance)
            : (sale.creditInfo.pagadas >= sale.creditInfo.totalCuotas)
    );
    let paymentsHtml = '';
    if (sale.creditInfo && sale.creditInfo.payments && sale.creditInfo.payments.length > 0) {
        paymentsHtml = '<div class="receipt-divider"></div>';
        paymentsHtml += '<div style="font-size:11px;font-weight:600;margin-bottom:4px;">HISTORIAL DE PAGOS</div>';
        sale.creditInfo.payments.forEach(p => {
            paymentsHtml += '<div class="receipt-row"><span>' + shortDate(p.date) + '</span><span>' + formatPrice(p.amount) + '</span></div>';
        });
        const totalPagado = sale.creditInfo.payments.reduce((s, p) => s + p.amount, 0);
        paymentsHtml += '<div class="receipt-row" style="font-weight:600;border-top:1px dashed var(--border);padding-top:4px;margin-top:2px;"><span>Total pagado</span><span>' + formatPrice(totalPagado) + '</span></div>';
    }
    const statusBadge = isFullyPaid
        ? '<div style="text-align:center;margin:8px 0;padding:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:13px;font-weight:700;color:#166534;">CANCELADO</div>'
        : '<div style="text-align:center;margin:8px 0;padding:6px;background:#fffbe6;border:1px solid #fde68a;border-radius:6px;font-size:13px;font-weight:700;color:#92400e;">PENDIENTE</div>';
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => `<div class="receipt-row"><span>${i.name.substring(0,22)} x${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join('');
    content.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <h4>LOPEZTECH NATU</h4>
                <p>Santa Marta, Colombia<br>NIT: 123.456.789-0</p>
                <p style="font-size:11px;margin-top:2px;">${shortDate(sale.date)}</p>
            </div>
            ${statusBadge}
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Factura #${sale.id}</span><span>${sale.method}</span></div>
            <div class="receipt-row"><span>Cliente: ${sale.customer || 'Mostrador'}</span></div>
            ${sale.creditInfo ? '<div class="receipt-row"><span>Tipo: ' + (sale.creditInfo.tipo === 'abono' ? 'Cuenta de cobro' : 'Cuotas fijas') + '</span></div>' : ''}
            <div class="receipt-divider"></div>
            ${itemsHtml}
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Subtotal</span><span>${formatPrice(sale.subtotal)}</span></div>
            ${sale.excedente ? '<div class="receipt-row"><span>Excedente</span><span>' + formatPrice(sale.excedente) + '</span></div>' : ''}
            ${paymentsHtml}
            <div class="receipt-total"><span>TOTAL VENTA</span><span>${formatPrice(sale.total)}</span></div>
            <div class="receipt-footer">Factura final generada el ${new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        </div>
    `;
    document.getElementById('receiptModal').classList.add('open');
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
        html += '<details style="margin:6px 0;"><summary style="cursor:pointer;font-size:11px;color:var(--text-muted);user-select:none;list-style:none;">▸ Productos</summary><div style="padding:4px 0;font-size:12px;color:var(--text-muted);">' + sale.items.map(i => i.name.substring(0, 20) + ' x' + i.qty + ' — ' + formatPrice(i.price * i.qty)).join('<br>') + '</div></details>';
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
function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    let filtered = [...posSales].reverse();
    if (q) filtered = filtered.filter(s => s.id.toString().includes(q) || (s.customer && s.customer.toLowerCase().includes(q)));
    const tbody = document.getElementById('salesTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay ventas registradas</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(s => {
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
            <td>${s.excedente ? '<span style="color:var(--warning);font-weight:600;">' + formatPrice(s.excedente) + '</span>' : '-'}</td>
            <td>${methodHtml}</td>
            <td class="actions">
                ${s.items && s.items.length > 0 ? '<button class="edit" onclick="toggleSaleItems(this)" title="Ver productos" style="color:var(--text-muted);font-size:14px;">▾</button>' : ''}
                ${s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas)) ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="' + (s.creditInfo.tipo === 'abono' ? 'Registrar Abono' : 'Registrar Pago') + '" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : ''}
                <button onclick="showReceipt(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>
            </td>
        </tr>
        <tr class="sale-items-row" style="display:none;"><td colspan="8" style="padding:4px 12px 8px;background:var(--bg);font-size:12px;color:var(--text-muted);">${s.items ? s.items.map(i => '<span style="display:inline-block;margin:2px 4px;padding:2px 8px;background:#fff;border:1px solid var(--border);border-radius:6px;">' + i.name.substring(0, 22) + ' x' + i.qty + ' — ' + formatPrice(i.price * i.qty) + '</span>').join('') : ''}</td></tr>`;
    }).join('');
}

// ============ RECIBO ============
function showReceipt(sale) {
    if (typeof sale === 'string') sale = JSON.parse(sale);
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => `<div class="receipt-row"><span>${i.name.substring(0,22)} x${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>`).join('');
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
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('open');
}

function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    const win = window.open('', '', 'width=380,height=600');
    win.document.write('<html><head><style>body{font-family:"Courier New",monospace;font-size:12px;padding:16px;line-height:1.6;}.receipt-header{text-align:center;margin-bottom:12px;}.receipt-header h4{font-size:16px;margin-bottom:2px;}.receipt-divider{border-top:1px dashed #999;margin:6px 0;}.receipt-row{display:flex;justify-content:space-between;font-size:11px;}.receipt-total{display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:8px 0;}.receipt-footer{text-align:center;font-size:10px;color:#888;margin-top:10px;}</style></head><body>' + content + '</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
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
    loadData();
    initCatFilter();
    (async function() {
        const available = await API.check();
        if (available) await syncFromApi();
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

checkSession();
