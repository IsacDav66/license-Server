// plugins/add-admin.js (Corregido con manejo de LID/JID y verificación de Dueño)

const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys'); // Usando @itsukichann/baileys (añadido jidNormalizedUser)
const { addAdminToWhitelist } = require('../shared-admin-db');

// El JID completo del dueño del bot, leído desde .env para seguridad
// ASUMIMOS que BOT_OWNER_JID en .env es el JID estándar (ej: "51959442730@s.whatsapp.net")
const BOT_OWNER_JID = process.env.BOT_OWNER_JID; 

module.exports = {
    name: 'Añadir Admin',
    aliases: ['addadmin', 'setadmin'],
    description: 'Añade un usuario a la lista blanca de administradores permitidos (Solo Dueño).',
    category: 'Dueño', // <--- Mantiene la categoría 'Dueño'
    marketplace: {
        tebex_id: 7383057,
        price: "7.00",
        icon: "fa-user-plus",
        preview: {
            suggestions: ["!addadmin @Usuario"],
            responses: {
                "!addadmin @Usuario": "✅ ¡Éxito! El usuario @Usuario ha sido añadido/actualizado en la lista blanca de admins."
            }
        }
    },

    async execute(sock, msg, args, commandName, finalUserIdFromMain = null) { // Acepta finalUserIdFromMain pero no se confía en él
        // --- AUTO-RESOLUCIÓN DEL SENDERID DENTRO DEL PLUGIN ---
        const commandSenderId = msg.senderLid || msg.author; // ¡El plugin resuelve el ID del remitente!
        const senderOriginalJid = msg.author; // JID original del que ejecuta el comando (para menciones)

        // --- VERIFICACIÓN CRÍTICA (AHORA CON EL commandSenderId resuelto por el plugin) ---
        if (!commandSenderId) {
            console.error(`[Add Admin ERROR] commandSenderId es NULL. Fallo en la resolución de ID para msg.author: ${senderOriginalJid}.`);
            await msg.reply("❌ Hubo un problema al identificar tu usuario. No se puede procesar el comando. Intenta de nuevo.");
            return;
        }
        // --- FIN VERIFICACIÓN ---

        // --- Lógica de verificación de dueño robusta ---
        if (jidNormalizedUser(senderOriginalJid) !== jidNormalizedUser(BOT_OWNER_JID)) {
             return msg.reply('⛔ Este comando solo puede ser usado por mi dueño.');
        }
        // --- FIN Lógica ---


        const mentionedJids = msg.mentionedJidList || []; // JIDs originales de los mencionados
        
        if (!mentionedJids || mentionedJids.length === 0) {
            return msg.reply('⚠️ Formato incorrecto. Debes mencionar al usuario. Ejemplo: `.addadmin @usuario`');
        }

        const userToAdminOriginalJid = mentionedJids[0]; // JID completo original del usuario a añadir
        
        // --- Resolver el LID/JID para la base de datos ---
        let userToAdminDbId;
        const chat = await msg.getChat();
        if (chat.isGroup && chat.groupMetadata && chat.groupMetadata.participants) {
            const mentionedParticipant = chat.groupMetadata.participants.find(p => p.id === userToAdminOriginalJid);
            userToAdminDbId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : userToAdminOriginalJid;
        } else {
            userToAdminDbId = userToAdminOriginalJid; // Si no es grupo, o no se encontró LID, usar JID original
        }
        // --- Fin resolución ---

        const decodedJid = jidDecode(userToAdminOriginalJid);
        const userNumberForText = decodedJid ? decodedJid.user : userToAdminOriginalJid.split('@')[0];

        if (!userNumberForText) {
            return msg.reply('❌ No pude obtener el número de teléfono del usuario mencionado.');
        }

        const result = await addAdminToWhitelist(userToAdminDbId, userNumberForText, commandSenderId); // Pasamos userToAdminDbId y commandSenderId

        if (result.success) {
            const replyText = `✅ ¡Éxito! El usuario @${userNumberForText} ha sido añadido/actualizado en la lista blanca de admins.`;
            await sock.sendMessage(msg.from, {
                text: replyText,
                mentions: [userToAdminOriginalJid] // Array con el JID original para la mención
            });
        } else {
            await msg.reply(`❌ Falló la operación. ${result.message}`);
        }
    }
};