// plugins/balance.js (Baileys Version - Corregido LID para Menciones y sin Color)
// Comando para ver el balance de EXP, Dinero en mano y Dinero en banco.

const { getUserData } = require('../shared-economy'); // getUserData ahora es async
const { jidDecode } = require('@whiskeysockets/baileys'); // <--- USANDO @ITSUKICHANN/BAILEYS

const MONEY_SYMBOL = '$'; // Puedes cambiarlo a 💵 si prefieres

const execute = async (sock, msg, args, commandName, finalUserIdFromMain = null) => { // Acepta finalUserIdFromMain
    let targetId;
    let userToDisplay;
    let displayName;
    let mentionsForReply = []; // Para enviar la mención en la respuesta de Baileys

    // Obtener la información del chat una vez, es necesaria para obtener LIDs de participantes.
    const chat = await msg.getChat(); 
    // Acceder al mensaje original de Baileys para obtener menciones
    const baileysOriginalMsg = msg._baileysMessage;
    const mentionedJidsInMsg = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJidsInMsg.length > 0) {
        // --- Lógica para usuario mencionado ---
        const mentionedJid = mentionedJidsInMsg[0]; // Tomamos la primera mención
        mentionsForReply.push(mentionedJid); // Añadir el JID original a la lista de menciones para la mención visual

        if (chat.isGroup && chat.groupMetadata && chat.groupMetadata.participants) {
            // Si es un grupo, intenta encontrar el LID del participante mencionado
            const mentionedParticipant = chat.groupMetadata.participants.find(p => p.id === mentionedJid);
            if (mentionedParticipant && mentionedParticipant.lid) {
                targetId = mentionedParticipant.lid; // ¡Usar LID para el mencionado si está disponible en el grupo!
            } else {
                targetId = mentionedJid; // Fallback a JID si no se encuentra LID en el grupo
            }
        } else {
            // Si no es un grupo, o no hay metadata, solo podemos usar el JID del mencionado
            targetId = mentionedJid; 
        }

        // Obtener datos del usuario mencionado usando el targetId (que ahora puede ser LID o JID)
        userToDisplay = await getUserData(targetId); 
        
        if (!userToDisplay) {
            console.error(`[Balance Plugin Baileys] No se pudieron obtener los datos para el usuario mencionado ${targetId}`);
            try { await msg.reply("❌ Hubo un error al obtener los datos del usuario mencionado."); } catch(e) { console.error("[Balance Plugin Baileys] Error enviando reply (mencionado no encontrado):", e);}
            return;
        }

        // Para el nombre a mostrar en el mensaje
        // Usamos el pushname guardado en la BD o el número del JID del mencionado
        displayName = userToDisplay.pushname || jidDecode(mentionedJid)?.user || mentionedJid.split('@')[0];
        displayName = `@${displayName}`; // Añadir @ para la mención visual en el texto

    } else {
        // --- Lógica para el propio usuario (remitente del comando) ---
        targetId = finalUserIdFromMain; // ¡Usar el ID resuelto (LID o JID) que el main ya pasó!
        mentionsForReply.push(msg.author); // Añadir el JID original del autor para la mención visual de uno mismo

        // Obtener datos del usuario que ejecuta el comando, pasando 'msg' para actualizar su pushname si es necesario
        userToDisplay = await getUserData(targetId, msg);
        
        if (!userToDisplay) {
            console.error(`[Balance Plugin Baileys] No se pudieron obtener los datos para el solicitante ${targetId}`);
            try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error("[Balance Plugin Baileys] Error enviando reply (solicitante no encontrado):", e);}
            return;
        }
        
        // Para el nombre a mostrar, usamos su pushname o JID decodificado
        const selfPushname = userToDisplay.pushname || jidDecode(msg.author)?.user || msg.author.split('@')[0];
        displayName = `@${selfPushname}`; // Formatear para mención visual
    }

    const balanceMessage = `*📊 Balance de ${displayName}*\n\n` +
                           `⭐ *EXP Total:* ${(userToDisplay.exp || 0).toLocaleString()}\n` +
                           `💵 *Dinero en Mano:* ${MONEY_SYMBOL}${(userToDisplay.money || 0).toLocaleString()}\n` +
                           `🏦 *Dinero en Banco:* ${MONEY_SYMBOL}${(userToDisplay.bank || 0).toLocaleString()}`;
    
    try {
        await sock.sendMessage(msg.from, {
            text: balanceMessage,
            mentions: mentionsForReply // Array con los JIDs a mencionar (JID original del remitente o del mencionado)
        }, { quoted: msg._baileysMessage }); // Citar el mensaje original del comando
    } catch (error) {
        console.error("[Balance Plugin Baileys] Error al enviar mensaje de balance:", error);
        // Fallback si el envío con menciones falla (usando replace para quitar el @ del displayName si lo tiene)
        await msg.reply(`*Balance de ${displayName.replace('@', '')}*\nEXP: ${userToDisplay.exp || 0}\nDinero: ${MONEY_SYMBOL}${userToDisplay.money || 0}\nBanco: ${MONEY_SYMBOL}${userToDisplay.bank || 0}\n_(Error al enviar con formato completo)_`);
    }
};

module.exports = {
    name: 'Balance',
    aliases: ['bal', 'balance', 'saldo'],
    description: 'Muestra tu balance de EXP, Dinero en mano y Dinero en banco, o el de un usuario mencionado.',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383048,
        price: "2.00",
        icon: "fa-wallet",
        preview: {
            suggestions: ["!bal", "!saldo"],
            responses: {
                "!bal": "*📊 Balance de @Usuario*\n\n⭐ *EXP Total:* 15,400\n💵 *Dinero en Mano:* $5,200\n🏦 *Dinero en Banco:* $12,000",
                "!saldo": "*📊 Balance de @Usuario*\n\n⭐ *EXP Total:* 15,400\n💵 *Dinero en Mano:* $5,200\n🏦 *Dinero en Banco:* $12,000"
            }
        }
    },
};