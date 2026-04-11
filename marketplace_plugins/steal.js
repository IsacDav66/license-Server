// plugins/steal.js (Baileys Version - LID/JID para Remitente y Menciones)
// Comando para robar dinero EN MANO a otros usuarios, con verificación de registro.

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


const { getUserData, saveUserData, msToTime } = require('../../lib/bot-core');
const { jidDecode } = require('@whiskeysockets/baileys'); // Para obtener número de JID
const MONEY_SYMBOL = '$'; // Puedes cambiarlo a 💵 si prefieres

const COOLDOWN_STEAL_MS = 30 * 60 * 1000; // 30 minutos
const STEAL_SUCCESS_CHANCE = 0.60;
const STEAL_MIN_PERCENT = 0.05; // 5%
const STEAL_MAX_PERCENT = 0.20; // 20%
const STEAL_FAIL_PENALTY_MONEY = 500;

// Ajustar parámetros a sock, msg, args, commandName
const execute = async (sock, msg, args, commandName, finalUserIdFromMain = null) => { // <--- finalUserIdFromMain AÑADIDO AQUÍ
    // --- ID del que ejecuta el comando (LID o JID, ya resuelto por el bot.js principal) ---
    const commandSenderId = finalUserIdFromMain; // <--- USAR finalUserIdFromMain aquí
    const chatId = msg.from; // JID del chat actual
    
    // Obtener información del contacto del remitente del comando para logs o menciones
    const senderContactInfo = await msg.getContact();
    if (!senderContactInfo) {
        console.error(`[Steal Plugin Baileys] No se pudo obtener el contacto del remitente ${commandSenderId}.`);
        try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) { console.error(`[Steal Plugin Baileys] Error enviando reply de no identificación:`, e); }
        return;
    }

    const attackerUser = await getUserData(commandSenderId, msg); // Datos del atacante

    if (!attackerUser) {
        console.error(`[Steal Plugin Baileys] No se pudieron obtener los datos para ${commandSenderId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error(`[Steal Plugin Baileys] Error enviando reply de error de datos:`, e); }
        return;
    }

    // --- INICIO Bloque de Verificación de Registro (para el ATACANTE) ---
    if (!attackerUser.password) { // Si el ATACANTE no tiene contraseña
        const currentChatInfo = await msg.getChat();
        if (!currentChatInfo.isGroup) {
            await msg.reply("🔒 Comando exclusivo de grupos. Por favor, usa este comando en un grupo para iniciar tu registro o usar las funciones de economía.");
            return;
        }
        const userNameToMention = attackerUser.pushname || commandSenderId.split('@')[0];

        if (!attackerUser.phoneNumber) { // CASO A: Sin contraseña NI número
            attackerUser.registration_state = 'esperando_numero_telefono';
            await saveUserData(commandSenderId, attackerUser); 
            console.log(`[Steal Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) no tiene contraseña ni teléfono. Solicitando número.`);
            const currentPrefix = msg.body.charAt(0);
            await sock.sendMessage(chatId, {
                text: `👋 ¡Hola @${userNameToMention}!\n\n` +
                      `Para usar las funciones de economía (como '${commandName}'), primero necesitamos registrar tu número de teléfono.\n\n` +
                      `Por favor, responde en ESTE CHAT GRUPAL con el comando:\n` +
                      `*${currentPrefix}mifono +TUNUMEROCOMPLETO*\n` +
                      `(Ej: ${currentPrefix}mifono +11234567890)\n\n` +
                      `Tu nombre de perfil actual es: *${attackerUser.pushname || 'No detectado'}*.`,
                mentions: [msg.author] // Usa msg.author para la mención visual en el chat
            }, { quoted: msg._baileysMessage });
            return;
        } else { // CASO B: Tiene número pero NO contraseña
            attackerUser.registration_state = 'esperando_contraseña_dm'; 
            await saveUserData(commandSenderId, attackerUser);
            
            console.log(`[Steal Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) tiene teléfono (+${attackerUser.phoneNumber}). Estado 'esperando_contraseña_dm' establecido.`);

            let displayPhoneNumber = attackerUser.phoneNumber;
            if (attackerUser.phoneNumber && !String(attackerUser.phoneNumber).startsWith('+')) {
                displayPhoneNumber = `+${attackerUser.phoneNumber}`;
            }

            await sock.sendMessage(chatId, {
                text: `🛡️ ¡Hola @${userNameToMention}!\n\n` +
                      `Ya tenemos tu número de teléfono registrado (*${displayPhoneNumber}*).\n` +
                      `Ahora, para completar tu registro, te he enviado un mensaje privado (DM) a ese número para que configures tu contraseña. Por favor, revisa tus DMs.\n`+
                      `‼️ Si quieres actualizar tu numero escribe .actualizarfono +52111222333 RECUERDA INCLUIR TODO TU NUMERO Y CODIGO DE PAIS\n`,
                mentions: [msg.author] // Usa msg.author para la mención visual en el chat
            }, { quoted: msg._baileysMessage });
            
            const dmChatJidToSendTo = `${attackerUser.phoneNumber}@s.whatsapp.net`;
            const dmMessageContent = "🔑 Por favor, responde a este mensaje con la contraseña que deseas establecer para los comandos de economía.";
            
            console.log(`[Steal Plugin Baileys DM DEBUG] Intentando enviar DM para contraseña a ${dmChatJidToSendTo}.`);
            try {
                await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                console.log(`[Steal Plugin Baileys DM SUCCESS] DM para contraseña enviado a ${dmChatJidToSendTo}.`);
            } catch(dmError){
                console.error(`[Steal Plugin Baileys DM ERROR] Error enviando DM a ${dmChatJidToSendTo}:`, dmError);
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que tu número registrado (+${attackerUser.phoneNumber || 'desconocido'}) sea correcto y que puedas recibir mensajes. Intenta de nuevo.`,
                    mentions: [commandSenderId]
                }, { quoted: msg._baileysMessage });
            }
            return; 
        }
    }
    // --- FIN Bloque de Verificación de Registro ---

    console.log(`[Steal Plugin Baileys] Usuario ${commandSenderId} (${attackerUser.pushname || 'N/A'}) está registrado. Procesando comando .steal.`);

    // --- Lógica Específica del Comando .steal ---
    const attackerId = commandSenderId; // Es el mismo que commandSenderId
    // attackerUser ya contiene los datos del atacante

    const now = Date.now();
    const timeSinceLastSteal = now - (attackerUser.laststeal || 0);

    if (timeSinceLastSteal < COOLDOWN_STEAL_MS) {
        const timeLeft = COOLDOWN_STEAL_MS - timeSinceLastSteal;
        return msg.reply(`*⏳ Debes esperar ${msToTime(timeLeft)} para intentar robar de nuevo.*`);
    }

    const baileysOriginalMsg = msg._baileysMessage;
    const mentionedJidsInMsg = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJidsInMsg.length === 0) {
        return msg.reply("❓ Debes mencionar a quién quieres robar. Ejemplo: `.steal @usuario`");
    }

    // --- RESOLUCIÓN DEL ID DEL OBJETIVO (VÍCTIMA) ---
    const rawMentionedJid = mentionedJidsInMsg[0]; // JID original del usuario mencionado
    let targetId; // Este será el LID o JID que usaremos para la BD

    // Obtener la metadata del grupo si es un chat de grupo (para LIDs de mencionados)
    const chat = await msg.getChat(); // Ya existe en tu código original
    const isGroup = chat.isGroup;
    const groupParticipants = chat.groupMetadata?.participants || []; // Ya existe en tu código original

    if (isGroup) {
        // Si es un grupo, intenta encontrar el LID del participante mencionado
        const mentionedParticipant = groupParticipants.find(p => p.id === rawMentionedJid);
        targetId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : rawMentionedJid;
        console.log(`[Steal Plugin Baileys Debug] Mención en grupo: Target ID resuelto para víctima: ${targetId}`);
    } else {
        targetId = rawMentionedJid; // Si no es grupo o no hay metadata, usamos el JID directamente
        console.log(`[Steal Plugin Baileys Debug] Mención en privado/sin metadata: Target ID para víctima: ${targetId}`);
    }
    // --- FIN RESOLUCIÓN ID OBJETIVO ---


    if (targetId === attackerId) {
        return msg.reply("🤦 No puedes robarte a ti mismo.");
    }

    // Obtener datos del objetivo (víctima). No pasamos 'msg' ya que 'msg' es del atacante.
    const targetUser = await getUserData(targetId); 

    if (!targetUser) {
        console.error(`[Steal Plugin Baileys] No se pudieron obtener los datos del objetivo ${targetId}`);
        return msg.reply("❌ Hubo un error al obtener los datos del usuario objetivo. Quizás no está en la base de datos.");
    }
    
    // Para los nombres a mostrar en el mensaje
    const finalTargetName = targetUser.pushname || jidDecode(rawMentionedJid)?.user || rawMentionedJid.split('@')[0];
    const attackerName = attackerUser.pushname || jidDecode(msg.author)?.user || msg.author.split('@')[0]; // Usamos msg.author para el nombre del atacante


    targetUser.money = targetUser.money || 0; // Asegurar que sea numérico

    if (targetUser.money <= 0) {
        return msg.reply(`💸 *${finalTargetName}* no tiene dinero en mano para robar. ¡Quizás lo tiene en el banco! 😉`);
    }
    
    attackerUser.laststeal = now; // Establecer cooldown para el atacante
    attackerUser.money = attackerUser.money || 0; // Asegurar que sea numérico

    let responseText;
    let mentionsInResponse = [msg.author, rawMentionedJid]; // Preparar para mencionar a ambos (JIDs originales)

    if (Math.random() < STEAL_SUCCESS_CHANCE) { // ROBO EXITOSO
        const maxCanSteal = targetUser.money; 
        let stolenAmount = Math.floor(targetUser.money * (Math.random() * (STEAL_MAX_PERCENT - STEAL_MIN_PERCENT) + STEAL_MIN_PERCENT));
        stolenAmount = Math.min(stolenAmount, maxCanSteal); // No robar más de lo que tiene
        stolenAmount = Math.max(stolenAmount, 1); // Robar al menos 1 si es posible

        if (stolenAmount <= 0 && targetUser.money > 0) { // Si el cálculo da 0 pero tiene algo
             stolenAmount = Math.min(1, targetUser.money); // Robar 1
        }
        
        if (stolenAmount <= 0 ) { // Si después de todo, no se puede robar nada (por ejemplo, víctima tiene 0 o 1 y el cálculo da 0)
             await saveUserData(attackerId, attackerUser); // Guardar solo el laststeal del atacante
             responseText = `😅 @${attackerName} intentaste robar a @${finalTargetName}, pero apenas tenía centavos en mano. No conseguiste nada.`;
        } else {
            attackerUser.money += stolenAmount;
            targetUser.money -= stolenAmount;

            await saveUserData(attackerId, attackerUser);
            await saveUserData(targetId, targetUser);

            console.log(`[Steal Plugin Baileys] ${attackerId} (${attackerName}) robó ${stolenAmount} de DINERO EN MANO a ${targetId} (${finalTargetName}).`);
            responseText = `*💰 ¡Éxito!* @${attackerName} le robaste *${MONEY_SYMBOL}${stolenAmount.toLocaleString()}* (en mano) a @${finalTargetName}.\nAhora tienes ${MONEY_SYMBOL}${attackerUser.money.toLocaleString()}.`;
        }
    } else { // ROBO FALLIDO
        const penalty = Math.min(attackerUser.money, STEAL_FAIL_PENALTY_MONEY); // No perder más de lo que tiene o la penalización fija
        attackerUser.money -= penalty;
        if (attackerUser.money < 0) attackerUser.money = 0;
        await saveUserData(attackerId, attackerUser); // Guardar laststeal y nuevo money del atacante

        console.log(`[Steal Plugin Baileys] ${attackerId} (${attackerName}) falló robando a @${finalTargetName} y perdió ${penalty}.`);
        responseText = `*🚓 ¡Fallaste!* @${finalTargetName} descubrió a @${attackerName}.`;
        if (penalty > 0) {
            responseText += ` Perdiste *${MONEY_SYMBOL}${penalty.toLocaleString()}* en la huida.\nAhora tienes ${MONEY_SYMBOL}${attackerUser.money.toLocaleString()}.`;
        } else {
            responseText += ` Por suerte no perdiste nada.`;
        }
    }

    try {
        await sock.sendMessage(chatId, {
            text: responseText,
            mentions: mentionsInResponse
        }, { quoted: msg._baileysMessage });
    } catch (error) {
        console.error("[Steal Plugin Baileys] Error enviando mensaje de resultado del robo:", error);
        // Fallback simple si el envío con menciones falla (quita las @ del texto)
        await msg.reply(responseText.replace(/@\S+/g, '')); 
    }
};

module.exports = {
    name: 'Robar',
    aliases: ['steal', 'robar'],
    description: 'Intenta robar dinero EN MANO a otro usuario (con cooldown y riesgo).',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383052,
        price: "8.00",
        icon: "fa-hand-holding-dollar",
        preview: {
            suggestions: ["!robar @Usuario"],
            responses: {
                "!robar @Usuario": "*💰 ¡Éxito!* @Atacante le robaste **$450** a @Víctima. ¡Corre! 🏃💨"
            }
        }
    },
};