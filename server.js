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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());


// Asegúrate de tener axios arriba: const axios = require('axios');

app.post('/create-checkout', async (req, res) => {
    try {
        console.log("--- Iniciando creación de Checkout ---");
        
        const response = await axios.post('https://checkout.tebex.io/api/checkouts', {
            package_id: 7383010, // <--- ✅ ESTE ES TU ID REAL
            type: 'single',
            complete_url: "https://davcenter.servequake.com/stunbot/verify?success=true",
            cancel_url: "https://davcenter.servequake.com/stunbot/store"
        }, {
            headers: {
                'X-Tebex-Secret': process.env.TEBEX_PRIVATE_KEY, // Asegúrate que sea la Private Key (v4L4...)
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Sesión de Tebex creada con éxito");
        res.json({ url: response.data.links.checkout });

    } catch (error) {
        if (error.response) {
            console.error("❌ Error de Tebex API:", error.response.status, JSON.stringify(error.response.data));
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            console.error("❌ Error de red:", error.message);
            res.status(500).json({ error: "Error de conexión" });
        }
    }
});

app.post('/tebex-webhook', async (req, res) => {
    const data = req.body;
    if (data.type === 'validation.webhook') return res.status(200).json({ id: data.id });
    
    if (data.type === 'payment.completed') {
        const email = data.subject.customer.email;
        const transactionId = data.subject.transaction_id;
        const newLicense = `STUNBOT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        try {
            await pool.query('INSERT INTO licenses (license_key, whatsapp_jid, is_active, client_name) VALUES ($1, $2, $3, $4)', [newLicense, 'pendiente@s.whatsapp.net', true, email]);
            await pool.query('INSERT INTO sales (email, transaction_id, amount, status, license_generated, payment_method) VALUES ($1, $2, $3, $4, $5, $6)', [email, transactionId, 10.00, 'completed', newLicense, 'tebex']);
            res.status(200).send('OK');
        } catch (e) { res.status(500).send('DB Error'); }
    } else { res.status(200).send('Ignored'); }
});

// --- RUTAS DE NAVEGACIÓN ---
app.get('/store', (req, res) => res.send(renderStore()));
app.get('/docs', (req, res) => res.send(renderDocs()));
app.get('/verify', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.replace('::ffff:', '');
    let barHtml = Array(30).fill('<div class="bar active"></div>').join('');
    res.send(renderVerify({ hours, minutes, seconds, cleanIP, barHtml }));
});

// --- API DE LICENCIAS ---
app.post('/verify', async (req, res) => {
    const { license_key } = req.body;
    try {
        const result = await pool.query('SELECT whatsapp_jid, is_active, ignored_groups FROM licenses WHERE license_key = $1', [license_key]);
        if (result.rows.length > 0) {
            const license = result.rows[0];
            if (license.is_active) return res.status(200).json({ valid: true, jid: license.whatsapp_jid, ignored_groups: license.ignored_groups || "" });
            return res.status(403).json({ valid: false, message: 'Licencia desactivada.' });
        }
        res.status(404).json({ valid: false, message: 'No encontrada.' });
    } catch (e) { res.status(500).json({ valid: false }); }
});

app.post('/change-jid', async (req, res) => {
    const { license_key, new_jid } = req.body;
    let formattedJid = new_jid.includes('@') ? new_jid : `${new_jid}@s.whatsapp.net`;
    try {
        const check = await pool.query('SELECT whatsapp_jid FROM licenses WHERE license_key = $1 AND is_active = true', [license_key]);
        if (check.rows.length === 0) return res.status(404).json({ valid: false, message: 'Licencia inválida' });
        await pool.query('UPDATE licenses SET whatsapp_jid = $1 WHERE license_key = $2', [formattedJid, license_key]);
        res.json({ valid: true, message: 'JID Actualizado' });
    } catch (e) { res.status(500).json({ valid: false }); }
});

// --- API DE COMENTARIOS Y PAGOS MANUALES ---
app.get('/api/comments', async (req, res) => {
    const result = await pool.query('SELECT name, content FROM comments ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
});
app.post('/api/comments', async (req, res) => {
    await pool.query('INSERT INTO comments (name, content) VALUES ($1, $2)', [req.body.name, req.body.content]);
    res.json({ success: true });
});
app.post('/api/checkout/manual', async (req, res) => {
    await pool.query('INSERT INTO sales (email, transaction_id, amount, status, payment_method) VALUES ($1, $2, $3, $4, $5)', [req.body.email, req.body.reference, 10.00, 'pending_review', req.body.method]);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ StunBot Server on port ${PORT}`));