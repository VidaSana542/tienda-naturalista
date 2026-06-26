const POS_RESTRICTED_PANELS = [];
const POS_PANEL_TITLES = { dashboard:'Dashboard Global', customers:'Clientes', sales:'Historial de Ventas', inventory:'Inventario' };
const POS_PANEL_RENDERERS = {};

let _dashPeriod = 'today';
let _paymentTargetSaleId = null;

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

    const paidTotal = periodSales.reduce((sum, s) => {
        if (s.method !== 'Credito') return sum + s.total;
        const pagado = (s.creditInfo && s.creditInfo.payments || []).reduce((sp, p) => sp + p.amount, 0);
        return sum + pagado;
    }, 0);

    const labels = { today: 'Hoy', week: 'Ultimos 7 dias', month: 'Historial mensual', year: 'Historial anual' };
    document.getElementById('dashPeriodLabel').textContent = labels[_dashPeriod] + (isHistory ? '' : ' \u2014 ' + periodCount + ' ventas \u2014 ' + formatPrice(periodTotal));
    const chartTitle = document.getElementById('dashChartTitle');
    if (chartTitle) chartTitle.textContent = 'Ventas por (' + labels[_dashPeriod] + ')';

    const totalProducts = posProducts.length;
    const lowStockCount = posProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outStockCount = posProducts.filter(p => p.stock <= 0).length;
    const avgTicket = periodCount > 0 ? periodTotal / periodCount : 0;
    const totalCustomers = posCustomers.length;
    const salesData = sumSales(periodSales);
    const custWithDebt = posCustomers.filter(c => {
        const custSales = posSales.filter(s => s.customerId === c.id);
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
    `;

    renderDashChart(periodSales);
    renderPayMethods(salesData);
    renderTopProducts(periodSales);
    renderStockAlerts();
    renderTopCustomers(posSales);
    renderDashSummary(periodSales, salesData, paidTotal);
    renderRecentSales(periodSales);
}

function renderDashChart(periodSales) {
    const canvas = document.getElementById('dashBarChart');
    if (!canvas) return;
    let labels = [];
    let data = [];
    if (_dashPeriod === 'today') {
        for (let h = 6; h < 22; h++) {
            labels.push(h + ':00');
            data.push(periodSales.filter(s => { const d = new Date(s.date); return d.getHours() >= h && d.getHours() < h + 1; }).reduce((sum, s) => sum + s.total, 0));
        }
    } else if (_dashPeriod === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            labels.push(d.toLocaleDateString('es-CO', { weekday:'short', day:'numeric' }));
            data.push(periodSales.filter(s => s.date && s.date.slice(0,10) === key).reduce((sum, s) => sum + s.total, 0));
        }
    } else if (_dashPeriod === 'month') {
        const months = {};
        periodSales.forEach(s => {
            const m = s.date ? s.date.slice(0,7) : 'unknown';
            months[m] = (months[m] || 0) + s.total;
        });
        labels = Object.keys(months).sort();
        data = labels.map(m => months[m]);
    } else {
        const years = {};
        periodSales.forEach(s => {
            const y = s.date ? s.date.slice(0,4) : 'unknown';
            years[y] = (years[y] || 0) + s.total;
        });
        labels = Object.keys(years).sort();
        data = labels.map(y => years[y]);
    }
    const max = Math.max(...data, 1);
    canvas.innerHTML = '<div style="display:flex;align-items:flex-end;height:200px;gap:4px;padding:0 4px;">' + data.map((v, i) => {
        const pct = Math.max(3, v / max * 100);
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;"><div style="width:100%;background:var(--primary-gradient);border-radius:4px 4px 0 0;height:' + pct + 'px;min-height:4px;transition:height 0.3s;" title="' + formatPrice(v) + '"></div><span style="font-size:9px;color:var(--text-muted);margin-top:4px;white-space:nowrap;">' + labels[i] + '</span></div>';
    }).join('') + '</div>';
}

function renderPayMethods(salesData) {
    const el = document.getElementById('dashPayMethods');
    if (!el) return;
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;padding:10px 0;">
            <div><div style="display:flex;justify-content:space-between;font-size:14px;"><span>Efectivo</span><strong>${formatPrice(salesData.cash)}</strong></div><div style="height:8px;background:var(--border);border-radius:4px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:${salesData.total > 0 ? (salesData.cash / salesData.total * 100) : 0}%;background:var(--green);border-radius:4px;transition:width 0.3s;"></div></div></div>
            <div><div style="display:flex;justify-content:space-between;font-size:14px;"><span>Digital</span><strong>${formatPrice(salesData.digital)}</strong></div><div style="height:8px;background:var(--border);border-radius:4px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:${salesData.total > 0 ? (salesData.digital / salesData.total * 100) : 0}%;background:var(--blue);border-radius:4px;transition:width 0.3s;"></div></div></div>
            <div><div style="display:flex;justify-content:space-between;font-size:14px;"><span>Credito</span><strong>${formatPrice(salesData.credit)}</strong></div><div style="height:8px;background:var(--border);border-radius:4px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:${salesData.total > 0 ? (salesData.credit / salesData.total * 100) : 0}%;background:var(--warning);border-radius:4px;transition:width 0.3s;"></div></div></div>
        </div>`;
}

function renderTopProducts(periodSales) {
    const tbody = document.getElementById('dashTopProducts');
    if (!tbody) return;
    const counter = {};
    periodSales.forEach(s => (s.items || []).forEach(i => {
        const key = i.name || 'Producto';
        counter[key] = counter[key] || { qty: 0, total: 0 };
        counter[key].qty += i.qty || 1;
        counter[key].total += (i.price || 0) * (i.qty || 1);
    }));
    const sorted = Object.entries(counter).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    tbody.innerHTML = sorted.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Sin ventas en el periodo</td></tr>' : sorted.map(([name, d], i) => '<tr><td>' + (i + 1) + '</td><td>' + name + '</td><td>' + d.qty + '</td><td><strong>' + formatPrice(d.total) + '</strong></td></tr>').join('');
}

function renderStockAlerts() {
    const tbody = document.getElementById('dashStockAlerts');
    if (!tbody) return;
    const alerts = posProducts.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 10);
    tbody.innerHTML = alerts.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">Sin alertas de stock</td></tr>' : alerts.map(p => {
        const tag = p.stock <= 0 ? 'tag-danger' : 'tag-warning';
        const text = p.stock <= 0 ? 'Agotado' : 'Stock Bajo';
        return '<tr><td>' + p.name + '</td><td><strong>' + p.stock + '</strong></td><td><span class="tag ' + tag + '">' + text + '</span></td></tr>';
    }).join('');
}

