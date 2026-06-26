// ============ POS POR FUERA - Config ============
const POS_SCOPE = 'fuera';
const POS_RESTRICTED_PANELS = ['tpv', 'dashboard', 'products', 'customers', 'cuentas', 'sales', 'labOrders', 'supplierExpenses'];
const POS_PANEL_TITLES = { dashboard:'Dashboard', orders:'Pedidos', tpv:'TPV / Pedido', salidas:'Salidas', products:'Productos', customers:'Clientes', cuentas:'Estado de Cuentas', inventory:'Inventario', sales:'Historial de Ventas' };
const POS_PANEL_RENDERERS = {};

// ============ TPV POR FUERA ============
let _barcodeTimer = null;

// ============ SALIDAS TEMPORALES (Ruta / Bodega) ==========
let posSalidas = []; // persisted list of salidas
let posSalidasNextId = 1;

async function loadSalidas() {
    if (API.isAvailable) {
        try {
            const apiSalidas = await API.getSalidas();
            posSalidas = (apiSalidas || []).map(s => ({ ...s, _synced: true }));
            if (posSalidas.length > 0) posSalidasNextId = Math.max(posSalidasNextId, ...posSalidas.map(s => s.id + 1));
            localStorage.setItem('posSalidas', JSON.stringify(posSalidas));
            if (typeof renderSalidas === 'function') renderSalidas();
            return;
        } catch(e) { console.error('[POS] loadSalidas API error:', e); }
    }
    try {
        const raw = localStorage.getItem('posSalidas');
        if (raw) {
            posSalidas = JSON.parse(raw) || [];
            if (posSalidas.length > 0) posSalidasNextId = Math.max(...posSalidas.map(s => s.id)) + 1;
        } else {
            posSalidas = [];
        }
    } catch (e) { console.error('loadSalidas error', e); posSalidas = []; }
}

function saveSalidas() {
    try { localStorage.setItem('posSalidas', JSON.stringify(posSalidas)); } catch (e) { console.error('saveSalidas error', e); }
    if (API.isAvailable) {
        posSalidas.forEach(s => {
            if (s._synced) return;
            API.saveSalida({
                id: s.id,
                userId: s.userId,
                userName: s.userName,
                items: s.items,
                notes: s.notes,
                status: s.status,
                created_at: s.created_at
            }).then(res => {
                if (res && res.id) { s.id = res.id; s._synced = true; localStorage.setItem('posSalidas', JSON.stringify(posSalidas)); }
            }).catch(e => { console.error('[POS] saveSalida API error:', e); });
        });
    }
}

function createSalidaObject(userId, userName, items, notes) {
    return {
        id: posSalidasNextId++,
        created_at: now(),
        userId: userId || (currentUser ? currentUser.user : ''),
        userName: userName || (currentUser ? currentUser.name : 'Usuario'),
        items: items.map(it => ({ productId: it.productId, sentQty: it.sentQty, soldQty: 0, returnedQty: 0 })),
        notes: notes || '',
        status: 'open'
    };
}

function getOpenSalidaForUser(userId) {
    return posSalidas.find(s => s.userId === userId && s.status === 'open');
}

