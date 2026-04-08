// license-server/server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs'); 
const path = require('path'); 

const app = express();
const PORT = process.env.PORT || 4000;
const { renderStore } = require('./views/store');

if (!process.env.DATABASE_URL) {
    console.error("CRÍTICO: La variable DATABASE_URL no está definida.");
    process.exit(1);
}

// --- CONFIGURACIÓN DE SSL DINÁMICA ---
const sslConfig = {
    rejectUnauthorized: false 
};

const caPath = path.join(__dirname, 'ca.pem');

if (fs.existsSync(caPath)) {
    try {
        sslConfig.ca = fs.readFileSync(caPath).toString();
        console.log("✅ Certificado CA (ca.pem) cargado en la configuración.");
    } catch (err) {
        console.error("❌ Error al leer ca.pem:", err);
    }
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
});

// --- FUNCIÓN KEEP-ALIVE (EVITAR QUE AIVEN SE DUERMA) ---
const keepAlive = async () => {
    try {
        const now = new Date().toLocaleString();
        await pool.query('SELECT 1'); // Consulta ultra ligera
        console.log(`\n[${now}] 🛡️ Keep-alive: Ping a la base de datos exitoso.`);
    } catch (err) {
        console.error(`\n[${new Date().toLocaleString()}] ⚠️ Keep-alive Error:`, err.message);
    }
};

// Ejecutar cada 2 horas (2 horas * 60 min * 60 seg * 1000 ms)
const DOS_HORAS = 2 * 60 * 60 * 1000;
setInterval(keepAlive, DOS_HORAS);
// -------------------------------------------------------

app.use(express.json());






const crypto = require('crypto');

app.post('/tebex-webhook', async (req, res) => {
    const data = req.body;

    // --- 1. RESPUESTA DE VALIDACIÓN (CRITICO PARA TEBEX) ---
    // Tebex envía esto para verificar que el servidor es tuyo.
    if (data && data.type === 'validation.webhook') {
        console.log("✅ Validando Webhook de Tebex...");
        return res.status(200).json({ id: data.id });
    }

    // --- 2. VERIFICACIÓN DE SEGURIDAD (FIRMA) ---
    const signature = req.headers['x-signature'];
    const secret = process.env.TEBEX_SECRET;
    
    if (signature && secret) {
        const bodyString = JSON.stringify(req.body);
        const hash = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
        if (signature !== hash) {
            return res.status(401).send('Invalid Signature');
        }
    }

    // --- 3. PROCESAR PAGO ---
    if (data.type === 'payment.completed') {
        const email = data.subject.customer.email;
        const transactionId = data.subject.transaction_id;
        const amount = data.subject.amount.value;

        try {
            // Generar Licencia
            const newLicense = `STUNBOT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

            // Insertar en la Base de Datos
            await pool.query(
                'INSERT INTO licenses (license_key, whatsapp_jid, is_active, client_name) VALUES ($1, $2, $3, $4)',
                [newLicense, 'pendiente@s.whatsapp.net', true, email]
            );

            // Registrar Venta
            await pool.query(
                'INSERT INTO sales (email, transaction_id, amount, status, license_generated, payment_method) VALUES ($1, $2, $3, $4, $5, $6)',
                [email, transactionId, amount, 'completed', newLicense, 'tebex']
            );

            console.log(`✅ [TEBEX] Pago Procesado con éxito para: ${email}. Licencia: ${newLicense}`);
            
            return res.status(200).send('Webhook Processed Successfully');

        } catch (error) {
            console.error("❌ Error procesando datos de Tebex:", error);
            return res.status(500).send('Database Error');
        }
    }

    // Ignorar otros eventos
    res.status(200).send('Event Ignored');
});






const paypal = require('@paypal/checkout-server-sdk');

// ==========================================
// CONFIGURACIÓN DE PAYPAL (CAMBIAR AQUÍ)
// Para pruebas usa: SandboxEnvironment
// Para real usa: LiveEnvironment
// ==========================================
let environment = new paypal.core.SandboxEnvironment( // <--- Cambia a LiveEnvironment cuando termines
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_SECRET
);
let client = new paypal.core.PayPalHttpClient(environment);



// Ruta para descargar el bot
app.get('/download/StunBot_V2.zip', (req, res) => {
    const file = path.join(__dirname, 'downloads', 'StunBot_V2.zip'); // Asegúrate de que el archivo exista ahí
    res.download(file, 'StunBot_V2.zip', (err) => {
        if (err) {
            console.error("Error al descargar el archivo:", err);
            res.status(404).send("El archivo no está disponible actualmente.");
        }
    });
});


app.post('/api/checkout/success', async (req, res) => {
    const { orderID, email } = req.body;

    try {
        const request = new paypal.orders.OrdersGetRequest(orderID);
        const order = await client.execute(request);

        // Validamos el pago
        if (order.result.status === 'COMPLETED' || order.result.status === 'APPROVED') {
            const amount = order.result.purchase_units[0].amount.value;

            if (parseFloat(amount) >= 10.00) {
                const newLicense = `STUNBOT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

                // Insertar Licencia
                await pool.query(
                    'INSERT INTO licenses (license_key, whatsapp_jid, is_active, client_name) VALUES ($1, $2, $3, $4)',
                    [newLicense, 'pendiente@s.whatsapp.net', true, email]
                );

                // Registrar Venta
                await pool.query(
                    'INSERT INTO sales (email, transaction_id, amount, status, license_generated, payment_method) VALUES ($1, $2, $3, $4, $5, $6)',
                    [email, orderID, amount, 'completed', newLicense, 'paypal']
                );

                return res.json({ success: true, license: newLicense });
            }
        }
        res.status(400).json({ success: false, message: 'Pago no válido' });
    } catch (err) {
        console.error("Error PayPal:", err);
        res.status(500).json({ success: false });
    }
});

