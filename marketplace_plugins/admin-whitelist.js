// plugins/admin-whitelist.js

const { jidNormalizedUser, jidDecode } = require('@whiskeysockets/baileys'); 
const { isUserAdminWhitelist } = require('../shared-admin-db');

// --- CONFIGURACIÓN ---
const PROTECTED_GROUP_JID = '120363241724220394@g.us';

// --- CACHÉ ANTI-SPAM GLOBAL ---
const whitelistCache = new Set();

// --- JIDs del Bot ---
const botAliasesRaw = (process.env.BOT_MENTION_ALIAS_NUMBERS || "").split(',').map(n => n.trim());
const potentialBotIds = []; 
if (process.env.BOT_JID_SWA) potentialBotIds.push(`${process.env.BOT_JID_SWA}@s.whatsapp.net`);
if (process.env.BOT_JID_LID) potentialBotIds.push(process.env.BOT_JID_LID);
for (const alias of botAliasesRaw) {
    if (alias.includes('@')) potentialBotIds.push(alias);
    else if (alias) potentialBotIds.push(`${alias}@s.whatsapp.net`);
}

module.exports = {
    name: 'Admin Whitelist Protector',
    description: 'Protege el grupo. (Versión Anti-Doble-Ejecución)',
    isListener: true,
    marketplace: {
        tebex_id: 7383023,
        price: "10.00",
        icon: "fa-user-shield",
        preview: {
            suggestions: ["!whitelist status"],
            responses: {
                "!whitelist status": "🛡️ *Whitelist Protector:* ACTIVO\n🔒 *Grupo:* Protegido\n✅ Monitorizando ascensos no autorizados para evitar filtraciones."
            }
        }
    },

    async initialize(sock) {
        console.log(`\x1b[36m[Admin Whitelist]\x1b[0m Listo en: ${PROTECTED_GROUP_JID}`);
        
        sock.ev.on('group-participants.update', async (update) => {
            const { id: chatId, participants, action } = update;

            if (chatId !== PROTECTED_GROUP_JID) return; 
            if (action !== 'promote') return;

            // 1. Filtrar usuarios y aplicar CANDADO inmediatamente
            const usersToCheck = [];

            for (const item of participants) {
                const userJid = typeof item === 'object' && item !== null ? item.id : item;
                if (!userJid || typeof userJid !== 'string') continue;

                // Normalizar al número para evitar duplicados LID/JID
                const userNumber = userJid.split(':')[0].split('@')[0];

                // --- CANDADO ---
                if (whitelistCache.has(userNumber)) {
                    // Si ya estamos revisando a este usuario, saltar
                    continue;
                }
                
                // Bloquear por 10 segundos
                whitelistCache.add(userNumber);
                setTimeout(() => whitelistCache.delete(userNumber), 10000);
                
                usersToCheck.push({ jid: userJid, number: userNumber });
            }

            if (usersToCheck.length === 0) return; // Nada nuevo que revisar

            // 2. Verificar Admin del Bot (Solo una vez)
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                const allBotIds = new Set([
                    ...(sock.user?.id ? [jidNormalizedUser(sock.user.id)] : []),
                    ...potentialBotIds.map(id => jidNormalizedUser(id))
                ]);
                const botParticipant = groupMetadata.participants.find(p => allBotIds.has(jidNormalizedUser(p.id)));
                
                if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                    return console.log(`[Admin Whitelist] ⚠️ El bot no es admin.`);
                }

                // 3. Verificar Whitelist
                for (const user of usersToCheck) {
                    // Resolver LID para DB
                    let userDbId = user.jid;
                    const metaParticipant = groupMetadata.participants.find(p => p.id === user.jid);
                    if (metaParticipant && metaParticipant.lid) userDbId = metaParticipant.lid;

                    console.log(`[Admin Whitelist] 🛡️ Verificando autorización para: ${user.number}`);
                    
                    const isAllowed = await isUserAdminWhitelist(userDbId); 

                    if (isAllowed) {
                        console.log(`[Admin Whitelist] ✅ ${user.number} es legítimo.`);
                        continue;
                    }

                    console.log(`[Admin Whitelist] 🚨 NO AUTORIZADO (${user.number}). Actuando...`);

                    // 4. Acción
                    await new Promise(r => setTimeout(r, 1000));
                    await sock.groupParticipantsUpdate(chatId, [user.jid], 'demote');
                    
                    await sock.sendMessage(chatId, {
                        text: `⚠️ Ascenso revertido (@${user.number}). No está en la whitelist.`,
                        mentions: [user.jid]
                    });
                }
            } catch (e) {
                console.error(`[Admin Whitelist Error]`, e.message);
            }
        });
    }
};