// plugins/ping.js
// Comprueba latencia y muestra info del sistema.

const os = require('os'); // Módulo nativo para info del sistema

// Función para formatear segundos a tiempo legible (días, horas, minutos, segundos)
// (Sin cambios respecto a tu versión original, es lógica pura de JS)
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);

    let uptimeString = '';
    if (d > 0) uptimeString += `${d}d `;
    if (h > 0) uptimeString += `${h}h `;
    if (m > 0) uptimeString += `${m}m `;
    if (s > 0 || uptimeString === '') uptimeString += `${s}s`;
    return uptimeString.trim();
}

module.exports = {
    name: 'Ping y Estado del Sistema', // Nombre más descriptivo
    aliases: ['ping', 'pong', 'speed', 'estado', 'status'], // Comandos que lo activan
    description: 'Comprueba la latencia del bot y muestra información del sistema.',
    category: 'Utilidad', // Categoría para el menú de ayuda
    groupOnly: false, // Puede usarse en chats privados también
    marketplace: {
        tebex_id: 7383018,
        price: "12.00",
        icon: "fa-chart-line",
        preview: {
            suggestions: ["!stats", "!evolucion"],
            responses: {
                "!stats": {
                    text: "📊 *ESTADÍSTICAS DEL GRUPO*\n\n📅 *Período:* Últimos 7 registros\n👥 *Total actual:* 1,540\n✨ *Crecimiento:* 📈 +12",
                    // URL Codificada para evitar error 400
                    image: "https://quickchart.io/chart?c=%7Btype:'line',data:%7Blabels:['1/4','2/4','3/4','4/4','5/4','6/4','7/4'],datasets:[%7Blabel:'Miembros',data:[1480,1495,1510,1520,1535,1538,1540],borderColor:'%2325D366'%7D]%7D%7D"
                },
                "!evolucion": {
                    text: "⏳ Generando visualización de crecimiento...",
                    image: "https://quickchart.io/chart?c=%7Btype:'sparkline',data:%7Bdatasets:[%7Bdata:[10,15,8,12,18,20,25]%7D]%7D%7D"
                }
            }
        }
    },

    async execute(sock, adaptedMessage, args) {
        // sock: La instancia del socket de Baileys
        // adaptedMessage: El objeto de mensaje adaptado
        // args: Los argumentos del comando (no se usan en ping)

        const chatId = adaptedMessage.from; // JID del chat donde se envió el comando
        const startTime = Date.now(); // Tiempo antes de cualquier acción de respuesta

        console.log(`[Ping Baileys] Comando recibido en ${chatId}. Tiempo inicial: ${startTime}`);

        // 1. Enviar respuesta inicial simple para medir latencia
        // Usaremos sock.sendMessage directamente para enviar la respuesta inicial
        // y luego el mensaje de estado. Esto evita anidar replies.
        // Guardamos la promesa del mensaje enviado para saber cuándo se completó.
        let pongMessageSentPromise;
        try {
            pongMessageSentPromise = sock.sendMessage(chatId,
                { text: '🏓 Pong!' },
                { quoted: adaptedMessage._baileysMessage } // Citar el mensaje original del usuario
            );
        } catch (error) {
            console.error("[Ping Baileys] Error enviando 'Pong!' inicial:", error);
            // Si falla el "Pong!", es poco probable que el resto funcione, pero lo intentamos.
            // No hacemos return aquí, ya que la latencia se calcula después.
        }

        // Esperar a que el mensaje "Pong!" se envíe (o falle)
        // Aunque la latencia se calcula al recibir la confirmación de WhatsApp (no solo al enviar localmente),
        // esta es una aproximación simple.
        if (pongMessageSentPromise) {
            await pongMessageSentPromise.catch(e => console.warn("[Ping Baileys] Promesa de 'Pong!' rechazada, continuando..."));
        }
        
        const initialResponseTime = Date.now(); // Tiempo después de que la función de envío haya retornado
        const latency = initialResponseTime - startTime;
        console.log(`[Ping Baileys] Latencia (hasta intento de envío de 'Pong!'): ${latency} ms`);

        // 2. Obtener Información del Sistema (sin cambios)
        const platform = os.platform();
        const arch = os.arch();
        const uptimeSeconds = os.uptime();
        const formattedUptime = formatUptime(uptimeSeconds);

        // 3. Construir Mensaje Final con Estado del Sistema
        const finalReplyMsg =
            `*⏱️ Estado del Bot (Baileys):*\n\n` +
            `*Latencia (aprox.):* ${latency} ms\n` + // La latencia real implica el roundtrip con el servidor de WA
            `*Sistema Operativo:* ${platform}\n` +
            `*Arquitectura:* ${arch}\n` +
            `*Tiempo Activo (OS):* ${formattedUptime}`;

        // 4. Enviar el Mensaje de Estado Final
        try {
            // Enviamos este mensaje como uno nuevo, sin citar, para que sea una información separada.
            await sock.sendMessage(chatId, { text: finalReplyMsg });
            console.log("[Ping Baileys] Mensaje de estado final enviado.");
        } catch (error) {
            console.error("[Ping Baileys] Error enviando mensaje de estado final:", error);
            // Opcional: Podrías intentar enviar un mensaje de error más simple si esto falla
            // await sock.sendMessage(chatId, { text: "Error al mostrar el estado del sistema." });
        }
    }
};