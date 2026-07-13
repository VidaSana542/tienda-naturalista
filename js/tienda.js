const FALLBACK_PRODUCTS = [
    { id: 1, name: "Citrato de Magnesio 90 Cap", brand: "Natural Systems", category: "suplementos", price: 56300, oldPrice: 0, img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80", stock: "in", badge: "sale", desc: "El citrato de magnesio es una forma altamente absorbible de magnesio que apoya la salud muscular, osea y nerviosa. Ideal para reducir el estres y mejorar el sueno." },
    { id: 2, name: "Aceite de Coco Virgen 500ml", brand: "Believe", category: "alimentos", price: 37800, oldPrice: 42000, img: "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=300&q=80", stock: "in", badge: "sale", desc: "Aceite de coco virgen extra prensado en frio. Ideal para cocinar, hidratar la piel y el cabello. 100% natural y organico." },
    { id: 3, name: "Colageno con Biotina 60 Cap", brand: "Botanitas", category: "suplementos", price: 35700, oldPrice: 0, img: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=300&q=80", stock: "in", badge: "", desc: "Formula avanzada con colageno hidrolizado y biotina para fortalecer unas, cabello y articulaciones. Resultados visibles en semanas." },
    { id: 4, name: "Algarroba Polvo 200 gr", brand: "Naturally", category: "alimentos", price: 13500, oldPrice: 0, img: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&q=80", stock: "in", badge: "new", desc: "Polvo de algarroba natural, rico en fibra y minerales. Alternativa saludable al cacao, ideal para batidos y reposteria." },
    { id: 5, name: "Alcachofa 100 Tab", brand: "Botanitas", category: "fitoterapeuticos", price: 21100, oldPrice: 0, img: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=300&q=80", stock: "low", badge: "", desc: "Tabletas de alcachofa para apoyar la digestion y la funcion hepatica. Depurativo natural que ayuda a eliminar toxinas." },
    { id: 6, name: "Aceite Esencial Lavanda 30ml", brand: "Aromas", category: "aromas", price: 28400, oldPrice: 0, img: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300&q=80", stock: "in", badge: "", desc: "Aceite esencial puro de lavanda. Ideal para aromaterapia, relajacion y cuidado de la piel. Calidad terapeutica." },
    { id: 7, name: "Jabon Natural de Romero", brand: "Naturasol", category: "cosmeticos", price: 12200, oldPrice: 15000, img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=80", stock: "in", badge: "sale", desc: "Jabon artesanal elaborado con aceites naturales y extracto de romero. Estimula el cuero cabelludo y revitaliza la piel." },
    { id: 8, name: "Complejo B 100 Sg", brand: "Natural Systems", category: "suplementos", price: 40000, oldPrice: 0, img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80", stock: "in", badge: "", desc: "Complejo vitaminico B completo con las 8 vitaminas del grupo B. Energia, metabolismo y sistema nervioso saludable." },
    { id: 9, name: "Clorofila Liquida 960ml", brand: "Natural Systems", category: "suplementos", price: 47000, oldPrice: 0, img: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300&q=80", stock: "in", badge: "new", desc: "Clorofila liquida concentrada. Ayuda a oxigenar la sangre, desintoxicar el organismo y fortalecer el sistema inmune." },
    { id: 10, name: "Miel de Abejas Pura 500gr", brand: "Believe", category: "alimentos", price: 22500, oldPrice: 0, img: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&q=80", stock: "low", badge: "", desc: "Miel de abejas 100% pura, sin procesar ni adulterar. Endulzante natural con propiedades antibacterianas y antioxidantes." },
    { id: 11, name: "Crema Corporal de Aloe", brand: "Naturasol", category: "cosmeticos", price: 19800, oldPrice: 24800, img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=80", stock: "in", badge: "sale", desc: "Crema hidratante con aloe vera y vitaminas. Absorcion rapida, ideal para piel seca y sensible. Hidratacion profunda." },
    { id: 12, name: "Probioticos 30 Sachets", brand: "Natural Systems", category: "suplementos", price: 63500, oldPrice: 0, img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80", stock: "in", badge: "", desc: "Probioticos y prebioticos en practicos sachets. Equilibra tu flora intestinal y fortalece tus defensas naturales." },
    { id: 13, name: "Aceite Esencial Menta 15ml", brand: "Aromas", category: "aromas", price: 18900, oldPrice: 0, img: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300&q=80", stock: "out", badge: "", desc: "Aceite esencial de menta piperita. Refrescante y estimulante. Ideal para dolores de cabeza, concentracion y aromaterapia." },
    { id: 14, name: "Te Verde 50 bolsitas", brand: "Naturally", category: "alimentos", price: 9800, oldPrice: 0, img: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=300&q=80", stock: "in", badge: "", desc: "Te verde natural en bolsitas. Rico en antioxidantes, favorece la concentracion y ayuda a mantener un peso saludable." },
    { id: 15, name: "Ginkgo Biloba 60 Cap", brand: "Fitomedics", category: "fitoterapeuticos", price: 32500, oldPrice: 0, img: "https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=300&q=80", stock: "in", badge: "new", desc: "Extracto de Ginkgo Biloba estandarizado. Mejora la circulacion cerebral, la memoria y la concentracion de forma natural." },
    { id: 16, name: "Shampoo Natural Ortiga", brand: "Naturasol", category: "cosmeticos", price: 16500, oldPrice: 0, img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=80", stock: "in", badge: "", desc: "Shampoo natural a base de ortiga y hierbas. Fortalece el cabello, controla la caida y regula el exceso de grasa." },
];

let products = [...FALLBACK_PRODUCTS];
const WHATSAPP_NUMBER = '573136196312';

const cart = JSON.parse(localStorage.getItem('ltnCart')) || [];
let activeFilter = 'all';
let activeSubcategory = '';
let searchQuery = '';
let allApiCategories = [];
let navStack = [];

function dn(p) { return p.catalogName || p.name; }

// Normaliza categorias de productos para que coincidan con las keys reales de categorias
const CATEGORY_NORMALIZE = {
    'belleza-y-bienestar': 'belleza_y_bienestar',
    'salud-y-bienestar': 'salud_y_bienestar',
    'vitaminas-y-minerales': 'vitaminas',
    'salud': 'salud_y_bienestar'
};
// Limpia subcategoria si no existe en la lista de categorias (ej: despues de borrarla en POS)
function cleanOrphanSubcategory(subKey, allCats) {
    if (!subKey || !allCats || allCats.length === 0) return '';
    return allCats.some(c => c.key === subKey.trim()) ? subKey.trim() : '';
}

const CATEGORY_ICONS = {
    suplementos: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>',
    'belleza-y-bienestar': '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    belleza_y_bienestar: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    salud_y_bienestar: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    vitaminas: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
    alimentos: '<svg viewBox="0 0 24 24"><path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.15v1.83c-1.92.75-3.57 2.08-4.8 3.89-.04.05-.09.1-.14.15-.36.43-.63.93-.78 1.48l-.11.35-.01 2.49zM6.69 12.7l5.73 5.73-5.73 5.73-2.86-2.86 2.87-2.87-2.87-2.87L6.69 12.7zm0-2.83L3.83 7.01 6.69 4.15l2.86 2.86-2.87 2.87 2.87 2.87-2.86 2.85z"/></svg>',
    aromas: '<svg viewBox="0 0 24 24"><path d="M12 2C9.38 2 7.13 3.44 6 5.55 4.88 7.65 5.12 10.31 6.54 12.19c.79.98 1.21 2.17 1.21 3.41V19c0 .55.45 1 1 1h6.5c.55 0 1-.45 1-1v-3.4c0-1.24.42-2.43 1.21-3.41 1.42-1.88 1.66-4.54.54-6.64C16.87 3.44 14.62 2 12 2zm0 2c1.83 0 3.42 1.05 4.18 2.69.76 1.64.46 3.61-.63 5.05-1.07 1.41-1.55 3.09-1.55 4.86V17h-4v-.4c0-1.77-.48-3.45-1.55-4.86-1.09-1.44-1.39-3.41-.63-5.05C8.58 5.05 10.17 4 12 4zm-2 13h4v2h-4v-2z"/></svg>',
    cosmeticos: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM18 6h-5v7l4-2.5 4 2.5V6zm-9 4H5v2h4v-2zm0 4H5v2h4v-2zm0-8H5v2h4V6z"/></svg>',
    fitoterapeuticos: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
};
const DEFAULT_CAT_ICON = '<svg viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>';

let categories = [
    { key: 'all', label: 'Todos', icon: DEFAULT_CAT_ICON }
];

function getCount(key) {
    if (key === 'all') return products.length;
    return products.filter(p => p.category === key).length;
}

function initCategoryCards() {
    const container = document.getElementById('categoryCards');
    container.innerHTML = categories.map(c =>
        `<div class="cat-card ${c.key === 'all' ? 'active' : ''}" onclick="setCategory('${c.key}')">
            <div class="cat-card-icon">${c.icon}</div>
            <div class="cat-card-name">${c.label}</div>

        </div>`
    ).join('');
}

function setCategory(key) {
    activeFilter = key;
    activeSubcategory = '';
    if (key === 'all') {
        history.replaceState(null, '', window.location.pathname);
    } else {
        window.location.hash = key;
    }
    document.querySelectorAll('.cat-card').forEach(el => el.classList.remove('active'));
    const cards = document.querySelectorAll('.cat-card');
    const idx = categories.findIndex(c => c.key === key);
    if (cards[idx]) cards[idx].classList.add('active');
    showProductsView();
    renderSubcatFilters(key);
    updateSearchPlaceholder(key);
    renderProducts();
}

function getSubcatsOf(catKey) {
    return allApiCategories.filter(c => c.parent_key === catKey);
}

function renderSubcatFilters(catKey) {
    const container = document.getElementById('subcategoryCards');
    const subs = getSubcatsOf(catKey);
    if (subs.length > 0) {
        document.getElementById('subcategorySection').style.display = '';
        container.innerHTML =
            `<div class="subcat-chip active" data-sub="" onclick="setSubcategoryFilter('${catKey}', '')">
                <span>Todos</span>
            </div>` +
            subs.map(s => `
                <div class="subcat-chip" data-sub="${s.key}" onclick="setSubcategoryFilter('${catKey}','${s.key}')">
                    <span>${s.label}</span>
                </div>
            `).join('');
    } else {
        document.getElementById('subcategorySection').style.display = 'none';
    }
}

function setSubcategoryFilter(catKey, subKey) {
    activeSubcategory = subKey;
    if (subKey) {
        window.location.hash = catKey + '/' + subKey;
    } else {
        window.location.hash = catKey;
    }
    document.querySelectorAll('.subcat-chip').forEach(c => c.classList.toggle('active', c.dataset.sub === subKey));
    renderProducts();
}

function showProductsView() {
    document.getElementById('categoryCards').style.display = '';
    document.getElementById('resultCount').style.display = '';
    document.getElementById('sortSelect').style.display = '';
    document.getElementById('subcategorySection').style.display = 'none';
    document.getElementById('productGrid').style.display = '';
}

function hideSubcategorySection() {
    showProductsView();
    document.getElementById('productGrid').innerHTML = '';
}

function backToCategories() {
    activeFilter = 'all';
    activeSubcategory = '';
    document.getElementById('subcategorySection').style.display = 'none';
    showProductsView();
    const cards = document.querySelectorAll('.cat-card');
    cards.forEach(c => c.classList.remove('active'));
    if (cards[0]) cards[0].classList.add('active');
    updateSearchPlaceholder('all');
    renderProducts();
}

function updateSearchPlaceholder(key) {
    const inp = document.getElementById('searchInput');
    if (!key || key === 'all') {
        inp.placeholder = 'Buscar por producto, marca o categoria...';
    } else {
        const cat = categories.find(c => c.key === key);
        inp.placeholder = cat ? 'Buscar en ' + cat.label.toLowerCase() + '...' : 'Buscar...';
    }
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    renderProducts();
}

function getFilteredProducts() {
    let filtered = products;
    if (activeFilter && activeFilter !== 'all') {
        console.log('[DEBUG] activeFilter:', JSON.stringify(activeFilter));
        console.log('[DEBUG] product categories sample:', JSON.stringify(Array.from(new Set(products.slice(0, 50).map(p => p.category)))));
        filtered = filtered.filter(p => (p.category || '').trim() === activeFilter.trim());
    }
    if (activeSubcategory) {
        filtered = filtered.filter(p => (p.subcategory || '').trim() === activeSubcategory.trim());
    }
    if (searchQuery) {
        filtered = filtered.filter(p =>
            dn(p).toLowerCase().includes(searchQuery) ||
            p.name.toLowerCase().includes(searchQuery) ||
            p.brand.toLowerCase().includes(searchQuery) ||
            p.category.toLowerCase().includes(searchQuery)
        );
    }
    return filtered;
}

function sortProducts(list, sortBy) {
    const sorted = [...list];
    switch (sortBy) {
        case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
        case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
        case 'name-asc': return sorted.sort((a, b) => dn(a).localeCompare(dn(b)));
        case 'name-desc': return sorted.sort((a, b) => dn(b).localeCompare(dn(a)));
        default: return sorted;
    }
}

function formatPrice(price) {
    return '$' + price.toLocaleString('es-CO');
}

function stockLabel(stock) {
    return '<span class="stock-badge stock-in"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Disponible</span>';
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const sortBy = document.getElementById('sortSelect').value;
    let filtered = getFilteredProducts();
    filtered = sortProducts(filtered, sortBy);

    document.getElementById('resultCount').textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        grid.style.display = 'block';
        grid.style.padding = '60px 0';
        grid.innerHTML = `<div class="no-products" style="text-align:center;color:#999;">
            <svg class="np-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <p>No encontramos productos con "${searchQuery}"</p>
        </div>`;
        return;
    }

    function cardHtml(p) {
        const badgeHtml = p.badge === 'new' ? '<span class="prod-badge badge-new">Nuevo</span>' :
                         p.badge === 'sale' ? '<span class="prod-badge badge-sale">Oferta</span>' : '';
        return `
        <div class="prod-card">
            ${badgeHtml}
            <div class="prod-img-wrap">
                <img src="${p.img || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23e8f5e9%22 width=%22200%22 height=%22200%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M100 40c-33 0-60 27-60 60s27 60 60 60 60-27 60-60-27-60-60-60zm0 110c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M90 85h20v40H90zm0-20h20v15H90z%22/%3E%3C/svg%3E'}" alt="${dn(p)}" loading="lazy" decoding="async" onerror="this.style.display='none'">
            </div>
            <div class="prod-body">
                <div class="prod-name" onclick="openModal(${p.id})">${dn(p)}</div>
                <div>${stockLabel(p.stock)}</div>
                <div class="prod-actions">
                    <button class="prod-btn-wa" onclick="addToCart(${p.id});setTimeout(()=>openCheckout(),100)">
                        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Comprar
                    </button>
                    <button class="prod-btn-cart" onclick="addToCart(${p.id})">
                        <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        Carrito
                    </button>
                </div>
            </div>
        </div>`;
    }

    if (activeFilter !== 'all') {
        grid.style.display = 'grid';
        grid.style.padding = '30px 0 50px';
        grid.innerHTML = filtered.map(p => cardHtml(p)).join('');
    } else {
        grid.style.display = 'block';
        grid.style.padding = '20px 0 30px';
        let html = '';
        const usedCats = [...new Set(filtered.map(p => p.category))];
        usedCats.forEach(catKey => {
            const catProducts = filtered.filter(p => p.category === catKey);
            if (catProducts.length === 0) return;
            const catInfo = categories.find(c => c.key === catKey);
            const icon = catInfo ? catInfo.icon : (CATEGORY_ICONS[catKey] || DEFAULT_CAT_ICON);
            const label = catInfo ? catInfo.label : catKey;
            html += '<div class="cat-section">' +
                '<div class="cat-section-header">' +
                    '<div class="csh-icon">' + icon + '</div>' +
                    '<h2>' + label + '</h2>' +
                    '<span>' + catProducts.length + ' producto' + (catProducts.length !== 1 ? 's' : '') + '</span>' +
                '</div>' +
                '<div class="prod-grid" style="padding:0;">' + catProducts.map(p => cardHtml(p)).join('') + '</div>' +
            '</div>';
        });
        grid.innerHTML = html || '<div class="no-products" style="text-align:center;padding:60px 20px;color:#999;"><p>No hay productos disponibles</p></div>';
    }
}

function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const existing = cart.find(c => c.id === id);
    if (existing) { existing.qty += 1; }
    else { cart.push({ ...product, qty: 1 }); }
    localStorage.setItem('ltnCart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${dn(product)} agregado al carrito`);
}

function removeFromCart(id) {
    const idx = cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    cart.splice(idx, 1);
    localStorage.setItem('ltnCart', JSON.stringify(cart));
    updateCartUI();
    renderCartPanel();
}

function updateQty(id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) { removeFromCart(id); return; }
    localStorage.setItem('ltnCart', JSON.stringify(cart));
    updateCartUI();
    renderCartPanel();
}

function updateCartUI() {
    const count = cart.reduce((sum, c) => sum + c.qty, 0);
    document.getElementById('cartCount').textContent = count;
}

function openCart() {
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartPanel').classList.add('open');
    renderCartPanel();
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartPanel').classList.remove('open');
    document.body.style.overflow = '';
}

function renderCartPanel() {
    const container = document.getElementById('cartItems');
    const subtotals = document.getElementById('cartSubtotals');
    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty"><svg class="ce-icon" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg><p>Tu carrito esta vacio</p><p class="em-txt">Explora nuestra tienda y agrega productos</p></div>';
        document.getElementById('cartTotal').textContent = '';
        subtotals.innerHTML = '';
        return;
    }
    container.innerHTML = cart.map(c => `
        <div class="cart-item">
            <div class="cart-item-img"><img src="${c.img || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23e8f5e9%22 width=%22200%22 height=%22200%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M100 40c-33 0-60 27-60 60s27 60 60 60 60-27 60-60-27-60-60-60zm0 110c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M90 85h20v40H90zm0-20h20v15H90z%22/%3E%3C/svg%3E'}" alt="${dn(c)}" loading="lazy" decoding="async" onerror="this.style.display='none'"></div>
            <div class="cart-item-info">
                <div class="cart-item-name">${dn(c)}</div>
                <div class="cart-item-brand">${c.brand}</div>
                <div class="cart-item-row2">
                    <div class="cart-item-qty">
                        <button onclick="updateQty(${c.id}, -1)">-</button>
                        <span>${c.qty}</span>
                        <button onclick="updateQty(${c.id}, 1)">+</button>
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart(${c.id})">x</button>
                </div>
            </div>
        </div>
    `).join('');
    subtotals.innerHTML = '';
    document.getElementById('cartTotal').textContent = '';
}

function openCheckout() {
    if (cart.length === 0) { showToast('El carrito esta vacio'); return; }
    closeCart();
    const summary = document.getElementById('orderSummary');
    summary.innerHTML = `
        <h3>Mi pedido</h3>
        ${cart.map(c => `<div><span>${dn(c)} x${c.qty}</span></div>`).join('')}
    `;
    document.getElementById('checkName').value = '';
    document.getElementById('checkPhone').value = '';
    document.getElementById('checkAddress').value = '';
    deliveryType = 'domicilio';
    document.querySelectorAll('input[name="delivery"]').forEach(r => r.checked = r.value === 'domicilio');
    document.getElementById('checkAddressGroup').style.display = '';
    document.getElementById('checkoutModal').classList.add('open');
}

let deliveryType = 'domicilio';

function selectDelivery(type) {
    deliveryType = type;
    const addrGroup = document.getElementById('checkAddressGroup');
    addrGroup.style.display = type === 'domicilio' ? '' : 'none';
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('open');
}

function submitOrder() {
    const name = document.getElementById('checkName').value.trim();
    const phone = document.getElementById('checkPhone').value.trim();
    const address = document.getElementById('checkAddress').value.trim();
    if (!name || !phone) { showToast('Completa nombre y telefono'); return; }
    if (deliveryType === 'domicilio' && !address) { showToast('Ingresa la direccion de envio'); return; }
    let lines = ['*Nuevo pedido*'];
    cart.forEach((c, i) => {
        lines.push((i + 1) + '. ' + dn(c) + ' x' + c.qty);
    });
    lines.push('');
    lines.push('*Datos del cliente:*');
    lines.push('Nombre: ' + name);
    lines.push('Telefono: ' + phone);
    lines.push('Entrega: ' + (deliveryType === 'domicilio' ? 'A domicilio' : 'Recoger en tienda'));
    if (deliveryType === 'domicilio') lines.push('Direccion: ' + address);
    const msg = encodeURIComponent(lines.join('\n'));
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + msg, '_blank');
    showToast('Pedido enviado por WhatsApp');
    cart.length = 0;
    localStorage.setItem('ltnCart', JSON.stringify(cart));
    updateCartUI();
    closeCheckout();
    renderCartPanel();
}

function openModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalImg').src = p.img || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23e8f5e9%22 width=%22200%22 height=%22200%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M100 40c-33 0-60 27-60 60s27 60 60 60 60-27 60-60-27-60-60-60zm0 110c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z%22/%3E%3Cpath fill=%22%234caf50%22 d=%22M90 85h20v40H90zm0-20h20v15H90z%22/%3E%3C/svg%3E';
    document.getElementById('modalImg').alt = dn(p);
    document.getElementById('modalBrand').textContent = p.brand;
    document.getElementById('modalName').textContent = dn(p);
    document.getElementById('modalDesc').textContent = p.desc;
    const waBtn = document.getElementById('modalWaBtn');
    waBtn.onclick = (e) => { e.preventDefault(); addToCart(p.id); closeModal(); openCheckout(); };
    const btn = document.getElementById('modalAddBtn');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg> Carrito';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.onclick = () => { addToCart(p.id); closeModal(); };
    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow = '';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

(async function init() {
    let apiProducts = [], apiCategories = [];
    try {
        const results = await Promise.allSettled([API.getProducts(), API.getCategories()]);
        if (results[0].status === 'fulfilled') apiProducts = results[0].value || [];
        else console.error('Error cargando productos:', results[0].reason);
        if (results[1].status === 'fulfilled') apiCategories = results[1].value || [];
        else console.error('Error cargando categorias:', results[1].reason);
    } catch (e) {
        console.error('Error en init:', e);
    }
    if (apiCategories.length > 0) {
        const seen = new Set();
        allApiCategories = apiCategories.filter(c => {
            if (seen.has(c.key)) return false;
            seen.add(c.key);
            return true;
        });
        const topCats = allApiCategories.filter(c => !c.parent_key);
        if (topCats.length > 0) {
            categories = [
                { key: 'all', label: 'Todos', icon: DEFAULT_CAT_ICON },
                ...topCats.map(c => ({
                    key: c.key,
                    label: c.label,
                    icon: CATEGORY_ICONS[c.key] || DEFAULT_CAT_ICON
                }))
            ];
        }
    }
    if (apiProducts.length > 0) {
        products = apiProducts.filter(p => p.visible !== false).map(p => ({
            id: parseInt(p.id),
            name: p.name,
            catalogName: p.catalog_name || '',
            brand: p.brand || '',
            category: CATEGORY_NORMALIZE[p.category] || p.category,
            subcategory: cleanOrphanSubcategory(p.subcategory || '', allApiCategories),
            price: parseFloat(p.price),
            oldPrice: 0,
            img: p.img || '',
            stock: p.stock > 5 ? 'in' : p.stock > 0 ? 'low' : 'out',
            badge: '',
            desc: p.description || ''
        }));
        console.log('[DEBUG] Categories from API:', JSON.stringify(categories.map(c => c.key)));
        console.log('[DEBUG] All categories + subcats:', JSON.stringify(allApiCategories.map(c => ({ key: c.key, parent_key: c.parent_key, label: c.label }))));
        console.log('[DEBUG] Unique product categories:', JSON.stringify([...new Set(products.map(p => p.category))]));
        console.log('[DEBUG] Products with no/invalid category:', JSON.stringify(products.filter(p => !p.category || p.category.trim() === '').map(p => ({ id: p.id, name: p.name, category: p.category }))));
    } else {
        showToast('No hay productos en la nube. Crea productos desde el POS y sincroniza.');
    }
    initCategoryCards();
    updateScrollButtons();
    showProductsView();
    renderSubcatFilters('all');
    updateCartUI();
    applyHash();
})();

function applyHash() {
    const hash = window.location.hash.replace('#', '');
    if (!hash) { setCategory('all'); return; }
    const parts = hash.split('/');
    const catKey = parts[0];
    const subKey = parts[1] || '';
    if (categories.some(c => c.key === catKey)) {
        activeFilter = catKey;
        activeSubcategory = subKey;
        document.querySelectorAll('.cat-card').forEach(el => el.classList.remove('active'));
        const cards = document.querySelectorAll('.cat-card');
        const idx = categories.findIndex(c => c.key === catKey);
        if (cards[idx]) cards[idx].classList.add('active');
        showProductsView();
        renderSubcatFilters(catKey);
        updateSearchPlaceholder(catKey);
        if (subKey) {
            setTimeout(() => {
                document.querySelectorAll('.subcat-chip').forEach(c => c.classList.toggle('active', c.dataset.sub === subKey));
            }, 0);
        }
        renderProducts();
    } else {
        setCategory('all');
    }
}

window.addEventListener('hashchange', function() {
    applyHash();
});

window.addEventListener('scroll', function() {
    document.getElementById('backTop').classList.toggle('show', window.scrollY > 400);
});

function scrollCategories(dir) {
    const el = document.getElementById('categoryCards');
    const scrollAmount = 200;
    el.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 350);
}

function updateScrollButtons() {
    const el = document.getElementById('categoryCards');
    const leftBtn = document.getElementById('catScrollLeft');
    const rightBtn = document.getElementById('catScrollRight');
    if (!el || !leftBtn || !rightBtn) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 5;
    leftBtn.style.display = hasOverflow ? '' : 'none';
    rightBtn.style.display = hasOverflow ? '' : 'none';
    leftBtn.disabled = el.scrollLeft <= 2;
    rightBtn.disabled = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
}

elCategoryCards = document.getElementById('categoryCards');
if (elCategoryCards) {
    elCategoryCards.addEventListener('scroll', updateScrollButtons);
}

setTimeout(updateScrollButtons, 500);
window.addEventListener('resize', updateScrollButtons);
