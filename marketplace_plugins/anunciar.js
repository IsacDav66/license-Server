// plugins/Dueño/anunciar.js

// --- CONFIGURACIÓN ---
// Define tu ID de propietario. Solo este ID podrá usar el comando.
const OWNER_ID = '1658008416509@lid';
// Define el JID del grupo donde se enviarán los anuncios.
const ANNOUNCEMENT_GROUP_JID = '120363241724220394@g.us';

module.exports = {
    name: 'Anunciador Global',
    aliases: ['anunciar', 'anuncio', 'broadcast'],
    description: 'Envía un anuncio formateado a un grupo predefinido.',
    category: 'Dueño',
    // Se puede usar desde cualquier chat, no solo en grupos.
    groupOnly: false,
    marketplace: {
        tebex_id: 7383056,
        price: "5.00",
        icon: "fa-bullhorn",
        preview: {
            suggestions: ["!anunciar Nueva Update!"],
            responses: {
                "!anunciar Nueva Update!": "*╭───◎「 📢 STUN | UPDATE 」◎───╮*\n*│*\n*│*  Nueva Update!\n*│*\n*│* ✨ ¡Espero que disfruten las mejoras!\n*│*\n*╰─────────────◎*"
            }
        }
    },

    async execute(sock, msg, args) {
        const senderId = msg.author;

        // 1. Verificación de Propietario
        // Comprueba si el autor del mensaje es el dueño del bot.
        if (senderId !== OWNER_ID) {
            // Opcional: podrías no responder nada para que otros no sepan que el comando existe.
            return msg.reply('❌ Este comando es exclusivo para el propietario del bot.');
        }

        // 2. Verificar que haya un mensaje para anunciar
        // Si no se escriben palabras después del comando, muestra cómo usarlo.
        if (args.length === 0) {
            return msg.reply(
                '⚠️ Debes escribir el mensaje que quieres anunciar.\n\n' +
                '*Ejemplo:*\n' +
                `.anunciar Se ha corregido el bug del comando .play y se añadió el nuevo plugin .clima`
            );
        }

        // 3. Unir todos los argumentos para formar el mensaje completo
        const announcementText = args.join(' ');

        // 4. Formatear el mensaje del anuncio para que se vea bien
        // Puedes personalizar este formato como más te guste.
        const formattedAnnouncement = `
*╭───◎「 📢 STUN | UPDATE 」◎───╮*
*│*
*│*  ${announcementText}
*│*
*│* ✨ ¡Espero que disfruten las mejoras!
*│*
*╰─────────────◎*
        `.trim(); // .trim() elimina espacios en blanco innecesarios al inicio y al final

        // 5. Enviar el anuncio al grupo especificado
        try {
            await sock.sendMessage(ANNOUNCEMENT_GROUP_JID, {
                text: formattedAnnouncement
            });

            // 6. Enviar una confirmación al propietario de que el mensaje se envió
            await msg.reply('✅ ¡Anuncio enviado con éxito al grupo principal!');

        } catch (error) {
            console.error('[Anunciar] Error al enviar el mensaje al grupo:', error);
            await msg.reply(`❌ Ocurrió un error al intentar enviar el anuncio. Revisa la consola.\n\n*Error:* ${error.message}`);
        }
    }
};