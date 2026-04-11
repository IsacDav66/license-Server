// plugins/Admin/vote-kick.js

const { getUserData, saveUserData, pool } = require('../../lib/bot-core');

// --- 1. CARGA DE JIDS ---
const BOT_JIDS = [];
if (process.env.BOT_JID_SWA) BOT_JIDS.push(process.env.BOT_JID_SWA);
if (process.env.BOT_JID_LID) BOT_JIDS.push(process.env.BOT_JID_LID);

// Función auxiliar para extraer SOLO el número
const getNumber = (jid) => {
    if (!jid) return null;
    return jid.split(':')[0].split('@')[0];
};

const BOT_NUMBERS = BOT_JIDS.map(jid => getNumber(jid));
// ------------------------------------------------------------------

// Almacenamiento temporal
const activeVotes = new Map();

// Configuraciones
const VOTOS_NECESARIOS = 3; 
const TIEMPO_VOTACION = 5 * 60 * 1000; 

module.exports = {
    name: 'Votación de Expulsión',
    aliases: ['votekick', 'banvote', 'sivoto', 'si'],
    description: 'Inicia o participa en una votación democrática para expulsar a un usuario (incluyendo admins).',
    category: 'Admin',
    groupOnly: true,
    marketplace: {
        requirements: ["Bot Administrador"],
        tebex_id: 7383041,
        price: "10.00",
        icon: "fa-gavel",
        preview: {
            suggestions: ["!votekick @Usuario", "!si"],
            responses: {
                "!votekick @Usuario": "⚖️ *TRIBUNAL INICIADO* ⚖️\n\nSe propone expulsar a @Usuario.\n🎯 Meta: *3 votos*.\n⏳ Tiempo: 5 minutos.\n\nEscribe *.si* para apoyar.",
                "!si": "🗳️ Voto registrado.\n📊 Progreso: 2/3"
            }
        }
    },

    checkMessage: async (sock, msg) => {
        return false;
    },

    async execute(sock, msg, args, commandName) {
        const chatId = msg.from;
        const senderId = msg.author; 
        const senderNumber = getNumber(senderId);

        if (BOT_JIDS.length === 0) {
            console.error('[VoteKick] ERROR: BOT_JID_SWA/LID no configurados en .env');
            return msg.reply('❌ Error interno de configuración.');
        }

        // --- BLOQUE 1: VOTAR (si, sivoto) ---
        if (['si', 'sivoto'].includes(commandName)) {
            if (!activeVotes.has(chatId)) {
                return msg.reply('⚠️ No hay ninguna votación de expulsión activa.');
            }

            const currentVote = activeVotes.get(chatId);

            // Verificar si ya votó
            const alreadyVoted = Array.from(currentVote.votes).some(voterId => getNumber(voterId) === senderNumber);

            if (alreadyVoted) {
                return msg.reply('⚠️ Ya has votado en esta sesión.');
            }

            currentVote.votes.add(senderId);
            const votosActuales = currentVote.votes.size;
            const targetMention = currentVote.targetId;

            await sock.sendMessage(chatId, {
                text: `🗳️ Voto registrado de @${senderNumber}.\n📊 Progreso: ${votosActuales}/${VOTOS_NECESARIOS}`,
                mentions: [senderId]
            });

            if (votosActuales >= VOTOS_NECESARIOS) {
                clearTimeout(currentVote.timer);
                activeVotes.delete(chatId);

                await sock.sendMessage(chatId, {
                    text: `⚖️ *TRIBUNAL FINALIZADO*\n\nLa comunidad ha hablado. El usuario @${getNumber(targetMention)} será eliminado.`,
                    mentions: [targetMention]
                });

                try {
                    await new Promise(r => setTimeout(r, 1000));
                    await sock.groupParticipantsUpdate(chatId, [targetMention], 'remove');
                } catch (err) {
                    console.error('[VoteKick] Error al expulsar:', err);
                    // Mensaje de error actualizado explicando el tema de los admins
                    await sock.sendMessage(chatId, { text: '❌ Error al intentar eliminar. Si el objetivo era Admin, yo necesito ser el Creador del Grupo (SuperAdmin) para poder echarlo.' });
                }
            }
            return;
        }

        // --- BLOQUE 2: INICIAR VOTACIÓN (votekick, banvote) ---
        if (['votekick', 'banvote'].includes(commandName)) {
            
            let groupMetadata;
            try {
                groupMetadata = await sock.groupMetadata(chatId);
            } catch (e) {
                return msg.reply('❌ No pude obtener los datos del grupo.');
            }

            const participants = groupMetadata.participants;

            // --- 2. DETECCIÓN DE BOT ADMIN ---
            const botParticipant = participants.find(p => {
                const pNum = getNumber(p.id);
                return BOT_NUMBERS.includes(pNum);
            });

            const botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

            if (!botIsAdmin) {
                return msg.reply('❌ Necesito ser Admin para gestionar el tribunal.');
            }

            // --- 3. DETECCIÓN DE SENDER ADMIN ---
            const senderParticipant = participants.find(p => getNumber(p.id) === senderNumber);
            const senderIsAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');

            if (!senderIsAdmin) {
                return msg.reply('❌ Solo los administradores pueden iniciar un tribunal.');
            }

            if (activeVotes.has(chatId)) {
                return msg.reply('⚠️ Ya hay una votación en curso.');
            }

            // --- 4. DETECCIÓN DEL OBJETIVO ---
            let targetId;
            if (msg.mentionedJidList && msg.mentionedJidList.length > 0) {
                targetId = msg.mentionedJidList[0];
            } else if (msg.contextInfo && msg.contextInfo.participant) {
                targetId = msg.contextInfo.participant;
            }

            if (!targetId) {
                return msg.reply('⚠️ Etiqueta a alguien o responde a su mensaje.\nEjemplo: *.votekick @usuario*');
            }

            const targetNumber = getNumber(targetId);

            // Validaciones de seguridad
            if (BOT_NUMBERS.includes(targetNumber)) return msg.reply('🤡 Buen intento, pero no me voy a ir.');
            if (targetNumber === senderNumber) return msg.reply('¿Por qué querrías expulsarte a ti mismo?');

            // --- CAMBIO AQUÍ: Eliminamos la restricción de "No se puede votar contra admin" ---
            // Solo dejamos una advertencia opcional si quieres, pero por ahora permitimos todo.
            
            const targetParticipant = participants.find(p => getNumber(p.id) === targetNumber);
            const targetIsAdmin = targetParticipant && (targetParticipant.admin === 'admin' || targetParticipant.admin === 'superadmin');

            let warningMsg = "";
            if (targetIsAdmin) {
                warningMsg = "\n⚠️ *Atención:* El objetivo es Administrador. Si la votación gana, solo podré expulsarlo si yo soy SuperAdmin (Creador).";
            }

            // --- 5. INICIAR ESTRUCTURA ---
            const timer = setTimeout(() => {
                if (activeVotes.has(chatId)) {
                    activeVotes.delete(chatId);
                    sock.sendMessage(chatId, { text: '⏳ *Tiempo agotado.* La votación no alcanzó los votos necesarios.' });
                }
            }, TIEMPO_VOTACION);

            activeVotes.set(chatId, {
                targetId: targetId,
                votes: new Set([senderId]),
                initiator: senderId,
                timer: timer
            });

            const text = `⚖️ *TRIBUNAL INICIADO* ⚖️\n\n` +
                         `Se propone expulsar a @${targetNumber}.${warningMsg}\n` +
                         `🎯 Meta: *${VOTOS_NECESARIOS} votos*.\n` +
                         `⏳ Tiempo: 5 minutos.\n\n` +
                         `Escribe *.si* o *.sivoto* para apoyar.`;

            await sock.sendMessage(chatId, { 
                text: text, 
                mentions: [targetId] 
            });
        }
    }
};