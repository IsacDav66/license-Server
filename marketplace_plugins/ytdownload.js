// plugins/ytdownload.js (VERSIÓN DE DEPURACIÓN)


const brDB = {
    getAll: () => db.prepare('SELECT * FROM brainroots_characters ORDER BY rarity ASC').all(),
    getById: (id) => db.prepare('SELECT * FROM brainroots_characters WHERE id = ?').get(id),
    getByName: (n) => db.prepare('SELECT * FROM brainroots_characters WHERE LOWER(name) = LOWER(?)').get(n),
    addToUser: (u, c) => { const ts = Date.now(); db.prepare('INSERT INTO user_brainroots (user_id, character_id, catch_timestamp, last_income_timestamp) VALUES (?, ?, ?, ?)').run(u, c, ts, ts); },
    getUserColl: (u) => db.prepare('SELECT ub.id AS entry_id, bc.*, ub.catch_timestamp, ub.last_income_timestamp FROM user_brainroots ub JOIN brainroots_characters bc ON ub.character_id = bc.id WHERE ub.user_id = ?').all(u),
    updateIncome: (id, ts) => db.prepare('UPDATE user_brainroots SET last_income_timestamp = ? WHERE id = ?').run(ts, id),
    remove: (u, c) => { const row = db.prepare('SELECT id FROM user_brainroots WHERE user_id = ? AND character_id = ? LIMIT 1').get(u, c); if(row) db.prepare('DELETE FROM user_brainroots WHERE id = ?').run(row.id); return !!row; },
    getRandom: (u) => db.prepare('SELECT ub.id as entry_id, bc.* FROM user_brainroots ub JOIN brainroots_characters bc ON ub.character_id = bc.id WHERE ub.user_id = ? ORDER BY RANDOM() LIMIT 1').get(u),
    addMarket: (s, c, p) => db.prepare('INSERT INTO brainroots_market (seller_id, character_id, price, listing_timestamp) VALUES (?, ?, ?, ?)').run(s, c, p, Date.now()).lastInsertRowid,
    removeMarket: (id, s) => s ? db.prepare('DELETE FROM brainroots_market WHERE id = ? AND seller_id = ? RETURNING *').get(id, s) : db.prepare('DELETE FROM brainroots_market WHERE id = ? RETURNING *').get(id),
    getListings: () => db.prepare('SELECT bm.id as listing_id, bc.name, bc.rarity, bm.price as listing_price, bm.seller_id FROM brainroots_market bm JOIN brainroots_characters bc ON bm.character_id = bc.id').all(),
    getListingById: (id) => db.prepare('SELECT * FROM brainroots_market WHERE id = ?').get(id)
};

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// --- CONFIGURACIÓN ---
const TEMP_DIR = path.join(__dirname, '..', 'temp'); // La carpeta temp estará dentro de la carpeta del bot
const DOWNLOAD_SERVICE_URL = process.env.DOWNLOAD_SERVICE_URL;

