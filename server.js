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
app.post('/create-checkout', async (req, res) => {
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

// ==========================================
// 2. TEBEX - WEBHOOK (ENTREGA DE LICENCIA)
// ==========================================
app.post('/tebex-webhook', async (req, res) => {
    const data = req.body;

    // Validación de Tebex
    if (data.type === 'validation.webhook') {
        return res.status(200).json({ id: data.id });
    }

    // Firma de seguridad (Opcional, pero recomendada)
    const signature = req.headers['x-signature'];
    const secret = process.env.TEBEX_SECRET; // Webhook Secret (b0ff...)
    if (signature && secret) {
        const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
        
    }

    // Pago completado
    if (data.type === 'payment.completed') {
        const email = data.subject.customer.email;
        const transactionId = data.subject.transaction_id;
        const amount = data.subject.amount.value;

        try {
            // Generar licencia
            const newLicense = `STUNBOT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

            // Insertar en Base de Datos
            await pool.query(
                'INSERT INTO licenses (license_key, whatsapp_jid, is_active, client_name) VALUES ($1, $2, $3, $4)',
                [newLicense, 'pendiente@s.whatsapp.net', true, email]
            );

            // Registrar Venta
            await pool.query(
                'INSERT INTO sales (email, transaction_id, amount, status, license_generated, payment_method) VALUES ($1, $2, $3, $4, $5, $6)',
                [email, transactionId, amount, 'completed', newLicense, 'tebex']
            );

            console.log(`✅ Licencia generada para: ${email}`);
            return res.status(200).send('OK');
        } catch (e) {
            console.error("Error DB Webhook:", e);
            return res.status(500).send('DB Error');
        }
    }

    res.status(200).send('Ignored');
});

// ==========================================
// 3. RUTAS DE NAVEGACIÓN
// ==========================================
app.get('/store', (req, res) => res.send(renderStore()));
app.get('/docs', (req, res) => res.send(renderDocs()));
app.get('/verify', async (req, res) => {
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
app.post('/verify', async (req, res) => {
    const { license_key } = req.body;
    try {
        const result = await pool.query('SELECT whatsapp_jid, is_active, ignored_groups FROM licenses WHERE license_key = $1', [license_key]);
        if (result.rows.length > 0) {
            const lic = result.rows[0];
            if (lic.is_active) return res.json({ valid: true, jid: lic.whatsapp_jid, ignored_groups: lic.ignored_groups });
            return res.status(403).json({ valid: false, message: 'Licencia desactivada' });
        }
        res.status(404).json({ valid: false, message: 'No encontrada' });
    } catch (e) { res.status(500).json({ valid: false }); }
});

app.post('/change-jid', async (req, res) => {
    const { license_key, new_jid } = req.body;
    let formattedJid = new_jid.includes('@') ? new_jid : `${new_jid}@s.whatsapp.net`;
    try {
        const check = await pool.query('SELECT whatsapp_jid FROM licenses WHERE license_key = $1 AND is_active = true', [license_key]);
        if (check.rows.length === 0) return res.status(404).json({ valid: false, message: 'Licencia no válida' });
        await pool.query('UPDATE licenses SET whatsapp_jid = $1 WHERE license_key = $2', [formattedJid, license_key]);
        res.json({ valid: true, message: 'JID actualizado correctamente' });
    } catch (e) { res.status(500).json({ valid: false }); }
});

app.get('/api/comments', async (req, res) => {
    const result = await pool.query('SELECT name, content FROM comments ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
});
app.post('/api/comments', async (req, res) => {
    await pool.query('INSERT INTO comments (name, content) VALUES ($1, $2)', [req.body.name, req.body.content]);
    res.json({ success: true });
});

// Mantener base de datos despierta
setInterval(() => pool.query('SELECT 1').catch(() => {}), 1000 * 60 * 60 * 2);

app.listen(PORT, () => console.log(`🚀 StunBot Server Running on Port ${PORT}`));