const renderDocs = () => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Technical Documentation</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #030712; --card: #0f172a; --primary: #38bdf8; --border: rgba(255, 255, 255, 0.05); --error: #ef4444; }
            body { font-family: 'Inter', sans-serif; background: var(--bg); color: #94a3b8; margin: 0; line-height: 1.6; }
            .nav-header { position: fixed; top: 0; width: 100%; padding: 15px 40px; display: flex; align-items: center; border-bottom: 1px solid var(--border); background: rgba(3, 7, 18, 0.8); backdrop-filter: blur(10px); z-index: 100; }
            .container { max-width: 900px; margin: 100px auto; padding: 0 20px; }
            h1, h2, h3 { color: white; letter-spacing: -0.5px; }
            h1 { font-size: 2.5rem; margin-bottom: 10px; }
            .section { margin-bottom: 60px; padding-bottom: 40px; border-bottom: 1px solid var(--border); }
            .pro-box { background: rgba(17, 24, 39, 0.5); border: 1px solid var(--border); padding: 25px; border-radius: 16px; margin-top: 20px; }
            .pro-box h3 { margin-top: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: var(--primary); }
            .transfer-container { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
            input { background: #000; border: 1px solid #1e293b; color: white; padding: 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
            .btn-transfer { background: var(--primary); color: #030712; border: none; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; margin-top: 15px; width: 100%; }
            #trans_res { margin-top: 15px; padding: 12px; border-radius: 8px; display: none; font-size: 0.85rem; font-weight: 600; text-align: center; }
            code { font-family: 'JetBrains Mono', monospace; background: #000; color: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.9rem; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .feature-card { border: 1px solid var(--border); padding: 20px; border-radius: 12px; transition: 0.3s; }
            .feature-card b { color: white; display: block; margin-bottom: 5px; }
            .warning-box { border-left: 4px solid var(--error); background: rgba(239, 68, 68, 0.05); padding: 20px; color: #fca5a5; border-radius: 0 12px 12px 0; margin: 20px 0; }
            footer { text-align: center; padding: 40px; font-size: 0.8rem; }
            .back-link { text-decoration: none; color: var(--primary); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <nav class="nav-header">
            <a href="/stunbot/verify" style="text-decoration:none; color:white; font-weight:800;"><i class="fas fa-bolt" style="color:var(--primary)"></i> STUNBOT<span style="color:var(--primary)">DOCS</span></a>
        </nav>
        <div class="container">
            <a href="/stunbot/verify" class="back-link"><i class="fas fa-arrow-left"></i> Volver al Estado</a>
            <h1>Documentación Técnica</h1>
            
            <div class="section">
                <div class="pro-box" style="border: 1px solid var(--primary); background: rgba(56, 189, 248, 0.03);">
                    <h3><i class="fas fa-exchange-alt"></i> Gestión de Nodo (Cambio de JID)</h3>
                    <p style="color: #cbd5e1; font-size: 0.9rem;">Traslade su licencia a un nuevo número de WhatsApp de forma instantánea.</p>
                    <div class="transfer-container">
                        <input type="text" id="trans_key" placeholder="LICENCIA (STUNBOT-...)">
                        <input type="text" id="trans_jid" placeholder="NUEVO NÚMERO (519XXXXXXXX)">
                    </div>
                    <button class="btn-transfer" onclick="changeJid()">EJECUTAR CAMBIO DE NODO SEGURO</button>
                    <div id="trans_res"></div>
                </div>
            </div>

            <div class="section">
                <h2><i class="fas fa-shield-check"></i> Seguridad de Licenciamiento</h2>
                <div class="warning-box">
                    <i class="fas fa-exclamation-circle"></i> <b>Bloqueo por JID:</b> La licencia está vinculada estrictamente al número autorizado.
                </div>
                <div class="grid">
                    <div class="feature-card">
                        <i class="fas fa-heartbeat" style="color:var(--primary)"></i><b>Heartbeat Protocol</b>
                        El bot realiza una verificación silenciosa cada <code>5 HORAS</code> con el servidor Oracle Cloud.
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-sync" style="color:var(--primary)"></i><b>Hot Reload</b>
                        Detección de cambios en la carpeta <code>/plugins</code> en tiempo real sin reiniciar sesión.
                    </div>
                </div>
            </div>

            <div class="section">
                <h2><i class="fas fa-comments"></i> Feedback de la Comunidad</h2>
                <div class="pro-box" style="background: rgba(255,255,255,0.02);">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <input type="text" id="comm_name" placeholder="Tu Nombre" style="flex: 1;">
                        <input type="text" id="comm_text" placeholder="Escribe un comentario..." style="flex: 2;">
                        <button onclick="postComment()" style="width: auto; padding: 0 20px; background: var(--primary); color: #000; border-radius: 8px; border: none; font-weight: 800; cursor: pointer;">ENVIAR</button>
                    </div>
                    <div id="comments_list"></div>
                </div>
            </div>

            <footer>&copy; 2025 StunBot Infrastructure. Operaciones Privadas AES-256.</footer>
        </div>

        <script>
            async function changeJid() {
                const key = document.getElementById('trans_key').value;
                const jid = document.getElementById('trans_jid').value;
                const resDiv = document.getElementById('trans_res');
                if(!key || !jid) return alert('Complete los campos');
                resDiv.style.display = 'block'; resDiv.innerHTML = 'PROCESANDO...';
                try {
                    const response = await fetch('/stunbot/change-jid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ license_key: key, new_jid: jid }) });
                    const data = await response.json();
                    resDiv.style.background = data.valid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                    resDiv.style.color = data.valid ? '#34d399' : '#f87171';
                    resDiv.innerHTML = data.message.toUpperCase();
                } catch (e) { resDiv.innerHTML = 'ERROR DE CONEXIÓN'; }
            }

            async function loadComments() {
                try {
                    const res = await fetch('/stunbot/api/comments');
                    const data = await res.json();
                    document.getElementById('comments_list').innerHTML = data.map(c => \`
                        <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 0; text-align:left;">
                            <b style="color:white; font-size:0.9rem;">\${c.name}</b>
                            <p style="margin:0; font-size:0.85rem; color:#cbd5e1;">\${c.content}</p>
                        </div>
                    \`).join('');
                } catch (e) {}
            }

            async function postComment() {
                const name = document.getElementById('comm_name').value;
                const text = document.getElementById('comm_text').value;
                if(!name || !text) return;
                await fetch('/stunbot/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, content: text }) });
                document.getElementById('comm_text').value = ''; loadComments();
            }
            loadComments();
        </script>
    </body>
    </html>
    `;
};
module.exports = { renderDocs };