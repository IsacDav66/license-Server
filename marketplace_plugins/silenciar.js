// plugins/Dueño/silenciar.js (Con Modo "Todos Silencio")

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const OWNER_ID = '1658008416509@lid';
const BOT_JIDS = [];
if (process.env.BOT_JID_SWA) BOT_JIDS.push(process.env.BOT_JID_SWA);
if (process.env.BOT_JID_LID) BOT_JIDS.push(process.env.BOT_JID_LID);

const SILENCE_DB_PATH = path.join(__dirname, '..', '..', 'db', 'silenced_users.json');
let silenceData = {}; // Ahora guarda tanto los usuarios como el estado del modo

function loadSilenceData() {
    try {
        const dbDir = path.dirname(SILENCE_DB_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        if (fs.existsSync(SILENCE_DB_PATH)) {
            silenceData = JSON.parse(fs.readFileSync(SILENCE_DB_PATH, 'utf8'));
            // Asegurarse de que las propiedades principales existan
            if (!silenceData.users) silenceData.users = {};
            if (!silenceData.modes) silenceData.modes = {};
            console.log('[Silenciar] Base de datos de silencios cargada.');
        } else {
            console.log('[Silenciar] No se encontró DB, se creará una nueva.');
            silenceData = { users: {}, modes: {} };
        }
    } catch (error) {
        console.error('[Silenciar] Error al cargar la DB de silencios:', error);
        silenceData = { users: {}, modes: {} };
    }
}

function saveSilenceData() {
    try {
        fs.writeFileSync(SILENCE_DB_PATH, JSON.stringify(silenceData, null, 2));
    } catch (error) { console.error('[Silenciar] Error al guardar la DB de silencios:', error); }
}

module.exports = {
    name: 'Silenciar Usuarios',
    aliases: ['silenciar', 'callar', 'mute', 'quitarsilencio', 'unmute', 'todossilencio'],
    description: 'Silencia a un usuario o activa el modo donde todos pueden silenciar.',
    category: 'Moderación',
    groupOnly: true,
    marketplace: {
        requirements: ["Bot Administrador"],
        tebex_id: 7383060,
        price: "10.00",
        icon: "fa-microphone-slash",
        preview: {
            suggestions: ["!mute @Usuario 10", "!todossilencio on"],
            responses: {
                "!mute @Usuario 10": "🔇 El usuario @Usuario ha sido silenciado por 10 minutos.",
                "!todossilencio on": "🔥 *¡Modo \"Todos Silencio\" ACTIVADO!* 🔥\n\nCualquier miembro ahora puede usar .silenciar y .quitarsilencio."
            }
        }
    },

    onLoad: async (sock) => {
        loadSilenceData();
    },

    checkMessage: async (sock, msg) => {
        const chat = await msg.getChat();
        if (!chat.isGroup || !msg.author) return false;

        const groupJid = chat.id._serialized;
        const authorJid = msg.author;
        
        const silencedGroup = silenceData.users[groupJid];
        if (!silencedGroup || !silencedGroup[authorJid]) return false;

        const userExpiration = silencedGroup[authorJid];

        if (Date.now() >= userExpiration) {
            delete silenceData.users[groupJid][authorJid];
            if (Object.keys(silenceData.users[groupJid]).length === 0) delete silenceData.users[groupJid];
            saveSilenceData();
            console.log(`[Silenciar] El silencio de ${authorJid.split('@')[0]} ha expirado.`);
            return false;
        }

        try {
            await sock.sendMessage(groupJid, { delete: msg._baileysMessage.key });
            return true;
        } catch (error) {
            console.error('[Silenciar] No se pudo eliminar el mensaje:', error);
            return false;
        }
    },

    async execute(sock, msg, args, commandName) {
        const chat = await msg.getChat();
        const groupMetadata = chat.groupMetadata;
        const senderId = msg.author;
        const groupJid = chat.id._serialized;

        // --- MANEJO DEL COMANDO .todossilencio ---
        if (commandName === 'todossilencio') {
            if (senderId !== OWNER_ID) {
                return msg.reply('❌ Este comando es exclusivo para el propietario del bot.');
            }
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                silenceData.modes[groupJid] = true;
                saveSilenceData();
                return msg.reply('🔥 *¡Modo "Todos Silencio" ACTIVADO!* 🔥\n\nCualquier miembro ahora puede usar `.silenciar` y `.quitarsilencio`.');
            }
            if (mode === 'off') {
                silenceData.modes[groupJid] = false;
                // Reset: Se quita el silencio a todos en este grupo
                if (silenceData.users[groupJid]) {
                    delete silenceData.users[groupJid];
                }
                saveSilenceData();
                return msg.reply('✅ *Modo "Todos Silencio" DESACTIVADO.*\n\nSe ha restaurado la paz y se ha quitado el silencio a todos.');
            }
            return msg.reply('Uso: `.todossilencio on` o `.todossilencio off`');
        }

        // --- LÓGICA DE PERMISOS PARA .silenciar y .quitarsilencio ---
        const isTodosSilencioMode = silenceData.modes[groupJid] === true;

        if (!isTodosSilencioMode && senderId !== OWNER_ID) {
            return msg.reply('❌ Este comando solo puede ser utilizado por el propietario del bot.');
        }

        // Verificar que el bot sea admin (necesario para eliminar mensajes)
        const botParticipant = groupMetadata.participants.find(p => BOT_JIDS.includes(p.id) || (p.lid && BOT_JIDS.includes(p.lid)));
        if (!botParticipant || !botParticipant.admin) {
            return msg.reply('❌ Para que este comando funcione, necesito ser administrador del grupo.');
        }
        
        // El resto del comando
        if (msg.mentionedJidList.length === 0) {
            return msg.reply(`⚠️ Por favor, menciona al usuario.\n\n*Ejemplo:*\n*.silenciar @usuario 10*`);
        }
        
        const targetId = msg.mentionedJidList[0];
        
        // Protecciones
        if (targetId === OWNER_ID) return msg.reply('❌ No puedes silenciar al propietario del bot.');
        if (BOT_JIDS.includes(targetId)) return msg.reply('❌ No puedes silenciarme a mí.');

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetId || p.lid === targetId);
        if (!targetParticipant) return msg.reply('❌ El usuario mencionado no se encuentra en este grupo.');
        
        if (['silenciar', 'callar', 'mute'].includes(commandName)) {
            let durationInMinutes = parseInt(args[1], 10);
            if (isNaN(durationInMinutes) || durationInMinutes <= 0) {
                return msg.reply('❌ Debes especificar una duración válida en minutos. *.silenciar @usuario 10*');
            }
            // Limitar la duración máxima si no es el dueño quien lo usa
            if (senderId !== OWNER_ID && durationInMinutes > 60) {
                durationInMinutes = 60; // Máximo 1 hora para usuarios normales
                await msg.reply('⚠️ El tiempo máximo de silencio para no-propietarios es de 60 minutos.');
            }

            const expiration = Date.now() + durationInMinutes * 60 * 1000;
            if (!silenceData.users[groupJid]) silenceData.users[groupJid] = {};
            silenceData.users[groupJid][targetId] = expiration;
            saveSilenceData();
            return msg.reply(`🔇 El usuario @${targetId.split('@')[0]} ha sido silenciado por ${durationInMinutes} minutos.`, { mentions: [targetId] });
        }
        
        if (['quitarsilencio', 'unmute'].includes(commandName)) {
            if (!silenceData.users[groupJid] || !silenceData.users[groupJid][targetId]) {
                return msg.reply(`⚠️ El usuario @${targetId.split('@')[0]} no estaba silenciado.`, { mentions: [targetId] });
            }
            delete silenceData.users[groupJid][targetId];
            if (Object.keys(silenceData.users[groupJid]).length === 0) delete silenceData.users[groupJid];
            saveSilenceData();
            return msg.reply(`🔊 Se ha quitado el silencio al usuario @${targetId.split('@')[0]}.`, { mentions: [targetId] });
        }
    }
};

