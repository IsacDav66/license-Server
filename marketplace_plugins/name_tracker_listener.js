// plugins/name_tracker_listener.js
const { updateUserName } = require('../shared-economy.js'); // <-- CAMBIADO

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


module.exports = {
    name: 'Rastreador de Nombres',
    description: 'Escucha mensajes para guardar el pushname de los usuarios en PostgreSQL.',
    isListener: true,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383030,
        price: "3.00",
        icon: "fa-id-card",
        preview: {
            suggestions: ["¿Quién soy?", "!test-tracker"],
            responses: {
                "¿Quién soy?": "🤖 *Rastreador de Nombres:* He guardado tu nombre como 'StunDoc' en la base de datos SQL.",
                "!test-tracker": "✅ *Sync:* Nombre y JID vinculados correctamente en PostgreSQL."
            }
        }
    },

    async checkMessage(sock, msg) {
        // La lógica interna no cambia en absoluto.
        const chatInfo = await msg.getChat();
        if (!chatInfo.isGroup || msg.fromMe) return false;

        const senderId =msg.senderLid || msg.author;
        const contactInfo = await msg.getContact();
        const senderName = contactInfo?.pushname;

        if (senderId && senderName) {
            updateUserName(senderId, senderName);
        }
        
        return false;
    }
};