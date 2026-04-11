
// plugins/link-deleter.js

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


const { jidDecode } = require('@whiskeysockets/baileys');

// --- CONFIGURACIÓN DEL PLUGIN ---
const IGNORE_ADMINS = true; // Poner en false si quieres que también borre enlaces de admins
const NOTIFY_USER_ON_DELETE = false; // Poner en true para enviar un aviso (puede ser ruidoso)
const NOTIFICATION_MESSAGE = "⚠️ Tu mensaje fue eliminado porque contenía un enlace no permitido.";
// Expresión regular para detectar enlaces.
const URL_REGEX = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\b[-A-Z0-9+&@#\/%?=~_|!:,.;]+\.(com|org|net|gov|edu|mil|biz|info|mobi|name|aero|jobs|museum|co|io|tv|me|ly|gl|cl|pe|ar|mx|es|us|uk|de|fr|jp|cn|ru|br|pt|it|au|ca|in|ch|at|be|dk|fi|gr|hk|ie|il|kr|lu|nl|no|nz|pl|se|sg|th|tr|tw|vn|za|asia|cat|int|pro|tel|travel|xxx|xyz|page|site|live|online|store|shop|blog|app|dev|tech|info|link|icu|top|club|art|pics|website|space|digital|guru|ninja|expert|solutions|systems|network|world|global|today|news|media|press|center|company|foundation|institute|academy|university|college|school|services|support|help|community|forum|chat|group|social|blog|post|article|video|audio|music|image|photo|gallery|download|file|archive|zip|rar|exe|apk|dmg|iso|torrent|stream|live|watch|play|game|app|store|market|shop|buy|sell|pay|donate|giveaway|contest|sweepstakes|survey|poll|vote|register|login|signup|signin|auth|account|profile|user|member|admin|panel|dashboard|api|sdk|dev|test|stage|prod|beta|alpha|demo|example|localhost)([-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])?)/ig;

// (Opcional) Lista blanca de dominios permitidos (ejemplos)
const ALLOWED_DOMAINS = [
    // 'youtube.com',
    // 'youtu.be',
    // 'twitter.com',
    // 'wa.me' // Enlace de WhatsApp
];
// -----------------------------

module.exports = {
    name: 'Link Deleter',
    description: 'Detecta y elimina automáticamente mensajes con enlaces en grupos (si el bot es admin) y saca al usuario.',
    category: 'Moderación',
    marketplace: {
        requirements: ["Bot Administrador"],
        tebex_id: 7383026,
        price: "10.00",
        icon: "fa-link-slash",
        preview: {
            suggestions: ["Enviar un enlace", "Soy Admin envia link"],
            responses: {
                "Enviar un enlace": "🚨 *Link Deleter:* Enlace detectado. Mensaje eliminado y usuario expulsado del grupo.",
                "Soy Admin envia link": "✅ *Link Deleter:* Administrador detectado. El enlace ha sido permitido."
            }
        }
    },

    async checkMessage(sock, adaptedMessage) {
        const { body, from: chatId, author: senderJid, _baileysMessage: originalBaileysMsg } = adaptedMessage;

        if (!chatId || !chatId.endsWith('@g.us')) {
            return false; // Solo para grupos
        }

        if (!body || typeof body !== 'string' || body.trim() === '') {
            return false; // No hay texto para analizar
        }

        // 1. Verificar si el mensaje contiene un enlace
        const linksFound = body.match(URL_REGEX);

        if (!linksFound || linksFound.length === 0) {
            return false; // No hay enlaces, no hacer nada
        }

        console.log(`[Link Deleter] Enlace(s) detectado(s) de ${senderJid} en ${chatId}: ${linksFound.join(', ')}`);

        // (Opcional) 2. Verificar si el enlace está en la lista blanca de dominios
        if (ALLOWED_DOMAINS.length > 0) {
            let allLinksAllowed = true;
            for (const link of linksFound) {
                try {
                    const domain = new URL(link.startsWith('http') ? link : `http://${link}`).hostname.replace(/^www\./, '');
                    if (!ALLOWED_DOMAINS.some(allowedDomain => domain.endsWith(allowedDomain))) {
                        allLinksAllowed = false;
                        console.log(`[Link Deleter] Enlace ${link} (dominio: ${domain}) NO está en la lista blanca.`);
                        break;
                    } else {
                        console.log(`[Link Deleter] Enlace ${link} (dominio: ${domain}) SÍ está en la lista blanca.`);
                    }
                } catch (e) {
                    console.warn(`[Link Deleter] No se pudo parsear la URL: ${link}. Considerándolo no permitido.`);
                    allLinksAllowed = false;
                    break;
                }
            }
            if (allLinksAllowed) {
                console.log(`[Link Deleter] Todos los enlaces detectados están permitidos. No se borrará.`);
                return false; // Todos los enlaces están en la lista blanca
            }
        }


        // 3. Verificar si el remitente es administrador (si IGNORE_ADMINS es true)
        if (IGNORE_ADMINS) {
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
                if (senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin')) {
                    console.log(`[Link Deleter] Mensaje de administrador (${senderJid}) con enlace. Ignorando borrado.`);
                    return false; // El remitente es admin, no borrar
                }
            } catch (e) {
                console.error(`[Link Deleter] Error obteniendo metadata del grupo ${chatId} para verificar admin:`, e.message);
                return false;
            }
        }

        // Si llegamos aquí, el mensaje contiene un enlace no permitido y el remitente no es un admin (o no se ignoran admins).
        const messageKey = originalBaileysMsg?.key;

        if (!messageKey) {
            console.error("[Link Deleter] No se pudo obtener la clave del mensaje original de Baileys para borrarlo.");
            return false; // No podemos borrar sin la clave
        }

        try {
            // ==========================================================
            // === ACCIÓN 1: Borrar el mensaje ==========================
            // ==========================================================
            console.log(`[Link Deleter] Intentando borrar mensaje con enlace de ${senderJid} en ${chatId}. ID del mensaje: ${messageKey.id}`);
            await sock.sendMessage(chatId, { delete: messageKey });
            console.log(`[Link Deleter] Mensaje de ${senderJid} con enlace borrado exitosamente de ${chatId}.`);
            
            // ==========================================================
            // === ACCIÓN 2: ELIMINAR al usuario (Kick) =================
            // ==========================================================
            try {
                console.log(`[Link Deleter] Intentando eliminar (kick) al usuario: ${senderJid}`);
                await sock.groupParticipantsUpdate(chatId, [senderJid], 'remove');
                console.log(`[Link Deleter] Usuario ${senderJid} eliminado exitosamente de ${chatId}.`);
            } catch (kickError) {
                console.error(`[Link Deleter] ERROR AL INTENTAR ELIMINAR a ${senderJid}:`, kickError.message);
                if (kickError.message && kickError.message.includes("is not admin")) {
                    console.warn(`[Link Deleter] El bot no tiene permiso para ELIMINAR en ${chatId}.`);
                }
            }
            // ==========================================================

            // 5. Notificar al usuario (opcional)
            if (NOTIFY_USER_ON_DELETE) {
                try {
                    const senderNumber = jidDecode(senderJid)?.user;
                    // El mensaje de notificación debe ser enviado antes del kick si queremos citar,
                    // pero para un link deleter estricto, generalmente se notifica a los admins o se ignora.
                    // Aquí, notificaremos al grupo después de borrar/kick, sin citar el mensaje borrado.
                    await sock.sendMessage(chatId, {
                        text: `@${senderNumber}, ${NOTIFICATION_MESSAGE} Ha sido ELIMINADO del grupo por esta infracción.`,
                        mentions: [senderJid]
                    }); 
                } catch (notifyError) {
                    console.error(`[Link Deleter] Error enviando notificación de borrado a ${senderJid}:`, notifyError.message);
                }
            }
            return true; // Mensaje procesado y borrado/usuario eliminado

        } catch (deleteError) {
            console.error(`[Link Deleter] Error al intentar borrar el mensaje de ${senderJid} en ${chatId}:`, deleteError.message);
            
            // Si el bot no es admin para borrar, no puede kickear tampoco, pero lo loggeamos.
            if (deleteError.message && deleteError.message.includes("is not admin")) {
                console.warn(`[Link Deleter] El bot no es administrador en el grupo ${chatId}. No se pudo borrar ni eliminar al usuario.`);
            }
            return false; 
        }
    }
};