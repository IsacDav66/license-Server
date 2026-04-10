// plugins/admin-change-listener.js

// CACHÉ GLOBAL ANTI-SPAM
// Almacena IDs procesados para evitar repeticiones
const announcedCache = new Set();

module.exports = {
    name: 'Admin Action Announcer',
    description: 'Anuncia cambios de admin (Con bloqueo anti-spam estricto).',
    category: 'Dueño',
    isListener: true,
    marketplace: {
        tebex_id: 7383058,
        price: "5.00",
        icon: "fa-bell",
        preview: {
            suggestions: ["Simular Ascenso", "Simular Degradación"],
            responses: {
                "Simular Ascenso": "✨ *Nuevo Admin* ✨\n\n@Dueño ha hecho admin a @Usuario.",
                "Simular Degradación": "❗ *Admin Removido* ❗\n\n@Dueño le ha quitado el admin a @Usuario."
            }
        }
    },

    async initialize(sock) {
        if (!sock || !sock.ev) return;

        sock.ev.on('group-participants.update', async (update) => {
            const { id, participants, action, author } = update;

            // Filtros básicos
            if (action !== 'promote' && action !== 'demote') return;
            if (!author) return;

            // Espera de seguridad (2s)
            await new Promise(resolve => setTimeout(resolve, 2000));

            const actorMention = `@${author.split('@')[0]}`;
            const actorJidForMention = author;

            for (const participantJid of participants) {
                // 1. Obtener ID limpio
                const userJid = typeof participantJid === 'string' ? participantJid : participantJid.id;
                if (!userJid) continue;

                // 2. Obtener solo el NÚMERO (para unificar LID y JID)
                const userNumber = userJid.split(':')[0].split('@')[0];

                // 3. GENERAR LLAVE ÚNICA (Grupo + Acción + Usuario)
                const uniqueKey = `${id}-${action}-${userNumber}`;

                // 4. VERIFICAR CANDADO
                if (announcedCache.has(uniqueKey)) {
                    // Ya anunciamos esto hace poco, ignorar.
                    continue;
                }

                // 5. PONER CANDADO (Dura 10 segundos)
                announcedCache.add(uniqueKey);
                setTimeout(() => announcedCache.delete(uniqueKey), 10000);

                // --- ENVIAR MENSAJE ---
                const targetMention = `@${userNumber}`;
                const mentions = [userJid, actorJidForMention];
                let messageText = "";

                if (action === 'demote') {
                    messageText = `❗ *Admin Removido* ❗\n\n${actorMention} le ha quitado el admin a ${targetMention}.`;
                } else if (action === 'promote') {
                    messageText = `✨ *Nuevo Admin* ✨\n\n${actorMention} ha hecho admin a ${targetMention}.`;
                }

                try {
                    await sock.sendMessage(id, { text: messageText, mentions: mentions });
                    console.log(`[Announcer] ✅ Notificación enviada una sola vez para ${userNumber}`);
                } catch (err) {
                    console.error(`[Announcer Error]`, err.message);
                }
            }
        });
    }
};