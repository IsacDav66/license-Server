// plugins/Dueño/alertadmin.js (Versión Corregida que SÍ silencia)

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// --- CONFIGURACIÓN ---
const OWNER_ID = '1658008416509@lid';
const BOT_JIDS = [];
if (process.env.BOT_JID_SWA) BOT_JIDS.push(process.env.BOT_JID_SWA);
if (process.env.BOT_JID_LID) BOT_JIDS.push(process.env.BOT_JID_LID);

const STRIKES_DB_PATH = path.join(__dirname, '..', '..', 'db', 'admin_strikes.json');
const SILENCE_DB_PATH = path.join(__dirname, '..', '..', 'db', 'silenced_users.json');

let adminStrikes = {};

function loadStrikesData() {
    try {
        const dbDir = path.dirname(STRIKES_DB_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        if (fs.existsSync(STRIKES_DB_PATH)) {
            adminStrikes = JSON.parse(fs.readFileSync(STRIKES_DB_PATH, 'utf8'));
        }
    } catch (e) { adminStrikes = {}; }
}

function saveStrikesData() {
    try {
        fs.writeFileSync(STRIKES_DB_PATH, JSON.stringify(adminStrikes, null, 2));
    } catch (e) { console.error("[Alert Admin] Error guardando DB de faltas:", e); }
}

loadStrikesData();

module.exports = {
    name: 'Alerta de Administrador',
    aliases: ['alertadmin', 'adminstrike', 'pardonstrike', 'checkstrikes'],
    description: 'Añade o gestiona faltas a un administrador.',
    category: 'Dueño',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383055,
        price: "10.00",
        icon: "fa-triangle-exclamation",
        preview: {
            suggestions: ["!alertadmin @Admin", "!checkstrikes @Admin"],
            responses: {
                "!alertadmin @Admin": "🚨 *¡Falta de Administrador!* 🚨\n\nEl admin @Admin ha recibido una falta.\n\nFaltas acumuladas: *1/2*\n\n*Consecuencia:* Silenciado por 24 horas. 🔇",
                "!checkstrikes @Admin": "*Estado de Faltas de @Admin*\n\n- Faltas: 1"
            }
        }
    },

    async execute(sock, msg, args, commandName) {
        if (msg.author !== OWNER_ID) {
            return msg.reply('❌ Comando exclusivo para el propietario del bot.');
        }

        const mentionedId = msg.mentionedJidList[0];
        const groupId = msg.from;

        if (['alertadmin', 'adminstrike'].includes(commandName)) {
            if (!mentionedId) return msg.reply('⚠️ Debes mencionar al admin para aplicarle una falta.');
            if (mentionedId === OWNER_ID) return msg.reply('No puedes aplicarte una falta a ti mismo.');

            const adminData = adminStrikes[mentionedId] || { strikes: 0 };
            adminData.strikes += 1;
            adminData.last_strike_timestamp = Date.now();
            adminStrikes[mentionedId] = adminData;
            
            let announcement = `🚨 *¡Falta de Administrador!* 🚨\n\nEl admin @${mentionedId.split('@')[0]} ha recibido una falta.\n\nFaltas acumuladas: *${adminData.strikes}/2*`;
            
            if (adminData.strikes === 1) {
                // --- ¡LÓGICA DE SILENCIAMIENTO RESTAURADA Y CRUCIAL! ---
                const durationMs = 24 * 60 * 60 * 1000;
                try {
                    let silenceData = { users: {}, modes: {} };
                    if (fs.existsSync(SILENCE_DB_PATH)) {
                        silenceData = JSON.parse(fs.readFileSync(SILENCE_DB_PATH, 'utf8'));
                    }
                    if (!silenceData.users) silenceData.users = {};
                    if (!silenceData.users[groupId]) silenceData.users[groupId] = {};
                    silenceData.users[groupId][mentionedId] = Date.now() + durationMs;
                    fs.writeFileSync(SILENCE_DB_PATH, JSON.stringify(silenceData, null, 2));
                    announcement += `\n\n*Consecuencia:* Silenciado por 24 horas. 🔇`;
                } catch (e) { console.error("[Alert Admin] Error al modificar DB de silencios:", e); }
                // --- FIN DE LA LÓGICA RESTAURADA ---
            } else if (adminData.strikes >= 2) {
                try {
                    const groupMetadata = (await msg.getChat()).groupMetadata;
                    const botParticipant = groupMetadata.participants.find(p => BOT_JIDS.includes(p.id) || (p.lid && BOT_JIDS.includes(p.lid)));
                    if (botParticipant?.admin) {
                        await sock.groupParticipantsUpdate(groupId, [mentionedId], 'demote');
                        announcement += `\n\n*Consecuencia Final:* Se le ha quitado el admin. ⛔`;
                    } else {
                        announcement += `\n\n*Error en Castigo:* No pude quitarle el admin (¿soy admin?).`;
                    }
                } catch (e) { announcement += `\n\n*Error en Castigo:* No pude quitarle el admin.`; }
            }
            saveStrikesData();
            return sock.sendMessage(groupId, { text: announcement, mentions: [mentionedId] });
        }
        
        if (commandName === 'pardonstrike') {
            if (!mentionedId) return msg.reply('⚠️ Debes mencionar al admin para perdonar sus faltas.');
            if (!adminStrikes[mentionedId] || adminStrikes[mentionedId].strikes === 0) {
                return msg.reply(`El usuario @${mentionedId.split('@')[0]} no tiene faltas.`, { mentions: [mentionedId] });
            }
            delete adminStrikes[mentionedId];
            saveStrikesData();
            return msg.reply(`✅ Todas las faltas de @${mentionedId.split('@')[0]} han sido perdonadas.`, { mentions: [mentionedId] });
        }

        if (commandName === 'checkstrikes') {
            if (!mentionedId) return msg.reply('⚠️ Debes mencionar a un admin para ver sus faltas.');
            const adminData = adminStrikes[mentionedId] || { strikes: 0 };
            const statusText = `*Estado de Faltas de @${mentionedId.split('@')[0]}*\n\n- Faltas: ${adminData.strikes}`;
            return sock.sendMessage(msg.from, { text: statusText, mentions: [mentionedId] });
        }
    }
};