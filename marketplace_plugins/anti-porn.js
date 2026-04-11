// --- plugins/anti-porn.js (Versión con Gestión de Palabras por Chat) ---

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

const { 
    downloadContentFromMessage, 
    jidDecode, 
    jidNormalizedUser, 
    WAMessageStubType
} = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;
const OWNER_ID = '1658008416509@lid'; // ID del propietario para los comandos de gestión

// --- GESTIÓN DE PALABRAS PROHIBIDAS ---
const KEYWORDS_DB_PATH = path.join(__dirname, '..', '..', 'db', 'forbidden_keywords.json');
const defaultKeywords = ['porno', 'porn', 'xxx', 'desnuda', 'desnudo', 'pack', 'cp ', 'paja','doxeo','doxing','incesto','pedofilia','pedófilo','fetiche','fetish','sexo','sexual','nudez','nude','nudes','18+','18 plus', 'dox','doxxed', 'doxxing', 'doxxxed','doxxx','doxxxx', 'c4', "doxear", "DOXEAR", "Doxear", "dOxEaR", "d0xear", "d0x3ar", "D0X3AR", "d0x3@r", "d0x3ãr", "DōX3Ãr", "døxear", "døx3ar", "døx3år", "dôxear", "dôx3ar", "dôx3år", "dox3ar", "dox3@r", "dox3år", "dox3ãr", "dox3âr", "dox3aЯ", "dox3Δr", "dox3Λr", "dox3αr", "dox3ⓡ", "dox3ℝ", "dox3я", "dox3ʀ", "dox3Ɍ", "dox3ŕ", "dox3ř", "dox3Ŗ", "dox3Я", "dox3Ʀ", "dox3®", "dox3Яr", "dox3Яʀ", "dox3Яℝ", "DōX3Ãr","d0x3Δr", "d0x", "reniec"];
let forbiddenKeywords = [];

