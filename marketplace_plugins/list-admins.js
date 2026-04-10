// plugins/list-admins.js (Con comando .editarlista y manejo de LID/JID)

const { jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys'); // Añadido jidNormalizedUser
const { getAllWhitelistedAdmins, removeAdminFromWhitelist } = require('../shared-admin-db');

// --- ID DEL USUARIO AUTORIZADO PARA .editarlista ---
const AUTHORIZED_EDITOR_JID = '51988388664@s.whatsapp.net';
// --- FIN ID AUTORIZADO ---

// Mapeo para rastrear el ID del usuario con su número en una sesión temporal
// Esto es necesario porque el usuario ingresará un número (ej. "1"), no un JID.
const editSession = new Map(); // Map<chatId_editorJid, { adminList: [], timestamp: Date }>
const EDIT_SESSION_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos para la sesión de edición

module.exports = {
    name: 'Lista de Admins / Editar',
    aliases: ['listadmins', 'adminslist', 'wl', 'editarlista', 'editwl'],
    description: 'Muestra la lista de administradores autorizados. El dueño puede usar `.editarlista` para remover admins por número.',
    category: 'Dueño', // O 'Dueño'
    marketplace: {
        tebex_id: 7383062,
        price: "5.00",
        icon: "fa-list-ol",
        preview: {
            suggestions: ["!wl", "!editwl"],
            responses: {
                "!wl": "👑 *Lista de Administradores Autorizados* 👑\n\n1. @51959442730\n2. @51988388664\n\nTotal: 2 administradores.",
                "!editwl": "👑 *Lista de Administradores Autorizados* 👑\n\n1. @51959442730\n\nPara eliminar a alguien, responde: `.editarlista [número]`"
            }
        }
    },


    async execute(sock, msg, args, commandName) { // commandName se recibe automáticamente
        const senderOriginalJid = msg.author; // JID original del que ejecuta el comando (para menciones)
        const chatId = msg.from;

        // --- Auto-resolución del commandSenderId ---
        // El plugin resuelve el ID del remitente porque bot.js no pasa finalUserIdFromMain
        const commandSenderId = msg.senderLid || msg.author; 
        if (!commandSenderId) {
            console.error(`[List Admins/Edit ERROR] commandSenderId es NULL. Fallo en la resolución de ID para msg.author: ${senderOriginalJid}.`);
            await msg.reply("❌ Hubo un problema al identificar tu usuario. No se puede procesar el comando. Intenta de nuevo.");
            return;
        }
        // --- Fin Auto-resolución ---

        // Lógica para el comando .editarlista
        if (['editarlista', 'editwl'].includes(commandName)) {
            // Verificar si el usuario está autorizado para usar .editarlista
            if (jidNormalizedUser(senderOriginalJid) !== jidNormalizedUser(AUTHORIZED_EDITOR_JID)) {
                console.warn(`[List Admins/Edit] Intento de uso no autorizado de ${commandName} por ${senderOriginalJid}`);
                return msg.reply('⛔ No estás autorizado para usar este comando.');
            }

            const currentAdminList = await getAllWhitelistedAdmins();
            if (!currentAdminList || currentAdminList.length === 0) {
                return msg.reply('ℹ️ La lista blanca de administradores está vacía, no hay nada que editar.');
            }

            // Si el usuario proporcionó un número para eliminar
            if (args.length > 0) {
                const indexToRemove = parseInt(args[0]) - 1; // Convertir a índice basado en 0
                
                // Buscar si hay una sesión de edición activa para este chat y editor
                const sessionKey = `${chatId}_${commandSenderId}`;
                const activeSession = editSession.get(sessionKey);

                if (!activeSession || (Date.now() - activeSession.timestamp > EDIT_SESSION_EXPIRATION_MS)) {
                    // Si no hay sesión activa o expiró, intentamos directamente con la lista actual
                    console.warn(`[List Admins/Edit] Intento de eliminar por índice sin sesión activa o expirada.`);
                    return msg.reply('⚠️ No hay una sesión de edición activa. Usa `.editarlista` sin argumentos para ver la lista y el número a eliminar.');
                }

                if (isNaN(indexToRemove) || indexToRemove < 0 || indexToRemove >= activeSession.adminList.length) {
                    return msg.reply(`❌ Número de la lista inválido. Por favor, ingresa un número entre 1 y ${activeSession.adminList.length}.`);
                }

                const adminToRemove = activeSession.adminList[indexToRemove];
                
                // Realizar la eliminación
                const result = await removeAdminFromWhitelist(adminToRemove.user_id);

                if (result.success && result.rowCount > 0) {
                    const replyText = `✅ ¡Éxito! El usuario @${adminToRemove.phone_number} ha sido eliminado de la lista blanca de administradores.`;
                    await sock.sendMessage(msg.from, {
                        text: replyText,
                        mentions: [adminToRemove.user_id] // Mencionar el JID original
                    });
                    editSession.delete(sessionKey); // Limpiar la sesión después de la eliminación exitosa
                } else {
                    await msg.reply(`❌ Falló la eliminación de @${adminToRemove.phone_number}. ${result.message || 'Inténtalo de nuevo.'}`);
                }
            } else {
                // Si no hay argumentos, mostrar la lista numerada y pedir un número
                let listText = '👑 *Lista de Administradores Autorizados* 👑\n\n';
                const mentions = [];
                const adminListForSession = []; // Lista para almacenar en la sesión

                currentAdminList.forEach((admin, index) => {
                    listText += `${index + 1}. @${admin.phone_number}\n`;
                    mentions.push(admin.user_id);
                    adminListForSession.push(admin); // Guardar el objeto admin completo
                });

                listText += `\nPara eliminar a alguien, responde con el comando: \`.editarlista [número_de_lista]\` (ej: \`.editarlista 1\`)`;
                listText += `\n_(Esta sesión de edición expira en ${EDIT_SESSION_EXPIRATION_MS / 60000} minutos)_`;

                await sock.sendMessage(msg.from, {
                    text: listText,
                    mentions: mentions
                });

                // Guardar la lista actual en una sesión temporal
                const sessionKey = `${chatId}_${commandSenderId}`;
                editSession.set(sessionKey, { adminList: adminListForSession, timestamp: Date.now() });

                // Limpiar la sesión después de la expiración
                setTimeout(() => {
                    if (editSession.has(sessionKey) && editSession.get(sessionKey).timestamp === editSession.get(sessionKey).timestamp) { // Check de la misma sesión
                        editSession.delete(sessionKey);
                        console.log(`[List Admins/Edit] Sesión de edición para ${commandSenderId} en ${chatId} expirada.`);
                    }
                }, EDIT_SESSION_EXPIRATION_MS);
            }
            return; // Terminar la ejecución del comando .editarlista
        }

        // Lógica para el comando .listadmins, .adminslist, .wl (sin cambios importantes)
        try {
            const adminList = await getAllWhitelistedAdmins();

            if (!adminList || adminList.length === 0) {
                return msg.reply('ℹ️ Actualmente no hay ningún administrador en la lista blanca.');
            }

            let replyText = '👑 *Lista de Administradores Autorizados* 👑\n\n';
            const mentions = [];

            adminList.forEach((admin, index) => {
                replyText += `${index + 1}. @${admin.phone_number}\n`;
                mentions.push(admin.user_id);
            });
            
            replyText += `\nTotal: ${adminList.length} administradores.`;

            await sock.sendMessage(msg.from, {
                text: replyText,
                mentions: mentions
            });

        } catch (error) {
            console.error('[List Admins Error]', error);
            await msg.reply('❌ Ocurrió un error al intentar obtener la lista de administradores.');
        }
    }
};