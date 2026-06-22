// ============ Tools Auth - PIN 542 ============
(function() {
    const PIN = '542';
    const SESSION_KEY = 'tools_auth';
    
    // Check if already authenticated this session
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') return;
    
    // Prompt for PIN
    const input = prompt('PIN de acceso:');
    if (input === PIN) {
        sessionStorage.setItem(SESSION_KEY, 'ok');
    } else {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#0a0a0a;color:#e0e0e0;"><div style="text-align:center;"><h1 style="color:#ef4444;">Acceso denegado</h1><p>PIN incorrecto</p><button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;background:#1a1a2e;color:#e0e0e0;border:1px solid #333;border-radius:8px;cursor:pointer;">Reintentar</button></div></div>';
        throw new Error('Auth failed');
    }
})();
