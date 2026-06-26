// ============ Cash History ============
let cashHistory = [];
function loadCashHistory() {
    try { cashHistory = JSON.parse(localStorage.getItem('cashHistory_' + cashDateStr())) || []; } catch(e) { cashHistory = []; }
}
function saveCashHistory() { localStorage.setItem('cashHistory_' + cashDateStr(), JSON.stringify(cashHistory)); }
function addCashHistoryEntry(type, description, amount) {
    const balance = availableCash();
    cashHistory.unshift({
        timestamp: nowLocal(),
        type: type,
        description: description,
        amount: amount,
        balance: balance
    });
    saveCashHistory();
}
function renderCashHistory() {
    loadCashHistory();
    const tbody = document.getElementById('cashHistoryBody');
    if (!tbody) return;
    if (cashHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Sin movimientos</td></tr>';
        return;
    }
    const typeLabels = { base: 'Base', expense: 'Gasto', sale: 'Venta', refund: 'Devolucion' };
    tbody.innerHTML = cashHistory.map(e => {
        const d = new Date(e.timestamp);
        const str = d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
        const typeClass = e.type === 'sale' ? 'color:var(--success)' : e.type === 'expense' ? 'color:var(--danger)' : 'color:var(--primary)';
        return '<tr><td style="font-size:12px;">' + str + '</td><td><span style="' + typeClass + ';font-weight:600;font-size:12px;">' + (typeLabels[e.type] || e.type) + '</span></td><td style="font-size:12px;">' + e.description + '</td><td style="font-weight:600;">$' + (parseFloat(e.amount)||0).toLocaleString('es-CO') + '</td><td style="font-weight:500;">$' + (parseFloat(e.balance)||0).toLocaleString('es-CO') + '</td></tr>';
    }).join('');
}
function clearCashHistory() {
    if (!confirm('Limpiar historial de caja?')) return;
    cashHistory = [];
    saveCashHistory();
    renderCashHistory();
    showToast('Historial limpiado');
}
