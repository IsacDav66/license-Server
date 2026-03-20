// license-server/server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs'); 
const path = require('path'); 

const app = express();
const PORT = process.env.PORT || 4000;

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