const renderVerify = (data) => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Service Status</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #030712; --card: rgba(17, 24, 39, 0.7); --primary: #38bdf8; --success: #10b981; --error: #ef4444; --border: rgba(255, 255, 255, 0.1); }
            body { font-family: 'Inter', sans-serif; background: var(--bg); background-image: radial-gradient(circle at 50% -20%, #1e293b, var(--bg)); color: white; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
            .nav-header { position: absolute; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; border-bottom: 1px solid var(--border); background: rgba(3, 7, 18, 0.5); backdrop-filter: blur(10px); z-index: 10; }
            .logo { font-weight: 800; font-size: 1.2rem; letter-spacing: -1px; display: flex; align-items: center; gap: 8px; color: white; text-decoration: none; }
            .system-time { font-family: monospace; color: var(--primary); font-size: 0.9rem; background: rgba(56, 189, 248, 0.1); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.2); }
            .main-card { background: var(--card); backdrop-filter: blur(12px); padding: 40px; border-radius: 24px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid var(--border); text-align: center; z-index: 5; }
            .status-dots { display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; font-size: 0.8rem; color: #94a3b8; }
            .dot-item { display: flex; align-items: center; gap: 6px; }
            .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            .uptime-timeline { display: flex; gap: 4px; margin: 20px 0; justify-content: center; align-items: flex-end; height: 25px; }
            .bar { width: 5px; height: 18px; background: var(--success); border-radius: 10px; }
            .bar.active { background: var(--success); box-shadow: 0 0 5px rgba(16, 185, 129, 0.4); }
            input { width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid var(--border); background: rgba(0,0,0,0.4); color: white; font-size: 1rem; margin-bottom: 15px; box-sizing: border-box; text-align: center; }
            button { width: 100%; padding: 14px; border-radius: 12px; border: none; background: white; color: black; font-weight: 700; cursor: pointer; transition: 0.2s; }
            button:hover { background: var(--primary); color: white; transform: translateY(-2px); }
            .stats-info { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; border-top: 1px solid var(--border); padding-top: 25px; }
            .label { font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 800; }
            .value { font-size: 0.85rem; color: #f1f5f9; font-family: monospace; }
            #result { margin-top: 20px; padding: 15px; border-radius: 12px; display: none; font-size: 0.85rem; font-weight: 600; }
            .active-res { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
            .inactive-res { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
            footer { position: absolute; bottom: 30px; color: #4b5563; font-size: 0.75rem; display: flex; gap: 25px; }
            footer a { color: #64748b; text-decoration: none; }
        </style>
    </head>
    <body>
        <nav class="nav-header">
            <a href="/stunbot/verify" class="logo"><i class="fas fa-bolt" style="color: var(--primary)"></i> STUNBOT<span style="color: var(--primary)">CLOUD</span></a>
            <div class="system-time" id="clock">00:00:00 UTC</div>
        </nav>
        <div class="main-card">
            <div class="status-dots">
                <div class="dot-item"><div class="dot"></div> API</div>
                <div class="dot-item"><div class="dot"></div> DB</div>
                <div class="dot-item"><div class="dot"></div> NODES</div>
            </div>
            <h1>License Status</h1>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-top: -5px; margin-bottom: 20px;">Cluster: Oracle-Cloud-Ashburn-1</p>
            <div class="uptime-timeline">${data.barHtml}</div>
            <input type="text" id="licenseKey" placeholder="STUNBOT-XXXX-XXXX">
            <button onclick="checkLicense()">VALIDATE AUTHORIZATION</button>
            <div id="result"></div>
            <div class="stats-info">
                <div class="stat-group"><div class="label">Server Uptime</div><div class="value">${data.hours}h ${data.minutes}m ${data.seconds}s</div></div>
                <div class="stat-group"><div class="label">Network Latency</div><div id="pingValue" class="value" style="color: var(--primary)">-- ms</div></div>
                <div class="stat-group"><div class="label">Your Endpoint IP</div><div class="value">${data.cleanIP}</div></div>
                <div class="stat-group"><div class="label">Encryption</div><div class="value" style="color: var(--success)">AES-256 SSL</div></div>
            </div>
        </div>
        <footer>
            <span>&copy; 2025 StunBot Infrastructure</span>
            <a href="/stunbot/docs">Manual de Uso</a>
            <a href="/stunbot/store">Tienda</a>
        </footer>
        <script>
            function updateClock() {
                const now = new Date();
                document.getElementById('clock').innerText = now.getUTCHours().toString().padStart(2, '0') + ':' + now.getUTCMinutes().toString().padStart(2, '0') + ':' + now.getUTCSeconds().toString().padStart(2, '0') + ' UTC';
            }
            setInterval(updateClock, 1000); updateClock();
            async function checkLicense() {
                const key = document.getElementById('licenseKey').value;
                const resDiv = document.getElementById('result');
                const pingVal = document.getElementById('pingValue');
                if(!key) return;
                resDiv.style.display = 'block'; resDiv.innerHTML = 'INTERROGATING...'; resDiv.className = '';
                const start = performance.now();
                try {
                    const response = await fetch('/stunbot/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ license_key: key }) });
                    const end = performance.now(); pingVal.innerText = Math.round(end - start) + ' ms';
                    const data = await response.json();
                    if (data.valid) { resDiv.className = 'active-res'; resDiv.innerHTML = 'ACCESS GRANTED - LICENSE ACTIVE'; }
                    else { resDiv.className = 'inactive-res'; resDiv.innerHTML = data.message.toUpperCase(); }
                } catch (err) { resDiv.className = 'inactive-res'; resDiv.innerHTML = 'NETWORK ERROR'; }
            }
        </script>
    </body>
    </html>
    `;
};
module.exports = { renderVerify };