// plugins/admins.js

module.exports = {
    name: 'Mencionar Admins',
    aliases: ['admins', 'staff', '@admin', '@admins'], // Comandos para invocar
    description: 'Menciona a todos los administradores del grupo.',
    groupOnly: true, // Este comando solo funcionará en grupos
    category: 'Grupo', // Categoría para el menú de ayuda
    marketplace: {
        tebex_id: 7383042,
        price: "4.00",
        icon: "fa-users-line",
        preview: {
            suggestions: ["!admins Ayuda!"],
            responses: {
                "!admins Ayuda!": "📢 ¡Atención Administradores!\n\nMotivo: *Ayuda!* \n\nSe solicita su presencia:\n➤ @Admin1\n➤ @Admin2\n➤ @Owner"
            }
        }
    },

    async execute(sock, msg, args) {
        // CORRECCIÓN: Usar msg.from que ya contiene el JID del chat (grupo o privado)
        const chatJid = msg.from;

        if (!chatJid || !chatJid.endsWith('@g.us')) {
            // Esta verificación es redundante si groupOnly: true, pero es una buena práctica
            await msg.reply('Este comando solo se puede usar en grupos.');
            return;
        }

        try {
            // Obtener metadatos del grupo usando el adaptador
            // msg.getChat() ya está disponible en tu adaptador y devuelve groupMetadata
            const chat = await msg.getChat();
            if (!chat || !chat.isGroup || !chat.groupMetadata) {
                await msg.reply('No se pudo obtener la información de este grupo.');
                return;
            }

            const groupMetadata = chat.groupMetadata;
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

            if (admins.length === 0) {
                await msg.reply('No se encontraron administradores en este grupo (¡esto es raro!).');
                return;
            }

            let text = `📢 ¡Atención Administradores!\n${args.join(" ") ? `\nMotivo: *${args.join(" ")}* \n` : '\n' }Se solicita su presencia:\n`;
            const mentions = [];

            for (const admin of admins) {
                text += `➤ @${admin.id.split('@')[0]}\n`; // Construye el texto para la mención
                mentions.push(admin.id); // Agrega el JID del admin a la lista de menciones
            }

            await sock.sendMessage(chatJid, { // CORRECCIÓN: Usar chatJid
                text: text,
                mentions: mentions // Array de JIDs a mencionar
            }, { quoted: msg._baileysMessage }); // Usar el mensaje original de Baileys guardado en el adaptador

        } catch (error) {
            console.error('[ERROR EN PLUGINS/ADMINS.JS]', error);
            await msg.reply('Ocurrió un error al intentar mencionar a los administradores.');
        }
    }
};