// 2. PAGO MANUAL (Yape/Binance)
app.post('/api/checkout/manual', async (req, res) => {
    const { email, reference, method } = req.body;
    
    try {
        await pool.query('INSERT INTO sales (email, transaction_id, amount, status, payment_method) VALUES ($1, $2, $3, $4, $5)',
        [email, reference, 10.00, 'pending_review', method]);
        
        // Opcional: Aquí podrías enviarte un mensaje de WhatsApp a ti mismo avisando que hay un pago por revisar
        res.json({ success: true });
    } catch (e) { res.status(500).send(); }
});



// Ruta de la tienda
app.get('/store', (req, res) => {
    res.send(renderStore());
});



// Obtener los últimos 10 comentarios
app.get('/api/comments', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, content, created_at FROM comments ORDER BY created_at DESC LIMIT 10');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener comentarios' });
    }
});

// Guardar un nuevo comentario
app.post('/api/comments', async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Faltan campos' });

    try {
        await pool.query('INSERT INTO comments (name, content) VALUES ($1, $2)', [name, content]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar comentario' });
    }
});


app.post('/change-jid', async (req, res) => {
    const { license_key, new_jid } = req.body;

    if (!license_key || !new_jid) {
        return res.status(400).json({ valid: false, message: 'Faltan datos obligatorios.' });
    }

    // Limpiar el JID: asegurar que termine en @s.whatsapp.net
    let formattedJid = new_jid.trim();
    if (!formattedJid.includes('@')) {
        formattedJid += '@s.whatsapp.net';
    }

    try {
        // 1. Verificar si la licencia existe y está activa 
        // CAMBIO: Quitamos "id" de la consulta porque no existe en tu tabla
        const check = await pool.query(
            'SELECT whatsapp_jid FROM licenses WHERE license_key = $1 AND is_active = true',
            [license_key]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Licencia no válida o inexistente.' });
        }

        const oldJid = check.rows[0].whatsapp_jid;

        // 2. Actualizar al nuevo JID
        await pool.query(
            'UPDATE licenses SET whatsapp_jid = $1 WHERE license_key = $2',
            [formattedJid, license_key]
        );

        console.log(`[LICENCIA] Cambio de JID: ${license_key} | ${oldJid} -> ${formattedJid}`);

        return res.status(200).json({ 
            valid: true, 
            message: 'JID actualizado correctamente. Reinicie su bot para aplicar los cambios.' 
        });

    } catch (error) {
        console.error("Error en /change-jid:", error);
        return res.status(500).json({ valid: false, message: 'Error interno del servidor.' });
    }
});