function renderSalidas() {
    try {
        const tbody = document.getElementById('salidasTable');
        if (!tbody) return;
        if (!posSalidas || posSalidas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No hay salidas registradas</td></tr>';
            return;
        }
        tbody.innerHTML = posSalidas.slice().sort((a,b) => b.id - a.id).map(s => {
            const sent = s.items.reduce((a,i)=>a+i.sentQty,0);
            const sold = s.items.reduce((a,i)=>a+i.soldQty,0);
            const ret = s.items.reduce((a,i)=>a+i.returnedQty,0);
            const statusColor = s.status === 'closed' ? '#dc2626' : '#16a34a';
            const statusBg = s.status === 'closed' ? '#fee2e2' : '#f0fdf4';
            const statusLabel = s.status === 'closed' ? 'Cerrada' : 'Abierta';
            const completeness = sent > 0 ? Math.round(((sold + ret) / sent) * 100) : 0;
            return `<tr>
                <td><strong>#${s.id}</strong></td>
                <td style="font-size:12px;color:var(--text-muted);">${s.created_at.split('T')[0]}</td>
                <td><small>${s.userName}</small></td>
                <td style="text-align:center;"><strong>${sent}</strong></td>
                <td style="text-align:center;color:#16a34a;"><strong>${sold}</strong></td>
                <td style="text-align:center;color:#dc2626;"><strong>${ret}</strong></td>
                <td style="text-align:center;"><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${statusLabel}</span></td>
                <td style="text-align:center;">
                    <div style="display:flex;gap:4px;justify-content:center;">
                        <button class="btn btn-sm" onclick="openSalidaDetail(${s.id})" style="font-size:11px;padding:4px 10px;">Ver</button>
                        ${s.status !== 'closed' ? `<button class="btn btn-sm btn-outline" onclick="openEditSalida(${s.id})" title="Editar" style="font-size:11px;padding:4px 8px;color:var(--primary);border-color:var(--primary);">Editar</button>` : ''}
                        <button class="btn btn-sm btn-outline" onclick="deleteSalida(${s.id})" title="Eliminar" style="font-size:11px;padding:4px 8px;color:var(--danger);border-color:var(--danger);">Eliminar</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('renderSalidas error', e);
    }
}

function openSalidaDetail(id) {
    const s = posSalidas.find(x=>x.id===id);
    if (!s) return;
    const el = document.getElementById('returnSalidaItems');
    if (!el) return;
    const isActive = s.status !== 'closed';
    el.innerHTML = s.items.map(it => {
        const prod = posProducts.find(p=>p.id===it.productId) || { name: 'Producto' };
        const available = Math.max(0, it.sentQty - it.soldQty - it.returnedQty);
        return `<div style="background:#f9fafb;border:1px solid var(--border);border-radius:6px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div><strong>${prod.name}</strong><br><small style="color:var(--text-muted);">ID: ${it.productId}</small></div>
                <div style="text-align:right;font-size:12px;color:var(--text-muted);">
                    <div>Enviados: <strong>${it.sentQty}</strong></div>
                    <div>Vendidos: <strong style="color:#16a34a;">${it.soldQty}</strong></div>
                    <div>Devueltos: <strong style="color:#dc2626;">${it.returnedQty}</strong></div>
                    <div>Disponible: <strong style="color:#2563eb;">${available}</strong></div>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
                <label style="font-size:12px;flex:1;">¿Cuántos devolver?</label>
                <input type="number" min="0" max="${available}" value="0" data-prod="${it.productId}" class="return-qty-input" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;text-align:center;">
            </div>
        </div>`;
    }).join('');
    (document.getElementById('returnSalidaModal')||{}).style.display = 'flex';
    (document.getElementById('returnSalidaModal')||{}).classList.add('open');
    document.getElementById('returnSalidaModal').dataset.salidaId = id;
    document.getElementById('returnSalidaModal').dataset.status = s.status;
    document.body.style.overflow = 'hidden';
    // Hide "Vender en TPV" for employees
    const btnVender = document.getElementById('salidaVenderTpvBtn');
    if (btnVender) btnVender.style.display = (currentUser && currentUser.role === 'empleado') ? 'none' : '';
    switchSalidaTab('devolver');
}

function switchSalidaTab(tab) {
    document.querySelectorAll('.salida-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.stab === tab);
        b.style.borderBottomColor = b.dataset.stab === tab ? 'var(--primary)' : 'transparent';
        b.style.color = b.dataset.stab === tab ? 'var(--primary)' : 'var(--text-muted)';
    });
    document.getElementById('salidaTabDevolver').style.display = tab === 'devolver' ? '' : 'none';
    updateSalidaModalButtons(document.getElementById('returnSalidaModal').dataset.status);
}

function updateSalidaModalButtons(status) {
    const isOpen = status !== 'closed';
    const btnReturn = document.getElementById('salidaModalReturnBtn');
    if (btnReturn) btnReturn.style.display = isOpen ? '' : 'none';
}

function closeReturnSalidaModal() {
    const m = document.getElementById('returnSalidaModal');
    if (!m) return; m.classList.remove('open'); m.style.display = 'none'; document.body.style.overflow = '';
}

function saveReturnSalida() {
    const m = document.getElementById('returnSalidaModal');
    if (!m) return; const id = parseInt(m.dataset.salidaId);
    const s = posSalidas.find(x=>x.id===id); if (!s) return;
    const inputs = Array.from(document.querySelectorAll('#returnSalidaItems .return-qty-input'));
    let any = false;
    inputs.forEach(inp=>{
        const prodId = inp.dataset.prod; const v = parseInt(inp.value)||0; if (v<=0) return; any=true;
        const it = s.items.find(i=>i.productId===prodId); if (!it) return;
        const canReturn = Math.max(0, it.sentQty - it.soldQty - it.returnedQty);
        const toReturn = Math.min(canReturn, v);
        if (toReturn>0) {
            s._synced = false;
            it.returnedQty += toReturn;
            const prod = posProducts.find(p=>p.id===prodId);
            if (prod) {
                const prev = prod.stock;
                prod.stock = (prod.stock || 0) + toReturn;
                addInvLog(prod.id, prod.name, 'retorno', toReturn, prev, prod.stock, 'Devolucion Salida #' + s.id, s.id, true);
            }
        }
    });
    if (!any) { showToast('Ingresa cantidades a devolver'); return; }
    if (s.items.every(i=>i.sentQty <= (i.soldQty + i.returnedQty))) s.status = 'closed';
    saveSalidas(); saveProducts(); saveInvLog(); renderSalidas(); renderInventory(); closeReturnSalidaModal(); showToast('Devolucion registrada');
}

function loadSalidaToTpv() {
    const m = document.getElementById('returnSalidaModal');
    if (!m) return;
    const id = parseInt(m.dataset.salidaId);
    const s = posSalidas.find(x => x.id === id);
    if (!s) return;
    if (s.status === 'closed') { showToast('Esta salida ya esta cerrada'); return; }
    posCart = [];
    let loaded = 0;
    s.items.forEach(it => {
        const available = Math.max(0, it.sentQty - it.soldQty - it.returnedQty);
        if (available > 0) {
            const prod = posProducts.find(p => p.id === it.productId);
            if (prod) {
                posCart.push({ id: prod.id, qty: available, price: prod.price, _fromSalida: s.id, _maxQty: available + prod.stock });
                loaded++;
            }
        }
    });
    if (loaded === 0) { showToast('No hay productos disponibles para vender'); return; }
    saveCart();
    renderTpvCart();
    closeReturnSalidaModal();
    switchPanel('tpv');
    showToast(loaded + ' producto(s) cargado(s) desde Salida #' + s.id + ' - Confirma el cobro en TPV');
}

function setupBarcodeScan() {
    const input = document.getElementById('tpvBarcode');
    if (!input) return;
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
    const sub = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const excedente = parseFloat(document.getElementById('tpvExcedente')?.value) || 0;
    const total = sub + excedente;

    if (count) count.textContent = totalQty;
    if (subtotal) subtotal.textContent = formatPrice(sub);
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Registrar Pedido ' + formatPrice(total); btn.disabled = false; }
    if (badge) badge.textContent = totalQty;
    if (barTotal) barTotal.textContent = formatPrice(total);

    if (container) container.innerHTML = posCart.map((item, idx) => {
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
        if (delta > 0) {
            let maxQty;
            if (posCart[idx]._fromSalida) {
                maxQty = posCart[idx]._maxQty || 999;
            } else {
                const prod = posProducts.find(p => p.id === posCart[idx].id);
                maxQty = prod ? prod.stock : 999;
            }
            if (newQty > maxQty) { showToast('Maximo disponible: ' + maxQty); return; }
        }
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
    document.querySelector('.sidebar').classList.toggle('cart-open', cart.classList.contains('open'));
}

function clearCart() {
    posCart = [];
    saveCart();
    renderTpvCart();
}

// ============ PRODUCTO TEMPORAL ============
let _tempProductCounter = 0;
let _editPriceIndex = null;

function openTempProductModal() {
    const modal = document.getElementById('tempProductModal');
    const nameInput = document.getElementById('tempProdName');
    const priceInput = document.getElementById('tempProdPrice');
    const qtyInput = document.getElementById('tempProdQty');

    if (!modal) return;
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 120);
}

// ============ Create Salida Modal Handlers ==========
function openCreateSalidaModal() {
    _editingSalidaId = null;
    const el = document.getElementById('createSalidaItems');
    if (el) el.innerHTML = '';
    const notesEl = document.getElementById('createSalidaNotes');
    if (notesEl) notesEl.value = '';
    addCreateSalidaRow();
    const title = document.querySelector('#createSalidaModal .modal-header h3');
    if (title) title.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:8px;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.56 9.31 6.88 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.88 0 1.56-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>Crear Salida Temporal';
    const footerBtn = document.querySelector('#createSalidaModal .modal-footer .btn-primary');
    if (footerBtn) { footerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" style="vertical-align:middle;margin-right:6px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Crear Salida'; footerBtn.onclick = createSalida; }
    const m = document.getElementById('createSalidaModal');
    if (m) { m.style.display = 'flex'; m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeCreateSalidaModal() { const m = document.getElementById('createSalidaModal'); if (!m) return; m.classList.remove('open'); m.style.display = 'none'; document.body.style.overflow = ''; }

function addCreateSalidaRow() {
    const el = document.getElementById('createSalidaItems'); if (!el) return;
    const productsList = Array.isArray(posProducts) ? posProducts : [];
    
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'flex-start';
    row.style.padding = '8px';
    row.style.background = '#fff';
    row.style.border = '1px solid var(--border)';
    row.style.borderRadius = '6px';
    row.style.position = 'relative';
    
    // Product search container
    const prodContainer = document.createElement('div');
    prodContainer.style.flex = '1';
    prodContainer.style.minWidth = '200px';
    prodContainer.style.position = 'relative';
    
    const prodInput = document.createElement('input');
    prodInput.type = 'text';
    prodInput.placeholder = 'Busca producto...';
    prodInput.style.width = '100%';
    prodInput.style.padding = '6px 8px';
    prodInput.style.border = '1px solid var(--border)';
    prodInput.style.borderRadius = '4px';
    prodInput.style.fontSize = '13px';
    prodInput.dataset.selectedId = '';
    
    const dropdown = document.createElement('div');
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid var(--border)';
    dropdown.style.borderRadius = '4px';
    dropdown.style.marginTop = '2px';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.zIndex = '1000';
    dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    
    prodInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        let filtered = productsList;
        if (q) {
            filtered = productsList.filter(p => 
                p.name.toLowerCase().includes(q) || 
                (p.brand && p.brand.toLowerCase().includes(q)) ||
                (p.barcode && p.barcode.includes(q))
            );
        }
        if (q && filtered.length > 0) {
            dropdown.innerHTML = '';
            filtered.slice(0, 10).forEach(p => {
                const div = document.createElement('div');
                div.style.padding = '8px';
                div.style.cursor = 'pointer';
                div.style.borderBottom = '1px solid var(--border)';
                div.style.fontSize = '12px';
                div.style.transition = 'background 0.2s';
                div.innerHTML = `<strong>${p.name}</strong><br><small style="color:var(--text-muted);">Stock: ${p.stock || 0}</small>`;
                div.onmouseover = () => { div.style.background = '#f0f0f0'; };
                div.onmouseout = () => { div.style.background = ''; };
                div.onclick = () => {
                    prodInput.dataset.selectedId = p.id;
                    prodInput.value = p.name;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else if (q) {
            dropdown.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">Sin resultados</div>';
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });
    
    prodInput.addEventListener('focus', (e) => {
        if (e.target.value.trim()) {
            e.target.dispatchEvent(new Event('input'));
        }
    });
    
    prodInput.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
    
    prodContainer.appendChild(prodInput);
    prodContainer.appendChild(dropdown);
    
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '1';
    inp.value = '1';
    inp.placeholder = 'Cant.';
    inp.style.width = '60px';
    inp.style.padding = '6px 8px';
    inp.style.border = '1px solid var(--border)';
    inp.style.borderRadius = '4px';
    inp.style.fontSize = '13px';
    inp.style.textAlign = 'center';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm';
    removeBtn.style.padding = '4px 8px';
    removeBtn.style.fontSize = '12px';
    removeBtn.textContent = '✕ Eliminar';
    removeBtn.onclick = () => { row.remove(); };
    
    row.appendChild(prodContainer);
    row.appendChild(inp);
    row.appendChild(removeBtn);
    el.appendChild(row);
}

function createSalida() {
    const itemsEl = document.getElementById('createSalidaItems'); if (!itemsEl) return;
    const rows = Array.from(itemsEl.children);
    const items = [];
    for (const r of rows) {
        const prodInput = r.querySelector('input[data-selected-id]');
        const qtyInput = r.querySelector('input[type="number"]');
        if (!prodInput || !qtyInput) continue;
        const pid = prodInput.dataset.selectedId;
        const qty = parseInt(qtyInput.value)||0;
        if (!pid) { showToast('Selecciona un producto en cada fila'); return; }
        if (qty <= 0) { showToast('La cantidad debe ser mayor a 0'); return; }
        const prod = posProducts.find(p=>p.id===pid);
        if (!prod) { showToast('Producto no encontrado'); return; }
        if (qty > (prod.stock || 0)) { showToast('Cantidad ' + qty + ' mayor al stock de ' + prod.name + ' (' + (prod.stock||0) + ')'); return; }
        items.push({ productId: pid, sentQty: qty });
    }
    if (items.length === 0) { showToast('Agrega al menos un producto'); return; }
    const notes = document.getElementById('createSalidaNotes').value || '';
    const s = createSalidaObject(currentUser ? currentUser.user : '', currentUser ? currentUser.name : 'Usuario', items, notes);
    posSalidas.push(s);
    // reduce main stock now
    s.items.forEach(it => {
        const p = posProducts.find(x=>x.id===it.productId);
        if (p) { const prev = p.stock; p.stock = Math.max(0, p.stock - it.sentQty); addInvLog(p.id, p.name, 'salida_temp', -it.sentQty, prev, p.stock, 'Salida temporal #' + s.id, s.id, true); }
    });
    saveSalidas(); saveProducts(); renderSalidas(); closeCreateSalidaModal(); showToast('✓ Salida #' + s.id + ' creada (' + items.reduce((a,i)=>a+i.sentQty,0) + ' items)');
}

function deleteSalida(id) {
    const s = posSalidas.find(x => x.id === id);
    if (!s) return;
    const sent = s.items.reduce((a,i) => a + i.sentQty, 0);
    const sold = s.items.reduce((a,i) => a + i.soldQty, 0);
    const ret = s.items.reduce((a,i) => a + i.returnedQty, 0);
    const pending = sent - sold - ret;
    let msg = 'Eliminar salida #' + s.id + '?';
    if (s.status !== 'closed' && pending > 0) {
        msg += '\n\nHay ' + pending + ' unidades sin reportar. Se devolverán al inventario.';
    }
    if (!confirm(msg)) return;
    s.items.forEach(it => {
        const p = posProducts.find(x => x.id === it.productId);
        if (p) {
            const toReturn = it.sentQty - it.soldQty - it.returnedQty;
            if (toReturn > 0) {
                const prev = p.stock;
                p.stock += toReturn;
                addInvLog(p.id, p.name, 'retorno', toReturn, prev, p.stock, 'Retorno por eliminación de Salida #' + s.id, s.id, true);
            }
        }
    });
    posSalidas = posSalidas.filter(x => x.id !== id);
    saveSalidas(); saveProducts(); renderSalidas();
    if (API.isAvailable) API.deleteSalida(id).catch(e => console.error('[POS-FUERA] deleteSalida error:', e));
    showToast('Salida #' + id + ' eliminada');
}

function openEditSalida(id) {
    const s = posSalidas.find(x => x.id === id);
    if (!s) return;
    if (s.status === 'closed') { showToast('No se puede editar una salida cerrada'); return; }
    _editingSalidaId = id;
    const el = document.getElementById('createSalidaItems');
    if (el) el.innerHTML = '';
    const notesEl = document.getElementById('createSalidaNotes');
    if (notesEl) notesEl.value = s.notes || '';
    s.items.forEach(it => {
        addCreateSalidaRow();
        const rows = document.getElementById('createSalidaItems').children;
        const lastRow = rows[rows.length - 1];
        if (!lastRow) return;
        const prodInput = lastRow.querySelector('input[data-selected-id]');
        const qtyInput = lastRow.querySelector('input[type="number"]');
        const prod = posProducts.find(p => p.id === it.productId);
        if (prodInput) {
            prodInput.dataset.selectedId = it.productId;
            prodInput.value = prod ? prod.name : it.productId;
        }
        if (qtyInput) qtyInput.value = it.sentQty;
    });
    const title = document.querySelector('#createSalidaModal .modal-header h3');
    if (title) title.textContent = 'Editar Salida #' + id;
    const footer = document.querySelector('#createSalidaModal .modal-footer .btn-primary');
    if (footer) { footer.textContent = 'Guardar Cambios'; footer.onclick = () => saveEditSalida(); }
    const m = document.getElementById('createSalidaModal');
    if (m) { m.style.display = 'flex'; m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

let _editingSalidaId = null;

function saveEditSalida() {
    const id = _editingSalidaId;
    if (!id) return;
    const s = posSalidas.find(x => x.id === id);
    if (!s) return;
    const itemsEl = document.getElementById('createSalidaItems');
    if (!itemsEl) return;
    const rows = Array.from(itemsEl.children);
    const newItems = [];
    for (const r of rows) {
        const prodInput = r.querySelector('input[data-selected-id]');
        const qtyInput = r.querySelector('input[type="number"]');
        if (!prodInput || !qtyInput) continue;
        const pid = prodInput.dataset.selectedId;
        const qty = parseInt(qtyInput.value) || 0;
        if (!pid) { showToast('Selecciona un producto en cada fila'); return; }
        if (qty <= 0) { showToast('La cantidad debe ser mayor a 0'); return; }
        const prod = posProducts.find(p => p.id === pid);
        if (!prod) { showToast('Producto no encontrado'); return; }
        const oldItem = s.items.find(i => i.productId === pid);
        const oldSent = oldItem ? oldItem.sentQty : 0;
        const diff = qty - oldSent;
        if (diff > 0) {
            if (diff > (prod.stock || 0)) { showToast('Stock insuficiente para ' + prod.name + ' (disponible: ' + (prod.stock || 0) + ')'); return; }
        }
        newItems.push({
            productId: pid,
            sentQty: qty,
            soldQty: oldItem ? oldItem.soldQty : 0,
            returnedQty: oldItem ? oldItem.returnedQty : 0
        });
    }
    if (newItems.length === 0) { showToast('Agrega al menos un producto'); return; }
    s.items.forEach(it => {
        const newItem = newItems.find(ni => ni.productId === it.productId);
        if (!newItem) {
            const toReturn = it.sentQty - it.soldQty - it.returnedQty;
            if (toReturn > 0) {
                const p = posProducts.find(x => x.id === it.productId);
                if (p) { const prev = p.stock; p.stock += toReturn; addInvLog(p.id, p.name, 'retorno', toReturn, prev, p.stock, 'Retorno por quitar de Salida #' + s.id, s.id, true); }
            }
        }
    });
    newItems.forEach(ni => {
        const oldItem = s.items.find(i => i.productId === ni.productId);
        const oldSent = oldItem ? oldItem.sentQty : 0;
        const diff = ni.sentQty - oldSent;
        if (diff > 0) {
            const p = posProducts.find(x => x.id === ni.productId);
            if (p) { const prev = p.stock; p.stock -= diff; addInvLog(p.id, p.name, 'salida_temp', -diff, prev, p.stock, 'Ajuste Salida #' + s.id, s.id, true); }
        }
    });
    s.items = newItems;
    s.notes = document.getElementById('createSalidaNotes').value || '';
    _editingSalidaId = null;
    saveSalidas(); saveProducts(); renderSalidas(); closeCreateSalidaModal();
    showToast('Salida #' + id + ' actualizada');
    const title = document.querySelector('#createSalidaModal .modal-header h3');
    if (title) title.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:8px;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.56 9.31 6.88 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.88 0 1.56-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>Crear Salida Temporal';
    const footerBtn = document.querySelector('#createSalidaModal .modal-footer .btn-primary');
    if (footerBtn) { footerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" style="vertical-align:middle;margin-right:6px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Crear Salida'; footerBtn.onclick = createSalida; }
}

function closeTempProductModal() {
    const modal = document.getElementById('tempProductModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

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

// ============ CHECKOUT PEDIDO ============
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

function toggleExcedente() {
    const inp = document.getElementById('tpvExcedente');
    if (parseFloat(inp.value) > 0) { inp.value = '0'; } else { inp.value = '5000'; }
    calcTotalExcedente();
}
function calcTotalExcedente() { renderTpvCart(); }

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
        body.innerHTML = '<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">El cliente podra abonar cualquier valor cuando quiera.</div>';
    }
}
function getCheckoutTotal() {
    const sub = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const excedente = parseFloat(document.getElementById('tpvExcedente').value) || 0;
    return sub + excedente;
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

function openCheckoutModal() {
    if (posCart.length === 0) { showToast('Agrega productos al pedido'); return; }
    chkPayMethod = 'cash';
    chkCreditType = 'fijo';
    document.getElementById('chkCustomerId').value = '';
    document.getElementById('chkCustomerInput').value = '';
    const el = document.getElementById('chkQuickAdd');
    if (el) el.style.display = 'none';
    document.getElementById('chkCreditConfig').classList.remove('open');
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    renderCheckoutCustomers();
    renderCheckoutPayGrid();
    renderCheckoutResumen();
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('open');
}

function renderCheckoutCustomers() {
    const q = document.getElementById('chkCustomerInput').value.toLowerCase().trim();
    const list = document.getElementById('chkCustomerList');
    const selectedId = document.getElementById('chkCustomerId').value;
    const scopedCustomers = filterCustomersByScope(posCustomers);
    const filtered = q ? scopedCustomers.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone && c.phone.includes(q);
        const parts = q.split(/\s*-\s*/);
        const partMatch = parts.length > 1 && (
            c.name.toLowerCase().includes(parts[0].trim()) ||
            (c.phone && c.phone.includes(parts[1].trim()))
        );
        return nameMatch || phoneMatch || partMatch;
    }) : scopedCustomers;
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
    if (summary) {
        if (chkPayMethod === 'credito') {
            let html = '';
            if (chkCreditType === 'fijo') {
                const sel = document.querySelector('#chkCreditBody select');
                const cuotas = sel ? parseInt(sel.value) : 1;
                const cv = Math.ceil(total / cuotas);
                html = '<div style="font-size:12px;color:var(--text-muted);">Cuotas fijas: ' + cuotas + ' x ' + formatPrice(cv) + '</div>';
            } else {
                html = '<div style="font-size:12px;color:#16a34a;">Cuenta de cobro: ' + formatPrice(total) + '</div>';
            }
            summary.innerHTML = html;
        } else if (chkPayMethod === 'mixed') {
            const assigned = calcMixedTotal();
            const restante = total - assigned;
            const color = restante > 0 ? 'var(--warning)' : (restante === 0 ? 'var(--success)' : 'var(--danger)');
            summary.innerHTML = '<div style="font-size:12px;font-weight:600;color:' + color + ';"><span>Restante: ' + formatPrice(Math.abs(restante)) + '</span></div>';
        } else {
            summary.innerHTML = '';
        }
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

function confirmCheckout() {
    if (posCart.length === 0) { showToast('El pedido esta vacio'); return; }
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
        paymentBreakdown,
        method: methods[chkPayMethod] || 'Efectivo',
        methodKey: chkPayMethod,
        customer: customerName,
        customerId,
        creditInfo: getCheckoutCreditInfo(total),
        ventaPorFuera: true
    };
    posSales.push(sale);
    const openSalida = (currentUser ? getOpenSalidaForUser(currentUser.user) : null);
    posCart.forEach(ci => {
        if (ci.isTemp) return;
        const p = posProducts.find(pr => pr.id === ci.id);
        if (p) {
            let remaining = ci.qty;
            if (ci._fromSalida) {
                const salida = posSalidas.find(s => s.id === ci._fromSalida);
                if (salida) {
                    const si = salida.items.find(it => it.productId === ci.id);
                    if (si) {
                        const availableOnRoute = Math.max(0, si.sentQty - si.soldQty - si.returnedQty);
                        const fromRoute = Math.min(availableOnRoute, remaining);
                        if (fromRoute > 0) {
                            salida._synced = false;
                            si.soldQty += fromRoute;
                            remaining -= fromRoute;
                            addInvLog(ci.id, p.name, 'venta_ruta', -fromRoute, p.stock, p.stock, 'Venta desde Salida #' + salida.id, sale.id, true);
                        }
                    }
                }
            } else if (openSalida) {
                const si = openSalida.items.find(it => it.productId === ci.id);
                if (si) {
                    const availableOnRoute = Math.max(0, si.sentQty - si.soldQty - si.returnedQty);
                    const fromRoute = Math.min(availableOnRoute, remaining);
                    if (fromRoute > 0) {
                        openSalida._synced = false;
                        si.soldQty += fromRoute;
                        remaining -= fromRoute;
                        addInvLog(ci.id, p.name, 'venta_ruta', -fromRoute, p.stock, p.stock, 'Venta desde Salida #' + openSalida.id, sale.id, true);
                    }
                }
            }
            if (remaining > 0) {
                const prev = p.stock;
                p.stock = Math.max(0, p.stock - remaining);
                addInvLog(ci.id, p.name, 'salida', -remaining, prev, p.stock, 'Pedido #' + sale.id + ' (Por fuera)', sale.id, true);
            }
        }
    });
    posSalidas.forEach(s => {
        if (s.items.every(i => i.sentQty <= (i.soldQty + i.returnedQty))) s.status = 'closed';
    });
    saveSalidas();
    saveSales();
    saveProducts();
    saveInvLog();
    posCart.filter(ci => ci.isTemp).forEach(ci => {
        API.saveTempProduct({ name: ci.tempName, price: ci.price, qty: ci.qty, sale_id: sale.id }).catch(e => console.error('[POS-FUERA] saveTempProduct error:', e));
    });
    clearCart();
    closeCheckoutModal();
    renderTpv();
    renderProductTable();
    renderCustomerTable();
    renderSalesTable();
    showReceipt(sale);
    showToast('Pedido #' + sale.id + ' registrado');
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
    const colors = { 'Efectivo': '#4caf50', 'Nequi': '#00c853', 'Daviplata': '#f44336', 'Tarjeta': '#2196f3', 'Transferencia': '#9c27b0', 'Bolt': '#ff6d00', 'Credito': '#ff9800' };
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
let _salesSortDesc = true;
let _salesView = 'today';
function switchSalesView(view) {
    _salesView = view;
    document.querySelectorAll('.sales-view-tab').forEach(btn => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('active', isActive);
        btn.style.background = isActive ? 'var(--primary,#2e7d32)' : 'transparent';
        btn.style.color = isActive ? '#fff' : 'var(--text-muted,#888)';
    });
    const filters = document.getElementById('salesAllFilters');
    if (filters) filters.style.display = view === 'all' ? 'flex' : 'none';
    if (view === 'today') {
        const df = document.getElementById('salesDateFrom');
        const dt = document.getElementById('salesDateTo');
        if (df) df.value = '';
        if (dt) dt.value = '';
    }
    renderSalesTable();
}
function toggleSalesSort() {
    _salesSortDesc = !_salesSortDesc;
    const btn = document.getElementById('salesSortBtn');
    if (btn) btn.textContent = _salesSortDesc ? '⬇ Más reciente' : '⬆ Más antiguo';
    renderSalesTable();
}
function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    const dateFrom = document.getElementById('salesDateFrom').value;
    const dateTo = document.getElementById('salesDateTo').value;
    let filtered = posSales.filter(s => s.ventaPorFuera);
    if (_salesView === 'today') {
        const todayStr = today();
        filtered = filtered.filter(s => s.date && s.date.substring(0, 10) === todayStr);
    } else {
        if (dateFrom) filtered = filtered.filter(s => s.date && s.date.substring(0, 10) >= dateFrom);
        if (dateTo) filtered = filtered.filter(s => s.date && s.date.substring(0, 10) <= dateTo);
    }
    filtered = _salesSortDesc ? filtered.slice().reverse() : filtered;
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
                <button class="edit" onclick="openSaleEditModal(${s.id})" title="Editar venta" style="color:var(--primary);"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="edit" onclick="voidSale(${s.id})" title="Anular venta" style="color:var(--danger);"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg></button>
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
                <img src="${LOGO_DATA_URL || LOGO_URL}" style="max-width:180px;height:auto;margin-bottom:6px;" alt="Logo">
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
    const imgs = win.document.querySelectorAll('img');
    let loaded = 0;
    const total = imgs.length;
    if (total === 0) { setTimeout(() => { win.print(); win.close(); }, 300); return; }
    imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === total) { setTimeout(() => { win.print(); win.close(); }, 200); } }
        else { img.onload = img.onerror = function() { loaded++; if (loaded === total) { setTimeout(() => { win.print(); win.close(); }, 200); }; }; }
    });
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
    html += '<div class="form-group"><label style="font-size:12px;color:var(--text-muted);">Fecha del pago</label><input type="date" id="paymentDate" value="' + today() + '" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;"></div>';
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
    const sale = posSales.find(s => String(s.id) === String(saleId));
    if (!sale) return;
    if (!sale.creditInfo) return;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    if (!amount || amount <= 0) { showToast('Ingresa un valor valido'); return; }
    const payDate = document.getElementById('paymentDate').value;
    const payDateStr = payDate ? payDate + 'T12:00:00' : now();
    if (!sale.creditInfo.payments) sale.creditInfo.payments = [];
    sale.creditInfo.payments.push({ date: payDateStr, amount: Math.round(amount) });
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
        const numericId = parseInt(String(sale.id).replace(/^p/i, ''));
        API.addPayment(numericId, Math.round(amount), 'Pago registrado desde POS Por Fuera', payDateStr).catch(e => { console.error('[POS-FUERA] addPayment error:', e); });
        API.updateSale(numericId, { credit_info: sale.creditInfo }).catch(e => { console.error('[POS-FUERA] updateSale credit_info error:', e); });
    }
    closePaymentModal();
    refreshCustHistory();
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
    let customers = filterCustomersByScope(posCustomers);
    if (q) customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (filter === 'deuda') customers = customers.filter(c => getCustomerPending(c.id) > 0);
    else if (filter === 'aldia') customers = customers.filter(c => getCustomerPending(c.id) <= 0);
    if (!getPosScope() && tipoFilter !== 'all') customers = customers.filter(c => (c.tipo || 'local') === tipoFilter);
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
        const rowBg = pendingTotal > 30000 ? 'background:rgba(255,165,0,0.20);' : pendingTotal >= 20000 ? 'background:rgba(59,130,246,0.15);' : pendingTotal > 0 ? 'background:rgba(255,165,0,0.10);' : 'background:rgba(34,197,94,0.15);';
        return '<tr style="' + rowBg + '">' +
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

// ============ REGISTRAR COMPRA ANTIGUA ============
function openOldPurchaseModal() {
    document.getElementById('oldPurchaseDate').value = today();
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
    const matches = posProducts.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q))).slice(0, 8);
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
        '<input type="number" class="old-prod-qty" value="1" min="1" style="width:50px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" onchange="calcOldPurchaseTotal()">' +
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
        '<input type="number" class="old-prod-qty" value="1" min="1" style="width:50px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center;" onchange="calcOldPurchaseTotal()">' +
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
    document.getElementById('oldPurchasePaidGroup').style.display = 'none';
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
POS_PANEL_RENDERERS['tpv'] = renderTpv;
POS_PANEL_RENDERERS['products'] = renderProductTable;
POS_PANEL_RENDERERS['customers'] = renderCustomerTable;
POS_PANEL_RENDERERS['categories'] = renderCategoriesTable;
POS_PANEL_RENDERERS['cuentas'] = renderAccountStatus;
POS_PANEL_RENDERERS['inventory'] = renderInventory;
POS_PANEL_RENDERERS['sales'] = renderSalesTable;
POS_PANEL_RENDERERS['salidas'] = renderSalidas;
POS_PANEL_RENDERERS['labOrders'] = renderLabOrders;
POS_PANEL_RENDERERS['supplierExpenses'] = renderSupplierExpenses;

function initPOS() {
    (async function() {
        console.log('[POS-FUERA] initPOS iniciando...');
        const tempBtn = document.getElementById('tempProductBtn');
        if (tempBtn && !tempBtn.dataset.bound) {
            tempBtn.dataset.bound = 'true';
            tempBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTempProductModal();
            });
        }

        const available = await API.check();
        if (available) {
            await syncFromApi();
        } else {
            loadData();
        }
        await loadSalidas();
        applyPosScopeUI();
        initCatFilter();
        migrateProductSubcats();
        renderDashboard();
        renderTpv();
        setupBarcodeScan();
        renderProductTable();
        renderCustomerTable();
        renderCategoriesTable();
        renderAccountStatus();
        renderSalesTable();
        buildMobileMenu();
        if (currentUser && currentUser.role === 'empleado') {
            switchPanel('salidas');
        }
    })();
}

checkSession();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
