// plugins/passwordRegistrationListener.js (Versión Final y Corregida para LIDs)

const { 
    getUserData, 
    saveUserData, 
    hashPassword 
} = require('../shared-economy');
// Ya no necesitamos las otras funciones aquí

module.exports = {
    name: 'Password Registration Listener',
    description: 'Escucha DMs para establecer/restablecer la contraseña.',
    category: 'Seguridad', // Asegúrate de añadir esta línea en el archivo
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383031,
        price: "5.00",
        icon: "fa-key",
        preview: {
            suggestions: ["mi_password_123", "hola"],
            responses: {
                "mi_password_123": "✅ ¡Tu contraseña ha sido establecida con éxito! 🎉\nYa puedes usar todos los comandos de economía de forma segura.",
                "hola": "⚠️ Estás en modo registro. Por favor, envía la contraseña que deseas usar para proteger tu cuenta."
            }
        }
    },

    async checkMessage(sock, msg) {
        // 1. Filtrar mensajes que no sean DMs o que sean del propio bot
        const chatInfo = await msg.getChat();
        if (chatInfo.isGroup || msg.fromMe) {
            return false;
        }

        // 2. Obtener el ID permanente del remitente del DM
        const authorId = msg.author; // msg.author siempre contendrá el JID correcto en un DM
        if (!authorId) return false;
        
        try {
            // 3. Buscar al usuario en la base de datos usando su ID permanente
            const user = await getUserData(authorId, msg);

            // 4. Verificar si el usuario existe y si está en un estado de espera de contraseña
            if (user && (user.registration_state === 'esperando_contraseña_dm' || user.registration_state === 'esperando_nueva_contraseña_dm')) {
                
                const originalState = user.registration_state; // Guardamos el estado original para el mensaje de éxito
                const newPassword = msg.body.trim();

                console.log(`[PassListener] Usuario ${authorId} encontrado en estado '${originalState}'. Procesando contraseña.`);

                // 5. Validar la contraseña
                if (newPassword.length < 4) {
                    await msg.reply("⚠️ Tu contraseña es muy corta. Debe tener al menos 4 caracteres. Por favor, envía una contraseña válida.");
                    return true; // Mensaje procesado
                }

                // 6. Hashear y guardar la contraseña
                const hashedPassword = await hashPassword(newPassword);
                if (!hashedPassword) {
                    await msg.reply("❌ Hubo un error crítico al procesar tu contraseña. Inténtalo de nuevo más tarde.");
                    return true;
                }

                user.password = hashedPassword;
                user.registration_state = 'completado'; // Limpiar el estado a 'completado'
                
                await saveUserData(authorId, user);
                
                // 7. Enviar mensaje de éxito
                const successMessage = originalState === 'esperando_nueva_contraseña_dm'
                    ? "✅ ¡Tu contraseña ha sido cambiada con éxito! 🎉"
                    : "✅ ¡Tu contraseña ha sido establecida con éxito! 🎉\nYa puedes usar todos los comandos de economía.";
                
                await msg.reply(successMessage);
                console.log(`[PassListener] Contraseña actualizada y estado limpiado para ${authorId}.`);
                
                return true; // Mensaje procesado
            }

        } catch (error) {
            console.error('[PassListener] Ocurrió un error al procesar el DM de contraseña:', error);
            try { await msg.reply("❌ Hubo un error en el servidor al verificar tu estado. Por favor, intenta de nuevo."); } catch(e) {}
            return true;
        }
        
        return false; // El mensaje no era para este listener
    }
};