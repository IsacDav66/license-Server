// plugins/daily.js (Baileys Version)
// Comando para reclamar recompensas diarias y mantener rachas, con verificación de registro.

const { getUserData, saveUserData, msToTime } = require('../shared-economy');
const MONEY_SYMBOL = '💵';
const EXP_SYMBOL = '⭐';

const COOLDOWN_DAILY_MS = 23 * 60 * 60 * 1000; // 23 horas para dar un margen
const MAX_STREAK_DAYS = 30;
const STREAK_LOSS_THRESHOLD_MS = 47 * 60 * 60 * 1000; // 47 horas, un poco menos de 2 días completos

const BASE_DAILY_MONEY = 100;
const BASE_DAILY_EXP = 500;

function getStreakMultiplier(streakDays) {
    if (streakDays <= 0) return 1;
    if (streakDays >= MAX_STREAK_DAYS) streakDays = MAX_STREAK_DAYS;
    // Multiplicador más generoso: 1 + 5% por día de racha, hasta un máximo de x2.5 (en 30 días)
    // Ejemplo: día 1 = x1, día 2 = x1.05, día 10 = x1.45, día 30 = x2.45 (aprox)
    let multiplier = 1 + (0.05 * (streakDays - 1));
    return Math.min(multiplier, 2.5); // Límite superior del multiplicador
}

// ensureDailyFields es menos necesaria si DEFAULT_USER_FIELDS en shared-economy ya incluye lastdaily y dailystreak con valor 0.
// function ensureDailyFields(user) {
//     if (typeof user.lastdaily !== 'number' || isNaN(user.lastdaily)) {
//         user.lastdaily = 0;
//     }
//     if (typeof user.dailystreak !== 'number' || isNaN(user.dailystreak)) {
//         user.dailystreak = 0;
//     }
// }