function renderTopCustomers(allSales) {
    const tbody = document.getElementById('dashTopCustomers');
    if (!tbody) return;
    const counter = {};
    allSales.forEach(s => {
        const key = s.customer || 'Mostrador';
        counter[key] = counter[key] || { count: 0, total: 0 };
        counter[key].count++;
        counter[key].total += s.total;
    });
    const sorted = Object.entries(counter).filter(([k]) => k !== 'Mostrador').sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    tbody.innerHTML = sorted.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Sin clientes registrados</td></tr>' : sorted.map(([name, d], i) => '<tr><td>' + (i + 1) + '</td><td>' + name + '</td><td>' + d.count + '</td><td><strong>' + formatPrice(d.total) + '</strong></td></tr>').join('');
}

function renderDashSummary(periodSales, salesData, paidTotal) {
    const el = document.getElementById('dashSummary');
    if (!el) return;
    const totalQty = periodSales.reduce((s, v) => s + v.items.reduce((a, i) => a + i.qty, 0), 0);
    const avgItems = periodSales.length > 0 ? totalQty / periodSales.length : 0;
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;">' +
        '<div style="background:var(--bg);padding:14px;border-radius:10px;text-align:center;"><div style="font-size:22px;font-weight:700;">' + periodSales.length + '</div><div style="font-size:12px;color:var(--text-muted);">Ventas</div></div>' +
        '<div style="background:var(--bg);padding:14px;border-radius:10px;text-align:center;"><div style="font-size:22px;font-weight:700;">' + totalQty + '</div><div style="font-size:12px;color:var(--text-muted);">Unidades vendidas</div></div>' +
        '<div style="background:var(--bg);padding:14px;border-radius:10px;text-align:center;"><div style="font-size:22px;font-weight:700;">' + formatPrice(paidTotal) + '</div><div style="font-size:12px;color:var(--text-muted);">Cobrado</div></div>' +
        '<div style="background:var(--bg);padding:14px;border-radius:10px;text-align:center;"><div style="font-size:22px;font-weight:700;">' + avgItems.toFixed(1) + '</div><div style="font-size:12px;color:var(--text-muted);">Items x venta</div></div>' +
    '</div>';
}

function renderRecentSales(periodSales) {
    const tbody = document.getElementById('dashRecentSales');
    if (!tbody) return;
    const recent = periodSales.slice(-10).reverse();
    tbody.innerHTML = recent.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">Sin ventas en el periodo</td></tr>' : recent.map(s => '<tr><td><strong>#' + s.id + '</strong></td><td>' + shortDate(s.date) + '</td><td>' + (s.customer || 'Mostrador') + '</td><td>' + s.items.reduce((a, i) => a + i.qty, 0) + '</td><td><strong>' + formatPrice(s.total) + '</strong></td><td>' + (s.creditInfo ? '<span class="tag tag-warning">' + s.method + '</span>' : '<span class="tag tag-info">' + s.method + '</span>') + '</td></tr>').join('');
}

