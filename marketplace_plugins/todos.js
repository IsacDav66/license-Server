// plugins/todos.js (Versión Final con Cooldown, Formato y Permisos Nativos)

// --- ¡NUEVO! GESTIÓN DEL COOLDOWN ---
// Usamos un Map para almacenar la última vez que se usó el comando en cada grupo.
// La clave será el JID del grupo (chatId), y el valor será la marca de tiempo (timestamp) de cuándo termina el cooldown.
const commandCooldowns = new Map();
const COOLDOWN_HOURS = 5;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000; // 5 horas en milisegundos.

/**
 * Función de utilidad para convertir milisegundos a un formato legible.
 * @param {number} ms - Milisegundos a convertir.
 * @returns {string} - El tiempo formateado como "X horas, Y minutos y Z segundos".
 */
function msToTime(ms) {
    let seconds = Math.floor((ms / 1000) % 60);
    let minutes = Math.floor((ms / (1000 * 60)) % 60);
    let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    let parts = [];
    if (hours > 0) parts.push(`${hours} hora(s)`);
    if (minutes > 0) parts.push(`${minutes} minuto(s)`);
    if (seconds > 0) parts.push(`${seconds} segundo(s)`);

    return parts.join(', ');
}


module.exports = {
    name: 'Mencionar a Todos',
    aliases: ['todos', 'everyone', '@todos'],
    description: `Menciona a todos en el grupo. Tiene un cooldown de ${COOLDOWN_HOURS} horas.`,
    category: 'Administración',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383077,
        price: "5.00",
        icon: "fa-users-viewfinder",
        preview: {
            suggestions: ["!todos Hola!", "!everyone"],
            responses: {
                "!todos Hola!": "📢 *¡Atención, Grupo!* 📢\n\nSe solicita la presencia de todos:\n• @User1\n• @User2\n• @User3...\n\n- _Comando ejecutado por admin._",
                "!everyone": "📢 *¡Atención, Grupo!* 📢\n\nSe solicita la presencia de todos:\n• @User1\n• @User2\n• @User3...\n\n- _Comando ejecutado por admin._"
            }
        }
    },
    

    async execute(sock, adaptedMessage, args) {
        const chatId = adaptedMessage.from;
        const senderId = adaptedMessage.author;
        const baileysOriginalMsg = adaptedMessage._baileysMessage;
        const now = Date.now();

        // --- ¡NUEVO! VERIFICACIÓN DEL COOLDOWN ---
        // Esta es la primera comprobación que hacemos para ser más eficientes.
        const cooldownEndTime = commandCooldowns.get(chatId);
        if (cooldownEndTime && now < cooldownEndTime) {
            const remainingMs = cooldownEndTime - now;
            const remainingTime = msToTime(remainingMs);
            console.log(`[Todos Cooldown] Comando en enfriamiento para el grupo ${chatId}.`);
            return await adaptedMessage.reply(`⏳ Este comando está en enfriamiento.\n\nInténtalo de nuevo en: *${remainingTime}*.`);
        }

        // --- Obtención de Metadatos y Verificación de Permisos (sin cambios) ---
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatId);
        } catch (error) {
            console.error(`[Todos Cooldown] Error obteniendo metadatos para ${chatId}:`, error);
            return await adaptedMessage.reply('❌ No pude obtener la información de este grupo.');
        }

        const participants = groupMetadata.participants;
        const senderInGroup = participants.find(p => p.id === senderId);

        if (!senderInGroup || !senderInGroup.admin) {
            console.log(`[Todos Cooldown] Acceso denegado a ${senderId.split('@')[0]}. No es admin.`);
            return await adaptedMessage.reply('⛔️ Este comando solo puede ser utilizado por los administradores del grupo.');
        }
        
        console.log(`[Todos Cooldown] Comando ejecutado por el admin ${senderId.split('@')[0]}.`);

        // --- Formato de Mensaje (sin cambios) ---
        const groupName = groupMetadata.subject;
        const mentionJids = participants.map(p => p.id);

        let header = `📢 *¡Atención, ${groupName}!* 📢\n\nSe solicita la presencia de todos los miembros:\n\n`;
        const participantListText = participants
            .map(p => `  • @${p.id.split('@')[0]}`)
            .join('\n');
        let footer = `\n\n- _Comando ejecutado por un administrador._`;
        const fullMessage = header + participantListText + footer;

        try {
            await sock.sendMessage(chatId, {
                text: fullMessage,
                mentions: mentionJids
            }, { quoted: baileysOriginalMsg });

            // --- ¡NUEVO! ESTABLECER EL COOLDOWN DESPUÉS DEL ÉXITO ---
            // Solo si el mensaje se envía correctamente, establecemos el nuevo cooldown.
            commandCooldowns.set(chatId, now + COOLDOWN_MS);
            console.log(`[Todos Cooldown] Cooldown de ${COOLDOWN_HOURS} horas iniciado para ${chatId}.`);

        } catch (sendError) {
            console.error(`[Todos Cooldown] Error al enviar el mensaje de mención:`, sendError);
            await adaptedMessage.reply('❌ Ocurrió un error al intentar mencionar a todos.');
        }
    }
};