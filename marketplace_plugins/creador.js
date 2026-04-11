// plugins/creador.js
const fs = require('fs'); // Necesitamos 'fs' para leer el archivo del sticker

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

const path = require('path'); // Necesitamos 'path' para construir la ruta al sticker

module.exports = {
    name: "Creador",
    aliases: ["creador"],
    description: "Muestra información sobre el creador del bot Stun y envía un sticker.", // Descripción actualizada
    category: "Info",
    marketplace: {
        tebex_id: 7383039,
        price: "2.00",
        icon: "fa-user-gear",
        preview: {
            suggestions: ["!creador"],
            responses: {
                "!creador": {
                    text: "♨️𝙎𝙩𝙪𝙣 𝘽𝙤𝙩 | 𝙂𝙧𝙪𝙥𝙤 𝘼𝙣𝙖𝙧𝙦𝙪𝙞𝙘𝙤 ♨️\n\n𝙐𝙣𝙞𝙘𝙤 𝙘𝙧𝙚𝙖𝙙𝙤𝙧 @51959442730\n𝘿𝙚𝙨𝙖𝙧𝙧𝙤𝙡𝙡𝙤 𝙚𝙣 𝙉𝙤𝙙𝙚𝙅𝙎\n2025",
                    image: "https://i.pinimg.com/originals/2e/2d/71/2e2d71661da0568bce11847e896c9e91.jpg" // Simula el sticker
                    
                }
            }
        }
    },

    async execute(sock, m) {
        // JID completo del creador para la mención interna de WhatsApp
        const creatorJid = "51959442730@s.whatsapp.net"; 
        
        // Solo el número para mostrar en el texto de la mención
        const creatorNumberForText = creatorJid.split('@')[0]; 

        // Construcción del mensaje con el formato específico solicitado
        const message = `♨️𝙎𝙩𝙪𝙣 𝘽𝙤𝙩 | 𝙂𝙧𝙪𝙥𝙤 𝘼𝙣𝙖𝙧𝙦𝙪𝙞𝙘𝙤 ♨️\n\n` +
                        `𝙐𝙣𝙞𝙘𝙤 𝙘𝙧𝙚𝙖𝙙𝙤𝙧  @${creatorNumberForText} \n` + // Aquí se inserta la mención
                        `𝘿𝙚𝙨𝙖𝙧𝙧𝙤𝙡𝙡𝙤 𝙚𝙣 𝙉𝙤𝙙𝙚𝙅𝙎\n` +
                        `2025`;

        // --- Configuración del Sticker ---
        // Construye la ruta al sticker. 
        // __dirname es el directorio actual (plugins). Subimos un nivel (..) para ir al raíz del bot,
        // luego entramos en 'assets' y luego en 'creator'.
        const stickerFileName = 'sticker.webp'; // <--- ¡CAMBIA ESTO AL NOMBRE REAL DE TU ARCHIVO!
        const stickerPath = path.join(__dirname, '../../assets/creator', stickerFileName);
        
        try {
            // 1. Envía el mensaje de texto primero
            await sock.sendMessage(
                m.from, // El ID del chat (grupo o privado)
                { 
                    text: message, 
                    mentions: [creatorJid] // Array de JIDs para que WhatsApp realice la mención
                },
                { quoted: m._baileysMessage } // Opcional: Para que el mensaje sea una respuesta
            );

            // 2. Verifica si el archivo del sticker existe y luego envíalo
            if (fs.existsSync(stickerPath)) {
                const stickerBuffer = fs.readFileSync(stickerPath); // Lee el archivo
                await sock.sendMessage(
                    m.from, 
                    { sticker: stickerBuffer } // Envía el sticker como un Buffer
                    // Nota: Los stickers generalmente no se citan, pero puedes añadir { quoted: m._baileysMessage } aquí si lo deseas.
                );
                console.log(`[Creador Plugin] Sticker '${stickerFileName}' enviado con éxito.`);
            } else {
                console.warn(`[Creador Plugin] Advertencia: El archivo de sticker no se encontró en la ruta: ${stickerPath}`);
                await sock.sendMessage(m.from, { text: "⚠️ No pude enviar el sticker del creador. Asegúrate de que el archivo exista en `assets/creator`." });
            }

        } catch (error) {
            console.error("[Creador Plugin ERROR] Fallo al enviar mensaje o sticker:", error);
            await m.reply("❌ Ocurrió un error al intentar mostrar la información del creador o enviar el sticker.");
        }
    },
};