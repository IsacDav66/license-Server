// --- plugins/bienvenida-comunidad.js ---

const color = {
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
    brightGreen: "\x1b[92m",
    magenta: "\x1b[35m",
    yellow: "\x1b[33m"
};

module.exports = {
    name: 'Bienvenida Comunidad Simple',
    description: 'Saluda al usuario y le indica unirse al grupo principal desde la Comunidad.',
    isListener: true,
    category: 'Grupo', // Añadido para el filtro
    marketplace: {
        tebex_id: 7383040,
        price: "6.00",
        icon: "fa-door-open",
        preview: {
            suggestions: ["Simular Entrada"],
            responses: {
                "Simular Entrada": "¡Hola @Usuario! 👋 ¡Bienvenido a nuestra Comunidad!\n\nEstás en el grupo de *Recepción*. Para empezar a interactuar, entra a la pestaña de la **Comunidad** y únete al **Grupo Principal**. 🚀"
            }
        }
    },

    initialize: async (sock) => {
        // ID del grupo donde el bot dará la bienvenida (Recepción)
        const GRUPO_RECEPCION = '120363241724220394@g.us';

        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;

                // 1. FILTRO: Solo actuar en el grupo de recepción y cuando alguien entra
                if (id !== GRUPO_RECEPCION || action !== 'add') return;

                for (let participant of participants) {
                    /**
                     * 🛡️ SOLUCIÓN AL ERROR .split (Compatibilidad v7+ LIDs)
                     * Extraemos el ID ya sea que venga como String o como Objeto
                     */
                    let rawJid = "";
                    if (typeof participant === 'string') {
                        rawJid = participant;
                    } else if (participant && typeof participant === 'object') {
                        rawJid = participant.id || participant.jid || String(participant);
                    }

                    // Si no hay un ID válido, saltar al siguiente
                    if (!rawJid || !rawJid.includes('@')) continue;

                    // Extraemos el número o ID para la mención visual
                    const userTag = rawJid.split('@')[0];
                    
                    console.log(`${color.magenta}✨ [BIENVENIDA]${color.reset} Usuario detectado: ${color.brightGreen}${userTag}${color.reset}`);

                    /**
                     * 📝 MENSAJE DE INSTRUCCIONES
                     * Se le indica al usuario que use la interfaz de la Comunidad.
                     */
                    const textoMsg = `¡Hola @${userTag}! 👋 ¡Bienvenido a nuestra Comunidad!\n\nEstás en el grupo de *Recepción*. Para empezar a interactuar y hablar con todos, por favor entra a la pestaña de la **Comunidad** en tu WhatsApp y únete al **Grupo Principal** que verás en la lista.\n\n¡Te esperamos allá! 🚀`;

                    // Enviar mensaje mencionando al usuario
                    await sock.sendMessage(id, {
                        text: textoMsg,
                        mentions: [rawJid] // Esto hace que al usuario le suene la notificación
                    });
                }
            } catch (err) {
                console.error(`${color.yellow}⚠️ [ERROR PLUGIN BIENVENIDA]${color.reset}`, err.message);
            }
        });

        console.log(`${color.cyan}✅ [PLUGIN] Bienvenida de Comunidad (Instrucción Manual) lista.${color.reset}`);
    }
};