function loadKeywords() {
    try {
        const dbDir = path.dirname(KEYWORDS_DB_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        if (fs.existsSync(KEYWORDS_DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(KEYWORDS_DB_PATH, 'utf-8'));
            forbiddenKeywords = data.keywords;
        } else {
            forbiddenKeywords = defaultKeywords;
            saveKeywords();
        }
    } catch (e) {
        console.error("[Anti-Porn] Error al cargar palabras prohibidas, usando lista por defecto:", e);
        forbiddenKeywords = defaultKeywords;
    }
}

function saveKeywords() {
    try {
        fs.writeFileSync(KEYWORDS_DB_PATH, JSON.stringify({ keywords: forbiddenKeywords }, null, 2));
    } catch (e) { console.error("[Anti-Porn] Error al guardar palabras prohibidas:", e); }
}

loadKeywords(); // Cargar al iniciar

const NUDITY_THRESHOLD = 0.65;
const RELEVANT_NUDITY_MODELS = ['sexual_activity', 'sexual_display', 'erotica', 'very_suggestive'];
const ANALYZE_VIDEOS = true;
const VIDEO_NUDITY_THRESHOLD = 0.70;
const MODERATION_JID = '120363419450783030@g.us';
// --- FIN CONFIGURACIÓN ---

// Esta función es vital para la nueva lógica de reenvío
async function getMediaBuffer(baileysMsg, type) {
    if (!baileysMsg || !baileysMsg.message) return null;
    const mediaMsg = baileysMsg.message[`${type}Message`];
    if (!mediaMsg) return null;

    try {
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (e) {
        console.error(`[Anti-Porn] Error al obtener buffer del medio (${type}):`, e);
        return null;
    }
}

module.exports = {
    name: 'Anti-Pornografía',
    aliases: ['addpalabra', 'delpalabra', 'listpalabras'],
    description: 'Sistema anti-pornografía con gestión de palabras prohibidas.',
    category: 'Moderación',
    marketplace: {
        externalDependencies: ["axios@^1.11.0","form-data@^4.0.3"],
        requirements: ["Sightengine API User & Secret"],
        tebex_id: 7383025,
        price: "20.00",
        icon: "fa-eye-slash",
        preview: {
            suggestions: ["!listpalabras", "porno"],
            responses: {
                "!listpalabras": "📜 *Lista de Palabras Prohibidas:* porno, xxx, desnuda, reniec, doxeo...",
                "porno": "🚨 *Moderación:* El mensaje de @usuario ha sido eliminado por contenido inapropiado."
            }
        }
    },
    // isListener: true -> Ya no es necesario, checkMessage lo define como listener.

    /**
     * Esta función es el listener que se ejecuta en cada mensaje.
     */
    async checkMessage(sock, adaptedMessage) {
        const {
            body, from: chatId, author: senderJid, senderPhoneNumber,
            type: messageType, _baileysMessage: originalBaileysMsg
        } = adaptedMessage;

        if (originalBaileysMsg && WAMessageStubType[originalBaileysMsg.messageStubType]) return false;
        if (chatId === MODERATION_JID) return false; 
        if (!chatId || !chatId.endsWith('@g.us')) return false;

        // No actuar si el mensaje es uno de los comandos de gestión de este mismo plugin
        const command = body?.startsWith('.') ? body.slice(1).split(' ')[0].toLowerCase() : '';
        if (this.aliases.includes(command)) {
            // Si es un comando de gestión, checkMessage se hace a un lado para que execute() trabaje.
            return false;
        }

        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatId);
        } catch (e) {
            console.error(`[Anti-Porn] Error obteniendo metadata del grupo ${chatId}:`, e.message);
            return false;
        }
        
        if (!groupMetadata || !groupMetadata.participants) {
            return false;
        }
        const botJidNormalized = jidNormalizedUser(sock.user.id);
        let botLidNormalized = null;
        if (sock.user.lid) {
            const decodedLid = jidDecode(sock.user.lid);
            if (decodedLid) botLidNormalized = `${decodedLid.user}@${decodedLid.server}`;
        }
        const botParticipant = groupMetadata.participants.find(p => {
            const pNorm = jidNormalizedUser(p.id);
            return pNorm === botJidNormalized || (botLidNormalized && pNorm === botLidNormalized);
        });
        
        if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
            return false;
        }
        
        let isPornographic = false;
        let reason = '';
        let detectedModelInfo = '';
        let mediaBuffer = null;

        // 1. Análisis de texto
        if (body) {
            const lowerBody = body.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            if (forbiddenKeywords.some(keyword => lowerBody.includes(keyword))) {
                isPornographic = true;
                reason = 'Palabra clave prohibida detectada.';
            }
        }

        // 2. Análisis de imagen
        if (!isPornographic && messageType === 'image' && SIGHTENGINE_API_USER && SIGHTENGINE_API_SECRET) {
            try {
                mediaBuffer = await getMediaBuffer(originalBaileysMsg, 'image');
                if (mediaBuffer) {
                    const formData = new FormData();
                    formData.append('media', mediaBuffer, { filename: 'image.jpg' });
                    formData.append('models', 'nudity-2.1');
                    formData.append('api_user', SIGHTENGINE_API_USER);
                    formData.append('api_secret', SIGHTENGINE_API_SECRET);
                    const response = await axios.post('https://api.sightengine.com/1.0/check.json', formData, { headers: formData.getHeaders() });
                    if (response.data?.nudity) {
                        for (const model of RELEVANT_NUDITY_MODELS) {
                            if ((response.data.nudity[model] || 0) > NUDITY_THRESHOLD) {
                                isPornographic = true;
                                reason = `Contenido visual explícito detectado (Modelo: ${model})`;
                                break;
                            }
                        }
                    }
                }
            } catch (error) { console.error('[Anti-Porn] Error analizando imagen:', error.message); }
        }
        
        // 3. Análisis de Video
        else if (!isPornographic && messageType === 'video' && ANALYZE_VIDEOS && SIGHTENGINE_API_USER && SIGHTENGINE_API_SECRET) {
            try {
                mediaBuffer = await getMediaBuffer(originalBaileysMsg, 'video');
                if (mediaBuffer) {
                    const formData = new FormData();
                    formData.append('media', mediaBuffer, { filename: 'video.mp4' });
                    formData.append('models', 'nudity-2.1');
                    formData.append('api_user', SIGHTENGINE_API_USER);
                    formData.append('api_secret', SIGHTENGINE_API_SECRET);
                    const response = await axios.post('https://api.sightengine.com/1.0/video/check-sync.json', formData, { headers: formData.getHeaders() });
                    if (response.data?.data?.frames?.length > 0) {
                        for (const frame of response.data.data.frames) {
                            if (frame.nudity) { 
                                for (const model of RELEVANT_NUDITY_MODELS) {
                                    if ((frame.nudity[model] || 0) > VIDEO_NUDITY_THRESHOLD) {
                                        isPornographic = true;
                                        reason = `Contenido explícito detectado en video (Modelo: ${model})`;
                                        break; 
                                    }
                                }
                            }
                            if (isPornographic) break; 
                        }
                    }
                }
            } catch (error) {
                console.error('[Anti-Porn] Error procesando video:', error.message);
                mediaBuffer = null;
            }
        }

        // 4. Tomar acción
        if (isPornographic) {
            const messageKeyToDelete = originalBaileysMsg?.key;
            if (!messageKeyToDelete) return false;

            // Reenviar a moderación
            if (mediaBuffer && (messageType === 'image' || messageType === 'video')) {
                try {
                    const caption = `🚨 Media inapropiada 🚨\n\n*Grupo:* ${groupMetadata.subject}\n*Usuario:* ${senderJid.split('@')[0]}\n*Razón:* ${reason}`;
                    const messageToSend = messageType === 'image' ? { image: mediaBuffer, caption } : { video: mediaBuffer, caption };
                    await sock.sendMessage(MODERATION_JID, messageToSend);
                } catch (forwardError) {
                    await sock.sendMessage(MODERATION_JID, { text: `⚠️ FALLO REENVÍO DE MEDIA (${messageType} de ${senderJid}). Razón: ${reason}.` });
                }
            } else if (messageType === 'chat' && body) {
                 try {
                    const textCaption = `🚨 Texto inapropiado 🚨\n\n*Grupo:* ${groupMetadata.subject}\n*Usuario:* ${senderJid.split('@')[0]}\n*Razón:* ${reason}\n\n*Mensaje:* ${body}`;
                    await sock.sendMessage(MODERATION_JID, { text: textCaption });
                 } catch (e) {}
            }
            
            // Eliminar y advertir
            try {
                await sock.sendMessage(chatId, { delete: messageKeyToDelete });
                const userPartForTextMention = jidDecode(senderJid)?.user || senderPhoneNumber;
                const warningText = `⚠️ El mensaje de @${userPartForTextMention} ha sido eliminado. Razón: ${reason.includes('Palabra clave') ? 'Texto no permitido.' : reason }`;
                await sock.sendMessage(chatId, { text: warningText, mentions: [senderJid] });
            } catch (actionError) {
                console.error(`[Anti-Porn] Error al tomar acción (borrar/advertir):`, actionError.message);
            }

            return true; // Mensaje manejado
        }

        return false;
    },

    /**
     * Esta función se ejecuta cuando se usa .addpalabra, .delpalabra, etc.
     */
    async execute(sock, msg, args, commandName) {
        if (msg.author !== OWNER_ID) {
            return msg.reply('❌ Comando exclusivo para el propietario del bot.');
        }

        switch (commandName) {
            case 'addpalabra': {
                if (args.length === 0) {
                    return msg.reply('Uso: `.addpalabra <palabra1> <palabra2> ...`');
                }
                const wordsToAdd = args.map(word => word.toLowerCase());
                let addedCount = 0;
                wordsToAdd.forEach(word => {
                    if (!forbiddenKeywords.includes(word)) {
                        forbiddenKeywords.push(word);
                        addedCount++;
                    }
                });
                if (addedCount > 0) saveKeywords();
                return msg.reply(`✅ Se añadieron ${addedCount} nueva(s) palabra(s) a la lista de prohibidas.`);
            }

            case 'delpalabra': {
                if (args.length === 0) {
                    return msg.reply('Uso: `.delpalabra <palabra1> <palabra2> ...`');
                }
                const wordsToRemove = args.map(word => word.toLowerCase());
                let removedCount = 0;
                const newKeywords = forbiddenKeywords.filter(word => {
                    if (wordsToRemove.includes(word)) {
                        removedCount++;
                        return false;
                    }
                    return true;
                });
                
                if (removedCount > 0) {
                    forbiddenKeywords = newKeywords;
                    saveKeywords();
                }
                return msg.reply(`✅ Se eliminaron ${removedCount} palabra(s) de la lista de prohibidas.`);
            }

            case 'listpalabras': {
                if (forbiddenKeywords.length === 0) {
                    return msg.reply('📜 *Lista de Palabras Prohibidas:*\n\n(Actualmente vacía)');
                }
                const list = forbiddenKeywords.join(', ');
                return msg.reply(`📜 *Lista de Palabras Prohibidas:*\n\n${list}`);
            }
        }
    }
};