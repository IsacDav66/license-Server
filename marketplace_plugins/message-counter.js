// plugins/Utilidad/message-counter.js

// Importamos las funciones necesarias, incluyendo el 'pool' para consultas directas
const { getUserData, saveUserData, pool } = require('../shared-economy');

module.exports = {
    name: 'Contador de Mensajes',
    aliases: ['count', 'msgcount', 'topmsgs'],
    description: 'Cuenta los mensajes de los usuarios y muestra un ranking.',
    category: 'Utilidad',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383019,
        price: "4.00",
        icon: "fa-calculator",
        preview: {
            suggestions: ["!count", "!topmsgs"],
            responses: {
                "!count": "📊 El usuario @51974... ha enviado un total de *1,250* mensajes.",
                "!topmsgs": "🏆 *Top 10 Mensajeros del Bot* 🏆\n\n🥇 *StunBot* - 5,420 mensajes\n🥈 *StunDoc* - 4,100 mensajes\n🥉 *Soporte* - 2,800 mensajes\n4️⃣ *User_99* - 1,500 mensajes"
            }
        }
    },

    /**
     * Listener que se ejecuta en cada mensaje para incrementar el contador.
     * @returns {boolean} - Siempre devuelve false para no interrumpir otros comandos.
     */
    checkMessage: async (sock, msg) => {
        // Solo contar en grupos y no contar los mensajes del propio bot
        const chat = await msg.getChat();
        if (!chat.isGroup || msg.fromMe || !msg.author) {
            return false;
        }

        try {
            // Obtener los datos del usuario que envió el mensaje
            const user = await getUserData(msg.author, msg);
            
            // Incrementar el contador (usamos || 0 como seguridad)
            user.message_count = (user.message_count || 0) + 1;
            
            // Guardar los datos actualizados
            await saveUserData(msg.author, user);

        } catch (error) {
            console.error('[Message Counter] Error al incrementar el contador de mensajes:', error);
        }

        // Devolvemos false para que el mensaje pueda ser procesado por otros comandos o listeners.
        return false;
    },

    /**
     * Comando para ver el contador de mensajes o el top.
     */
    async execute(sock, msg, args, commandName) {
        
        // --- Lógica para el comando .topmsgs ---
        if (commandName === 'topmsgs') {
            try {
                // Consulta SQL para obtener el top 10 de usuarios por message_count
                const query = `
                    SELECT "pushname", "message_count"
                    FROM users
                    WHERE "message_count" > 0
                    ORDER BY "message_count" DESC
                    LIMIT 10;
                `;
                const result = await pool.query(query);

                if (result.rows.length === 0) {
                    return msg.reply('Aún no hay suficientes datos para mostrar un ranking.');
                }

                let topText = '🏆 *Top 10 Mensajeros del Bot* 🏆\n\n';
                const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

                result.rows.forEach((row, index) => {
                    const name = row.pushname || 'Usuario Desconocido';
                    const count = row.message_count;
                    topText += `${rankEmojis[index] || '🔹'} *${name}* - ${count} mensajes\n`;
                });

                return msg.reply(topText);

            } catch (error) {
                console.error('[Top Msgs] Error al obtener el ranking:', error);
                return msg.reply('❌ Ocurrió un error al generar el ranking.');
            }
        }

        // --- Lógica para el comando .count ---
        let targetId;
        
        // Si se menciona a alguien, el objetivo es esa persona.
        if (msg.mentionedJidList.length > 0) {
            targetId = msg.mentionedJidList[0];
        } else {
            // Si no, el objetivo es la persona que escribió el comando.
            targetId = msg.author;
        }

        try {
            const userData = await getUserData(targetId, msg);
            const targetName = userData.pushname || targetId.split('@')[0];
            const messageCount = userData.message_count || 0;

            const replyText = `📊 El usuario @${targetId.split('@')[0]} ha enviado un total de *${messageCount}* mensajes.`;

            await sock.sendMessage(msg.from, {
                text: replyText,
                mentions: [targetId]
            });

        } catch (error) {
            console.error('[Count Msg] Error al obtener el contador:', error);
            return msg.reply('❌ No pude obtener los datos de ese usuario.');
        }
    }
};