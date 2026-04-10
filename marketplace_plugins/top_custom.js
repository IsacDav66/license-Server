// plugins/top_custom.js (Versión con Cooldown de 5 horas)

const axios = require('axios');
// --- ¡NUEVAS IMPORTACIONES! ---
const { getUserData, saveUserData, msToTime } = require('../shared-economy');

// --- ¡NUEVA CONFIGURACIÓN! ---
const COOLDOWN_TOP_MS = 5 * 60 * 60 * 1000; // 5 horas

module.exports = {
    name: 'Top Personalizado',
    aliases: ['top'],
    description: 'Crea un top 10 aleatorio del grupo con el título que especifiques.',
    category: 'Diversión',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383069,
        price: "5.00",
        icon: "fa-arrow-up-1-9",
        preview: {
            suggestions: ["!top Los más larrys", "!top Los más pro"],
            responses: {
                "!top Los más larrys": "🤓 *Top 10 Los más larrys* 🤓\n\n*1.* @Usuario1\n*2.* @Usuario2\n*3.* @Usuario3\n*4.* @Usuario4\n*5.* @Usuario5\n*6.* @Usuario6\n*7.* @Usuario7\n*8.* @Usuario8\n*9.* @Usuario9\n*10.* @Usuario10",
                "!top Los más pro": "🔥 *Top 10 Los más pro* 🔥\n\n*1.* @UsuarioA\n*2.* @UsuarioB\n*3.* @UsuarioC\n*4.* @UsuarioD\n*5.* @UsuarioE\n*6.* @UsuarioF\n*7.* @UsuarioG\n*8.* @UsuarioH\n*9.* @UsuarioI\n*10.* @UsuarioJ"
            }
        }
    },

    async execute(sock, msg, args) {
        // --- ¡NUEVO BLOQUE DE COOLDOWN! ---
        const userId = msg.author;
        const user = await getUserData(userId);
        const now = Date.now();

        if (now - (user.lasttop || 0) < COOLDOWN_TOP_MS) {
            const timeLeft = COOLDOWN_TOP_MS - (now - (user.lasttop || 0));
            return msg.reply(`⏳ Debes esperar *${msToTime(timeLeft)}* para usar este comando de nuevo.`);
        }
        // --- FIN DEL BLOQUE DE COOLDOWN ---

        const chatInfo = await msg.getChat();
        if (!chatInfo.isGroup) {
            return msg.reply('Este comando solo funciona en grupos.');
        }

        const topTitleText = args.join(' ').trim();
        if (!topTitleText) {
            return msg.reply('⚠️ Debes escribir un texto para el top.\nEjemplo: `.top Los más pro`');
        }

        const groupMetadata = chatInfo.groupMetadata;
        if (!groupMetadata || !groupMetadata.participants || groupMetadata.participants.length === 0) {
            return msg.reply('❌ Error al obtener la lista de participantes del grupo.');
        }
        
        // --- ¡ACTUALIZACIÓN DE LA BASE DE DATOS! ---
        // Actualizamos el timestamp ANTES de ejecutar el comando para evitar spam si algo falla.
        user.lasttop = now;
        await saveUserData(userId, user);
        // ---------------------------------------------

        const participants = groupMetadata.participants;
        const participantJids = participants.map(p => p.id);
        const amountToShow = Math.min(participantJids.length, 10);
        const selectedJids = participantJids.sort(() => Math.random() - 0.5).slice(0, amountToShow);

        const emojis = ['🤓', '😅', '😂', '😳', '😎', '🥵', '😱', '🤑', '🙄', '💩', '🍑', '🤨', '🥴', '🔥', '👇🏻', '😔', '👀', '🌚', '⭐', '🏆', '🥇', '💯'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        let topListText = '';
        selectedJids.forEach((jid, index) => {
            topListText += `*${index + 1}.* @${jid.split('@')[0]}\n`;
        });

        const finalText = `*${randomEmoji} Top ${amountToShow} ${topTitleText} ${randomEmoji}*\n\n${topListText}`;

        try {
            await sock.sendMessage(msg.from, {
                text: finalText,
                mentions: selectedJids
            }, { quoted: msg._baileysMessage });
        } catch (error) {
            console.error(`[TopCustom Baileys] Error enviando mensaje de texto:`, error);
            await msg.reply(`❌ Error al enviar el top.`);
            // Si hay un error, reseteamos el cooldown para que el usuario pueda intentarlo de nuevo.
            user.lasttop = 0;
            await saveUserData(userId, user);
        }
    }
};