// plugins/apostar.js (Sistema de Apuestas PvP Cara y Sello para Baileys - Corregido LID para Menciones)

const { getUserData, saveUserData, msToTime } = require('../shared-economy');
const { jidNormalizedUser, jidDecode } = require('@whiskeysockets/baileys'); // <--- USANDO @ITSUKICHANN/BAILEYS (añadido jidDecode)
const MONEY_SYMBOL = '$';
// Tiempo en milisegundos que una apuesta permanece abierta antes de expirar.
const BET_EXPIRATION_MS = 3 * 60 * 1000; // 3 minutos

// Usamos un Map para almacenar las apuestas abiertas por grupo.
// Estructura: Map<chatId, Map<initiatorId, betInfo>>
const openBets = new Map();

/**
 * Función para resolver la apuesta, determinar el ganador y transferir el dinero.
 * @param {object} sock - La instancia del socket de Baileys.
 * @param {string} chatId - El JID del grupo.
 * @param {object} bet - El objeto de la apuesta que se va a resolver.
 * @param {object} opponentUser - El objeto de datos del oponente (ya de la DB) que aceptó la apuesta.
 * @param {string} opponentOriginalJid - El JID original del oponente para menciones.
 * @param {string} initiatorOriginalJid - El JID original del iniciador para menciones.
 */
async function resolveBet(sock, chatId, bet, opponentUser, opponentOriginalJid, initiatorOriginalJid) {
    const initiatorUser = await getUserData(bet.initiatorId); // Recargamos los datos por si acaso para el iniciador
    
    // Si por alguna razón el iniciador oponente no se pudo recargar, cancelar
    if (!initiatorUser) {
        console.error(`[Apuestas PvP] Error: No se pudo recargar los datos del iniciador ${bet.initiatorId} al resolver la apuesta.`);
        await sock.sendMessage(chatId, { text: `❌ Hubo un error al resolver la apuesta. Contacta a un administrador.` });
        return;
    }

    const coinFlipResult = Math.random() < 0.5 ? 'cara' : 'sello';
    const coinEmoji = coinFlipResult === 'cara' ? '🪙 (Cara)' : '⚫ (Sello)';

    let winnerUser, loserUser;
    let winnerOriginalJid, loserOriginalJid;

    if (bet.side === coinFlipResult) {
        winnerUser = initiatorUser;
        loserUser = opponentUser;
        winnerOriginalJid = initiatorOriginalJid;
        loserOriginalJid = opponentOriginalJid;
    } else {
        winnerUser = opponentUser;
        loserUser = initiatorUser;
        winnerOriginalJid = opponentOriginalJid;
        loserOriginalJid = initiatorOriginalJid;
    }

    const pot = bet.amount * 2;
    winnerUser.money += pot;

    // Guardamos los datos de ambos jugadores.
    await saveUserData(winnerUser.userId, winnerUser);
    await saveUserData(loserUser.userId, loserUser);

    // Limpiamos la apuesta del Map para que no pueda ser aceptada de nuevo.
    if (openBets.has(chatId)) {
        openBets.get(chatId).delete(bet.initiatorId);
    }

    // Usamos los JIDs originales para las menciones en el mensaje de WhatsApp.
    const winnerMention = `@${jidDecode(winnerOriginalJid)?.user || winnerOriginalJid.split('@')[0]}`;
    const loserMention = `@${jidDecode(loserOriginalJid)?.user || loserOriginalJid.split('@')[0]}`;

    const resultText = `--- ⚔️ *Apuesta Resuelta* ⚔️ ---\n\n` +
                       `La moneda giró y cayó en: *${coinEmoji}*\n\n` +
                       `🎉 ¡El ganador es ${winnerMention}!\n` +
                       `Se lleva un premio de *${MONEY_SYMBOL}${pot.toLocaleString()}*.\n\n` +
                       `😥 Mejor suerte para la próxima, ${loserMention}.`;

    await sock.sendMessage(chatId, {
        text: resultText,
        mentions: [winnerOriginalJid, loserOriginalJid]
    });
}