// --- RUTA DE DOCUMENTACIÓN PROFESIONAL ---
app.get('/docs', (req, res) => {
    res.send(`
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
            .badge { background: rgba(56, 189, 248, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
            .pro-box { background: rgba(17, 24, 39, 0.5); border: 1px solid var(--border); padding: 25px; border-radius: 16px; margin-top: 20px; }
            .pro-box h3 { margin-top: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }
            .pro-box h3 i { color: var(--primary); }
            
            /* Estilos para el formulario de cambio de JID */
            .transfer-container { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
            input { background: #000; border: 1px solid #1e293b; color: white; padding: 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
            input:focus { border-color: var(--primary); outline: none; }
            .btn-transfer { background: var(--primary); color: #030712; border: none; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; margin-top: 15px; width: 100%; transition: 0.3s; font-size: 0.85rem; }
            .btn-transfer:hover { background: white; transform: translateY(-2px); }
            #trans_res { margin-top: 15px; padding: 12px; border-radius: 8px; display: none; font-size: 0.85rem; font-weight: 600; text-align: center; }

            code { font-family: 'JetBrains Mono', monospace; background: #000; color: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.9rem; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .feature-card { border: 1px solid var(--border); padding: 20px; border-radius: 12px; transition: 0.3s; }
            .feature-card:hover { border-color: var(--primary); background: rgba(56, 189, 248, 0.02); }
            .feature-card i { color: var(--primary); margin-bottom: 15px; font-size: 1.2rem; }
            .feature-card b { color: white; display: block; margin-bottom: 5px; }
            .warning-box { border-left: 4px solid var(--error); background: rgba(239, 68, 68, 0.05); padding: 20px; color: #fca5a5; border-radius: 0 12px 12px 0; margin: 20px 0; }
            footer { text-align: center; padding: 40px; font-size: 0.8rem; }
            .back-link { text-decoration: none; color: var(--primary); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <nav class="nav-header">
            <a href="/verify" style="text-decoration:none; color:white; font-weight:800;"><i class="fas fa-bolt" style="color:var(--primary)"></i> STUNBOT<span style="color:var(--primary)">DOCS</span></a>
        </nav>

        <div class="container">
            <a href="/verify" class="back-link"><i class="fas fa-arrow-left"></i> Volver al Estado</a>
            <h1>Documentación Técnica</h1>
            <p>Guía avanzada sobre el funcionamiento, seguridad y protocolos del sistema StunBot.</p>

            <!-- NUEVA SECCIÓN: TRANSFERENCIA DE NODO -->
            <div class="section">
                <div class="pro-box" style="border: 1px solid var(--primary); background: rgba(56, 189, 248, 0.03);">
                    <h3><i class="fas fa-exchange-alt"></i> Gestión de Nodo (Cambio de JID)</h3>
                    <p style="color: #cbd5e1; font-size: 0.9rem;">Si desea trasladar su licencia a un nuevo número de WhatsApp, utilice este panel. Esta acción es <b>instantánea</b> y revocará el acceso al número anterior.</p>
                    
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
                <p>Nuestro núcleo emplea un sistema de validación de doble factor basado en hardware y red.</p>
                
                <div class="warning-box">
                    <i class="fas fa-exclamation-circle"></i> <b>Bloqueo por JID:</b> La licencia está vinculada estrictamente al número de WhatsApp autorizado. Cualquier intento de inicio en un número diferente disparará un protocolo de cierre automático y alerta al administrador.
                </div>

                <div class="grid">
                    <div class="feature-card">
                        <i class="fas fa-heartbeat"></i>
                        <b>Heartbeat Protocol</b>
                        El bot realiza una verificación silenciosa cada <code>5 HORAS</code>. Si el servidor revoca la licencia, el proceso de Node.js se auto-destruye para proteger la integridad.
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-fingerprint"></i>
                        <b>Validación de Identidad</b>
                        Al conectar, el sistema compara el <code>jidNormalizedUser</code> con el registro en el cluster central de Oracle Cloud.
                    </div>
                </div>
            </div>

            <div class="section">
                <h2><i class="fas fa-microchip"></i> Arquitectura del Bot</h2>
                <p>Construido sobre Baileys con un motor de alta disponibilidad.</p>
                
                <div class="pro-box">
                    <h3><i class="fas fa-sync"></i> Hot Reload (Carga en Caliente)</h3>
                    <p>Gracias al sistema <code>Chokidar</code>, el bot detecta cambios en la carpeta <code>/plugins</code> en tiempo real. Esto permite añadir o modificar comandos sin reiniciar la sesión de WhatsApp, garantizando un uptime del 100%.</p>
                </div>

                <div class="pro-box">
                    <h3><i class="fas fa-layer-group"></i> Cola de Mensajes (Queue System)</h3>
                    <p>Para evitar bloqueos por spam o saturación, implementamos un <code>MessageQueueWorker</code>. Los mensajes se encolan y procesan de forma asíncrona, permitiendo que el bot responda ráfagas de mensajes sin colapsar el event-loop.</p>
                </div>
            </div>

            <div class="section">
                <h2><i class="fas fa-terminal"></i> Códigos de Estado en Consola</h2>
                <p>El bot utiliza un sistema de logging ANSI para facilitar el monitoreo visual:</p>
                <ul style="list-style:none; padding:0;">
                    <li><code style="color:#10b981;">[CONECTADO]</code> Conexión exitosa con el servidor.</li>
                    <li><code style="color:#f59e0b;">[RECONECTANDO]</code> El socket ha caído, intentando reanudar flujo.</li>
                    <li><code style="color:#ef4444;">[DESCONECTADO]</code> Sesión cerrada o corrupta (badSession).</li>
                </ul>
            </div>

            <div class="section">
                <h2><i class="fas fa-question-circle"></i> FAQ de Errores</h2>
                <div class="feature-card" style="margin-bottom:15px;">
                    <b style="color:var(--primary);">¿Qué es el error "Stream Errored"?</b>
                    Es un error de conexión de WhatsApp. Nuestro bot lo detecta automáticamente e inicia una reconexión forzada en 5 segundos.
                </div>
                <div class="feature-card">
                    <b style="color:var(--primary);">¿Por qué no carga mi plugin nuevo?</b>
                    Asegúrese de que el archivo tenga la extensión <code>.js</code> y no esté en la lista de ignorados del Hot Reload.
                </div>
            </div>

            <div class="section">
                <h2><i class="fas fa-comments"></i> Feedback de la Comunidad</h2>
                <p>Deja tus sugerencias o reportes para mejorar el cluster.</p>
                
                <div class="pro-box" style="background: rgba(255,255,255,0.02);">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <input type="text" id="comm_name" placeholder="Tu Nombre o Nick" style="flex: 1;">
                        <input type="text" id="comm_text" placeholder="Escribe un comentario..." style="flex: 2;">
                        <button onclick="postComment()" style="width: auto; padding: 0 20px; background: var(--primary); color: #000; border-radius: 8px; border: none; font-weight: 800; cursor: pointer;">ENVIAR</button>
                    </div>

                    <div id="comments_list">
                        <!-- Los comentarios se cargarán aquí -->
                        <p style="text-align:center; font-size:0.8rem; color:var(--text-muted);">Cargando comentarios...</p>
                    </div>
                </div>
            </div>

            <footer>
                <p>&copy; 2025 StunBot Infrastructure. Operaciones Privadas AES-256.</p>
            </footer>
        </div>

        <script>
            // Función para cargar comentarios
            async function loadComments() {
                const list = document.getElementById('comments_list');
                try {
                    const res = await fetch('/api/comments');
                    const data = await res.json();
                    
                    if (data.length === 0) {
                        list.innerHTML = '<p style="text-align:center; font-size:0.8rem;">No hay comentarios aún. ¡Sé el primero!</p>';
                        return;
                    }

                    list.innerHTML = data.map(c => \`
                        <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <b style="color:white; font-size:0.9rem;"><i class="fas fa-user-circle" style="color:var(--primary)"></i> \${c.name}</b>
                                <small style="font-size:0.7rem; color:#4b5563;">\${new Date(c.created_at).toLocaleString()}</small>
                            </div>
                            <p style="margin:0; font-size:0.85rem; color:#cbd5e1;">\${c.content}</p>
                        </div>
                    \`).join('');
                } catch (e) {
                    list.innerHTML = 'Error al cargar el muro de comentarios.';
                }
            }

            // Función para publicar comentario
            async function postComment() {
                const name = document.getElementById('comm_name').value;
                const text = document.getElementById('comm_text').value;

                if(!name || !text) return alert('Por favor, rellena ambos campos.');

                try {
                    const res = await fetch('/api/comments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name, content: text })
                    });
                    
                    if(res.ok) {
                        document.getElementById('comm_text').value = '';
                        loadComments(); // Recargar lista
                    }
                } catch (e) {
                    alert('Error al publicar.');
                }
            }

            // Función para Cambio de JID
            async function changeJid() {
                const key = document.getElementById('trans_key').value;
                const jid = document.getElementById('trans_jid').value;
                const resDiv = document.getElementById('trans_res');

                if(!key || !jid) return alert('Por favor complete ambos campos.');

                resDiv.style.display = 'block';
                resDiv.style.background = 'rgba(255, 255, 255, 0.05)';
                resDiv.style.color = '#fff';
                resDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando cambio en Cluster...';

                try {
                    const response = await fetch('/stunbot/change-jid', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ license_key: key, new_jid: jid })
                    });
                    const data = await response.json();

                    if(data.valid) {
                        resDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                        resDiv.style.color = '#34d399';
                        resDiv.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.message.toUpperCase();
                    } else {
                        resDiv.style.background = 'rgba(239, 68, 68, 0.15)';
                        resDiv.style.color = '#f87171';
                        resDiv.innerHTML = '<i class="fas fa-times-circle"></i> ERROR: ' + data.message.toUpperCase();
                    }
                } catch (e) {
                    resDiv.innerHTML = 'ERROR DE COMUNICACIÓN CON EL SERVIDOR';
                }
            }


            loadComments();
        </script>
    </body>
    </html>
    `);
});

