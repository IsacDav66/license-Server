// plugins/tops_fun.js (Baileys Version)
// Comandos divertidos de Tops aleatorios en grupos con audio.

const fs = require('fs').promises; // Usar promesas para leer archivos
const path = require('path');
// MessageMedia no se usa, enviaremos el buffer directamente

module.exports = {
    name: 'Tops Divertidos', // Nombre del plugin
    aliases: ['topgays', 'topotakus'], // Comandos que activan el plugin
    description: 'Genera un top 10 aleatorio de Gays u Otakus del grupo.',
    category: 'Diversión',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383070,
        price: "6.00",
        icon: "fa-masks-theater",
        preview: {
            suggestions: ["!topgays", "!topotakus"],
            responses: {
                "!topgays": "🏳️‍🌈 *Top Gays del Grupo* 🏳️‍🌈\n\n🏳️‍🌈 1. @UserA\n🏳️‍🌈 2. @UserB\n🏳️‍🌈 3. @UserC\n\n(Enviando audio divertido... 🎙️) [ENVIAR_AUDIO]",
                "!topotakus": "📺 *Top Otakus del Grupo* 📺\n\n🍙 1. @UserX\n🍙 2. @UserY\n\n(Enviando audio otaku... 🎙️) [ENVIAR_AUDIO]"
            }
        }
    },

    
    // Ajustar parámetros a sock, msg, args, commandName
    async execute(sock, msg, args, commandName) {
        // 1. Obtener Chat y verificar si es grupo
        const chatInfo = await msg.getChat();
        if (!chatInfo.isGroup) {
            try { await msg.reply('Este comando solo funciona en grupos.'); } catch(e) {}
            return;
        }

        // 2. Obtener Participantes
        console.log(`[TopsFun Baileys] Obteniendo participantes para ${chatInfo.name || msg.from}...`);
        const groupMetadata = chatInfo.groupMetadata;
        if (!groupMetadata || !groupMetadata.participants || groupMetadata.participants.length === 0) {
            console.error(`[TopsFun Baileys] No se pudieron obtener participantes para el grupo ${msg.from}.`);
            try { await msg.reply('❌ Error al obtener la lista de participantes del grupo.'); } catch(e) {}
            return;
        }
        const participants = groupMetadata.participants;
        console.log(`[TopsFun Baileys] Participantes obtenidos: ${participants.length}`);

        // 3. Seleccionar Participantes Aleatorios
        const participantJids = participants.map(p => p.id);
        const numberOfParticipants = Math.min(participantJids.length, 10);
        const selectedJids = participantJids.sort(() => Math.random() - 0.5).slice(0, numberOfParticipants);

        // 4. Determinar Comando, Mensaje y Audio
        // commandName ya es el comando sin prefijo (ej. 'topgays')
        const usedCommand = commandName.toLowerCase(); 
        let messageTitle = '';
        let audioFileName = '';
        let emoji = '';

        if (usedCommand === 'topgays') {
            messageTitle = '🏳️‍🌈 *Top Gays del Grupo* 🏳️‍🌈';
            audioFileName = 'gay2.mp3'; // Nombre del archivo en media/audios
            emoji = '🏳️‍🌈';
        } else if (usedCommand === 'topotakus') {
            messageTitle = '📺 *Top Otakus del Grupo* 📺';
            audioFileName = 'otaku.mp3'; // Nombre del archivo en media/audios
            emoji = '🍙';
        } else {
            console.warn(`[TopsFun Baileys] Comando no reconocido dentro del plugin: ${usedCommand}`);
            try { await msg.reply("Comando de Top no reconocido."); } catch(e) {}
            return;
        }

        // 5. Construir Mensaje de Texto con Menciones
        let responseText = `${messageTitle}\n\n`;
        selectedJids.forEach((jid, index) => {
            const userNumber = jid.split('@')[0];
            responseText += `${emoji} ${index + 1}. @${userNumber}\n`;
        });

        // 6. Enviar Mensaje de Texto con Menciones
        console.log(`[TopsFun Baileys] Enviando top ${usedCommand} a ${msg.from}`);
        try {
            await sock.sendMessage(msg.from, {
                text: responseText,
                mentions: selectedJids
            }, { quoted: msg._baileysMessage });
        } catch (error) {
            console.error(`[TopsFun Baileys] Error enviando mensaje de texto:`, error);
            // No detener, intentar enviar audio igual si aplica
        }

        // 7. Enviar Audio (si existe)
        if (audioFileName) {
            const audioPath = path.join(__dirname, '..', 'media', 'audios', audioFileName); // Asumiendo que está en /media/audios relativo a la raíz del proyecto
            console.log(`[TopsFun Baileys] Buscando audio en: ${audioPath}`);

            try {
                await fs.access(audioPath); // Verificar si el archivo existe
                const audioBuffer = await fs.readFile(audioPath); // Leer el archivo como buffer

                console.log(`[TopsFun Baileys] Enviando audio ${audioFileName} como PTT...`);
                await sock.sendMessage(msg.from, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg', // O audio/mp3, audio/ogg, etc., según el formato
                    ptt: true // Enviar como mensaje de voz
                }); // No se puede citar fácilmente un PTT con el mensaje de texto anterior.
                console.log(`[TopsFun Baileys] Audio enviado.`);
            } catch (audioError) {
                if (audioError.code === 'ENOENT') {
                    console.warn(`[TopsFun Baileys] Archivo de audio no encontrado: ${audioPath}`);
                    // Opcional: Notificar que falta el audio
                    // await msg.reply(`Audio para ${usedCommand} no encontrado.`);
                } else {
                    console.error(`[TopsFun Baileys] Error al leer o enviar audio ${audioFileName}:`, audioError);
                }
            }
        }
    }
};