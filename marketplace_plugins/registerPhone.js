// plugins/registerPhone.js (Baileys Version)
// Maneja el registro inicial del teléfono y la actualización del mismo,
// permitiendo la actualización incluso durante el proceso de registro.

const { getUserData, saveUserData, validateAndNormalizePhone } = require('../../lib/bot-core');
const { jidDecode } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'Gestión de Teléfono',
    aliases: [
        'mifono', 'myphone', 'setphone', 'minumero',
        'actualizarfono', 'updatephone', 'cambiarfono'
    ],
    description: 'Registra o actualiza tu número de teléfono asociado al bot.',
    category: 'Configuración',
    marketplace: {
        tebex_id: 7383073,
        price: "2.00",
        icon: "fa-mobile-retro",
        preview: {
            suggestions: ["!mifono +519...", "!actualizarfono +519..."],
            responses: {
                "!mifono +519...": "👍 ¡Gracias! Tu número fue guardado.\nTe enviaré un DM para configurar tu contraseña. 🛡️",
                "!actualizarfono +519...": "✅ Tu número ha sido actualizado.\nSi no has configurado tu contraseña, te enviaré un DM para hacerlo. 🔐"
            }
        }
    },

    async execute(sock, msg, args, commandName) {
        const senderContactInfo = await msg.getContact();
        if (!senderContactInfo) {
            console.error("[RegisterPhone Baileys] No se pudo obtener el contacto del remitente.");
            try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) {}
            return;
        }
        const userId =msg.senderLid || msg.author; // JID del que ejecuta el comando
        const chatId = msg.from; // JID del chat donde se envió el comando
        const user = await getUserData(userId, msg); // Datos del que ejecuta el comando

        if (!user) {
            console.error(`[RegisterPhone Baileys] No se pudieron obtener los datos para ${userId}`);
            try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) {}
            return;
        }

        const isUpdateCommand = ['actualizarfono', 'updatephone', 'cambiarfono'].includes(commandName.toLowerCase());
        const isInitialSetupCommand = ['mifono', 'myphone', 'setphone', 'minumero'].includes(commandName.toLowerCase());
        const userNameToMention = user.pushname || userId.split('@')[0];

        // --- Lógica de ACTUALIZACIÓN ---
        if (isUpdateCommand) {
            if (!user.phoneNumber && user.registration_state !== 'esperando_numero_telefono') {
                return msg.reply(`🔒 Aún no has iniciado el registro. Usa un comando como \`.work\` primero.`);
            }
            if (!args[0]) {
                const currentPhoneNumber = user.phoneNumber ? `+${user.phoneNumber}` : 'Ninguno';
                return msg.reply(`❓ Para actualizar, usa: \`.${commandName} +TUNUEVONUMERO\`\nTu número actual es: ${currentPhoneNumber}`);
            }

            const validationResult = validateAndNormalizePhone(args[0]);
            if (!validationResult.isValid) {
                return msg.reply(`⚠️ ${validationResult.error} Usa el formato internacional (ej: +14155552671).`);
            }
            const normalizedNewPhone = validationResult.phoneNumber;

            if (user.phoneNumber === normalizedNewPhone) {
                return msg.reply(`🤔 Este ya es tu número de teléfono registrado.`);
            }

            const oldPhoneNumber = user.phoneNumber;
            user.phoneNumber = normalizedNewPhone;
            
            let replyMessageText = `✅ ¡Tu número de teléfono ha sido actualizado a *${args[0]}*!`;
            
            if (user.registration_state === 'esperando_numero_telefono' || !user.password) {
                user.registration_state = 'esperando_contraseña_dm';
                replyMessageText += `\nAhora te enviaré un DM a tu nuevo número para que configures tu contraseña.`;
                
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: "🔑 (Actualización) Responde a este mensaje con tu nueva contraseña." });
                } catch (dmError) {
                    replyMessageText += "\n⚠️ No pude enviarte el DM. Asegúrate de que el número sea correcto.";
                }
            }
            
            await saveUserData(userId, user);
            return sock.sendMessage(chatId, { text: replyMessageText, mentions: [userId] }, { quoted: msg._baileysMessage });
        }

        // --- Lógica de REGISTRO INICIAL ---
        if (isInitialSetupCommand) {
            if (user.registration_state !== 'esperando_numero_telefono') {
                if (user.password && user.phoneNumber) {
                    return msg.reply(`✅ Ya estás registrado con el número +${user.phoneNumber}. Para cambiarlo, usa \`.actualizarfono\`.`);
                }
                return msg.reply(`❓ No estoy esperando tu número ahora. Usa un comando como \`.work\` para iniciar el registro.`);
            }

            if (!args[0]) {
                return msg.reply(`⚠️ Proporciona tu número después del comando. Ejemplo: \`.mifono +1234567890\``);
            }

            const validationResult = validateAndNormalizePhone(args[0]);
            if (!validationResult.isValid) {
                return msg.reply(`⚠️ ${validationResult.error} Usa el formato internacional (ej: +5491123456789).`);
            }
            
            user.phoneNumber = validationResult.phoneNumber;
            user.registration_state = 'esperando_contraseña_dm';
            await saveUserData(userId, user);

            await sock.sendMessage(chatId, {
                text: `👍 ¡Gracias, @${userNameToMention}! Tu número (*${args[0]}*) fue guardado.\nTe enviaré un DM a ese número para que configures tu contraseña.`,
                mentions: [userId]
            }, { quoted: msg._baileysMessage });
            
            const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
            try {
                await sock.sendMessage(dmJid, { text: "🔑 Responde a este mensaje con la contraseña que deseas establecer." });
            } catch(dmError){ 
                await sock.sendMessage(chatId, {
                    text: `⚠️ No pude enviarte el DM al número *${args[0]}*. Asegúrate de que sea correcto.`,
                    mentions: [userId]
                }, { quoted: msg._baileysMessage });
            }
            return;
        }
    }
};