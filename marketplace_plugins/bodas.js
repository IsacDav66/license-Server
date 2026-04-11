// plugins/bodas.js (Baileys Version - Completo)


const brDB = {
    getAll: () => db.prepare('SELECT * FROM brainroots_characters ORDER BY rarity ASC').all(),
    getById: (id) => db.prepare('SELECT * FROM brainroots_characters WHERE id = ?').get(id),
    getByName: (n) => db.prepare('SELECT * FROM brainroots_characters WHERE LOWER(name) = LOWER(?)').get(n),
    addToUser: (u, c) => { const ts = Date.now(); db.prepare('INSERT INTO user_brainroots (user_id, character_id, catch_timestamp, last_income_timestamp) VALUES (?, ?, ?, ?)').run(u, c, ts, ts); },
    getUserColl: (u) => db.prepare('SELECT ub.id AS entry_id, bc.*, ub.catch_timestamp, ub.last_income_timestamp FROM user_brainroots ub JOIN brainroots_characters bc ON ub.character_id = bc.id WHERE ub.user_id = ?').all(u),
    updateIncome: (id, ts) => db.prepare('UPDATE user_brainroots SET last_income_timestamp = ? WHERE id = ?').run(ts, id),
    remove: (u, c) => { const row = db.prepare('SELECT id FROM user_brainroots WHERE user_id = ? AND character_id = ? LIMIT 1').get(u, c); if(row) db.prepare('DELETE FROM user_brainroots WHERE id = ?').run(row.id); return !!row; },
    getRandom: (u) => db.prepare('SELECT ub.id as entry_id, bc.* FROM user_brainroots ub JOIN brainroots_characters bc ON ub.character_id = bc.id WHERE ub.user_id = ? ORDER BY RANDOM() LIMIT 1').get(u),
    addMarket: (s, c, p) => db.prepare('INSERT INTO brainroots_market (seller_id, character_id, price, listing_timestamp) VALUES (?, ?, ?, ?)').run(s, c, p, Date.now()).lastInsertRowid,
    removeMarket: (id, s) => s ? db.prepare('DELETE FROM brainroots_market WHERE id = ? AND seller_id = ? RETURNING *').get(id, s) : db.prepare('DELETE FROM brainroots_market WHERE id = ? RETURNING *').get(id),
    getListings: () => db.prepare('SELECT bm.id as listing_id, bc.name, bc.rarity, bm.price as listing_price, bm.seller_id FROM brainroots_market bm JOIN brainroots_characters bc ON bm.character_id = bc.id').all(),
    getListingById: (id) => db.prepare('SELECT * FROM brainroots_market WHERE id = ?').get(id)
};

const fs = require('fs').promises; // Usar promesas para fs
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const { getUserData } = require('../../lib/bot-core'); // Para obtener pushnames
const { jidDecode } = require('@whiskeysockets/baileys');

const BODAS_JSON_PATH = path.join(__dirname, '..', 'bodas.json'); // Ajusta si es necesario
const PROPOSAL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
const activeProposals = new Map(); // { chatId: Map<proposedId, {proposerId, timestamp}> }

// --- Funciones de Utilidad para bodas.json ---
async function loadBodasData() {
    try {
        await fs.access(BODAS_JSON_PATH);
        const data = await fs.readFile(BODAS_JSON_PATH, 'utf-8');
        const marriages = JSON.parse(data);
        return (typeof marriages === 'object' && marriages !== null) ? marriages : {};
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("[Bodas Plugin Baileys] bodas.json no encontrado, se creará uno vacío.");
            return {};
        }
        console.error("[Bodas Plugin Baileys] Error cargando bodas.json:", error);
        return {};
    }
}

