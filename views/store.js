const renderStore = () => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Digital Store</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #030712; --card: #0f172a; --primary: #38bdf8; --border: rgba(255, 255, 255, 0.05); }
            body { font-family: 'Inter', sans-serif; background: var(--bg); color: white; margin: 0; }
            .container { max-width: 1100px; margin: 80px auto; padding: 20px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px; }
            
            .product-info h1 { font-size: 3rem; margin: 0; }
            .badge { background: var(--primary); color: #000; padding: 5px 12px; border-radius: 20px; font-weight: 800; font-size: 0.7rem; }
            
            .checkout-card { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; position: sticky; top: 100px; }
            .payment-methods { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 20px 0; }
            .method { border: 1px solid #1e293b; padding: 15px; border-radius: 12px; cursor: pointer; text-align: center; transition: 0.3s; grayscale: 100%; opacity: 0.6; }
            .method:hover, .method.active { border-color: var(--primary); grayscale: 0; opacity: 1; background: rgba(56, 189, 248, 0.05); }
            .method img { width: 40px; height: 40px; object-fit: contain; margin-bottom: 5px; }
            .method span { display: block; font-size: 0.7rem; font-weight: 700; }

            .payment-details { background: #000; padding: 20px; border-radius: 16px; margin-top: 20px; display: none; }
            .qr-box { text-align: center; margin-bottom: 15px; }
            .qr-box img { width: 150px; border-radius: 10px; }

            .btn-verify { background: var(--primary); color: #000; width: 100%; padding: 15px; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; margin-top: 10px; }
            input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #1e293b; background: #000; color: white; margin-bottom: 10px; box-sizing: border-box; }
        
        
            /* Modal de Éxito (Licencia) */
            .success-modal { 
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(3, 7, 18, 0.9); backdrop-filter: blur(10px); 
                justify-content: center; align-items: center; z-index: 2000; 
            }
            .success-content { 
                background: var(--card); padding: 40px; border-radius: 28px; border: 1px solid var(--primary); 
                max-width: 450px; width: 90%; text-align: center; box-shadow: 0 0 50px rgba(56, 189, 248, 0.2); 
                animation: slideUp 0.5s ease-out;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

            .license-display { 
                background: #000; border: 1px dashed var(--primary); padding: 20px; 
                border-radius: 12px; font-family: 'JetBrains Mono', monospace; 
                font-size: 1.2rem; color: var(--primary); margin: 20px 0; 
                display: flex; justify-content: space-between; align-items: center;
            }
            .btn-copy { background: none; border: none; color: white; cursor: pointer; font-size: 1rem; }
            .btn-copy:hover { color: var(--primary); }

            .download-info { font-size: 0.8rem; color: #94a3b8; margin-top: 15px; }


        
            </style>
    </head>
    <body>
        <div class="container">
            <div class="product-info">
                <span class="badge">SISTEMA PRIVADO</span>
                <h1>StunBot Pro License</h1>
                <p style="color:#94a3b8; font-size: 1.2rem;">Licencia vitalicia con acceso a todos los módulos de automatización, encriptación AES-256 y soporte técnico 24/7.</p>
                
                <div style="margin-top:40px;">
                    <h3 style="color:white;"><i class="fas fa-layer-group"></i> ¿Qué incluye?</h3>
                    <ul style="color:#94a3b8; padding-left:20px;">
                        <li>Protocolo Anti-Ban Baileys optimizado.</li>
                        <li>Dashboard de estado y cambio de JID manual.</li>
                        <li>Filtro de grupos y logs en tiempo real.</li>
                    </ul>
                </div>
            </div>

            <div class="checkout-card">
                <div style="font-size: 0.8rem; color: #64748b;">TOTAL A PAGAR</div>
                <div style="font-size: 2.5rem; font-weight: 800;">$10.00 <span style="font-size: 1rem; color: #4b5563;">USD</span></div>

                <div class="payment-methods">
                    <div class="method" id="m-paypal" onclick="selectMethod('paypal')">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174861.png">
                        <span>PayPal</span>
                    </div>
                    <div class="method" id="m-binance" onclick="selectMethod('binance')">
                        <img src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png">
                        <span>Binance</span>
                    </div>
                    <div class="method" id="m-yape" onclick="selectMethod('yape')">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/Yape_logo.png">
                        <span>Yape</span>
                    </div>
                </div>

                <!-- Contenedor dinámico según el pago -->
                <div id="paypal-container" class="payment-details">
                    <div id="paypal-button-container"></div>
                </div>

                <div id="manual-container" class="payment-details">
                    <div class="qr-box">
                        <img id="qr-img" src="">
                        <p id="qr-text" style="font-size:0.8rem; margin-top:10px;"></p>
                    </div>
                    <input type="text" id="p_email" placeholder="Tu Email">
                    <input type="text" id="p_ref" placeholder="Número de Operación / Ref">
                    <button class="btn-verify" onclick="submitManual()">NOTIFICAR PAGO</button>
                </div>
            </div>
        </div>


        <!-- Modal de Éxito -->
<div id="successModal" class="success-modal">
    <div class="success-content">
        <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success); margin-bottom: 20px;"></i>
        <h2 style="margin:0;">¡PAGO COMPLETADO!</h2>
        <p style="color: #94a3b8;">Tu licencia ha sido generada con éxito. Guárdala en un lugar seguro.</p>
        
        <div class="license-display">
            <span id="finalLicense">STUNBOT-XXXX-XXXX</span>
            <button class="btn-copy" onclick="copyLicense()" title="Copiar Licencia">
                <i class="fas fa-copy"></i>
            </button>
        </div>

        <button class="btn-verify" onclick="window.location.href='/docs'">IR A LA DOCUMENTACIÓN</button>
        
        <div class="download-info">
            <i class="fas fa-download"></i> Descargando archivos del bot automáticamente...
        </div>
    </div>
</div>


        <script src="https://www.paypal.com/sdk/js?client-id=AfPhvtfJzqyKy3Wqsfpl4c-IxTOfhiv9L434Q0yf5ZFnhSuZb8ZJLHubj5t71-mWI7vMtshHn71_Sk5M&currency=USD"></script>
        <script>
    let currentMethod = '';

    // Función para seleccionar el método de pago (Yape, Binance, PayPal)
    function selectMethod(method) {
        currentMethod = method;
        document.querySelectorAll('.method').forEach(m => m.classList.remove('active'));
        document.getElementById('m-' + method).classList.add('active');
        
        document.getElementById('paypal-container').style.display = 'none';
        document.getElementById('manual-container').style.display = 'none';

        if(method === 'paypal') {
            document.getElementById('paypal-container').style.display = 'block';
        } else {
            document.getElementById('manual-container').style.display = 'block';
            if(method === 'yape') {
                document.getElementById('qr-img').src = 'URL_DE_TU_QR_YAPE';
                document.getElementById('qr-text').innerText = 'Yapear a: 9XXXXXXXX (Tu Nombre)';
            } else {
                document.getElementById('qr-img').src = 'URL_DE_TU_QR_BINANCE';
                document.getElementById('qr-text').innerText = 'Binance ID: 123456789';
            }
        }
    }

    // Lógica de PayPal (Botón Automático)
    paypal.Buttons({
        createOrder: (data, actions) => {
            return actions.order.create({
                purchase_units: [{ amount: { value: '10.00' } }]
            });
        },
        onApprove: (data, actions) => {
            return actions.order.capture().then(async (details) => {
                const res = await fetch('/api/checkout/success', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        method: 'paypal', 
                        orderID: data.orderID, 
                        email: details.payer.email_address 
                    })
                });
                const result = await res.json();
                if(result.success) {
                    showSuccess(result.license);
                }
            });
        }
    }).render('#paypal-button-container');

    // Función para mostrar el Modal de Éxito y descargar el Bot
    function showSuccess(license) {
        // Ocultar selectores de pago
        document.getElementById('paypal-container').style.display = 'none';
        document.getElementById('manual-container').style.display = 'none';
        
        // Mostrar Modal de éxito
        document.getElementById('successModal').style.display = 'flex';
        document.getElementById('finalLicense').innerText = license;

        // Iniciar descarga automática
        const downloadLink = document.createElement('a');
        downloadLink.href = '/download/StunBot_V2.zip'; 
        downloadLink.download = 'StunBot_V2.zip';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    // Función para copiar la licencia al portapapeles
    function copyLicense() {
        const licenseText = document.getElementById('finalLicense').innerText;

        // Intentar primero con el método moderno (requiere HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(licenseText).then(() => {
                showCheckIcon();
            }).catch(() => {
                fallbackCopy(licenseText); // Si falla, usar el método antiguo
            });
        } else {
            // Método antiguo para conexiones no seguras (HTTP / IPs)
            fallbackCopy(licenseText);
        }
    }

    // Método de respaldo compatible con todo (Crea un campo de texto invisible, lo copia y lo borra)
    function fallbackCopy(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Asegurarse de que no sea visible
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.select();
        try {
            document.execCommand('copy');
            showCheckIcon();
        } catch (err) {
            alert('No se pudo copiar automáticamente. Por favor, selecciona el texto manualmente.');
        }
        document.body.removeChild(textArea);
    }

    // Función para cambiar el icono a un "check" verde
    function showCheckIcon() {
        const btnIcon = document.querySelector('.btn-copy i');
        const originalClass = btnIcon.className;
        
        btnIcon.className = 'fas fa-check';
        btnIcon.style.color = '#10b981'; // Color verde éxito
        
        setTimeout(() => {
            btnIcon.className = originalClass;
            btnIcon.style.color = ''; // Volver al color original
        }, 2000);
    }

    // Lógica para pagos manuales (Yape/Binance)
    async function submitManual() {
        const email = document.getElementById('p_email').value;
        const ref = document.getElementById('p_ref').value;
        if(!email || !ref) return alert('Completa los datos');

        const res = await fetch('/api/checkout/manual', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ method: currentMethod, email, reference: ref })
        });
        alert('Pago enviado a revisión. Te contactaremos al email.');
    }
</script>
    </body>
    </html>
    `;
};
module.exports = { renderStore };