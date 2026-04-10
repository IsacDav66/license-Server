// plugins/slut.js (Baileys Version - Corregido LID para Remitente y Menciones)
// Comando para "trabajos" arriesgados/ilegales y para "pagar por servicios" a otro usuario.
// Incluye verificación de registro.

const { getUserData, saveUserData, msToTime, pickRandom } = require('../shared-economy');
const { jidDecode } = require('@whiskeysockets/baileys'); // Para obtener número de JID
const MONEY_SYMBOL = '$'; // Puedes cambiarlo a 💵 si prefieres

const COOLDOWN_SLUT_SOLO_MS = 20 * 60 * 1000; // 20 minutos

const riskyActivities = [
    {
        description: "Te infiltras en una fiesta de alta sociedad para 'socializar' con gente adinerada 🍸💼",
        successMessage: (amount) => `¡Tu encanto funcionó! Conseguiste ${MONEY_SYMBOL}${amount.toLocaleString()} en 'donaciones generosas'.`,
        failureMessage: (penalty) => `🥂 Te pasaste de copas y te echaron. Tuviste que pagar ${MONEY_SYMBOL}${penalty.toLocaleString()} por los daños.`,
        minReward: 700, maxReward: 3500, penaltyPercent: 0.4, minPenaltyFlat: 250, successChance: 0.60
    },
    {
        description: "Participas en un 'intercambio cultural' muy privado y lucrativo 😉🤫",
        successMessage: (amount) => `El 'intercambio' fue un éxito. Obtuviste ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `💔 Hubo un malentendido y terminaste perdiendo ${MONEY_SYMBOL}${penalty.toLocaleString()}.`,
        minReward: 1000, maxReward: 5000, penaltyPercent: 0.5, minPenaltyFlat: 400, successChance: 0.50
    },
    {
        description: "Ofreces 'servicios de consultoría especializada' en un callejón oscuro  alley🌃",
        successMessage: (amount) => `Tu 'consultoría' fue muy solicitada. Ganaste ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `🚓 ¡Redada policial! Tuviste que pagar una fianza de ${MONEY_SYMBOL}${penalty.toLocaleString()}.`,
        minReward: 600, maxReward: 2800, penaltyPercent: 0.6, minPenaltyFlat: 300, successChance: 0.55
    },
    {
        description: "Intentas seducir a un millonario/a para obtener 'apoyo financiero' sugar💰",
        successMessage: (amount) => `¡Caña al anzuelo! Recibiste un generoso 'regalo' de ${MONEY_SYMBOL}${amount.toLocaleString()}.`,
        failureMessage: (penalty) => `🙅‍♂️ Te descubrieron tus intenciones y te dejaron sin nada, además perdiste ${MONEY_SYMBOL}${penalty.toLocaleString()} en el intento.`,
        minReward: 1200, maxReward: 6000, penaltyPercent: 0.3, minPenaltyFlat: 500, successChance: 0.45
    }
];