async function saveBodasData(data) {
    try {
        await fs.writeFile(BODAS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error("[Bodas Plugin Baileys] Error guardando bodas.json:", error);
    }
}

function cleanupExpiredProposals(chatId) {
    if (!activeProposals.has(chatId)) return;
    const chatProposals = activeProposals.get(chatId);
    const now = Date.now();
    let changed = false;
    for (const [proposedId, proposalData] of chatProposals.entries()) {
        if (now - proposalData.timestamp > PROPOSAL_TIMEOUT_MS) {
            chatProposals.delete(proposedId);
            console.log(`[Bodas Plugin Baileys] Propuesta expirada y eliminada en chat ${chatId} de ${proposalData.proposerId} para ${proposedId}`);
            changed = true;
        }
    }
    if (changed && chatProposals.size === 0) {
        activeProposals.delete(chatId);
    }
}

// --- Funciones Auxiliares para Imagen de Ship ---
async function drawCircularImage(ctx, image, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
}

function drawPixelHeart(ctx, centerX, centerY, pixelSize, color) {
    const heartShape = [ /* ... (definición del corazón pixelado como en tu ejemplo) ... */
        [0, 1, 1, 0, 0, 0, 1, 1, 0], [1, 1, 1, 1, 0, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0]
    ];
    const heartWidth = heartShape[0].length * pixelSize;
    const heartHeight = heartShape.length * pixelSize;
    const startX = centerX - heartWidth / 2;
    const startY = centerY - heartHeight / 2;
    ctx.fillStyle = color;
    for (let r = 0; r < heartShape.length; r++) {
        for (let c = 0; c < heartShape[r].length; c++) {
            if (heartShape[r][c] === 1) {
                ctx.fillRect(startX + c * pixelSize, startY + r * pixelSize, pixelSize, pixelSize);
            }
        }
    }
}

async function loadProfilePicOrDefault(sock, userId, defaultSize = 150) {
    let pfpUrl;
    try {
        // En Baileys, getProfilePicture es la forma de obtener la URL de la foto de perfil
        pfpUrl = await sock.profilePictureUrl(userId, 'image');
    } catch (e) {
        console.warn(`[Bodas Plugin Baileys Ship] No se pudo obtener URL de PFP para ${userId}: ${e.message}`);
    }

    if (pfpUrl) {
        try {
            const response = await axios.get(pfpUrl, { responseType: 'arraybuffer' });
            return await loadImage(Buffer.from(response.data));
        } catch (error) {
            console.warn(`[Bodas Plugin Baileys Ship] No se pudo cargar imagen desde ${pfpUrl} para ${userId}: ${error.message}. Usando placeholder.`);
        }
    }
    
    // Crear un placeholder si no hay URL o falla la descarga
    const canvas = createCanvas(defaultSize, defaultSize);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(0, 0, defaultSize, defaultSize);
    ctx.fillStyle = '#606060';
    const r = defaultSize / 3;
    const centerX = defaultSize / 2;
    const centerY = defaultSize / 2.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - r / 2, r / 1.5, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + r, r, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    return await loadImage(canvas.toBuffer('image/png'));
}

// Función para obtener el nombre de un usuario (pushname o número)
async function getUserDisplayName(sock, userId, msgForContext = null) {
    if (msgForContext && msgForContext.author === userId) {
        const contact = await msgForContext.getContact();
        return contact.pushname || jidDecode(userId)?.user || userId.split('@')[0];
    }
    try {
        const userData = await getUserData(userId);
        if (userData && userData.pushname) {
            return userData.pushname;
        }
    } catch (e) { /* ignorar */ }
    // Como último recurso, decodificar JID. Obtener info de perfil en tiempo real puede ser costoso.
    return jidDecode(userId)?.user || userId.split('@')[0];
}

module.exports = {
    name: 'Sistema de Parejas, Buscador y Shipeos',
    aliases: [
        'pareja', 'proponer', 'bodas', 'aceptar', 'rechazar', 'parejas', 'divorcio', 'cancelarpropuesta',
        'buscarpareja', 'buscamepareja',
        'ship', 'shippear'
    ],
    description: 'Gestiona propuestas, matrimonios, busca parejas y shippea.\nComandos: .pareja @u, .aceptar, .rechazar, .cancelarpropuesta, .parejas, .divorcio, .buscarpareja, .buscamepareja, .ship @u1 @u2',
    category: 'Social',
    groupOnly: true,
    marketplace: {
        tebex_id: 7383020,
        price: "8.00",
        icon: "fa-ring",
        preview: {
            suggestions: ["!ship @Persona1 @Persona2", "!parejas", "!proponer @Alguien"],
            responses: {
                "!ship @Persona1 @Persona2": {
                    text: "🚢 ¡Ship a la vista! @Persona1 y @Persona2 tienen un *80%* de compatibilidad. ¿Qué opinan? 🥰",
                    // URL de una imagen de ejemplo de cómo se ve el ship real
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775760430209.webp" 
                },
                "!parejas": "📜 *Lista de Parejas Actuales* 📜\n\n❤️ @StunBot y @Sofia\n❤️ @StunDoc y @Bot_Pro\n❤️ @User99 y @Invitada",
                "!proponer @Alguien": "💘 *¡Propuesta de Pareja!* 💘\n\n¡Oh là là! Parece que @Usuario quiere formalizar las cosas con @Alguien... 👀\n\n@Alguien, tienes 15 minutos para responder:\n✅ .aceptar | ❌ .rechazar"
            }
        }
    },


    async execute(sock, msg, args, commandName) {
        const chatId = msg.from; // JID del grupo
        const senderId =msg.senderLid || msg.author; // JID del que ejecuta el comando
        const senderName = await getUserDisplayName(sock, senderId, msg);
        
        let marriages = await loadBodasData();
        cleanupExpiredProposals(chatId);

        const baileysOriginalMsg = msg._baileysMessage;
        const mentionedJids = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // --- Comando: .pareja @usuario (Proponer Matrimonio) ---
        // O .proponer @usuario o .bodas @usuario
        if (commandName === 'pareja' || commandName === 'proponer' || commandName === 'bodas') {
            if (args.length > 0 && args[0].toLowerCase() === 'lista') { // Subcomando para ver lista (alias de .parejas)
                 commandName = 'parejas'; // Redirigir a la lógica de .parejas
            } else {
                if (mentionedJids.length === 0) {
                    // Si no hay menciones, y el comando es .pareja o .mipareja (sin mención), mostrar la pareja actual
                    if (commandName === 'pareja' || commandName === 'bodas') {
                         commandName = 'mipareja'; // Actuar como .mipareja
                    } else { // .proponer requiere mención
                        return msg.reply(`Debes mencionar a alguien para proponerle. Ejemplo: \`.proponer @usuario\``);
                    }
                } else { // Lógica de propuesta
                    const proposedId = mentionedJids[0];
                    const proposedName = await getUserDisplayName(sock, proposedId);

                    if (proposedId === senderId) {
                        return msg.reply(`🤦 @${senderName}, no puedes proponerte matrimonio a ti mismo/a.`, { mentions: [senderId] });
                    }
                    if (marriages[senderId]) {
                        const currentPartnerId = marriages[senderId];
                        if (currentPartnerId === proposedId) {
                            const currentPartnerName = await getUserDisplayName(sock, currentPartnerId);
                            return msg.reply(`💖 ¡Pero si @${proposedName} ya es tu pareja! Disfruten su amor. 🥰`, { mentions: [senderId, proposedId] });
                        }
                        const currentPartnerName = await getUserDisplayName(sock, currentPartnerId);
                        return msg.reply(`💔 Ya tienes una pareja: @${currentPartnerName}. ¡Si quieres proponer a @${proposedName}, primero el \`.divorcio\`!`, { mentions: [senderId, currentPartnerId, proposedId] });
                    }
                    if (marriages[proposedId]) {
                        const targetCurrentPartnerId = marriages[proposedId];
                        const targetCurrentPartnerName = await getUserDisplayName(sock, targetCurrentPartnerId);
                        return msg.reply(`😥 Lo siento @${senderName}, pero @${proposedName} ya está casado/a con @${targetCurrentPartnerName}.`, { mentions: [senderId, proposedId, targetCurrentPartnerId] });
                    }

                    if (activeProposals.has(chatId)) {
                        const chatProposals = activeProposals.get(chatId);
                        if (Array.from(chatProposals.values()).some(p => p.proposerId === senderId)) {
                            return msg.reply(`Ya tienes una propuesta pendiente en este chat. Cancela con \`.cancelarpropuesta\` o espera.`);
                        }
                        if (chatProposals.has(proposedId)) {
                            const existingProposal = chatProposals.get(proposedId);
                            const existingProposerName = await getUserDisplayName(sock, existingProposal.proposerId);
                            return msg.reply(`@${proposedName} ya tiene una propuesta pendiente de @${existingProposerName}.`, { mentions: [proposedId, existingProposal.proposerId] });
                        }
                    }

                    if (!activeProposals.has(chatId)) activeProposals.set(chatId, new Map());
                    activeProposals.get(chatId).set(proposedId, { proposerId: senderId, timestamp: Date.now() });
                    console.log(`[Bodas Plugin Baileys] Nueva propuesta en ${chatId}: ${senderName} -> ${proposedName}`);

                    const proposalMsg = `💘 *¡Propuesta de Pareja!* 💘\n\n` +
                                      `¡Oh là là! Parece que @${senderName} quiere formalizar las cosas con @${proposedName}... 👀\n\n` +
                                      `@${proposedName}, tienes 15 minutos para responder en este chat:\n` +
                                      `✅ Escribe \`.aceptar\`\n` +
                                      `❌ Escribe \`.rechazar\``;
                    await sock.sendMessage(chatId, { text: proposalMsg, mentions: [senderId, proposedId] }, { quoted: msg._baileysMessage });
                    return;
                }
            }
        }

        // --- Comando: .aceptar ---
        if (commandName === 'aceptar') {
            if (!activeProposals.has(chatId) || !activeProposals.get(chatId).has(senderId)) { // senderId es el que acepta
                return msg.reply(`🤔 No tienes propuestas pendientes para aceptar en este chat.`);
            }
            const proposal = activeProposals.get(chatId).get(senderId);
            const proposerId = proposal.proposerId;
            const proposerName = await getUserDisplayName(sock, proposerId);
            const acceptorName = senderName; // El que ejecuta .aceptar

            marriages = await loadBodasData(); // Recargar por si acaso
            if (marriages[senderId]) return msg.reply(`💍 Ya tienes pareja.`);
            if (marriages[proposerId]) return msg.reply(`💔 @${proposerName} ya está en una relación.`, { mentions: [proposerId] });

            marriages[senderId] = proposerId;
            marriages[proposerId] = senderId;
            await saveBodasData(marriages);

            activeProposals.get(chatId).delete(senderId);
            if (activeProposals.get(chatId).size === 0) activeProposals.delete(chatId);

            const acceptMsg = `🎉 *¡Felicidades!* 🎉\n\n¡@${acceptorName} aceptó la propuesta de @${proposerName}!\n¡Ahora son pareja! 🥳💖`;
            await sock.sendMessage(chatId, { text: acceptMsg, mentions: [senderId, proposerId] }, { quoted: msg._baileysMessage });
            console.log(`[Bodas Plugin Baileys] Matrimonio aceptado: ${senderId} y ${proposerId}`);
            return;
        }

        // --- Comando: .rechazar ---
        if (commandName === 'rechazar') {
            if (!activeProposals.has(chatId) || !activeProposals.get(chatId).has(senderId)) {
                return msg.reply(`🤔 No tienes propuestas que rechazar en este chat.`);
            }
            const proposal = activeProposals.get(chatId).get(senderId);
            const proposerId = proposal.proposerId;
            const proposerName = await getUserDisplayName(sock, proposerId);
            const rejectorName = senderName;

            activeProposals.get(chatId).delete(senderId);
            if (activeProposals.get(chatId).size === 0) activeProposals.delete(chatId);

            const rejectMsg = `😥 Oh... @${rejectorName} rechazó la propuesta de @${proposerName}.`;
            await sock.sendMessage(chatId, { text: rejectMsg, mentions: [senderId, proposerId] }, { quoted: msg._baileysMessage });
            console.log(`[Bodas Plugin Baileys] Propuesta rechazada por ${senderId} a ${proposerId}`);
            return;
        }

        // --- Comando: .cancelarpropuesta ---
        if (commandName === 'cancelarpropuesta') {
            let proposalCancelled = false;
            if (activeProposals.has(chatId)) {
                const chatProposals = activeProposals.get(chatId);
                for (const [proposedId, proposalData] of chatProposals.entries()) {
                    if (proposalData.proposerId === senderId) { // senderId es el que propuso
                        const proposedName = await getUserDisplayName(sock, proposedId);
                        chatProposals.delete(proposedId);
                        if (chatProposals.size === 0) activeProposals.delete(chatId);
                        proposalCancelled = true;
                        const cancelMsg = `❌ @${senderName} ha cancelado su propuesta a @${proposedName}.`;
                        await sock.sendMessage(chatId, { text: cancelMsg, mentions: [senderId, proposedId] }, { quoted: msg._baileysMessage });
                        console.log(`[Bodas Plugin Baileys] Propuesta cancelada por ${senderId} a ${proposedId}`);
                        break;
                    }
                }
            }
            if (!proposalCancelled) await msg.reply(`🤷 No tienes propuestas activas para cancelar en este chat.`);
            return;
        }
        
        // --- Comando: .parejas o .pareja lista ---
        if (commandName === 'parejas') {
            marriages = await loadBodasData();
            const marriageKeys = Object.keys(marriages);
            if (marriageKeys.length === 0) return msg.reply("💔 Aún no hay parejas formadas en el bot.");

            let replyMsg = "📜 *Lista de Parejas Actuales* 📜\n\n";
            const processed = new Set();
            let coupleCount = 0;
            const mentionsArray = [];

            for (const p1_id of marriageKeys) {
                if (processed.has(p1_id)) continue;
                const p2_id = marriages[p1_id];
                // Validar que la relación sea mutua
                if (!p2_id || marriages[p2_id] !== p1_id) {
                    console.warn(`[Bodas Plugin Baileys Lista] Inconsistencia para ${p1_id}. Pareja ${p2_id} no corresponde o falta. Limpiando.`);
                    delete marriages[p1_id];
                    if (p2_id) delete marriages[p2_id]; // También limpiar la entrada del supuesto partner
                    continue; // Saltar esta entrada inconsistente
                }
                processed.add(p1_id);
                processed.add(p2_id);
                
                const p1_name = await getUserDisplayName(sock, p1_id);
                const p2_name = await getUserDisplayName(sock, p2_id);
                
                replyMsg += `❤️ @${p1_name} y @${p2_name}\n`;
                mentionsArray.push(p1_id, p2_id);
                coupleCount++;
            }
            // Si hubo limpieza por inconsistencias, guardar los datos corregidos
            if (Object.keys(marriages).length !== marriageKeys.length) {
                await saveBodasData(marriages);
            }
            if (coupleCount === 0) replyMsg = "💔 No hay parejas formadas válidamente en este momento.";
            
            await sock.sendMessage(chatId, { text: replyMsg.trim(), mentions: mentionsArray }, { quoted: msg._baileysMessage });
            return;
        }

        // --- Comando: .divorcio ---
        if (commandName === 'divorcio') {
            marriages = await loadBodasData();
            const partnerId = marriages[senderId];
            if (!partnerId) {
                return msg.reply(`🤷 @${senderName}, no tienes pareja actualmente para divorciarte.`, { mentions: [senderId] });
            }
            const partnerName = await getUserDisplayName(sock, partnerId);

            delete marriages[senderId];
            delete marriages[partnerId];
            await saveBodasData(marriages);

            const divorceMsg = `💔 *¡Relación Terminada!* 💔\n\n@${senderName} y @${partnerName} ya no son pareja.`;
            await sock.sendMessage(chatId, { text: divorceMsg, mentions: [senderId, partnerId] }, { quoted: msg._baileysMessage });
            console.log(`[Bodas Plugin Baileys] Divorcio: ${senderId} y ${partnerId}`);
            return;
        }

        // --- Comando: .mipareja (o .pareja sin mención) ---
        if (commandName === 'mipareja' || (commandName === 'pareja' && mentionedJids.length === 0)) {
            let userToCheckId = senderId;
            let userToCheckName = senderName;

            marriages = await loadBodasData();
            const partnerId = marriages[userToCheckId];
            if (partnerId) {
                const partnerName = await getUserDisplayName(sock, partnerId);
                await msg.reply(`💑 @${userToCheckName}, tu pareja actual es @${partnerName}. ¡Hacen linda pareja!`, { mentions: [userToCheckId, partnerId] });
            } else {
                await msg.reply(`💔 @${userToCheckName}, parece que estás soltero/a por ahora. ¡El amor está en el aire!`, { mentions: [userToCheckId] });
            }
            return;
        }
        
        // --- Comando: .buscarpareja ---
        if (commandName === 'buscarpareja') {
            const chatMetadata = await msg.getChat(); // Obtiene metadatos del grupo
            const participants = chatMetadata.groupMetadata?.participants || [];
            if (participants.length < 2) {
                return msg.reply("Cupido necesita al menos 2 personas en el grupo para trabajar su magia. 🏹");
            }

            const eligibleParticipantsJids = participants.map(p => p.id).filter(id => id !== sock.user.id); // Excluir al bot

            if (eligibleParticipantsJids.length < 2) {
                return msg.reply("No hay suficientes personas elegibles en el grupo para formar una pareja. 😕");
            }

            let index1 = Math.floor(Math.random() * eligibleParticipantsJids.length);
            let person1Id = eligibleParticipantsJids[index1];
            let index2;
            do {
                index2 = Math.floor(Math.random() * eligibleParticipantsJids.length);
            } while (index1 === index2);
            let person2Id = eligibleParticipantsJids[index2];

            const person1Name = await getUserDisplayName(sock, person1Id);
            const person2Name = await getUserDisplayName(sock, person2Id);

            const phrases = [ /* ... (tus frases para buscarpareja) ... */
                 `💘 ¡Cupido ha hablado! @${person1Name} y @${person2Name}, ¿qué tal si lo intentan? 😉`,
                 `✨ Las estrellas se alinean para @${person1Name} y @${person2Name}. ¡Podría ser el inicio de algo! ✨`
            ];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            await sock.sendMessage(chatId, { text: randomPhrase, mentions: [person1Id, person2Id] }, { quoted: msg._baileysMessage });
            return;
        }

        // --- Comando: .buscamepareja ---
        if (commandName === 'buscamepareja') {
            marriages = await loadBodasData();
            const currentPartnerId = marriages[senderId];
            if (currentPartnerId) {
                const currentPartnerName = await getUserDisplayName(sock, currentPartnerId);
                return msg.reply(`💔 @${senderName}, ¡pero si ya tienes pareja con @${currentPartnerName}! Si quieres buscar de nuevo, primero \`.divorcio\`. 😉`, { mentions: [senderId, currentPartnerId] });
            }

            const chatMetadata = await msg.getChat();
            const participants = chatMetadata.groupMetadata?.participants || [];
            if (participants.length < 2) {
                return msg.reply("Cupido necesita más opciones en el grupo para encontrarte pareja. 🏹");
            }
            
            const eligibleTargetsJids = participants.map(p => p.id).filter(id => id !== sock.user.id && id !== senderId);

            if (eligibleTargetsJids.length < 1) {
                return msg.reply("😥 Parece que no hay nadie más disponible en el grupo para ti en este momento...");
            }

            const targetIndex = Math.floor(Math.random() * eligibleTargetsJids.length);
            const targetPersonId = eligibleTargetsJids[targetIndex];
            const targetPersonName = await getUserDisplayName(sock, targetPersonId);

            const phrases = [ /* ... (tus frases para buscamepareja) ... */
                `💘 ¡Atención @${senderName}! Cupido cree que @${targetPersonName} podría ser tu media naranja. 🍊`,
                `✨ @${senderName}, las estrellas dicen que deberías conocer mejor a @${targetPersonName}. ✨`
            ];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            await sock.sendMessage(chatId, { text: randomPhrase, mentions: [senderId, targetPersonId] }, { quoted: msg._baileysMessage });
            return;
        }

        // --- Comando: .ship @usuario1 @usuario2 ---
        if (commandName === 'ship' || commandName === 'shippear') {
            if (mentionedJids.length < 2) {
                return msg.reply("🚢 Para shippear necesitas mencionar a DOS personas. Ejemplo: `.ship @persona1 @persona2`");
            }

            const person1Id = mentionedJids[0];
            const person2Id = mentionedJids[1];
            const person1Name = await getUserDisplayName(sock, person1Id);
            const person2Name = await getUserDisplayName(sock, person2Id);

            if (person1Id === person2Id) return msg.reply(`🤔 @${senderName}, shippear a @${person1Name} consigo mismo/a es... original.`, { mentions: [senderId, person1Id] });
            // if (person1Id === sock.user.id || person2Id === sock.user.id) return msg.reply(`Aww, gracias @${senderName}, pero soy el motor de los ships, no el pasajero. 💘`, { mentions: [senderId] });


            const CANVAS_WIDTH = 700; const CANVAS_HEIGHT = 350; const PFP_RADIUS = 75;
            const PFP_Y_POS = CANVAS_HEIGHT / 2; const PFP1_X_POS = CANVAS_WIDTH * 0.22;
            const PFP2_X_POS = CANVAS_WIDTH * 0.78; const HEART_PIXEL_SIZE = 15;
            const HEART_COLOR = '#FF4136'; const TEXT_COLOR = '#FFFFFF';

            const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            gradient.addColorStop(0, '#4A001F'); gradient.addColorStop(1, '#2A003D');
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            const img1 = await loadProfilePicOrDefault(sock, person1Id, PFP_RADIUS * 2);
            const img2 = await loadProfilePicOrDefault(sock, person2Id, PFP_RADIUS * 2);

            await drawCircularImage(ctx, img1, PFP1_X_POS, PFP_Y_POS, PFP_RADIUS);
            await drawCircularImage(ctx, img2, PFP2_X_POS, PFP_Y_POS, PFP_RADIUS);

            drawPixelHeart(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, HEART_PIXEL_SIZE, HEART_COLOR);

            const compatibility = Math.floor(Math.random() * 71) + 30; // 30% a 100%
            const percentageText = `${compatibility}%`;
            
            // Registrar fuente (opcional, si tienes el archivo .ttf)
            // try {
            //     registerFont(path.join(__dirname, '..', 'fonts', 'PixelEmulator.ttf'), { family: 'PixelFont' }); // Ajusta ruta de fuente
            //     ctx.font = `bold ${HEART_PIXEL_SIZE * 2.5}px PixelFont`;
            // } catch (fontError) {
            //     console.warn("[Bodas Plugin Ship] Fuente Pixel no encontrada, usando default. Error:", fontError.message);
            //     ctx.font = `bold ${HEART_PIXEL_SIZE * 2.8}px Sans-Serif`;
            // }
             ctx.font = `bold ${HEART_PIXEL_SIZE * 2.8}px Sans-Serif`;


            ctx.fillStyle = TEXT_COLOR; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(percentageText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

            marriages = await loadBodasData(); // Recargar por si acaso
            let shipTextMessage;
            if (marriages[person1Id] === person2Id && marriages[person2Id] === person1Id) {
                shipTextMessage = `¡@${senderName} ha detectado a la pareja estrella @${person1Name} y @${person2Name}! ✨ ¡Ya son un ${compatibility}% de amor puro!`;
            } else {
                shipTextMessage = `🚢 ¡Ship a la vista! @${senderName} cree que @${person1Name} y @${person2Name} tienen un ${compatibility}% de compatibilidad. ¿Qué opinan?`;
            }

            try {
                const imageBuffer = canvas.toBuffer('image/png');
                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: shipTextMessage,
                    mentions: [senderId, person1Id, person2Id]
                }, { quoted: msg._baileysMessage });
            } catch (imgError) {
                console.error("[Bodas Plugin Baileys Ship IMG ERR] Error generando o enviando imagen:", imgError);
                await sock.sendMessage(chatId, {
                    text: shipTextMessage, // Fallback a solo texto
                    mentions: [senderId, person1Id, person2Id]
                }, { quoted: msg._baileysMessage });
            }
            return;
        }

        // Si el comando no coincide con ninguna lógica manejada explícitamente
        // esto ayuda a capturar si algún alias no está cubierto o si la lógica de redirección falla.
        // console.log(`[Bodas Plugin Baileys] Comando '${commandName}' no manejado explícitamente después de las verificaciones.`);
    }
};