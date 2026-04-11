require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs'); 
const path = require('path'); 
const crypto = require('crypto');
const axios = require('axios');

// Vistas Modularizadas
const { renderStore } = require('./views/store');
const { renderVerify } = require('./views/verify');
const { renderDocs } = require('./views/docs');
const { renderMarketplace } = require('./views/marketplace'); // <--- AÑADE ESTA LÍNEA

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Base de Datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());

// ==========================================
// 1. TEBEX - CREAR SESIÓN DE PAGO (MODAL)
// ==========================================
app.post('/stunbot/create-checkout', async (req, res) => {
    try {
        console.log("--- Iniciando Flujo de Canasta (Tebex Option 2) ---");

        const auth = {
            username: process.env.TEBEX_PROJECT_ID.trim(),
            password: process.env.TEBEX_PRIVATE_KEY.trim()
        };

        // PASO 1: Crear la canasta (Basket)
        const basketResponse = await axios.post('https://checkout.tebex.io/api/baskets', {
            complete_url: "https://davcenter.servequake.com/stunbot/verify?success=true",
            cancel_url: "https://davcenter.servequake.com/stunbot/store"
        }, { auth });

        const basketIdent = basketResponse.data.data.ident;
        console.log("✅ Canasta creada:", basketIdent);

        // PASO 2: Añadir el paquete a la canasta
        await axios.post(`https://checkout.tebex.io/api/baskets/${basketIdent}/packages`, {
            package_id: 7383010,
            qty: 1
        }, { auth });

        console.log("✅ Paquete añadido a la canasta");

        // PASO 3: Devolver la URL de checkout
        // Según tu captura, la URL está en basketResponse.data.data.links.checkout
        res.json({ url: basketResponse.data.data.links.checkout });

    } catch (error) {
        console.error("❌ Error en el flujo de Canasta:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
            res.status(error.response.status).json(error.response.data);
        } else {
            console.error("Mensaje:", error.message);
            res.status(500).json({ error: "Error de conexión" });
        }
    }
});