module.exports = {
    name: 'Apostar PvP',
    aliases: ['apostar', 'bet'],
    description: 'Inicia o acepta una apuesta de cara o sello contra otro jugador.',
    category: 'Economía', // <--- ¡CAMBIADO A 'ECONOMÍA'!
    groupOnly: true,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383047,
        price: "6.00",
        icon: "fa-coins",
        preview: {
            suggestions: ["!apostar 500 cara", ".apostar @Usuario 500"],
            responses: {
                "!apostar 500 cara": "--- 🔥 *Nueva Apuesta Abierta* 🔥 ---\n\n@Usuario está apostando *$500* a *CARA 🪙*.\n\nPara aceptar, alguien debe escribir:\n`.apostar @Usuario 500`",
                ".apostar @Usuario 500": "--- 🔥 *Nueva Apuesta Abierta* 🔥 ---\n\n@Usuario está apostando *$500* a @Usuario`"
            }
        }
    },

    async execute(sock, msg, args, commandName, finalUserIdFromMain = null) { // Acepta finalUserIdFromMain
        const commandSenderId = finalUserIdFromMain; // ID del que ejecuta el comando (LID o JID)
        const senderOriginalJid = msg.author; // JID original del que ejecuta el comando (para menciones)
        const chatId = msg.from;
        
        // --- ¡VERIFICACIÓN CRÍTICA AQUÍ! (Mantenida por seguridad) ---
        if (!commandSenderId) {
            console.error(`[Apuestas PvP ERROR] commandSenderId es NULL para msg.author: ${senderOriginalJid}. No se puede procesar el comando.`);
            await msg.reply("❌ Hubo un problema al identificar tu usuario. No se puede procesar el comando. Intenta de nuevo.");
            return; // Detener la ejecución si no podemos obtener un ID válido.
        }
        // --- FIN VERIFICACIÓN ---

        const user = await getUserData(commandSenderId, msg); // Datos del que ejecuta el comando
        
        // Obtenemos la metadata del grupo si es un chat de grupo (para LIDs de mencionados)
        const chat = await msg.getChat();
        const isGroup = chat.isGroup;
        const groupParticipants = chat.groupMetadata?.participants || [];

        if (!user || !user.password) {
            // Reutiliza la misma lógica de registro de tus otros plugins si quieres.
            const userNameToMention = user?.pushname || jidDecode(senderOriginalJid)?.user || senderOriginalJid.split('@')[0];
            const currentPrefix = msg.body.charAt(0);

            if (!user.phoneNumber) {
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(commandSenderId, user);
                const replyText = `👋 ¡Hola, @${userNameToMention}!\n\nPara usar las apuestas, necesitas registrarte. Por favor, responde en este chat con:\n*${currentPrefix}mifono +TuNumeroCompleto*`;
                return sock.sendMessage(chatId, { text: replyText, mentions: [senderOriginalJid] }, { quoted: msg._baileysMessage });
            } else {
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(commandSenderId, user);
                const replyText = `🛡️ ¡Hola, @${userNameToMention}!\n\nYa tenemos tu número (+${user.phoneNumber}). Te he enviado un DM a ese número para que configures tu contraseña. ¡Revísalo!`;
                await sock.sendMessage(chatId, { text: replyText, mentions: [senderOriginalJid] }, { quoted: msg._baileysMessage });
                
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: "🔑 Responde a este mensaje con la contraseña que deseas para los comandos de economía." });
                } catch (dmError) {
                    console.error(`[Apuestas PvP DM ERROR] Error enviando DM a ${dmJid}:`, dmError);
                    await msg.reply("⚠️ No pude enviarte el DM. Asegúrate de que tu número sea correcto y que puedas recibir mensajes del bot.");
                }
                return;
            }
        }

        const mentionedJids = msg.mentionedJidList || [];

        // --- FLUJO 1: ACEPTAR UNA APUESTA EXISTENTE ---
        if (mentionedJids.length > 0) {
            const rawInitiatorJid = mentionedJids[0]; // JID original del iniciador de la apuesta (el que se mencionó)
            let initiatorDbId; // ID (LID o JID) para buscar en la DB

            // --- ¡NUEVA LÓGICA PARA RESOLVER LID/JID DEL MENCIONADO! ---
            if (isGroup) {
                const initiatorParticipant = groupParticipants.find(p => p.id === rawInitiatorJid);
                initiatorDbId = (initiatorParticipant && initiatorParticipant.lid) ? initiatorParticipant.lid : rawInitiatorJid;
            } else {
                initiatorDbId = rawInitiatorJid;
            }
            // --- FIN LÓGICA ---

            if (jidNormalizedUser(initiatorDbId) === jidNormalizedUser(commandSenderId)) { // Comparar IDs normalizados
                return msg.reply('🤦‍♂️ No puedes aceptar tu propia apuesta.');
            }

            const betAmount = parseInt(args.find(arg => !isNaN(parseInt(arg)))); // Buscar la cantidad en los args

            const groupBets = openBets.get(chatId);
            const betToAccept = groupBets ? groupBets.get(initiatorDbId) : null; // Buscar por initiatorDbId (el iniciador mencionado)

            if (!betToAccept) {
                const initiatorName = jidDecode(rawInitiatorJid)?.user || rawInitiatorJid.split('@')[0];
                return msg.reply(`🤔 @${initiatorName} no tiene ninguna apuesta abierta en este momento.`, { mentions: [rawInitiatorJid] });
            }

            if (isNaN(betAmount) || betAmount <= 0 || betAmount !== betToAccept.amount) {
                return msg.reply(`⚠️ Para aceptar la apuesta, debes igualar el monto exacto de *${MONEY_SYMBOL}${betToAccept.amount.toLocaleString()}*.`);
            }

            if (user.money < betAmount) {
                return msg.reply(`💸 No tienes suficiente dinero en mano (${MONEY_SYMBOL}${user.money.toLocaleString()}) para aceptar esta apuesta.`);
            }

            // Deducir el dinero del aceptante
            user.money -= betAmount;
            await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del aceptante

            // ¡Resolver la apuesta!
            // Pasamos el usuario del aceptante, y los JIDs originales de ambos para las menciones.
            await resolveBet(sock, chatId, betToAccept, user, senderOriginalJid, rawInitiatorJid);
            return;
        }

        // --- FLUJO 2: CREAR UNA NUEVA APUESTA ---
        if (args.length < 2) {
            return msg.reply(`❓ Uso:\n- Para crear: \`.apostar <cantidad> <cara/sello>\`\n- Para aceptar: \`.apostar @usuario <cantidad>\``);
        }

        const betAmount = parseInt(args[0]);
        const betSide = args[1].toLowerCase();

        if (isNaN(betAmount) || betAmount <= 0) {
            return msg.reply('⚠️ Debes apostar una cantidad válida y positiva.');
        }

        if (user.money < betAmount) {
            return msg.reply(`💸 No tienes suficiente dinero en mano (${MONEY_SYMBOL}${user.money.toLocaleString()}) para realizar esa apuesta.`);
        }

        if (!['cara', 'sello'].includes(betSide)) {
            return msg.reply('🤔 Debes elegir "cara" o "sello".');
        }

        // Verificar si el usuario ya tiene una apuesta abierta en este grupo
        const groupBets = openBets.get(chatId);
        if (groupBets && groupBets.has(commandSenderId)) { // Buscar por commandSenderId
            return msg.reply('⏳ Ya tienes una apuesta abierta en este chat. Espera a que expire o a que alguien la acepte.');
        }

        // Deducir el dinero del iniciador y guardarlo
        user.money -= betAmount;
        await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del iniciador

        const betInfo = {
            initiatorId: commandSenderId, // Usar el ID resuelto para la apuesta
            initiatorName: user.pushname || jidDecode(senderOriginalJid)?.user || senderOriginalJid.split('@')[0], // Nombre para display
            amount: betAmount,
            side: betSide,
            timestamp: Date.now()
        };

        // Guardar la apuesta en el Map
        if (!openBets.has(chatId)) {
            openBets.set(chatId, new Map());
        }
        openBets.get(chatId).set(commandSenderId, betInfo); // Guardar con el ID resuelto
        
        const senderMention = `@${jidDecode(senderOriginalJid)?.user || senderOriginalJid.split('@')[0]}`;
        const sideEmoji = betSide === 'cara' ? '🪙' : '⚫';
        
        const challengeText = `--- 🔥 *Nueva Apuesta Abierta* 🔥 ---\n\n` +
                              `${senderMention} está apostando *${MONEY_SYMBOL}${betAmount.toLocaleString()}* a *${betSide.toUpperCase()} ${sideEmoji}*.\n\n` +
                              `Para aceptar, alguien debe escribir:\n` +
                              `\`.apostar ${senderMention} ${betAmount}\`\n\n` +
                              `_(Esta apuesta expira en ${msToTime(BET_EXPIRATION_MS)})._`;

        await sock.sendMessage(chatId, {
            text: challengeText,
            mentions: [senderOriginalJid] // Usar el JID original para la mención
        });

        // --- Lógica de Expiración ---
        setTimeout(async () => {
            const currentGroupBets = openBets.get(chatId);
            const betToExpire = currentGroupBets ? currentGroupBets.get(commandSenderId) : null; // Buscar por commandSenderId
            
            // Solo expira si la apuesta todavía existe y es la misma instancia (timestamp)
            if (betToExpire && betToExpire.timestamp === betInfo.timestamp) {
                const initiatorUser = await getUserData(commandSenderId); // Obtener datos con el ID resuelto
                if (initiatorUser) {
                    initiatorUser.money += betToExpire.amount; // Devolver el dinero
                    await saveUserData(commandSenderId, initiatorUser); // Guarda con el ID resuelto
                } else {
                    console.error(`[Apuestas PvP] Error: No se pudo encontrar al usuario iniciador ${commandSenderId} para devolver el dinero al expirar la apuesta.`);
                }
                
                currentGroupBets.delete(commandSenderId); // Borrar con el ID resuelto
                
                await sock.sendMessage(chatId, {
                    text: `⌛ La apuesta de ${senderMention} por *${MONEY_SYMBOL}${betAmount.toLocaleString()}* ha expirado y su dinero ha sido devuelto.`,
                    mentions: [senderOriginalJid] // Usar el JID original
                });
            }
        }, BET_EXPIRATION_MS);
    }
};