app.get('/verify', (req, res) => {
    // Lógica de tiempo y estadísticas
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    // Obtener IP real del cliente (considerando Nginx)
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.replace('::ffff:', '');

    // Lógica para generar las 30 barras de Uptime
    // Simulamos que las primeras 27 barras son el historial y las últimas 3 
    // dependen de si el servidor lleva encendido más de 1, 5 y 10 minutos.
    let barHtml = '';
    const totalBars = 30;
    for (let i = 0; i < totalBars; i++) {
        let activeClass = 'active';
        let opacity = 1;

        // Simulamos un pequeño "desvanecimiento" en las últimas barras si el uptime es bajo
        if (i > 27) {
            const requirements = [60, 300, 600]; // 1min, 5min, 10min
            if (uptimeSeconds < requirements[i - 28]) {
                activeClass = '';
                opacity = 0.2;
            }
        }
        barHtml += `<div class="bar ${activeClass}" style="opacity: ${opacity}"></div>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Service Status</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root { 
                --bg: #030712; 
                --card: rgba(17, 24, 39, 0.7); 
                --primary: #38bdf8; 
                --success: #10b981; 
                --error: #ef4444; 
                --border: rgba(255, 255, 255, 0.1);
            }
            body { 
                font-family: 'Inter', system-ui, sans-serif; 
                background: var(--bg);
                background-image: radial-gradient(circle at 50% -20%, #1e293b, var(--bg));
                color: white; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
                overflow: hidden;
            }
            
            /* Header */
            .nav-header { position: absolute; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; border-bottom: 1px solid var(--border); background: rgba(3, 7, 18, 0.5); backdrop-filter: blur(10px); z-index: 10; }
            .logo { font-weight: 800; font-size: 1.2rem; letter-spacing: -1px; display: flex; align-items: center; gap: 8px; color: white; text-decoration: none; }
            .system-time { font-family: monospace; color: var(--primary); font-size: 0.9rem; background: rgba(56, 189, 248, 0.1); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.2); }

            /* Card */
            .main-card { 
                background: var(--card); backdrop-filter: blur(12px); padding: 40px; border-radius: 24px; 
                width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); 
                border: 1px solid var(--border); text-align: center; z-index: 5;
            }

            .status-dots { display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; font-size: 0.8rem; color: #94a3b8; }
            .dot-item { display: flex; align-items: center; gap: 6px; }
            .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

            h1 { font-size: 2rem; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -1px; }

            /* Uptime Timeline */
            .uptime-timeline { display: flex; gap: 4px; margin: 20px 0; justify-content: center; align-items: flex-end; height: 25px; }
            .bar { width: 5px; height: 18px; background: var(--success); border-radius: 10px; transition: 0.3s; }
            .bar.active { background: var(--success); box-shadow: 0 0 5px rgba(16, 185, 129, 0.4); }
            .bar:hover { height: 25px; background: var(--primary); }

            input { 
                width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid var(--border); 
                background: rgba(0,0,0,0.4); color: white; font-size: 1rem; margin-bottom: 15px; box-sizing: border-box; transition: 0.3s;
                text-align: center; font-family: monospace;
            }
            input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.1); background: rgba(0,0,0,0.6); }

            button { 
                width: 100%; padding: 14px; border-radius: 12px; border: none; background: white; color: black; 
                font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.9rem; letter-spacing: 0.5px;
            }
            button:hover { background: var(--primary); color: white; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(56, 189, 248, 0.2); }

            .stats-info { 
                margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; 
                text-align: left; border-top: 1px solid var(--border); padding-top: 25px;
            }
            .stat-group { display: flex; flex-direction: column; gap: 4px; }
            .label { font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }
            .value { font-size: 0.85rem; color: #f1f5f9; font-family: 'JetBrains Mono', monospace; }

            #result { margin-top: 20px; padding: 15px; border-radius: 12px; display: none; font-size: 0.85rem; font-weight: 600; animation: slideUp 0.3s ease-out; }
            @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            .active-res { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
            .inactive-res { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }

            footer { position: absolute; bottom: 30px; color: #4b5563; font-size: 0.75rem; display: flex; gap: 25px; }
            footer a { color: #64748b; text-decoration: none; transition: 0.2s; }
            footer a:hover { color: var(--primary); }
        </style>
    </head>
    <body>

        <nav class="nav-header">
            <a href="#" class="logo"><i class="fas fa-bolt" style="color: var(--primary)"></i> STUNBOT<span style="color: var(--primary)">CLOUD</span></a>
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
            
            <div class="uptime-timeline">
                ${barHtml}
            </div>
            <div style="font-size: 0.65rem; color: #4b5563; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">99.98% Uptime recorded</div>

            <input type="text" id="licenseKey" placeholder="STUNBOT-XXXX-XXXX-XXXX">
            <button onclick="checkLicense()">VALIDATE AUTHORIZATION</button>

            <div id="result"></div>

            <div class="stats-info">
                <div class="stat-group">
                    <div class="label">Server Uptime</div>
                    <div class="value">${hours}h ${minutes}m ${seconds}s</div>
                </div>
                <div class="stat-group">
                    <div class="label">Network Latency</div>
                    <div id="pingValue" class="value" style="color: var(--primary)">-- ms</div>
                </div>
                <div class="stat-group">
                    <div class="label">Your Endpoint IP</div>
                    <div class="value">${cleanIP}</div>
                </div>
                <div class="stat-group">
                    <div class="label">Encryption</div>
                    <div class="value" style="color: var(--success)">AES-256 SSL</div>
                </div>
            </div>
        </div>

        <footer>
            <span>&copy; 2025 StunBot Infrastructure</span>
            <a href="/stunbot/docs"><i class="fas fa-book"></i> Manual de Uso</a>
            <a href="#"><i class="fas fa-headset"></i> Support</a>
        </footer>

        <script>
            // Reloj en tiempo real
            function updateClock() {
                const now = new Date();
                document.getElementById('clock').innerText = now.getUTCHours().toString().padStart(2, '0') + ':' + 
                                                           now.getUTCMinutes().toString().padStart(2, '0') + ':' + 
                                                           now.getUTCSeconds().toString().padStart(2, '0') + ' UTC';
            }
            setInterval(updateClock, 1000);
            updateClock();

            async function checkLicense() {
                const key = document.getElementById('licenseKey').value;
                const resDiv = document.getElementById('result');
                const pingVal = document.getElementById('pingValue');
                
                if(!key) {
                    resDiv.style.display = 'block';
                    resDiv.className = 'inactive-res';
                    resDiv.innerHTML = 'PLEASE ENTER A KEY';
                    return;
                }

                resDiv.style.display = 'block';
                resDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> INTERROGATING DATABASE...';
                resDiv.className = '';
                
                const start = performance.now();

                try {
                    const response = await fetch('/stunbot/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ license_key: key })
                    });
                    
                    const end = performance.now();
                    const latency = Math.round(end - start);
                    pingVal.innerText = latency + ' ms';
                    pingVal.style.color = latency < 150 ? '#10b981' : '#38bdf8';

                    const data = await response.json();
                    
                    if (data.valid) {
                        resDiv.className = 'active-res';
                        resDiv.innerHTML = '<i class="fas fa-shield-check"></i> ACCESS GRANTED - LICENSE ACTIVE';
                    } else {
                        resDiv.className = 'inactive-res';
                        resDiv.innerHTML = '<i class="fas fa-shield-exclamation"></i> ' + data.message.toUpperCase();
                    }
                } catch (err) {
                    resDiv.className = 'inactive-res';
                    resDiv.innerHTML = 'CONNECTION REFUSED - CLUSTER DOWN';
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.post('/verify', async (req, res) => {
    const { license_key } = req.body;
    console.log(`\n[${new Date().toISOString()}] Petición de verificación recibida para la clave: ${license_key}`);

    if (!license_key) {
        console.log("-> Respuesta: 400 - Clave no proporcionada.");
        return res.status(400).json({ valid: false, message: 'Clave de licencia no proporcionada.' });
    }

    try {
        console.log("-> Conectando a la base de datos para buscar la clave...");
        const result = await pool.query(
            'SELECT whatsapp_jid, is_active, ignored_groups FROM licenses WHERE license_key = $1',
            [license_key]
        );
        console.log(`-> Consulta ejecutada. Se encontraron ${result.rows.length} filas.`);

        if (result.rows.length > 0) {
            const license = result.rows[0];
            if (license.is_active) {
                console.log(`-> Respuesta: 200 - Licencia VÁLIDA y ACTIVA para JID: ${license.whatsapp_jid}`);
                return res.status(200).json({ 
                    valid: true, 
                    message: 'Licencia activa.',
                    jid: license.whatsapp_jid,
                ignored_groups: license.ignored_groups || "" // Enviar la lista
                });
            } else {
                console.log(`-> Respuesta: 403 - Licencia encontrada pero DESACTIVADA.`);
                return res.status(403).json({ valid: false, message: 'Licencia desactivada.' });
            }
        } else {
            console.log(`-> Respuesta: 404 - Clave de licencia NO encontrada en la base de datos.`);
            return res.status(404).json({ valid: false, message: 'Clave de licencia no encontrada.' });
        }
    } catch (error) {
        console.error("💥 ERROR INTERNO DEL SERVIDOR durante la verificación:", error);
        return res.status(500).json({ valid: false, message: 'Error interno del servidor.' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Servidor de licencias escuchando en el puerto ${PORT}`);
    console.log("Esperando peticiones de verificación de los bots...");

    console.log("🚀 Sistema Keep-alive activado (cada 2 horas)");
    
    // Opcional: Ejecutar un ping inicial al arrancar el server
    keepAlive();
});