// plugins/Listeners/log_announcer.js
const { pool } = require('../shared-economy.js');
const ANNOUNCEMENT_GROUP_JID = '120363241724220394@g.us'; // Tu grupo de pruebas

module.exports = {
    name: 'Anunciador de Logs',
    description: 'Anuncia logs completados.',
    isListener: true,
    category: 'Admin', // Añadido para que el Marketplace lo clasifique
    marketplace: {
        tebex_id: 7383027,
        price: "5.00",
        icon: "fa-bullhorn",
        preview: {
            suggestions: ["Simular Log"],
            responses: {
                "Simular Log": "✅ *Nuevo Log de publicacion de grupo detectado*\n\n*ID:* 452\n*Estado:* COMPLETED\n*Error:* Sin errores"
            }
        }
    },

    async initialize(sock) {
        console.log('\x1b[35m[Log Announcer] Intentando conectar al canal "log_completed"...\x1b[0m');

        try {
            const client = await pool.connect();
            await client.query('LISTEN log_completed');
            console.log('\x1b[32m[Log Announcer] ✅ Escuchando notificaciones de PostgreSQL correctamente.\x1b[0m');

            client.on('notification', async (notification) => {
                const logId = parseInt(notification.payload, 10);
                if (isNaN(logId)) return;

                console.log(`\x1b[36m[Log Announcer] 🔔 Notificación detectada para ID: ${logId}\x1b[0m`);
                
                const result = await client.query('SELECT * FROM script_logs WHERE id = $1', [logId]);
                if (result.rows.length > 0) {
                    const log = result.rows[0];
                    if (log.is_announced) return;

                    const message = `✅ *Nuevo Log de publicacion de grupo detectado*\n\n` +
                                  `*ID:* ${log.id}\n` +
                                  `*Estado:* ${log.end_status}\n` +
                                  (log.error_details ? `*Error:* ${log.error_details}` : 'Sin errores');

                    await sock.sendMessage(ANNOUNCEMENT_GROUP_JID, { text: message });
                    await client.query('UPDATE script_logs SET is_announced = TRUE WHERE id = $1', [logId]);
                }
            });

            // Manejar errores de conexión para que no se muera el bot
            client.on('error', (err) => {
                console.error('\x1b[31m[Log Announcer] Error en conexión de escucha:\x1b[0m', err);
            });

        } catch (err) {
            console.error('\x1b[31m[Log Announcer] Error al inicializar:\x1b[0m', err);
        }
    }
};