// Ajustar parámetros a sock, msg, args, commandName
const execute = async (sock, msg, args, commandName) => {
    // --- INICIO Bloque de Verificación de Registro ---
    const senderContactInfo = await msg.getContact(); // Desde tu adaptador
    if (!senderContactInfo) {
        console.error(`[Daily Plugin Baileys] No se pudo obtener el contacto del remitente.`);
        try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) { console.error(`[Daily Plugin Baileys] Error enviando reply de no identificación:`, e); }
        return;
    }
    const commandSenderId =msg.senderLid || msg.author; // JID del remitente
    const chatId = msg.from; // ID del chat
    const user = await getUserData(commandSenderId, msg); // Pasar 'msg' para actualizar pushname

    if (!user) {
        console.error(`[Daily Plugin Baileys] No se pudieron obtener los datos del usuario para ${commandSenderId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error(`[Daily Plugin Baileys] Error enviando reply de error de datos:`, e); }
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
            console.log(`[Daily Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) no tiene contraseña ni teléfono. Solicitando número. Estado: esperando_numero_telefono.`);
            const currentPrefix = msg.body.charAt(0);
            
            await sock.sendMessage(chatId, {
                text: `👋 ¡Hola @${userNameToMention}!\n\n` +
                      `Para usar las funciones de economía (como la recompensa diaria), primero necesitamos registrar tu número de teléfono.\n\n` +
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
            
            console.log(`[Daily Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) tiene teléfono (+${user.phoneNumber}). Estado 'esperando_contraseña_dm' establecido para ${commandSenderId}.`);

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
            
            console.log(`[Daily Plugin Baileys DM DEBUG] Intentando enviar DM para contraseña a ${dmChatJidToSendTo}.`);
            try {
                await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                console.log(`[Daily Plugin Baileys DM SUCCESS] DM para contraseña enviado exitosamente a ${dmChatJidToSendTo}.`);
            } catch(dmError){
                console.error(`[Daily Plugin Baileys DM ERROR] Error enviando DM para contraseña a ${dmChatJidToSendTo}:`, dmError);
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que puedes recibir mensajes de este número.`,
                    mentions: [commandSenderId]
                }, { quoted: msg._baileysMessage });
            }
            return; 
        }
    }
    // --- FIN Bloque de Verificación de Registro ---

    console.log(`[Daily Plugin Baileys] Usuario ${commandSenderId} (${user.pushname || 'N/A'}) está registrado. Procesando comando .daily.`);
    
    // ensureDailyFields(user); // getUserData debería inicializar estos campos desde DEFAULT_USER_FIELDS
    const now = Date.now();
    const timeSinceLastDaily = now - (user.lastdaily || 0);

    let streakLostMessage = null;
    if (user.lastdaily !== 0 && timeSinceLastDaily > STREAK_LOSS_THRESHOLD_MS) {
        streakLostMessage = `😢 ¡Oh no, *${user.pushname || 'tú'}*! Has perdido tu racha de ${user.dailystreak || 0} día(s) por no reclamar a tiempo. Tu racha vuelve a 0.\n\n`;
        user.dailystreak = 0;
    } else if (user.lastdaily === 0 && (user.dailystreak || 0) > 0) {
        // Caso raro: si tiene racha pero lastdaily es 0 (ej. importación o error previo)
        console.warn(`[Daily Plugin Baileys] Usuario ${commandSenderId} tenía racha ${user.dailystreak} pero lastdaily era 0. Reseteando racha.`);
        user.dailystreak = 0;
    }

    if (user.lastdaily !== 0 && timeSinceLastDaily < COOLDOWN_DAILY_MS) {
        const timeLeft = COOLDOWN_DAILY_MS - timeSinceLastDaily;
        return msg.reply(`🎁 Ya reclamaste tu recompensa diaria. Vuelve en *${msToTime(timeLeft)}*.\nTu racha actual: ${user.dailystreak || 0} día(s).`);
    }

    // Actualizar racha
    if (user.lastdaily === 0 || (user.dailystreak || 0) === 0) { // Si es la primera vez o perdió la racha
        user.dailystreak = 1;
    } else { // Reclamando consecutivamente (y no ha perdido la racha)
        user.dailystreak = Math.min((user.dailystreak || 0) + 1, MAX_STREAK_DAYS);
    }

    const currentStreak = user.dailystreak;
    const streakMultiplier = getStreakMultiplier(currentStreak);

    const moneyEarned = Math.floor(BASE_DAILY_MONEY * streakMultiplier);
    const expEarned = Math.floor(BASE_DAILY_EXP * streakMultiplier);

    user.money = (user.money || 0) + moneyEarned; // Asegurar que user.money sea numérico
    user.exp = (user.exp || 0) + expEarned;   // Asegurar que user.exp sea numérico
    user.lastdaily = now;

    await saveUserData(commandSenderId, user);

    let replyMessage = "";
    if (streakLostMessage) {
        replyMessage += streakLostMessage;
    }
    replyMessage += `🎉 ¡Recompensa Diaria Reclamada por *${user.pushname || 'ti'}*! 🎉\n\n` +
                       ` Streak Actual: 🔥 *${currentStreak} día(s)* (Multiplicador: x${streakMultiplier.toFixed(2)})\n\n` +
                       `Has recibido:\n` +
                       `  ${MONEY_SYMBOL} ${moneyEarned.toLocaleString()}\n` +
                       `  ${EXP_SYMBOL} ${expEarned.toLocaleString()}\n\n`;

    if (currentStreak === MAX_STREAK_DAYS) {
        replyMessage += `✨ ¡Felicidades! ¡Has alcanzado la racha máxima de ${MAX_STREAK_DAYS} días! Sigue reclamando para mantener tus recompensas máximas.\n\n`;
    } else {
        const nextClaimApprox = new Date(now + COOLDOWN_DAILY_MS);
        replyMessage += `Vuelve mañana (aprox. ${nextClaimApprox.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit'})}) para continuar tu racha.\n\n`;
    }
    
    replyMessage += `Tu saldo actual:\n` +
                    `  ${MONEY_SYMBOL} ${user.money.toLocaleString()}\n` +
                    `  ${EXP_SYMBOL} ${user.exp.toLocaleString()}`;

    await msg.reply(replyMessage);
    console.log(`[Daily Plugin Baileys] Usuario ${commandSenderId} (${user.pushname || 'N/A'}) reclamó daily. Racha: ${currentStreak}. Ganó: $${moneyEarned}, EXP ${expEarned}.`);
};

module.exports = {
    name: 'Recompensa Diaria',
    aliases: ['daily', 'diario', 'recompensa'],
    description: 'Reclama tu recompensa diaria y mantén tu racha para mejores premios.',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383046,
        price: "3.00",
        icon: "fa-calendar-check",
        preview: {
            suggestions: ["!daily", "!recompensa"],
            responses: {
                "!daily": "🎉 ¡Recompensa Diaria Reclamada! 🎉\n\nStreak Actual: 🔥 *5 día(s)*\nHas recibido: 💵 $150 y ⭐ 750 EXP.",
                "!recompensa": "🎉 ¡Recompensa Diaria Reclamada! 🎉\n\nStreak Actual: 🔥 *5 día(s)*\nHas recibido: 💵 $150 y ⭐ 750 EXP."
            }
        }
    },
};