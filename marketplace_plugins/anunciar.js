// plugins/Dueño/anunciar.js


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

// --- CONFIGURACIÓN ---
// Define tu ID de propietario. Solo este ID podrá usar el comando.
const OWNER_ID = '1658008416509@lid';
// Define el JID del grupo donde se enviarán los anuncios.
const ANNOUNCEMENT_GROUP_JID = '120363241724220394@g.us';

module.exports = {
    name: 'Anunciador Global',
    aliases: ['anunciar', 'anuncio', 'broadcast'],
    description: 'Envía un anuncio formateado a un grupo predefinido.',
    category: 'Dueño',
    // Se puede usar desde cualquier chat, no solo en grupos.
    groupOnly: false,
    marketplace: {
        tebex_id: 7383056,
        price: "5.00",
        icon: "fa-bullhorn",
        preview: {
            suggestions: ["!anunciar Nueva Update!"],
            responses: {
                "!anunciar Nueva Update!": "*╭───◎「 📢 STUN | UPDATE 」◎───╮*\n*│*\n*│*  Nueva Update!\n*│*\n*│* ✨ ¡Espero que disfruten las mejoras!\n*│*\n*╰─────────────◎*"
            }
        }
    },

    async execute(sock, msg, args) {
        const senderId = msg.author;

        // 1. Verificación de Propietario
        // Comprueba si el autor del mensaje es el dueño del bot.
        if (senderId !== OWNER_ID) {
            // Opcional: podrías no responder nada para que otros no sepan que el comando existe.
            return msg.reply('❌ Este comando es exclusivo para el propietario del bot.');
        }

        // 2. Verificar que haya un mensaje para anunciar
        // Si no se escriben palabras después del comando, muestra cómo usarlo.
        if (args.length === 0) {
            return msg.reply(
                '⚠️ Debes escribir el mensaje que quieres anunciar.\n\n' +
                '*Ejemplo:*\n' +
                `.anunciar Se ha corregido el bug del comando .play y se añadió el nuevo plugin .clima`
            );
        }

        // 3. Unir todos los argumentos para formar el mensaje completo
        const announcementText = args.join(' ');

        // 4. Formatear el mensaje del anuncio para que se vea bien
        // Puedes personalizar este formato como más te guste.
        const formattedAnnouncement = `
*╭───◎「 📢 STUN | UPDATE 」◎───╮*
*│*
*│*  ${announcementText}
*│*
*│* ✨ ¡Espero que disfruten las mejoras!
*│*
*╰─────────────◎*
        `.trim(); // .trim() elimina espacios en blanco innecesarios al inicio y al final

        // 5. Enviar el anuncio al grupo especificado
        try {
            await sock.sendMessage(ANNOUNCEMENT_GROUP_JID, {
                text: formattedAnnouncement
            });

            // 6. Enviar una confirmación al propietario de que el mensaje se envió
            await msg.reply('✅ ¡Anuncio enviado con éxito al grupo principal!');

        } catch (error) {
            console.error('[Anunciar] Error al enviar el mensaje al grupo:', error);
            await msg.reply(`❌ Ocurrió un error al intentar enviar el anuncio. Revisa la consola.\n\n*Error:* ${error.message}`);
        }
    }
};