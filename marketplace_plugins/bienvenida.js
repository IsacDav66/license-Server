// --- plugins/bienvenida-comunidad.js ---


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

const color = {
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
    brightGreen: "\x1b[92m",
    magenta: "\x1b[35m",
    yellow: "\x1b[33m"
};

module.exports = {
    name: 'Bienvenida Comunidad Simple',
    description: 'Saluda al usuario y le indica unirse al grupo principal desde la Comunidad.',
    isListener: true,
    category: 'Grupo', // Añadido para el filtro
    marketplace: {
        tebex_id: 7383040,
        price: "6.00",
        icon: "fa-door-open",
        preview: {
            suggestions: ["Simular Entrada"],
            responses: {
                "Simular Entrada": "¡Hola @Usuario! 👋 ¡Bienvenido a nuestra Comunidad!\n\nEstás en el grupo de *Recepción*. Para empezar a interactuar, entra a la pestaña de la **Comunidad** y únete al **Grupo Principal**. 🚀"
            }
        }
    },

    initialize: async (sock) => {
        // ID del grupo donde el bot dará la bienvenida (Recepción)
        const GRUPO_RECEPCION = '120363241724220394@g.us';

        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;

                // 1. FILTRO: Solo actuar en el grupo de recepción y cuando alguien entra
                if (id !== GRUPO_RECEPCION || action !== 'add') return;

                for (let participant of participants) {
                    /**
                     * 🛡️ SOLUCIÓN AL ERROR .split (Compatibilidad v7+ LIDs)
                     * Extraemos el ID ya sea que venga como String o como Objeto
                     */
                    let rawJid = "";
                    if (typeof participant === 'string') {
                        rawJid = participant;
                    } else if (participant && typeof participant === 'object') {
                        rawJid = participant.id || participant.jid || String(participant);
                    }

                    // Si no hay un ID válido, saltar al siguiente
                    if (!rawJid || !rawJid.includes('@')) continue;

                    // Extraemos el número o ID para la mención visual
                    const userTag = rawJid.split('@')[0];
                    
                    console.log(`${color.magenta}✨ [BIENVENIDA]${color.reset} Usuario detectado: ${color.brightGreen}${userTag}${color.reset}`);

                    /**
                     * 📝 MENSAJE DE INSTRUCCIONES
                     * Se le indica al usuario que use la interfaz de la Comunidad.
                     */
                    const textoMsg = `¡Hola @${userTag}! 👋 ¡Bienvenido a nuestra Comunidad!\n\nEstás en el grupo de *Recepción*. Para empezar a interactuar y hablar con todos, por favor entra a la pestaña de la **Comunidad** en tu WhatsApp y únete al **Grupo Principal** que verás en la lista.\n\n¡Te esperamos allá! 🚀`;

                    // Enviar mensaje mencionando al usuario
                    await sock.sendMessage(id, {
                        text: textoMsg,
                        mentions: [rawJid] // Esto hace que al usuario le suene la notificación
                    });
                }
            } catch (err) {
                console.error(`${color.yellow}⚠️ [ERROR PLUGIN BIENVENIDA]${color.reset}`, err.message);
            }
        });

        console.log(`${color.cyan}✅ [PLUGIN] Bienvenida de Comunidad (Instrucción Manual) lista.${color.reset}`);
    }
};