// Ajustar parámetros a sock, msg, args, commandName
const execute = async (sock, msg, args, commandName, finalUserIdFromMain = null) => { // Acepta finalUserIdFromMain
    const senderContactInfo = await msg.getContact();
    if (!senderContactInfo) {
        console.error(`[Slut Plugin Baileys] No se pudo obtener el contacto del remitente.`);
        try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) {}
        return;
    }
    
    // --- ID del que ejecuta el comando (LID o JID) ---
    const commandSenderId = finalUserIdFromMain; 
    // console.log(color.brightGreen + `[DEBUG SLUT] commandSenderId (desde main): ${commandSenderId}` + color.reset);

    const chatId = msg.from; // JID del chat
    const user = await getUserData(commandSenderId, msg); // Datos del que ejecuta el comando

    if (!user) {
        console.error(`[Slut Plugin Baileys] No se pudieron obtener los datos para ${commandSenderId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) {}
        return;
    }

    // --- INICIO Bloque de Verificación de Registro ---
    if (!user.password) {
        const currentChatInfo = await msg.getChat();
        if (!currentChatInfo.isGroup) {
            await msg.reply("🔒 Comando exclusivo de grupos. Por favor, usa este comando en un grupo para iniciar tu registro o usar las funciones de economía.");
            return;
        }
        const userNameToMention = user.pushname || msg.author.split('@')[0]; // Usa msg.author para la mención
        if (!user.phoneNumber) { // CASO A: Sin contraseña NI número
            user.registration_state = 'esperando_numero_telefono';
            await saveUserData(commandSenderId, user); 
            console.log(`[Slut Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) no tiene contraseña ni teléfono. Solicitando número.`);
            const currentPrefix = msg.body.charAt(0);
            await sock.sendMessage(chatId, {
                text: `👋 ¡Hola @${userNameToMention}!\n\n` +
                      `Para usar las funciones de economía, primero necesitamos registrar tu número de teléfono.\n\n` +
                      `Por favor, responde en ESTE CHAT GRUPAL con el comando:\n` +
                      `*${currentPrefix}mifono +TUNUMEROCOMPLETO*\n` +
                      `(Ej: ${currentPrefix}mifono +11234567890)\n\n` +
                      `Tu nombre de perfil actual es: *${user.pushname || 'No detectado'}*.`,
                mentions: [msg.author] // Mencionar con el JID original
            }, { quoted: msg._baileysMessage });
            return;
        } else { // CASO B: Tiene número pero NO contraseña
            user.registration_state = 'esperando_contraseña_dm';
            await saveUserData(commandSenderId, user);
            
            console.log(`[Slut Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) tiene teléfono (+${user.phoneNumber}). Estado 'esperando_contraseña_dm' establecido.`);

            let displayPhoneNumber = user.phoneNumber;
            if (user.phoneNumber && !String(user.phoneNumber).startsWith('+')) {
                displayPhoneNumber = `+${user.phoneNumber}`;
            }

            await sock.sendMessage(chatId, {
                text: `🛡️ ¡Hola @${userNameToMention}!\n\n` +
                      `Ya tenemos tu número de teléfono registrado (*${displayPhoneNumber}*).\n` +
                      `Ahora, para completar tu registro, te he enviado un mensaje privado (DM) a ese número para que configures tu contraseña. Por favor, revisa tus DMs.\n`+
                      `‼️ Si quieres actualizar tu numero escribe .actualizarfono +52111222333 RECUERDA INCLUIR TODO TU NUMERO Y CODIGO DE PAIS\n`,
                mentions: [msg.author] // Mencionar con el JID original
            }, { quoted: msg._baileysMessage });
            
            const dmChatJidToSendTo = `${user.phoneNumber}@s.whatsapp.net`;
            const dmMessageContent = "🔑 Por favor, responde a este mensaje con la contraseña que deseas establecer para los comandos de economía.";
            
            console.log(`[Slut Plugin Baileys DM DEBUG] Intentando enviar DM para contraseña a ${dmChatJidToSendTo}.`);
            try {
                await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                console.log(`[Slut Plugin Baileys DM SUCCESS] DM para contraseña enviado a ${dmChatJidToSendTo}.`);
            } catch(dmError){
                console.error(`[Slut Plugin Baileys DM ERROR] Error enviando DM a ${dmChatJidToSendTo}:`, dmError);
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que puedes recibir mensajes de este número.`,
                    mentions: [msg.author] // Mencionar con el JID original
                }, { quoted: msg._baileysMessage });
            }
            return; 
        }
    }
    // --- FIN Bloque de Verificación de Registro ---

    console.log(`[Slut Plugin Baileys] Usuario ${commandSenderId} (${user.pushname || 'N/A'}) está registrado.`);

    // --- Lógica del Comando .slut ---
    const baileysOriginalMsg = msg._baileysMessage;
    const mentionedJidsInMsg = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    // Obtener la metadata del grupo si es un chat de grupo (para LIDs de mencionados)
    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const groupParticipants = chat.groupMetadata?.participants || [];

    if (mentionedJidsInMsg.length > 0) {
        // --- Funcionalidad de Pagar a Otro Usuario ---
        const rawMentionedJid = mentionedJidsInMsg[0]; // JID original del usuario mencionado
        let targetId; // Este será el LID o JID que usaremos para la BD

        if (isGroup) {
            // Intentamos encontrar el LID del participante mencionado
            const mentionedParticipant = groupParticipants.find(p => p.id === rawMentionedJid);
            targetId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : rawMentionedJid;
            // console.log(color.brightMagenta + `[DEBUG SLUT] Mención: Target ID resuelto: ${targetId}` + color.reset);
        } else {
            targetId = rawMentionedJid; // Si no es grupo, usamos el JID directamente
            // console.log(color.brightMagenta + `[DEBUG SLUT] Mención en privado: Target ID: ${targetId}` + color.reset);
        }
        
        // Obtener datos del objetivo. No pasamos 'msg' directamente,
        // ya que 'msg' es del pagador. El pushname del target se actualizará
        // cuando él mismo interactúe.
        const targetUser = await getUserData(targetId); 
        
        if (!targetUser) {
            console.error(`[Slut Plugin Baileys] No se pudieron obtener los datos del objetivo para ${targetId}`);
            return msg.reply("❌ Hubo un error al obtener los datos del usuario objetivo.");
        }

        const finalTargetName = targetUser.pushname || jidDecode(rawMentionedJid)?.user || rawMentionedJid.split('@')[0];
        const payerName = user.pushname || jidDecode(msg.author)?.user || msg.author.split('@')[0]; // Usar msg.author para el nombre del pagador

        if (targetId === commandSenderId) { // Compara IDs resueltos
            return msg.reply("🤦 No puedes pagarte a ti mismo.");
        }

        let amountToPay;
        // Los 'args' que llegan a execute ya no deberían tener el comando ni la mención (según tu bot.js).
        // El primer elemento de 'args' debería ser la cantidad.
        if (args.length > 0) {
            amountToPay = parseInt(args[0]);
        }

        if (isNaN(amountToPay) || amountToPay <= 0) {
            return msg.reply(`❓ Debes especificar una cantidad válida para pagar a *${finalTargetName}*. Ejemplo: \`.slut @usuario 100\``);
        }

        if (typeof user.money !== 'number' || isNaN(user.money) || (user.money || 0) < amountToPay) {
            return msg.reply(`💸 No tienes suficiente dinero en mano (${MONEY_SYMBOL}${(user.money || 0).toLocaleString()}) para pagar ${MONEY_SYMBOL}${amountToPay.toLocaleString()}.\nTienes: ${MONEY_SYMBOL}${(user.money || 0).toLocaleString()}`);
        }

        user.money -= amountToPay;
        targetUser.money = (targetUser.money || 0) + amountToPay; // Asegurar que targetUser.money sea numérico

        await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del pagador
        await saveUserData(targetId, targetUser); // Guarda por el ID resuelto del objetivo

        console.log(`[Slut Plugin Baileys - Pago] ${commandSenderId} (${payerName}) pagó ${amountToPay} a ${targetId} (${finalTargetName}).`);

        const paymentConfirmationText = `💋 *${payerName}* le ha pagado ${MONEY_SYMBOL}${amountToPay.toLocaleString()} a *@${finalTargetName}* por sus 'excelentes servicios'.\n\n`+
                                        `*${payerName}* ahora tiene: ${MONEY_SYMBOL}${user.money.toLocaleString()}\n`+
                                        `*@${finalTargetName}* ahora tiene: ${MONEY_SYMBOL}${targetUser.money.toLocaleString()}`;
        
        await sock.sendMessage(chatId, {
            text: paymentConfirmationText,
            mentions: [msg.author, rawMentionedJid] // Mencionar con los JIDs originales para que WhatsApp lo interprete bien
        }, { quoted: msg._baileysMessage });
        
        try {
            // Intentamos enviar DM usando el `phoneNumber` si está registrado, o el JID original del mencionado
            const dmTargetJid = targetUser.phoneNumber ? `${targetUser.phoneNumber}@s.whatsapp.net` : rawMentionedJid;

            if (dmTargetJid.includes('@s.whatsapp.net')) { // Solo intentar DM si tenemos un JID de usuario válido
                await sock.sendMessage(dmTargetJid, { 
                    text: `🤫 ¡Has recibido un pago de ${MONEY_SYMBOL}${amountToPay.toLocaleString()} de *${payerName}* por tus 'servicios discretos'! Tu saldo ahora es ${MONEY_SYMBOL}${targetUser.money.toLocaleString()}.`
                });
                 console.log(`[Slut Plugin Baileys - Pago] DM de notificación enviado a ${dmTargetJid}.`);
            } else {
                console.warn(`[Slut Plugin Baileys - Pago] No se pudo determinar un JID de usuario válido para enviar DM de notificación a ${finalTargetName} (targetId: ${targetId}).`);
            }
        } catch (privateMsgError) {
            console.error(`[Slut Plugin Baileys - Pago] Error enviando MD de notificación a ${finalTargetName} (targetId: ${targetId}):`, privateMsgError.message);
        }
        return;
    }

    // --- Si no hay mención, se ejecuta la actividad arriesgada individual ---
    const now = Date.now();
    const timeSinceLastSlut = now - (user.lastslut || 0);

    if (timeSinceLastSlut < COOLDOWN_SLUT_SOLO_MS) {
        const timeLeft = COOLDOWN_SLUT_SOLO_MS - timeSinceLastSlut;
        return msg.reply(`*💄 Necesitas recomponerte... Espera ${msToTime(timeLeft)} para tu próxima 'cita'.*`);
    }

    const activity = pickRandom(riskyActivities);
    user.lastslut = now;

    await msg.reply(`*💋 ${activity.description}...*`);
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    user.money = user.money || 0; // Asegurar que sea numérico

    if (Math.random() < activity.successChance) {
        const amountGained = Math.floor(Math.random() * (activity.maxReward - activity.minReward + 1)) + activity.minReward;
        user.money += amountGained;
        await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del remitente
        console.log(`[Slut Plugin Baileys - Solo] ${commandSenderId} (${user.pushname || 'N/A'}) tuvo éxito en '${activity.description}', ganó ${amountGained}.`);
        return msg.reply(`*🥂 ${activity.successMessage(amountGained)}*\nTu dinero: ${MONEY_SYMBOL}${user.money.toLocaleString()}`);
    } else {
        let penaltyAmount = Math.floor(user.money * activity.penaltyPercent);
        penaltyAmount = Math.max(penaltyAmount, activity.minPenaltyFlat);
        penaltyAmount = Math.min(penaltyAmount, user.money);
        user.money -= penaltyAmount;
        if (user.money < 0) user.money = 0;
        await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del remitente
        console.log(`[Slut Plugin Baileys - Solo] ${commandSenderId} (${user.pushname || 'N/A'}) falló en '${activity.description}', perdió ${penaltyAmount}.`);
        let finalMessage = `*💥 ${activity.failureMessage(penaltyAmount)}*`;
        finalMessage += `\nTu dinero: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;
        return msg.reply(finalMessage);
    }
};

module.exports = {
    name: 'Actividades Especiales',
    aliases: ['slut', 'cita', 'trabajonocturno', 'pagar'],
    description: 'Realiza "trabajos" arriesgados o paga a otro usuario por sus "servicios".',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383051,
        price: "5.00",
        icon: "fa-glass-cheers",
        preview: {
            suggestions: ["!slut", "!cita"],
            responses: {
                "!slut": "🍸 Te infiltras en una fiesta de alta sociedad...\n\n¡Tu encanto funcionó! Conseguiste **$1,200** en 'donaciones'. 🥂",
                "!cita": "💋 Te reúnes con un cliente en un lugar discreto...\n\n¡La cita fue exitosa! Conseguiste **$800** en 'servicios'. 🥂"
            }
        }
    },
};