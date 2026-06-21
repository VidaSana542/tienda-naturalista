    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        header.classList.toggle('scrolled', window.scrollY > 20);
    });

    (function() {
        const track = document.querySelector('.carousel-track');
        const dots = document.querySelectorAll('.carousel-dot');
        if (!track || !dots.length) return;
        let current = 0;
        const total = dots.length;
        let interval;

        function goTo(index) {
            current = index;
            track.style.transform = 'translateX(-' + (current * 100) + '%)';
            dots.forEach(function(d) { d.classList.remove('active'); });
            dots[current].classList.add('active');
        }

        function next() { goTo((current + 1) % total); }

        function startAuto() { interval = setInterval(next, 4000); }
        function stopAuto() { clearInterval(interval); }

        dots.forEach(function(dot) {
            dot.addEventListener('click', function() {
                stopAuto();
                goTo(parseInt(this.getAttribute('data-index')));
                startAuto();
            });
        });

        track.addEventListener('mouseenter', stopAuto);
        track.addEventListener('mouseleave', startAuto);

        startAuto();
    })();

const cart = JSON.parse(localStorage.getItem('ltnCart')) || [];

function updateCartUI() {
    const count = cart.reduce((s, c) => s + c.qty, 0);
    document.getElementById('cartCount').textContent = count;
}

function addToCart(id) {
    const product = featuredProducts.find(p => p.id === id);
    if (!product) return;
    const existing = cart.find(c => c.id === id);
    if (existing) existing.qty += 1;
    else cart.push({ ...product, qty: 1 });
    localStorage.setItem('ltnCart', JSON.stringify(cart));
    updateCartUI();
    showToast((product.catalog_name || product.name) + ' agregado al carrito');
}

function showToast(msg) {
    const d = document.getElementById('toast');
    d.textContent = msg; d.classList.add('toast-show');
    clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('toast-show'), 2000);
}

function openCart() { window.location.href = 'tienda'; }

let featuredProducts = [];

const CAT_ICONS = {
    suplementos: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>',
    belleza_y_bienestar: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    salud_y_bienestar: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    vitaminas: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>'
};

let indexCategories = [];

(async function loadCategories() {
    try {
        const all = await API.getCategories();
        indexCategories = (Array.isArray(all) ? all : []).filter(c => !c.parent_key);
    } catch(e) {
        indexCategories = [
            { key: 'suplementos', label: 'Suplementos' },
            { key: 'belleza_y_bienestar', label: 'Belleza y Bienestar' }
        ];
    }

    const grid = document.getElementById('indexCatGrid');
    if (grid) {
        grid.innerHTML = indexCategories.map(c => `
            <a href="tienda#${c.key}" class="cat-card">
                <div class="cat-icon">${CAT_ICONS[c.key] || CAT_ICONS.suplementos}</div>
                <h3>${c.label}</h3>
            </a>
        `).join('');
    }

    const footer = document.getElementById('indexFooterCats');
    if (footer) {
        footer.innerHTML = indexCategories.map(c =>
            `<a href="tienda#${c.key}">${c.label}</a>`
        ).join('');
    }
})();

(async function loadFeatured() {
    try {
        const data = await API.getProducts();
        featuredProducts = data.filter(p => p.featured).slice(0, 8);
    } catch(e) {
        featuredProducts = [
            {id:1,name:"Citrato de Magnesio 90 Cap",brand:"Natural Systems",price:56300,img:"https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80"},
            {id:2,name:"Aceite de Coco Virgen 500ml",brand:"Believe",price:37800,img:"https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400&q=80"},
            {id:3,name:"Colageno con Biotina 60 Cap",brand:"Botanitas",price:35700,img:"https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80"},
            {id:4,name:"Algarroba Polvo 200 gr",brand:"Naturally",price:13500,img:"https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80"}
        ];
    }
    const grid = document.getElementById('featuredGrid');
    grid.innerHTML = featuredProducts.map(p => `
        <div class="prod-card">
            <div class="prod-img"><img src="${p.img || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80'}" alt="${p.catalog_name || p.name}" loading="lazy"></div>
            <div class="prod-body">
                <div class="prod-brand">${p.brand || ''}</div>
                <div class="prod-name">${p.catalog_name || p.name}</div>
                <button class="prod-btn" onclick="addToCart(${p.id})">
                    <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    Comprar
                </button>
            </div>
        </div>
    `).join('');
    updateCartUI();
})();
