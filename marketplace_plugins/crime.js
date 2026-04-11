// plugins/crime.js (Baileys Version)
// Comando para cometer crímenes y ganar dinero (con riesgos), con verificación de registro.

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


const { getUserData, saveUserData, msToTime, pickRandom } = require('../../lib/bot-core');
const MONEY_SYMBOL = '💵';

const COOLDOWN_CRIME_MS = 15 * 60 * 1000; // 15 minutos de cooldown

const crimes = [
    {
        description: "Intentas robar una tienda de conveniencia 🏪",
        successMessage: (amount) => `¡Lograste robar la tienda! Te llevaste ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `🚨 ¡Te atraparon! Tuviste que pagar una multa de ${MONEY_SYMBOL}${penalty.toLocaleString()}.`,
        minReward: 500, maxReward: 2500, penaltyPercent: 0.5, minPenaltyFlat: 200, successChance: 0.65
    },
    {
        description: "Hackeas un cajero automático 💻🏧",
        successMessage: (amount) => `¡Hackeo exitoso! Conseguiste ${MONEY_SYMBOL}${amount.toLocaleString()} del cajero.`,
        failureMessage: (penalty) => `🔒 ¡El sistema te detectó! Perdiste ${MONEY_SYMBOL}${penalty.toLocaleString()} mientras intentabas cubrir tus rastros.`,
        minReward: 800, maxReward: 4000, penaltyPercent: 0.6, minPenaltyFlat: 300, successChance: 0.55
    },
    {
        description: "Participas en una carrera callejera ilegal 🏎️💨",
        successMessage: (amount) => `¡Ganaste la carrera! Te llevaste el premio de ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `💥 ¡Chocaste el auto! Los daños te costaron ${MONEY_SYMBOL}${penalty.toLocaleString()}.`,
        minReward: 1000, maxReward: 5000, penaltyPercent: 0.4, minPenaltyFlat: 150, successChance: 0.70
    },
    {
        description: "Robas un banco pequeño con una pistola de agua 🔫💧",
        successMessage: (amount) => `¡Nadie se dio cuenta de que era de agua! Te llevaste ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `🤣 ¡Se rieron de ti y llamaron a la policía! Te multaron con ${MONEY_SYMBOL}${penalty.toLocaleString()}.`,
        minReward: 200, maxReward: 1500, penaltyPercent: 0.75, minPenaltyFlat: 400, successChance: 0.40
    }
];

// Ajustar parámetros a sock, msg, args, commandName
const execute = async (sock, msg, args, commandName) => {
    // --- INICIO Bloque de Verificación de Registro ---
    const senderContactInfo = await msg.getContact(); // Desde tu adaptador
    if (!senderContactInfo) {
        console.error(`[Crime Plugin Baileys] No se pudo obtener el contacto del remitente.`);
        try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) { console.error(`[Crime Plugin Baileys] Error enviando reply de no identificación:`, e); }
        return;
    }
    const commandSenderId =msg.senderLid || msg.author; // JID del remitente
    const chatId = msg.from; // ID del chat
    const user = await getUserData(commandSenderId, msg); // Pasar 'msg' para actualizar pushname

    if (!user) {
        console.error(`[Crime Plugin Baileys] No se pudieron obtener los datos del usuario para ${commandSenderId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error(`[Crime Plugin Baileys] Error enviando reply de error de datos:`, e); }
        return;
    }

    if (!user.password) { // Si el usuario (commandSenderId) NO tiene contraseña
        const currentChatInfo = await msg.getChat(); // Desde tu adaptador
        if (!currentChatInfo.isGroup) {
            await msg.reply("🔒 Comando exclusivo de grupos. Por favor, usa este comando en un grupo para iniciar tu registro o usar las funciones de economía.");
            return;
        }
        const userNameToMention = user.pushname || commandSenderId.split('@')[0];
        if (!user.phoneNumber) { // CASO A: Sin contraseña NI número
            user.registration_state = 'esperando_numero_telefono';
            await saveUserData(commandSenderId, user);
            console.log(`[Crime Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) no tiene contraseña ni teléfono. Solicitando número. Estado: esperando_numero_telefono.`);
            const currentPrefix = msg.body.charAt(0);
            
            await sock.sendMessage(chatId, {
                text: `👋 ¡Hola @${userNameToMention}!\n\n` +
                      `Para usar las funciones de economía (como cometer crímenes), primero necesitamos registrar tu número de teléfono.\n\n` +
                      `Por favor, responde en ESTE CHAT GRUPAL con el comando:\n` +
                      `*${currentPrefix}mifono +TUNUMEROCOMPLETO*\n` +
                      `(Ej: ${currentPrefix}mifono +11234567890)\n\n` +
                      `Tu nombre de perfil actual es: *${user.pushname || 'No detectado'}*.`,
                mentions: [commandSenderId]
            }, { quoted: msg._baileysMessage });
            return;
        } else { // CASO B: Tiene número pero NO contraseña
            user.registration_state = 'esperando_contraseña_dm';
            await saveUserData(commandSenderId, user);
            
            console.log(`[Crime Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) tiene teléfono (+${user.phoneNumber}). Estado 'esperando_contraseña_dm' establecido para ${commandSenderId}.`);

            let displayPhoneNumber = user.phoneNumber;
            if (user.phoneNumber && !String(user.phoneNumber).startsWith('+')) {
                displayPhoneNumber = `+${user.phoneNumber}`;
            }

            await sock.sendMessage(chatId, {
                text: `🛡️ ¡Hola @${userNameToMention}!\n\n` +
                      `Ya tenemos tu número de teléfono registrado (*${displayPhoneNumber}*).\n` +
                      `Ahora, para completar tu registro, te he enviado un mensaje privado (DM) a ese número para que configures tu contraseña. Por favor, revisa tus DMs.\n`+
                      `‼️ Si quieres actualizar tu numero escribe .actualizarfono +52111222333 RECUERDA INCLUIR TODO TU NUMERO Y CODIGO DE PAIS\n`,
                mentions: [commandSenderId]
            }, { quoted: msg._baileysMessage });
            
            const dmChatJidToSendTo = `${user.phoneNumber}@s.whatsapp.net`;
            const dmMessageContent = "🔑 Por favor, responde a este mensaje con la contraseña que deseas establecer para los comandos de economía.";
            
            console.log(`[Crime Plugin Baileys DM DEBUG] Intentando enviar DM para contraseña a ${dmChatJidToSendTo}.`);
            try {
                await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                console.log(`[Crime Plugin Baileys DM SUCCESS] DM para contraseña enviado exitosamente a ${dmChatJidToSendTo}.`);
            } catch(dmError){
                console.error(`[Crime Plugin Baileys DM ERROR] Error enviando DM para contraseña a ${dmChatJidToSendTo}:`, dmError);
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que puedes recibir mensajes de este número.`,
                    mentions: [commandSenderId]
                }, { quoted: msg._baileysMessage });
            }
            return; 
        }
    }
    // --- FIN Bloque de Verificación de Registro ---

    console.log(`[Crime Plugin Baileys] Usuario ${commandSenderId} (${user.pushname || 'N/A'}) está registrado. Procesando comando .crime.`);
    
    const now = Date.now();
    const timeSinceLastCrime = now - (user.lastcrime || 0);

    if (timeSinceLastCrime < COOLDOWN_CRIME_MS) {
        const timeLeft = COOLDOWN_CRIME_MS - timeSinceLastCrime;
        return msg.reply(`*👮‍♂️ Estás bajo el radar, debes esperar ${msToTime(timeLeft)} para cometer otro crimen.*`);
    }

    const crime = pickRandom(crimes);
    user.lastcrime = now;

    await msg.reply(`*⌛ ${crime.description}...*`);
    // Simular un retraso para el "procesamiento" del crimen
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000)); 

    if (typeof user.money !== 'number' || isNaN(user.money)) user.money = 0;

    if (Math.random() < crime.successChance) {
        // Éxito
        const amountGained = Math.floor(Math.random() * (crime.maxReward - crime.minReward + 1)) + crime.minReward;
        user.money += amountGained;
        await saveUserData(commandSenderId, user);
        console.log(`[Crime Plugin Baileys] ${commandSenderId} (${user.pushname || 'N/A'}) tuvo éxito en '${crime.description}', ganó ${amountGained}. Dinero: ${user.money}`);
        return msg.reply(`*✅ ${crime.successMessage(amountGained)}*\nTu dinero: ${MONEY_SYMBOL}${user.money.toLocaleString()}`);
    } else {
        // Fallo
        let penaltyAmount = Math.floor((user.money || 0) * crime.penaltyPercent); // Asegurar user.money es numérico
        penaltyAmount = Math.max(penaltyAmount, crime.minPenaltyFlat);
        penaltyAmount = Math.min(penaltyAmount, (user.money || 0)); // No penalizar más de lo que tiene

        user.money -= penaltyAmount;
        if (user.money < 0) user.money = 0; 
        
        await saveUserData(commandSenderId, user);
        console.log(`[Crime Plugin Baileys] ${commandSenderId} (${user.pushname || 'N/A'}) falló en '${crime.description}', perdió ${penaltyAmount}. Dinero: ${user.money}`);
        let finalMessage = `*❌ ${crime.failureMessage(penaltyAmount)}*`;
        finalMessage += `\nTu dinero: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;
        return msg.reply(finalMessage);
    }
};

module.exports = {
    name: 'Crimen',
    aliases: ['crime', 'crimen', 'delito'],
    description: 'Comete crímenes para intentar ganar dinero (con cooldown y riesgos).',
    category: 'Economía',
    execute,
    marketplace: {
        tebex_id: 7383050,
        price: "5.00",
        icon: "fa-mask",
        preview: {
            suggestions: ["!crime", "!delito"],
            responses: {
                "!crime": "🚨 ¡Hackeo exitoso! Conseguiste **$3,400** del cajero automático. 🏧💻",
                "!delito": "💥 ¡Chocaste el auto! Los daños te costaron **$1,200**. 🏎️💨"
            }
        }
    },
};