// Función para escanear plugins de la tienda
const getMarketplacePlugins = () => {
    const pluginsDir = path.join(__dirname, 'marketplace_plugins');
    if (!fs.existsSync(pluginsDir)) return [];

    const files = fs.readdirSync(pluginsDir);
    const pluginsList = [];

    files.forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
                const startTag = "marketplace:";
                const startIndex = content.indexOf(startTag);
                
                if (startIndex !== -1) {
                    let braceCount = 0, objectStr = "", started = false;
                    for (let i = startIndex + startTag.length; i < content.length; i++) {
                        const char = content[i];
                        if (char === '{') { braceCount++; started = true; }
                        if (char === '}') braceCount--;
                        if (started) objectStr += char;
                        if (started && braceCount === 0) break;
                    }

                    if (objectStr) {
                        const marketplaceData = eval("(" + objectStr + ")");
                        const nameMatch = content.match(/name:\s*['"](.*?)['"]/);
                        const descMatch = content.match(/description:\s*['"](.*?)['"]/);
                        
                        // --- NUEVO: Extraer la categoría ---
                        const categoryMatch = content.match(/category:\s*['"](.*?)['"]/);

                        pluginsList.push({
                            tebex_id: marketplaceData.tebex_id,
                            name: nameMatch ? nameMatch[1] : file,
                            desc: descMatch ? descMatch[1] : 'Sin descripción',
                            category: categoryMatch ? categoryMatch[1] : 'Otros', // <--- Categoría extraída
                            icon: marketplaceData.icon || 'fa-plug',
                            price: marketplaceData.price || '0.00',
                            preview: marketplaceData.preview,
                            requirements: marketplaceData.requirements || [] 
                        });
                    }
                }
            } catch (e) {
                console.error("❌ Error en " + file + ":", e.message);
            }
        }
    });
    return pluginsList;
};

// Ruta del Marketplace (Ahora es dinámica)
app.get('/stunbot/marketplace', (req, res) => {
    const plugins = getMarketplacePlugins();
    res.send(renderMarketplace(plugins));
});


// Servir el logo para las vistas previas de WhatsApp
app.get('/stunbot/logo.png', (req, res) => {
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    
    // Verificamos si el archivo existe antes de enviarlo
    if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
    } else {
        res.status(404).send('Logo no encontrado');
    }
});
// ==========================================
// 2. TEBEX - WEBHOOK (ENTREGA DE LICENCIA)
// ==========================================
app.post('/stunbot/tebex-webhook', async (req, res) => {
    const data = req.body;
    if (data.type === 'validation.webhook') return res.status(200).json({ id: data.id });
    
    if (data.type === 'payment.completed') {
        const email = data.subject.customer.email;
        const pkgId = data.subject.items[0].package_id;

        try {
            if (pkgId === 7383010) { // ID DE LA LICENCIA BASE
                const newLicense = `STUNBOT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                await pool.query('INSERT INTO licenses (license_key, whatsapp_jid, is_active, client_name) VALUES ($1, $2, $3, $4)', [newLicense, 'pendiente@s.whatsapp.net', true, email]);
                console.log("✅ Licencia Base Creada");
            } else {
                // ES UN PLUGIN
                // Buscamos la licencia del cliente por su email
                const user = await pool.query('SELECT license_key FROM licenses WHERE client_name = $1', [email]);
                if (user.rows.length > 0) {
                    const lkey = user.rows[0].license_key;
                    const pluginName = data.subject.items[0].name;
                    await pool.query('INSERT INTO license_plugins (license_key, plugin_identifier, transaction_id) VALUES ($1, $2, $3)', 
                    [lkey, pluginName, data.subject.transaction_id]);
                    console.log(`🔌 Plugin ${pluginName} activado para ${lkey}`);
                }
            }
            res.status(200).send('OK');
        } catch (e) { res.status(500).send('Error'); }
    }
});


// 1. Conexión a la DB de Brainroots (Aiven)
const brainrootsPool = new Pool({
    connectionString: process.env.BRAINROOTS_DATABASE_URL, // La URL que empieza por postgres://
    ssl: {
        rejectUnauthorized: false // <--- ESTO ARREGLA EL ERROR DEL CERTIFICADO
    }
});

// 2. Endpoint de Sincronización
app.get('/stunbot/api/sync/brainroots', async (req, res) => {
    try {
        console.log("☁️  Consultando Brainroots en Aiven...");
        const result = await brainrootsPool.query('SELECT name, rarity, price, image_filename FROM brainroots_characters');
        
        if (result.rows.length === 0) {
            console.warn("⚠️ La DB de Aiven no devolvió personajes.");
        }

        res.json(result.rows);
    } catch (e) {
        console.error("❌ Error consultando DB de Aiven:", e.message);
        res.status(500).json({ error: "Fallo en la conexión con la base de datos de contenido" });
    }
});
// ==========================================
// 3. RUTAS DE NAVEGACIÓN
// ==========================================
app.get('/stunbot/store', (req, res) => res.send(renderStore()));
app.get('/stunbot/docs', (req, res) => res.send(renderDocs()));
app.get('/stunbot/verify', async (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.replace('::ffff:', '');
    const barHtml = Array(30).fill('<div class="bar active"></div>').join('');

    res.send(renderVerify({ hours, minutes, seconds, cleanIP, barHtml }));
});

// ==========================================
// 4. API - VERIFICACIÓN Y GESTIÓN
// ==========================================
// 1. Verificación de Licencia
app.post('/stunbot/verify', async (req, res) => {
    const { license_key } = req.body;
    try {
        const result = await pool.query('SELECT whatsapp_jid, is_active, ignored_groups FROM licenses WHERE license_key = $1', [license_key]);
        
        if (result.rows.length > 0) {
            const lic = result.rows[0];
            if (lic.is_active) {
                return res.json({ 
                    valid: true, 
                    jid: lic.whatsapp_jid, 
                    ignored_groups: lic.ignored_groups || "" 
                });
            }
            return res.status(403).json({ valid: false, message: 'Licencia desactivada' });
        }
        res.status(404).json({ valid: false, message: 'Licencia no encontrada' });
    } catch (e) {
        // ESTA LÍNEA ES VITAL: Te dirá el error en la consola de Node/PM2
        console.error("❌ ERROR CRÍTICO EN VERIFY:", e.message);
        res.status(500).json({ valid: false, error: e.message });
    }
});

// 2. Recuperar por Email (ESTA ES LA QUE TE DABA 404)
app.post('/stunbot/find-licenses', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ valid: false, message: 'Email requerido.' });

    try {
        const result = await pool.query(
            'SELECT license_key, whatsapp_jid, is_active FROM licenses WHERE client_name = $1 ORDER BY created_at DESC',
            [email.trim()]
        );

        if (result.rows.length > 0) {
            return res.json({ success: true, licenses: result.rows });
        } else {
            return res.status(404).json({ success: false, message: 'No se encontraron licencias.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// 3. Cambio de JID
app.post('/stunbot/change-jid', async (req, res) => {
    const { license_key, new_jid } = req.body;
    let formattedJid = new_jid.includes('@') ? new_jid : `${new_jid}@s.whatsapp.net`;
    try {
        const check = await pool.query('SELECT whatsapp_jid FROM licenses WHERE license_key = $1 AND is_active = true', [license_key]);
        if (check.rows.length === 0) return res.status(404).json({ valid: false, message: 'Licencia no válida' });
        await pool.query('UPDATE licenses SET whatsapp_jid = $1 WHERE license_key = $2', [formattedJid, license_key]);
        res.json({ valid: true, message: 'JID actualizado correctamente' });
    } catch (e) { res.status(500).json({ valid: false }); }
});

app.get('/stunbot/api/comments', async (req, res) => {
    const result = await pool.query('SELECT name, content FROM comments ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
});
app.post('/stunbot/api/comments', async (req, res) => {
    await pool.query('INSERT INTO comments (name, content) VALUES ($1, $2)', [req.body.name, req.body.content]);
    res.json({ success: true });
});

// Mantener base de datos despierta
setInterval(() => pool.query('SELECT 1').catch(() => {}), 1000 * 60 * 60 * 2);

app.listen(PORT, () => console.log(`🚀 StunBot Server Running on Port ${PORT}`));