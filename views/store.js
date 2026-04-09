const renderStore = () => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Digital Store</title>
        
        <!-- Librerías Externas -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        
        <!-- SDK de Tebex (Modal Hytale) -->
        <script src="https://js.tebex.io/"></script>

        <style>
            :root { --bg: #030712; --card: #0f172a; --primary: #38bdf8; --success: #10b981; --border: rgba(255, 255, 255, 0.05); }
            
            body { 
                font-family: 'Inter', sans-serif; background: var(--bg); color: white; margin: 0; 
                background-image: radial-gradient(circle at 50% -20%, #1e293b, var(--bg));
                min-height: 100vh; display: flex; flex-direction: column;
            }
            
            .nav-header { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: rgba(3, 7, 18, 0.5); backdrop-filter: blur(10px); z-index: 100; }
            .logo { font-weight: 800; font-size: 1.2rem; letter-spacing: -1px; color: white; text-decoration: none; }

            .container { 
                max-width: 1000px; margin: auto; padding: 40px 20px; 
                display: grid; grid-template-columns: 1fr 400px; gap: 60px; align-items: center; 
            }
            
            .product-info h1 { font-size: 3.5rem; margin: 0; font-weight: 800; letter-spacing: -2px; line-height: 1.1; }
            .badge { display: inline-block; background: rgba(56, 189, 248, 0.1); color: var(--primary); padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; border: 1px solid rgba(56, 189, 248, 0.2); margin-bottom: 15px; }
            
            .checkout-card { 
                background: var(--card); border: 1px solid var(--border); padding: 40px; border-radius: 32px; 
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center;
            }
            
            .price-tag { font-size: 3rem; font-weight: 800; margin: 10px 0; color: white; }
            .price-tag span { font-size: 1rem; color: #4b5563; font-weight: 400; }

            .btn-tebex { 
                background: white; color: black; width: 100%; padding: 18px; border: none; 
                border-radius: 16px; font-weight: 800; cursor: pointer; margin-top: 20px; 
                transition: 0.3s; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 12px;
                text-decoration: none;
            }
            .btn-tebex:hover { background: var(--primary); color: white; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(56, 189, 248, 0.2); }
            
            .trust-badges { margin-top: 30px; display: flex; justify-content: center; gap: 15px; opacity: 0.4; font-size: 1.5rem; }

            /* Modal de Éxito */
            .success-modal { 
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(3, 7, 18, 0.98); backdrop-filter: blur(15px); 
                justify-content: center; align-items: center; z-index: 2000; 
            }
            .success-content { 
                background: #111827; padding: 50px; border-radius: 32px; border: 1px solid var(--primary); 
                max-width: 450px; width: 90%; text-align: center; animation: slideUp 0.4s ease-out;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

            .license-display { 
                background: #000; border: 1px dashed var(--primary); padding: 25px; 
                border-radius: 16px; font-family: 'JetBrains Mono', monospace; 
                font-size: 1.2rem; color: var(--primary); margin: 25px 0; 
                display: flex; justify-content: space-between; align-items: center;
            }
            .btn-copy { background: none; border: none; color: white; cursor: pointer; font-size: 1.3rem; transition: 0.2s; }
            .btn-copy:hover { color: var(--primary); }

            footer { text-align: center; padding: 40px; border-top: 1px solid var(--border); margin-top: auto; font-size: 0.8rem; color: #4b5563; }
            footer a { color: #64748b; text-decoration: none; margin: 0 15px; transition: 0.2s; }
            footer a:hover { color: white; }

            /* ==========================================
               RESPONSIVE DESIGN (MÓVILES Y TABLETS)
            ========================================== */
            @media (max-width: 992px) {
                .container { 
                    grid-template-columns: 1fr; 
                    text-align: center; 
                    gap: 40px;
                    padding-top: 100px;
                }
                .product-info h1 { font-size: 2.8rem; }
                .checkout-card { margin: auto; width: 100%; max-width: 450px; box-sizing: border-box; }
                .product-info div { justify-content: center; } /* Centrar lista de beneficios */
            }

            @media (max-width: 600px) {
                .nav-header { padding: 15px 20px; }
                .product-info h1 { font-size: 2.2rem; }
                .price-tag { font-size: 2.5rem; }
                .success-content { padding: 30px 20px; }
                .license-display { font-size: 1rem; padding: 15px; }
                footer { display: flex; flex-direction: column; gap: 15px; }
            }
        </style>
    </head>
    <body>
        <nav class="nav-header">
            <a href="/stunbot/verify" class="logo"><i class="fas fa-bolt" style="color: var(--primary)"></i> STUNBOT<span style="color: var(--primary)">CLOUD</span></a>
            <div>
                <a href="/stunbot/docs" style="color: white; text-decoration: none; font-size: 0.9rem; font-weight: 600;">Docs</a>
            </div>
        </nav>

        <div class="container">
            <div class="product-info">
                <span class="badge">Licencia Vitalicia</span>
                <h1>StunBot Pro</h1>
                <p style="color:#94a3b8; font-size: 1.15rem; line-height: 1.6; margin-top: 20px;">
                    Acceda a la infraestructura de automatización de WhatsApp más potente. 
                    Encriptación de grado militar, Hot-Reload y sistema de colas inteligente.
                </p>
                
                <div style="margin-top:40px; display: grid; gap: 15px;">
                    <div style="display:flex; align-items:center; gap:12px; color:#cbd5e1;">
                        <i class="fas fa-check-circle" style="color:var(--success)"></i> <span>Protocolo Anti-Ban Baileys V6</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; color:#cbd5e1;">
                        <i class="fas fa-check-circle" style="color:var(--success)"></i> <span>Dashboard de Gestión de JID</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; color:#cbd5e1;">
                        <i class="fas fa-check-circle" style="color:var(--success)"></i> <span>Soporte Técnico Especializado</span>
                    </div>
                </div>
            </div>

            <div class="checkout-card">
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Pago Único</div>
                <div class="price-tag">$10.00 <span>USD</span></div>
                
                <p style="color: #94a3b8; font-size: 0.85rem; margin: 20px 0;">
                    La licencia se generará automáticamente tras validar el pago en el cluster.
                </p>

                <button class="btn-tebex" onclick="startCheckout()">
                    <i class="fas fa-shopping-cart"></i> ADQUIRIR LICENCIA AHORA
                </button>

                <div class="trust-badges">
                    <i class="fab fa-cc-paypal"></i>
                    <i class="fab fa-cc-visa"></i>
                    <i class="fab fa-cc-mastercard"></i>
                    <i class="fab fa-cc-apple-pay"></i>
                    <i class="fab fa-bitcoin"></i>
                </div>
                <div style="font-size: 0.65rem; color: #4b5563; margin-top: 10px;">Procesado de forma segura por Tebex</div>
            </div>
        </div>

        <!-- Modal de Éxito -->
        <div id="successModal" class="success-modal">
            <div class="success-content">
                <i class="fas fa-shield-check" style="font-size: 4rem; color: var(--success); margin-bottom: 20px;"></i>
                <h2 style="margin:0; font-weight: 800;">¡PAGO EXITOSO!</h2>
                <p style="color: #94a3b8; margin-top: 10px;">Tu licencia profesional ha sido activada en el sistema.</p>
                
                <div class="license-display">
                    <span id="finalLicense">GENERANDO...</span>
                    <button class="btn-copy" onclick="copyLicense()" title="Copiar">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>

                <button class="btn-tebex" style="background: var(--primary); color: white;" onclick="window.location.href='/stunbot/docs'">
                    CONFIGURAR MI BOT
                </button>
                
                <div style="font-size: 0.75rem; color: #4b5563; margin-top: 20px;">
                    <i class="fas fa-info-circle"></i> Los archivos del bot se enviaron a tu correo.
                </div>
            </div>
        </div>

        <footer>
            <span>&copy; 2025 StunBot Infrastructure Node</span>
            <div style="margin-top: 10px;">
                <a href="/stunbot/verify">Estado</a>
                <a href="/stunbot/docs">Soporte</a>
            </div>
        </footer>

        <script>
            async function startCheckout() {
                const btn = document.querySelector('.btn-tebex');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> PROCESANDO...';
                btn.disabled = true;

                try {
                    const res = await fetch('/stunbot/create-checkout', { method: 'POST' });
                    const data = await res.json();
                    if (data.url) {
                        Tebex.checkout.open(data.url);
                    } else {
                        alert("Error al conectar con la pasarela.");
                    }
                } catch (e) {
                    alert("Error de red. Intente de nuevo.");
                } finally {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }

            function copyLicense() {
                const text = document.getElementById('finalLicense').innerText;
                const showCheck = () => {
                    const icon = document.querySelector('.btn-copy i');
                    icon.className = 'fas fa-check'; icon.style.color = '#10b981';
                    setTimeout(() => { icon.className = 'fas fa-copy'; icon.style.color = ''; }, 2000);
                };

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).then(showCheck);
                } else {
                    const area = document.createElement("textarea");
                    area.value = text; document.body.appendChild(area);
                    area.select(); document.execCommand('copy');
                    document.body.removeChild(area);
                    showCheck();
                }
            }
        </script>
    </body>
    </html>
    `;
};
module.exports = { renderStore };