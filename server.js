// license-server/server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs'); // Añadido
const path = require('path'); // Añadido

const app = express();
const PORT = process.env.PORT || 4000;

if (!process.env.DATABASE_URL) {
    console.error("CRÍTICO: La variable DATABASE_URL no está definida.");
    process.exit(1);
}

// --- CONFIGURACIÓN DE SSL DINÁMICA ---
const sslConfig = {
    // ESTO ES LO MÁS IMPORTANTE:
    // Mantiene la conexión cifrada pero no falla si el certificado es auto-firmado
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
// -------------------------------------

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
});
// -------------------------------------

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
            'SELECT whatsapp_jid, is_active FROM licenses WHERE license_key = $1',
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
                    jid: license.whatsapp_jid
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
});