module.exports = {
    name: 'Reproducir Música',
    aliases: ['play', 'ytmp3', 'song'],
    description: 'Descarga música usando un servicio proxy local.',
    category: 'Descargas',
    groupOnly: false,
    marketplace: {
        externalDependencies: ["axios@^1.11.0"],
        requirements: ["Microservicio de Descarga Activo","FFmpeg instalado"],
        tebex_id: 7383071,
        price: "10.00",
        icon: "fa-music",
        preview: {
            suggestions: ["!play Queen Bohemian Rhapsody", "!song Ojala Beret"],
            responses: {
                "!play Queen Bohemian Rhapsody": "🔎 Buscando y procesando \"Queen Bohemian Rhapsody\"...\n\n✅ *Audio generado:* 06:00 min\n📦 *Tamaño:* 5.4 MB\n(Enviando archivo de audio... 🎧)",
                "!song Ojala Beret": "🔎 Buscando y procesando \"Ojala Beret\"...\n\n✅ *Audio generado:* 04:30 min\n📦 *Tamaño:* 3.2 MB\n(Enviando archivo de audio... 🎧)"
            }
        },
        requirements: ["Microservicio de Descarga", "FFmpeg"]
    },

    async execute(sock, msg, args) {
        console.log('\n--- [Play Plugin] INICIANDO EJECUCIÓN ---');

        if (!DOWNLOAD_SERVICE_URL) {
            console.log('[Play Plugin] ERROR: La variable DOWNLOAD_SERVICE_URL no está configurada.');
            return msg.reply('❌ La función de descarga no está configurada por el administrador.');
        }
        const query = args.join(' ').trim();
        if (!query) {
            console.log('[Play Plugin] INFO: No se proporcionó una consulta.');
            return sock.sendMessage(msg.from, { text: '❌ Escribe el nombre de la canción.' }, { quoted: msg._baileysMessage });
        }

        let filePath = '';
        try {
            console.log(`[Play Plugin] DEBUG: Consulta del usuario: "${query}"`);
            await sock.sendMessage(msg.from, { text: `🔎 Buscando y procesando "${query}"...` }, { quoted: msg._baileysMessage });

            // 1. Llamar al microservicio
            const serviceUrl = `${DOWNLOAD_SERVICE_URL}/download?q=${encodeURIComponent(query)}`;
            console.log(`[Play Plugin] DEBUG: Contactando al microservicio en: ${serviceUrl}`);

            const response = await axios.get(serviceUrl, { responseType: 'stream' });
            console.log('[Play Plugin] DEBUG: Respuesta del microservicio recibida. Código de estado:', response.status);

            const contentDisposition = response.headers['content-disposition'];
            let fileName = `audio_${Date.now()}.mp3`; // Nombre de archivo por defecto más único

            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+?)"/);
                if (match && match[1]) {
                    // Decodificar y limpiar el nombre del archivo
                    fileName = decodeURIComponent(match[1]).replace(/[\\/:"*?<>|]/g, '_');
                    console.log(`[Play Plugin] DEBUG: Nombre de archivo extraído de las cabeceras: "${fileName}"`);
                }
            } else {
                console.log('[Play Plugin] WARN: La cabecera Content-Disposition no se encontró en la respuesta.');
            }

            // Crear la carpeta temp si no existe
            if (!fs.existsSync(TEMP_DIR)) {
                console.log(`[Play Plugin] DEBUG: Creando directorio temporal en: ${TEMP_DIR}`);
                fs.mkdirSync(TEMP_DIR, { recursive: true });
            }
            filePath = path.join(TEMP_DIR, fileName);
            console.log(`[Play Plugin] DEBUG: Ruta completa del archivo temporal: ${filePath}`);

            // 2. Guardar el stream recibido en un archivo
            console.log('[Play Plugin] DEBUG: Iniciando pipeline para guardar el archivo...');
            await pipeline(response.data, fs.createWriteStream(filePath));
            console.log('[Play Plugin] DEBUG: Pipeline completado. El archivo debería estar guardado.');

            // 3. VERIFICAR EL ARCHIVO GUARDADO
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            console.log(`[Play Plugin] DEBUG: ¡VERIFICACIÓN! Tamaño del archivo guardado: ${fileSizeInBytes} bytes.`);

            if (fileSizeInBytes < 1024) { // Menos de 1 KB es sospechoso
                console.log('[Play Plugin] ERROR: El archivo guardado está vacío o es demasiado pequeño. Abortando envío.');
                throw new Error('El archivo descargado está vacío. El microservicio puede haber fallado silenciosamente.');
            }

            // 4. Enviar el archivo
            console.log(`[Play Plugin] DEBUG: Enviando archivo de audio a WhatsApp...`);
            await sock.sendMessage(msg.from, {
                audio: { url: filePath },
                mimetype: 'audio/mpeg',
                fileName: fileName,
            }, { quoted: msg._baileysMessage });
            console.log('[Play Plugin] DEBUG: Envío a WhatsApp completado con éxito.');

        } catch (err) {
            console.error('\n--- [Play Plugin] OCURRIÓ UN ERROR ---');
            console.error('[Play Plugin] ERROR:', err); // Loguear el objeto de error completo
            
            // Lógica de respuesta de error mejorada
            let errorMessage = '❌ Ocurrió un error inesperado durante la descarga.';
            if (err.response) { // Si el error vino de Axios
                errorMessage = `❌ El servicio de descarga respondió con un error: ${err.response.status}`;
            } else if (err.message.includes('vacío')) {
                errorMessage = '❌ La descarga falló. Se recibió un archivo vacío del servicio.';
            } else if (err.code === 'ECONNREFUSED') {
                errorMessage = '❌ No se pudo conectar con el servicio de descarga. ¿Está activo?';
            }
            await msg.reply(errorMessage);

        } finally {
            // 5. Limpiar el archivo temporal
            if (filePath && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[Play Plugin] DEBUG: Archivo temporal "${filePath}" eliminado.`);
                } catch (e) {
                    console.error('[Play Plugin] ERROR: No se pudo eliminar el archivo temporal:', e.message);
                }
            }
            console.log('--- [Play Plugin] EJECUCIÓN FINALIZADA ---\n');
        }
    }
};