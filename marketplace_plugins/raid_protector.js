// plugins/raid_protector.js (Versión 5.3 - Protección de Arranque de 10 Minutos)

const raidTracker = new Map();

// --- CONFIGURACIÓN DEL ANTI-RAID ---
const REMOVAL_LIMIT = 5; // Cantidad de eliminaciones para activar la alarma
const TIME_WINDOW_SECONDS = 10; // Tiempo en el que deben ocurrir esas eliminaciones
const TIME_WINDOW_MS = TIME_WINDOW_SECONDS * 1000;

// --- CONFIGURACIÓN DE TIEMPO DE GRACIA AL INICIO ---
// 10 minutos * 60 segundos * 1000 ms = 600,000 ms
const STARTUP_COOLDOWN_MS = 10 * 60 * 1000; 
const BOT_START_TIMESTAMP = Date.now();

// --- USUARIOS AUTORIZADOS ---
const AUTHORIZED_REMOVERS_JIDS = [
    '51959442730@s.whatsapp.net',
    '51988388664@s.whatsapp.net',
];

module.exports = {
    name: 'Protección Anti-Raid',
    description: 'Detecta eliminaciones masivas. Ignora eventos los primeros 10 min de encendido.',
    isListener: true,
    marketplace: {
        requirements: ["Bot Administrador"],
        tebex_id: 7383032,
        price: "15.00",
        icon: "fa-shield-halved",
        preview: {
            suggestions: ["Simular Raid", "!antiraid status"],
            responses: {
                "Simular Raid": "🚨 *ANTI-RAID ACTIVADO* 🚨\n\nSe detectaron 5 eliminaciones en menos de 10s.\n\n🛡️ *Medida:* Todos los administradores han sido degradados para detener el ataque. Amenaza neutralizada.",
                "!antiraid status": "🛡️ *Protección Anti-Raid:* ACTIVO\n⏱️ *Tiempo de gracia:* 10 min\n✅ El bot monitoriza eliminaciones masivas en tiempo real."
            }
        }
    },

    async initialize(sock) {
        console.log(`[Anti-Raid] 🛡️ Sistema listo. Modo "Ignorar Eventos Viejos" activo por 10 minutos.`);

        const botNumbers = (process.env.BOT_MENTION_ALIAS_NUMBERS || "").split(',').map(n => n.trim());
        if (botNumbers.length === 0 || !botNumbers[0]) {
            console.error('\x1b[31m[Anti-Raid] ERROR: BOT_MENTION_ALIAS_NUMBERS no configurado en .env\x1b[0m');
            return; 
        }

        sock.ev.on('group-participants.update', async (event) => {
            const { id: groupId, participants, action, author } = event;

            // 1. Filtrar solo eliminaciones
            if (action !== 'remove' || participants.length === 0) return;

            // --- LÓGICA DE PROTECCIÓN DE ARRANQUE (10 MINUTOS) ---
            // Si el tiempo actual es menor a (Hora de inicio + 10 minutos)
            if (Date.now() < (BOT_START_TIMESTAMP + STARTUP_COOLDOWN_MS)) {
                // El bot ignora silenciosamente cualquier eliminación para evitar falsos positivos
                // por la carga masiva de mensajes antiguos.
                return;
            }
            // ------------------------------------------------------

            // --- LÓGICA DE USUARIOS AUTORIZADOS ---
            if (AUTHORIZED_REMOVERS_JIDS.includes(author)) {
                // Si quien elimina es un admin de confianza del bot, no hacemos nada
                return; 
            }

            // --- LÓGICA DE DETECCIÓN DE RAID ---
            const tracker = raidTracker.get(groupId) || { count: 0, timer: null, triggered: false };
            
            // Si ya se disparó el raid en este grupo recientemente, salimos
            if (tracker.triggered) return;

            tracker.count += participants.length;
            
            console.log(`[Anti-Raid] Conteo en ${groupId}: ${tracker.count}/${REMOVAL_LIMIT} (Autor: ${author?.split('@')[0] || '?'})`);
            
            // Configurar el temporizador de reseteo
            if (tracker.timer) clearTimeout(tracker.timer);
            tracker.timer = setTimeout(() => { 
                raidTracker.delete(groupId); 
            }, TIME_WINDOW_MS);
            
            raidTracker.set(groupId, tracker);

            // --- DISPARO DEL ANTI-RAID ---
            if (tracker.count >= REMOVAL_LIMIT) {
                tracker.triggered = true;
                raidTracker.set(groupId, tracker);

                console.log(`\x1b[31m[Anti-Raid] ¡RAID CONFIRMADO EN ${groupId}!\x1b[0m`);

                try {
                    const groupMetadata = await sock.groupMetadata(groupId);
                    
                    // Buscar al bot en la lista de admins
                    const botInfo = groupMetadata.participants.find(p => botNumbers.some(num => p.id.startsWith(num)));

                    if (!botInfo || !botInfo.admin) {
                        console.log(`\x1b[33m[Anti-Raid] El bot no es admin, no puedo defender el grupo.\x1b[0m`);
                        return;
                    }
                    
                    // Filtrar admins para degradar (excluyendo al bot)
                    const admins = groupMetadata.participants.filter(p => p.admin);
                    const jidsToDemote = admins
                        .filter(admin => !botNumbers.some(num => admin.id.startsWith(num))) 
                        .map(admin => admin.id);

                    if (jidsToDemote.length > 0) {
                        await sock.sendMessage(groupId, { 
                            text: `🚨 *ANTI-RAID ACTIVADO* 🚨\n\nSe detectaron ${tracker.count} eliminaciones en menos de ${TIME_WINDOW_SECONDS}s.\n\n🛡️ *Medida:* Todos los administradores han sido degradados para detener el ataque.` 
                        });
                        
                        // Acción de demote
                        await sock.groupParticipantsUpdate(groupId, jidsToDemote, 'demote');
                        console.log(`\x1b[32m[Anti-Raid] Amenaza neutralizada. Admins degradados.\x1b[0m`);
                    }
                } catch (error) {
                    console.error(`[Anti-Raid Error]`, error);
                } finally {
                    if (tracker.timer) clearTimeout(tracker.timer);
                    raidTracker.delete(groupId);
                }
            }
        });
    }
};