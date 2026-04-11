// plugins/changepass.js (Flujo de Recuperación de Contraseña)

const { getUserData, saveUserData, validateAndNormalizePhone } = require('../../lib/bot-core');

module.exports = {
    name: 'Recuperar Contraseña',
    aliases: ['changepass', 'recuperarpass', 'resetpass'],
    description: 'Inicia el proceso para restablecer tu contraseña de economía.',
    category: 'Configuración',
    groupOnly: true, // El inicio del proceso debe ser en un grupo
    marketplace: {
        tebex_id: 7383072,
        price: "3.00",
        icon: "fa-user-lock",
        preview: {
            suggestions: ["!changepass +519..."],
            responses: {
                "!changepass +519...": "✅ ¡Verificación exitosa!\n\nTe he enviado un mensaje privado (DM) a tu número registrado para que establezcas tu nueva contraseña. 🔑"
            }
        }
    },

    async execute(sock, msg, args) {
        const senderId =msg.senderLid || msg.author;
        const chatId = msg.from;
        const user = await getUserData(senderId, msg);

        // 1. Verificar si el usuario está registrado (al menos con un número de teléfono)
        if (!user || !user.phoneNumber) {
            return msg.reply('🔒 Para recuperar tu contraseña, primero debes haber completado el registro inicial, incluyendo tu número de teléfono. Usa `.work` para empezar.');
        }

        // 2. Si el usuario no proporciona su número, guiarlo.
        if (args.length === 0) {
            const prefix = msg.body.charAt(0);
            return msg.reply(
                `🔐 Para iniciar la recuperación de tu contraseña, por favor, confirma tu número de teléfono registrado.\n\n` +
                `Escribe: *${prefix}changepass +TuNumeroRegistrado*\n\n` +
                `Esto es una medida de seguridad.`
            );
        }

        // 3. El usuario ha proporcionado un número, ahora lo validamos y comparamos.
        const providedPhoneNumber = args[0];
        const validationResult = validateAndNormalizePhone(providedPhoneNumber);

        if (!validationResult.isValid) {
            return msg.reply(`⚠️ El formato del número que ingresaste no es válido. Asegúrate de incluir el signo '+' y el código de país.`);
        }

        const normalizedProvidedPhone = validationResult.phoneNumber;

        // 4. Comparamos el número proporcionado con el de la base de datos.
        if (normalizedProvidedPhone !== user.phoneNumber) {
            console.log(`[ChangePass] Intento fallido para ${senderId.split('@')[0]}. Número proporcionado (${normalizedProvidedPhone}) no coincide con el registrado (${user.phoneNumber}).`);
            return msg.reply('❌ El número de teléfono que ingresaste no coincide con el que tienes registrado. Proceso cancelado.');
        }
        
        // 5. ¡El número coincide! Ahora iniciamos el flujo de recuperación.
        try {
            // Ponemos al usuario en el nuevo estado de espera.
            user.registration_state = 'esperando_nueva_contraseña_dm';
            await saveUserData(senderId, user);
            
            const userNameToMention = user.pushname || senderId.split('@')[0];
            const dmJid = `${user.phoneNumber}@s.whatsapp.net`;

            console.log(`[ChangePass] Verificación exitosa para ${senderId.split('@')[0]}. Enviando DM de recuperación a ${dmJid}.`);

            // Enviamos el DM al usuario.
            await sock.sendMessage(dmJid, { text: "🔑 (Recuperación de Contraseña) ¡Hola! Responde a este mensaje con la **nueva** contraseña que deseas establecer." });

            // Confirmamos al usuario en el grupo que el DM fue enviado.
            await sock.sendMessage(chatId, {
                text: `✅ ¡Verificación exitosa, @${userNameToMention}!\n\nTe he enviado un mensaje privado (DM) a tu número registrado para que establezcas tu nueva contraseña. Por favor, revisa tus mensajes.`,
                mentions: [senderId]
            }, { quoted: msg._baileysMessage });

        } catch (error) {
            console.error(`[ChangePass] Error durante el proceso de recuperación para ${senderId}:`, error);
            // Si falla el envío del DM, es importante limpiar el estado para que el usuario pueda intentarlo de nuevo.
            user.registration_state = null;
            await saveUserData(senderId, user);

            await msg.reply('❌ Hubo un error al intentar enviarte el mensaje privado. Asegúrate de que puedes recibir mensajes del bot y vuelve a intentarlo.');
        }
    }
};