function renderSalesTable() {
    const q = document.getElementById('salesSearch').value.toLowerCase().trim();
    const tipoFilter = document.getElementById('salesTipoFilter')?.value || 'all';
    let filtered = [...posSales].reverse();
    if (tipoFilter !== 'all') {
        filtered = filtered.filter(s => tipoFilter === 'local' ? !s.ventaPorFuera : s.ventaPorFuera);
    }
    if (q) filtered = filtered.filter(s => s.id.toString().includes(q) || (s.customer && s.customer.toLowerCase().includes(q)));
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
        const tipoLabel = s.ventaPorFuera ? '<span class="tag tag-warning" style="font-size:10px;">Fuera</span>' : '<span class="tag tag-success" style="font-size:10px;">Local</span>';
        const hasPending = s.creditInfo && (s.creditInfo.tipo === 'abono' ? (s.creditInfo.payments.reduce((a,p) => a + p.amount, 0) < s.creditInfo.balance) : (s.creditInfo.pagadas < s.creditInfo.totalCuotas));
        return '<tr>' +
            '<td><strong>#' + s.id + '</strong></td>' +
            '<td>' + formatDate(s.date) + '</td>' +
            '<td>' + (s.customer || 'Mostrador') + '</td>' +
            '<td>' + tipoLabel + '</td>' +
            '<td>' + qty + '</td>' +
            '<td><strong>' + formatPrice(s.total) + '</strong></td>' +
            '<td>' + methodHtml + '</td>' +
            '<td class="actions">' +
                (hasPending ? '<button class="edit" onclick="openPaymentModal(' + s.id + ')" title="Registrar Pago" style="color:var(--success);"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : '') +
                '<button onclick="showReceipt(' + JSON.stringify(s).replace(/"/g, '&quot;') + ')" title="Ver recibo"><svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg></button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function showReceipt(sale) {
    if (typeof sale === 'string') sale = JSON.parse(sale);
    const content = document.getElementById('receiptContent');
    const itemsHtml = sale.items.map(i => '<div class="receipt-row"><span>' + (i.name || 'Producto').substring(0,22) + ' x' + i.qty + '</span><span>' + formatPrice(i.price * i.qty) + '</span></div>').join('');
    const badge = sale.ventaPorFuera ? '<div style="font-size:11px;color:var(--warning);text-align:center;margin:4px 0;">VENTA POR FUERA</div>' : '';
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
                <img src="Logo_Factura.png" style="max-width:160px;height:auto;margin-bottom:4px;" alt="Vida Sana">
                <h4>VIDA SANA</h4>
                <p>Santa Marta, Colombia<br>NIT: 1082954847-4</p>
                <p style="font-size:11px;margin-top:2px;">${shortDate(sale.date)}</p>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Venta #${sale.id}</span><span>${sale.method}</span></div>
            <div class="receipt-row"><span>Cliente: ${sale.customer || 'Mostrador'}</span></div>
            ${badge}
            <div class="receipt-divider"></div>
            ${itemsHtml}
            <div class="receipt-divider"></div>
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
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Venta #' + saleId + '</span><span>' + formatPrice(sale.total) + '</span></div>';
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
        API.addPayment(sale.apiId || saleId, Math.round(amount), 'Pago registrado desde POS Global').catch(e => { console.error('[POS-GLOBAL] addPayment error:', e); });
    }
    closePaymentModal();
    refreshCustHistory();
    renderSalesTable();
    renderDashboard();
    showToast('Pago registrado con exito');
}

// ============ INIT ============
POS_PANEL_RENDERERS['dashboard'] = renderDashboard;
POS_PANEL_RENDERERS['customers'] = renderCustomerTable;
POS_PANEL_RENDERERS['sales'] = renderSalesTable;
POS_PANEL_RENDERERS['inventory'] = renderInventory;

function initPOS() {
    (async function() {
        if (currentUser && currentUser.role !== 'admin') {
            alert('Acceso denegado. Solo administradores pueden acceder al POS Global.');
            logout();
            return;
        }
        console.log('[POS-GLOBAL] initPOS iniciando...');
        const available = await API.check();
        if (available) {
            await syncFromApi();
        } else {
            loadData();
        }
        initCatFilter();
        migrateProductSubcats();
        renderDashboard();
        renderCustomerTable();
        renderSalesTable();
        renderInventory();
        buildMobileMenu();
    })();
}