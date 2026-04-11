// plugins/Listeners/anti-dox.js (Versión con "Traducción" Anti-Evasión)


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

const { jidNormalizedUser, jidDecode } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const OWNER_ID = '16580084109@lid';
const FORBIDDEN_SEQUENCES = ['doxeo', 'doxx', 'doxear', 'reniec', 'dox'];
const MODERATION_JID = '120363419450783030@g.us';

const userMessageHistory = new Map();
const MESSAGE_WINDOW_MS = 10 * 1000;

// --- ¡NUEVA FUNCIÓN DE TRADUCCIÓN! ---
/**
 * Reemplaza caracteres de evasión comunes por las letras correspondientes.
 * @param {string} text - El texto "aplastado" que aún puede contener números.
 * @returns {string} - El texto "traducido" solo con letras.
 */
function translateLeetSpeak(text) {
    return text
        .replace(/0/g, 'o')
        .replace(/1/g, 'i') // o 'l'
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/6/g, 'g')
        .replace(/7/g, 't')
        .replace(/8/g, 'b')
        .replace(/@/g, 'a');
        // Puedes añadir más reemplazos aquí si lo necesitas
}
// ------------------------------------

module.exports = {
    name: 'Filtro Anti-Doxeo Avanzado',
    description: 'Detecta palabras prohibidas incluso si se escriben en mensajes separados o con números.',
    isListener: true,
    marketplace: {
        requirements: ["Bot Administrador"],
        tebex_id: 7383024,
        price: "15.00",
        icon: "fa-user-secret",
        preview: {
            suggestions: ["doxear", "d0x3@r"],
            responses: {
                "doxear": "🚨 *Filtro Anti-Doxeo:* Intento de doxeo detectado. Mensaje eliminado y reporte enviado a moderación.",
                "d0x3@r": "🚨 *Filtro Anti-Doxeo:* Se detectó evasión (LeetSpeak). Secuencia: 'doxear'. Mensaje eliminado."
            }
        }
    },

    async checkMessage(sock, msg) {
        if (!msg.body || msg.fromMe || !msg.from.endsWith('@g.us') || msg.author === OWNER_ID) {
            return false;
        }
        
        const chatId = msg.from;
        const senderId = msg.author;
        const now = Date.now();

        try {
            // --- LÓGICA DE DETECCIÓN CON MEMORIA Y TRADUCCIÓN ---
            let history = userMessageHistory.get(senderId) || [];
            history = history.filter(entry => now - entry.timestamp < MESSAGE_WINDOW_MS);
            
            history.push({ 
                timestamp: now, 
                text: msg.body,
                key: msg._baileysMessage.key
            });
            userMessageHistory.set(senderId, history);

            const combinedText = history.map(entry => entry.text).join('');
            
            // 1. Normalizar a minúsculas
            const normalizedText = combinedText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            
            // 2. "Aplastamiento" (ahora permite '@' para que sea traducido)
            const squashedText = normalizedText.replace(/[^a-z0-9@]/g, '');

            // 3. "Traducción" de números/símbolos a letras
            const translatedText = translateLeetSpeak(squashedText);

            // 4. Búsqueda en el texto final
            const foundForbiddenSequence = FORBIDDEN_SEQUENCES.find(word => translatedText.includes(word));

            if (foundForbiddenSequence) {
                console.log(`[Anti-Dox Avanzado] ¡Secuencia prohibida detectada! Usuario: ${senderId.split('@')[0]}, Secuencia: "${foundForbiddenSequence}", Texto Traducido: "${translatedText}"`);

                const groupMetadata = (await msg.getChat()).groupMetadata;
                const botJids = [];
                if (process.env.BOT_JID_SWA) botJids.push(process.env.BOT_JID_SWA);
                if (process.env.BOT_JID_LID) botJids.push(process.env.BOT_JID_LID);
                const botParticipant = groupMetadata.participants.find(p => botJids.includes(p.id) || (p.lid && botJids.includes(p.lid)));

                if (!botParticipant?.admin) return false;

                // --- ACCIONES DE MODERACIÓN ---
                try {
                    const evidenceText = `🚨 *Intento de Doxeo Detectado (Evasión)* 🚨\n\n*Grupo:* ${groupMetadata.subject}\n*Usuario:* @${senderId.split('@')[0]}\n*Secuencia detectada:* ${foundForbiddenSequence}\n\n*Mensajes:* \n${history.map(e => `- ${e.text}`).join('\n')}`;
                    await sock.sendMessage(MODERATION_JID, { text: evidenceText, mentions: [senderId] });
                } catch (e) {}

                for (const entry of history) {
                    try { await sock.sendMessage(chatId, { delete: entry.key }); } catch (e) {}
                }
                
                userMessageHistory.delete(senderId);

                try {
                    const warningText = `⚠️ Se han eliminado los mensajes de @${senderId.split('@')[0]} por formar una secuencia de texto prohibida.`;
                    await sock.sendMessage(chatId, { text: warningText, mentions: [senderId] });
                } catch (e) {}

                return true;
            }

        } catch (error) {
            console.error('[Anti-Dox] Error inesperado en checkMessage:', error);
        }

        return false;
    }
};