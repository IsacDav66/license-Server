// plugins/brainroots.js (Versión basada en comando de spawn - Corregido LID para Remitente y Menciones, Categoría 'Brainroots')

const path = require('path');
const fs = require('fs');
const { 
    getUserData, saveUserData, msToTime, findUserName,
    getAllBrainrootsCharacters, getBrainrootsCharacterById, getBrainrootsCharacterByName,
    addBrainrootsToUser, getUserBrainroots, updateBrainrootIncomeTimestamp,
    removeBrainrootFromUser, getRandomUserBrainroot,
    pickRandom,
    addBrainrootToMarket, removeBrainrootFromMarket, getBrainrootsMarketListings, getBrainrootMarketListingById
} = require('../shared-economy');

// --- CONFIGURACIÓN DE ROBO DE BRAINROOTS ---
const COOLDOWN_ROB_COMMAND_MS = 2 * 60 * 60 * 1000; // 2 horas de cooldown para el comando !brrob
const BASE_ROB_SUCCESS_CHANCE = 0.50; // 50% de probabilidad base de éxito (0.0 a 1.0)
const RARITY_BONUS_PENALTY_PER_LEVEL = 0.05; // 5% de cambio en la probabilidad por cada nivel de rareza

// --- CONFIGURACIÓN DE INGRESO PASIVO ---
const INCOME_INTERVAL_HOURS = 1; // Cada 1 hora
const INCOME_PERCENTAGE_PER_DAY = 0.70; // 70% del valor al día

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const INCOME_INTERVAL_MS = INCOME_INTERVAL_HOURS * 60 * 60 * 1000;
const INCOME_PERCENTAGE_PER_INTERVAL = (INCOME_PERCENTAGE_PER_DAY * INCOME_INTERVAL_HOURS) / 24;

const MONEY_SYMBOL = '$';
const ASSETS_BRAINROOTS_DIR = path.join(__dirname, '..','..', 'assets', 'brainroots');

// --- CONFIGURACIÓN DEL SPAWN POR COMANDO ---
const CATCH_WINDOW_MS = 30 * 1000; // 30 segundos para atrapar el Brainroot aparecido
const COOLDOWN_SPAWN_COMMAND_MS = 5 * 60 * 1000; // 5 minutos de cooldown para el comando !brspawn

// --- Variables de estado global ---
let currentSpawnedCharacter = null; // { id, name, image_filename, rarity, price, spawnedJid }
let catchTimer = null;              // setTimeout ID para el tiempo de captura
let allCharacters = [];             // Caché de todos los personajes Brainroots
let rarityWeights = [];             // Lista ponderada de IDs de personajes para selección por rareza

// --- FUNCIÓN DE INICIALIZACIÓN (Se ejecuta al cargar el plugin) ---
async function initializeBrainrootsPlugin() {
    console.log("[Brainroots Plugin] Iniciando initializeBrainrootsPlugin...");
    try {
        allCharacters = await getAllBrainrootsCharacters();
         console.log(`[Brainroots Plugin DEBUG] allCharacters (después de la carga): ${allCharacters.length} entradas. (Detalles omitidos para brevedad)`);

        if (allCharacters.length === 0) {
            console.warn("[Brainroots Plugin] No se encontraron personajes Brainroots en la BD. La tabla 'brainroots_characters' está vacía o hubo un error al cargarla.");
        }

        rarityWeights = []; 
        if (allCharacters.length > 0) { 
            allCharacters.forEach(char => {
                let weight;
                switch (char.rarity) {
                    case 1: weight = 50; break;
                    case 2: weight = 25; break;
                    case 3: weight = 10; break;
                    case 4: weight = 3;  break;
                    case 5: weight = 1;  break;
                    default: weight = 1; break;
                }
                for (let i = 0; i < weight; i++) {
                    rarityWeights.push(char.id);
                }
            });
        }


        console.log(`[Brainroots Plugin DEBUG] rarityWeights (después de la población del forEach): ${rarityWeights.length} entradas.`);
        
        console.log(`[Brainroots Plugin] Ventana de captura: ${CATCH_WINDOW_MS / 1000} segundos.`);
        console.log(`[Brainroots Plugin] Cooldown de comando !brspawn: ${COOLDOWN_SPAWN_COMMAND_MS / 60000} minutos.`);
        
        console.log("[Brainroots Plugin] Inicialización completada exitosamente.");

    } catch (error) {
        console.error("[Brainroots Plugin] Error crítico durante initializeBrainrootsPlugin:", error);
        rarityWeights = [];
        allCharacters = [];
    }
}


// --- FUNCIÓN PARA ELEGIR UN PERSONAJE SEGÚN RAREZA ---
function chooseCharacterByRarity() {
    if (rarityWeights.length === 0) {
        console.warn("[Brainroots Spawn] rarityWeights está vacío, no se puede elegir un personaje.");
        return null;
    }
    const chosenId = pickRandom(rarityWeights);
    const chosenCharacter = allCharacters.find(char => char.id === chosenId);
    console.log(`[Brainroots Spawn] Personaje elegido por rareza: ${chosenCharacter ? chosenCharacter.name : 'ERROR: ID no encontrado'}`);
    return chosenCharacter;
}

// --- LÓGICA DEL PLUGIN PRINCIPAL ---
module.exports = {
    name: 'Brainroots',
    aliases: ['brspawn', 'spawnbr', 'brainrootcomprar', 'mybr', 'misbr', 'brainrootscollection', 'brincome', 'claimbr', 'brgift', 'regalarbr', 'brrob', 'robarbr', 'claim', 'brsell', 'venderbr', 'brunsell', 'quitarbr', 'brmarket', 'brshop', 'brbuy', 'comprarbr'],
    description: 'Comandos de Brainroots: spawn, atrapar (.claim o .brainrootcomprar [nombre]), colección, ingresos, regalo, robo y mercado.',
    category: 'Brainroots', // <--- Mantiene la categoría 'Brainroots'
    groupOnly: false,
    marketplace: {
        tebex_id: 7383076,
        price: "25.00",
        icon: "fa-brain",
        preview: {
            suggestions: ["!brspawn", ".claim", "!brmarket"],
            responses: {
                "!brspawn": {
                    text: "¡Un Brainroot salvaje apareció! 💥\n*Tralarero Tralala*\nRareza: 4/5\nPrecio: $15,000\n\n_Usa .claim para atraparlo!_",
                    image: "https://makerworld.bblmw.com/makerworld/model/USd4f2b366dfc775/design/2025-04-11_1cc7bb0854a2f.webp?x-oss-process=image/resize,w_1000/format,webp"
                },
                ".claim": {
                    text: "⏰ ¡Demasiado tarde! El Brainroot ya escapó o fue atrapado."
                },
                "!brmarket": "*🛒 Brainroots en el Mercado:*\n\n[ID: 45] *Brr brr patapim* (Rareza 2)\nPrecio: $5,000 | Vendedor: @Admin"
            }
        }
    },

    onLoad: async (sock) => {
        console.log("[Brainroots Plugin] Función onLoad ejecutada.");
        await initializeBrainrootsPlugin();
    },

    async execute(sock, msg, args, commandName, finalUserIdFromMain = null) { // Acepta finalUserIdFromMain pero no se confía en él
        // --- AUTO-RESOLUCIÓN DEL SENDERID DENTRO DEL PLUGIN ---
        // El plugin resuelve el ID del remitente porque 'bot.js' no pasa finalUserIdFromMain a la categoría 'Brainroots'.
        const commandSenderId = msg.senderLid || msg.author; 
        const senderOriginalJid = msg.author; // JID original del que ejecuta el comando (para menciones)
        // --- FIN AUTO-RESOLUCIÓN ---

        // --- VERIFICACIÓN CRÍTICA ---
        if (!commandSenderId) {
            console.error(`[Brainroots ERROR] commandSenderId es NULL. Fallo en la resolución de ID para msg.author: ${senderOriginalJid}.`);
            await msg.reply("❌ Hubo un problema al identificar tu usuario. No se puede procesar el comando. Intenta de nuevo.");
            return;
        }
        // --- FIN VERIFICACIÓN ---

        const chatJid = msg.from; // El JID del chat actual, ya sea grupo o privado
        const chat = await msg.getChat(); // Para obtener metadata del grupo
        const isGroup = chat.isGroup;
        const groupParticipants = chat.groupMetadata?.participants || [];


        // Obtenemos los datos del usuario que ejecuta el comando, pasando 'msg' para actualizar su pushname si es necesario
        const user = await getUserData(commandSenderId, msg); 
        const userNameToMention = user?.pushname || jidDecode(senderOriginalJid)?.user || senderOriginalJid.split('@')[0]; // Nombre para menciones/logs

        if (!user) {
            console.error(`[Brainroots Plugin] No se pudieron obtener los datos para ${commandSenderId}`);
            try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) {}
            return;
        }

        // --- Bloque de Verificación de Registro (igual que en otros juegos) ---
        if (!user.password) {
            console.log(`[Brainroots CMD Debug] Usuario ${commandSenderId} no registrado o sin contraseña.`);
            // Asegurarse de que el registro solo se inicie en grupos si es la intención
            if (!isGroup) {
                await msg.reply("🔒 Comando exclusivo de grupos. Por favor, usa este comando en un grupo para iniciar tu registro o usar las funciones de economía.");
                return;
            }
            // Aquí usamos senderOriginalJid para la mención, que es el JID original del remitente
            const actualSenderJid = senderOriginalJid; 

            if (!user.phoneNumber) { // CASO A: Sin contraseña NI número
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(commandSenderId, user); 
                console.log(`[Brainroots CMD Debug] Usuario ${commandSenderId} no tiene contraseña ni teléfono. Solicitando número.`);
                const prefix = msg.body.charAt(0);
                const replyText = `👋 ¡Hola, @${userNameToMention}!\n\nPara interactuar con los Brainroots, necesitas registrarte. Por favor, responde en este chat con:\n*${prefix}mifono +TuNumeroCompleto*`;
                return sock.sendMessage(chatJid, { text: replyText, mentions: [actualSenderJid] }, { quoted: msg._baileysMessage });
            } else { // CASO B: Tiene número pero NO contraseña
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(commandSenderId, user);
                
                console.log(`[Brainroots CMD Debug] Usuario ${commandSenderId} tiene teléfono (+${user.phoneNumber}). Estado 'esperando_contraseña_dm' establecido.`);

                let displayPhoneNumber = user.phoneNumber;
                if (user.phoneNumber && !String(user.phoneNumber).startsWith('+')) {
                    displayPhoneNumber = `+${user.phoneNumber}`;
                }

                await sock.sendMessage(chatJid, {
                    text: `🛡️ ¡Hola, @${userNameToMention}!\n\n` +
                          `Ya tenemos tu número de teléfono registrado (*${displayPhoneNumber}*).\n` +
                          `Ahora, para completar tu registro, te he enviado un mensaje privado (DM) a ese número para que configures tu contraseña. Por favor, revisa tus DMs.\n`+
                          `‼️ Si quieres actualizar tu numero escribe .actualizarfono +52111222333 RECUERDA INCLUIR TODO TU NUMERO Y CODIGO DE PAIS\n`,
                    mentions: [actualSenderJid]
                }, { quoted: msg._baileysMessage });
                
                const dmChatJidToSendTo = `${user.phoneNumber}@s.whatsapp.net`;
                const dmMessageContent = "🔑 Por favor, responde a este mensaje con la contraseña que deseas establecer para los comandos de economía.";
                
                console.log(`[Brainroots Plugin DM DEBUG] Intentando enviar DM para contraseña a ${dmChatJidToSendTo}.`);
                try {
                    await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                    console.log(`[Brainroots Plugin DM SUCCESS] DM para contraseña enviado a ${dmChatJidToSendTo}.`);
                } catch(dmError){
                    console.error(`[Brainroots Plugin DM ERROR] Error enviando DM a ${dmChatJidToSendTo}:`, dmError);
                    await sock.sendMessage(chatJid, {
                        text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que puedes recibir mensajes de este número.`,
                        mentions: [actualSenderJid]
                    }, { quoted: msg._baileysMessage });
                }
                return;
            }
        }
        // --- Fin Bloque de Verificación de Registro ---


        // --- Lógica para el COMANDO DE SPAWN (.brspawn o .spawnbr) ---
        if (['brspawn', 'spawnbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de spawn '${commandName}' por ${commandSenderId} en chat ${chatJid}.`);

            const now = Date.now();
            if (now - (user.lastbrainrootspawn || 0) < COOLDOWN_SPAWN_COMMAND_MS) {
                const timeLeft = COOLDOWN_SPAWN_COMMAND_MS - (now - (user.lastbrainrootspawn || 0));
                console.log(`[Brainroots CMD Debug] Cooldown activo para ${commandSenderId}. Tiempo restante: ${msToTime(timeLeft)}`);
                return msg.reply(`⏳ Ya has invocado un Brainroot recientemente. Espera ${msToTime(timeLeft)} para intentarlo de nuevo.`);
            }

            // Si ya hay un personaje activo en este CHAT, no spawnea otro.
            if (currentSpawnedCharacter && currentSpawnedCharacter.spawnedJid === chatJid) {
                console.log(`[Brainroots CMD Debug] Ya hay un Brainroot activo ('${currentSpawnedCharacter.name}') en este chat.`);
                return msg.reply(`🤷‍♂️ Ya hay un Brainroot activo ('${currentSpawnedCharacter.name}') esperando ser atrapado en este chat. ¡Date prisa o escapará!`);
            }

            const characterToSpawn = chooseCharacterByRarity();
            if (!characterToSpawn) {
                console.warn("[Brainroots Spawn] No hay personajes válidos para aparecer (chooseCharacterByRarity retornó nulo).");
                return msg.reply('❌ No hay personajes Brainroots disponibles para aparecer. Revisa la configuración del bot.');
            }

            currentSpawnedCharacter = { ...characterToSpawn, spawnedJid: chatJid }; // Asociar el spawn a este chat
            const imagePath = path.join(ASSETS_BRAINROOTS_DIR, characterToSpawn.image_filename);
            
            if (!fs.existsSync(imagePath)) {
                console.error(`[Brainroots Spawn] ERROR: Imagen no encontrada para ${characterToSpawn.name} en la ruta: ${imagePath}.`);
                currentSpawnedCharacter = null;
                return msg.reply('❌ ¡Parece que no encuentro la imagen de este Brainroot! Contacta a un administrador.');
            }

            try {
                const imageBuffer = fs.readFileSync(imagePath);
                const rarityText = `Rareza: ${currentSpawnedCharacter.rarity}/5`;
                const priceText = `Precio: ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()}`;
                const caption = `¡Un Brainroot salvaje apareció! 💥\n*${currentSpawnedCharacter.name}*\n${rarityText}\n${priceText}\n\nTienes *${CATCH_WINDOW_MS / 1000} segundos* para atraparlo con: \`.claim\``;

                console.log(`[Brainroots Spawn] Enviando '${currentSpawnedCharacter.name}' al chat: ${chatJid}`);
                await sock.sendMessage(chatJid, {
                    image: imageBuffer,
                    caption: caption
                });
                console.log(`[Brainroots Spawn] '${currentSpawnedCharacter.name}' enviado con éxito a ${chatJid}.`);

                user.lastbrainrootspawn = now; // Guardar el tiempo de uso del comando
                await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del remitente

                // Establecer el temporizador para limpiar el personaje si no es atrapado
                catchTimer = setTimeout(() => {
                    if (currentSpawnedCharacter && currentSpawnedCharacter.id === characterToSpawn.id && currentSpawnedCharacter.spawnedJid === chatJid) {
                        console.log(`[Brainroots Spawn] Tiempo agotado para '${characterToSpawn.name}'. Escapó del chat ${chatJid}.`);
                        sock.sendMessage(chatJid, {
                            text: `⏰ ¡Tiempo agotado! El Brainroot '${characterToSpawn.name}' escapó...`
                        });
                        currentSpawnedCharacter = null;
                    } else {
                        console.log(`[Brainroots Spawn] Temporizador para Brainroot '${characterToSpawn.name}' en ${chatJid} finalizado, pero ya fue atrapado o limpiado.`);
                    }
                }, CATCH_WINDOW_MS);
                console.log(`[Brainroots Spawn] Temporizador de captura de ${CATCH_WINDOW_MS / 1000}s iniciado para '${currentSpawnedCharacter.name}' en ${chatJid}.`);

            } catch (error) {
                console.error("[Brainroots Spawn] Error al enviar el Brainroot o configurar el temporizador:", error);
                if (error.stack) console.error(error.stack);
                currentSpawnedCharacter = null;
                if (catchTimer) clearTimeout(catchTimer);
                catchTimer = null;
                return msg.reply('❌ Ocurrió un error al intentar que apareciera un Brainroot. Inténtalo de nuevo más tarde.');
            }
            return;
        }


        // --- Lógica para el COMANDO DE COMPRA (.brainrootcomprar o .claim) ---
        if (['brainrootcomprar', 'claim'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Entrando a lógica de ${commandName} para ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);
            
            if (!currentSpawnedCharacter || currentSpawnedCharacter.spawnedJid !== chatJid) {
                console.log(`[Brainroots CMD Debug] No hay Brainroot activo en este chat o no fue spawneado aquí. Respondiendo...`);
                return msg.reply('🤷‍♂️ No hay ningún Brainroot activo para atrapar en este momento en este chat.');
            }

            let guessedName = null;
            let isClaimCommand = (commandName === 'claim');

            if (isClaimCommand) {
                guessedName = currentSpawnedCharacter.name;
                console.log(`[Brainroots CMD Debug] Comando .claim usado. Nombre asumido: '${guessedName}'`);
            } else {
                console.log(`[Brainroots CMD Debug] args[0]: ${args[0]}`);
                if (!args[0]) {
                    console.log(`[Brainroots CMD Debug] No se especificó nombre. Respondiendo...`);
                    return msg.reply('🤔 ¡Debes especificar el nombre del Brainroot que quieres atrapar! Ejemplo: `.brainrootcomprar [nombre]`');
                }
                guessedName = args.join(' ').trim();
                console.log(`[Brainroots CMD Debug] Nombre adivinado: '${guessedName}', Nombre esperado: '${currentSpawnedCharacter.name}'`);
                if (guessedName.toLowerCase() !== currentSpawnedCharacter.name.toLowerCase()) {
                    console.log(`[Brainroots CMD Debug] Nombre incorrecto. Respondiendo...`);
                    return msg.reply('❌ Nombre incorrecto. Intenta de nuevo.');
                }
            }
            
            console.log(`[Brainroots CMD Debug] catchTimer: ${catchTimer}`);
            if (catchTimer === null) {
                 console.log(`[Brainroots CMD Debug] Catch timer es nulo, demasiado tarde. Respondiendo...`);
                 return msg.reply('⏰ ¡Demasiado tarde! El Brainroot ya escapó o fue atrapado.');
            }

            // Verificar dinero del usuario
            console.log(`[Brainroots CMD Debug] User money: ${user.money}, Brainroot price: ${currentSpawnedCharacter.price}`);
            if (user.money < currentSpawnedCharacter.price) {
                console.log(`[Brainroots CMD Debug] Dinero insuficiente. Respondiendo...`);
                return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para atrapar a *${currentSpawnedCharacter.name}* (Costo: ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()}).`);
            }

            // Si todo es válido:
            // 1. Deducir dinero
            console.log(`[Brainroots CMD Debug] Todas las validaciones pasaron. Deduciendo dinero y añadiendo a colección.`);
            user.money -= currentSpawnedCharacter.price;
            await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del remitente

            // 2. Añadir a la colección del usuario
            const added = await addBrainrootsToUser(commandSenderId, currentSpawnedCharacter.id);

            if (added) {
                console.log(`[Brainroots CMD Debug] Brainroot ${currentSpawnedCharacter.name} añadido a la colección de ${userNameToMention}. Enviando confirmación.`);
                sock.sendMessage(chatJid, { // Usar chatJid para responder en el mismo chat
                    text: `🎉 ¡Felicidades, @${userNameToMention}! Has atrapado a *${currentSpawnedCharacter.name}* por ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()} y lo has añadido a tu colección.`,
                    mentions: [senderOriginalJid] // Mencionar con el JID original
                }, { quoted: msg._baileysMessage });

                const capturedBrainrootName = currentSpawnedCharacter.name;
                currentSpawnedCharacter = null;
                clearTimeout(catchTimer);
                catchTimer = null;
                console.log(`[Brainroots Catch] ${userNameToMention} atrapó a ${capturedBrainrootName}.`);

            } else {
                console.log(`[Brainroots CMD Debug] Falló addBrainrootsToUser por alguna razón desconocida.`);
                await msg.reply('❌ Ocurrió un error al añadir el Brainroot a tu colección.');
            }
            return;
        }

        // --- Lógica para el COMANDO DE COLECCIÓN (.mybr, .misbr, .brainrootscollection) ---
        if (['mybr', 'misbr', 'brainrootscollection'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de colección '${commandName}' por ${commandSenderId}. Args: ${args.join(' ')}`);

            let targetDbId = commandSenderId; // ID para buscar en la BD (LID o JID)
            let targetJidForMention = senderOriginalJid; // JID para la mención visual y getUserData si es self
            let targetDisplayName = userNameToMention; // Nombre a mostrar

            // Verificar si se mencionó a otro usuario o se usó @manual
            const mentionedJids = msg.mentionedJidList || [];
            if (mentionedJids.length > 0) {
                const rawMentionedJid = mentionedJids[0];
                targetJidForMention = rawMentionedJid; // JID original del mencionado
                if (isGroup) {
                    const mentionedParticipant = groupParticipants.find(p => p.id === rawMentionedJid);
                    targetDbId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : rawMentionedJid;
                    // console.log(`[Brainroots CMD Debug] Colección: Target DB ID resuelto: ${targetDbId}`);
                } else {
                    targetDbId = rawMentionedJid;
                }
                const mentionedUser = await getUserData(targetDbId);
                targetDisplayName = mentionedUser?.pushname || jidDecode(rawMentionedJid)?.user || rawMentionedJid.split('@')[0];
                console.log(`[Brainroots CMD Debug] Colección solicitada para usuario mencionado: ${targetDbId} (${targetDisplayName})`);
            } else if (args[0] && args[0].startsWith('@')) {
                // Parche si la mención no fue detectada por Baileys pero el formato @numero fue usado
                const numPart = args[0].substring(1).split('@')[0];
                targetJidForMention = numPart + '@s.whatsapp.net';
                if (isGroup) {
                    const mentionedParticipant = groupParticipants.find(p => p.id === targetJidForMention);
                    targetDbId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : targetJidForMention;
                } else {
                    targetDbId = targetJidForMention;
                }
                const mentionedUser = await getUserData(targetDbId);
                targetDisplayName = mentionedUser?.pushname || jidDecode(targetJidForMention)?.user || targetJidForMention.split('@')[0];
                console.log(`[Brainroots CMD Debug] Colección solicitada para usuario por @manual: ${targetDbId} (${targetDisplayName})`);
            }

            const userCharacters = await getUserBrainroots(targetDbId); // Obtiene cada entrada individual

            if (userCharacters.length === 0) {
                console.log(`[Brainroots CMD Debug] Usuario ${targetDbId} no tiene Brainroots.`);
                if (targetDbId === commandSenderId) {
                    return msg.reply('🌿 Aún no tienes ningún Brainroot. ¡Usa `.brspawn` para que aparezca uno y atrápalo!');
                } else {
                    return sock.sendMessage(chatJid, { text: `🌿 @${targetDisplayName} aún no tiene ningún Brainroot.`, mentions: [targetJidForMention] }, { quoted: msg._baileysMessage });
                }
            }

            let collectionMessage = `*🌱 Colección de Brainroots de @${targetDisplayName}:*\n\n`; // Usar @ para mención
            let totalPotentialIncome = 0;

            const now = Date.now();
            const groupedCharacters = {};

            userCharacters.forEach(char => {
                if (!groupedCharacters[char.name]) {
                    groupedCharacters[char.name] = {
                        name: char.name,
                        rarity: char.rarity,
                        price: char.price,
                        quantity: 0,
                        accumulatedIncome: 0,
                    };
                }
                groupedCharacters[char.name].quantity++;

                const timeSinceLastIncome = now - (char.last_income_timestamp || char.catch_timestamp);
                let intervalsPassed = Math.floor(timeSinceLastIncome / INCOME_INTERVAL_MS);

                if (intervalsPassed > 0) {
                    const incomePerInterval = Math.floor(char.price * INCOME_PERCENTAGE_PER_INTERVAL);
                    const incomeReady = incomePerInterval * intervalsPassed;
                    groupedCharacters[char.name].accumulatedIncome += incomeReady;
                    totalPotentialIncome += incomeReady;
                }
            });

            const orderedGroupedCharacters = Object.values(groupedCharacters).sort((a, b) => {
                if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                return a.name.localeCompare(b.name);
            });


            orderedGroupedCharacters.forEach(char => {
                collectionMessage += `• *${char.name}* x${char.quantity} (Rareza: ${char.rarity}/5, Precio: ${MONEY_SYMBOL}${char.price.toLocaleString()})`;
                if (char.accumulatedIncome > 0) {
                    collectionMessage += ` -> ${MONEY_SYMBOL}${char.accumulatedIncome.toLocaleString()} listo`;
                }
                collectionMessage += `\n`;
            });
            
            if (totalPotentialIncome > 0 && targetDbId === commandSenderId) {
                collectionMessage += `\n*💰 Ingreso total listo para reclamar: ${MONEY_SYMBOL}${totalPotentialIncome.toLocaleString()}*`;
                collectionMessage += `\nUsa \`.brincome\` para reclamarlo.`;
            } else if (totalPotentialIncome > 0) {
                collectionMessage += `\n_💰 Este usuario tiene un ingreso de ${MONEY_SYMBOL}${totalPotentialIncome.toLocaleString()} listo para reclamar._`;
            } else {
                collectionMessage += `\n_No hay ingresos listos para reclamar todavía._`;
            }

            console.log(`[Brainroots CMD Debug] Enviando colección de ${targetDisplayName} a ${commandSenderId}.`);
            return sock.sendMessage(chatJid, { text: collectionMessage, mentions: [targetJidForMention] }, { quoted: msg._baileysMessage });
        }

        // --- Lógica para el COMANDO DE RECLAMAR INGRESO (.brincome o .claimbr) ---
        if (['brincome', 'claimbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de reclamo de ingreso '${commandName}' para ${commandSenderId}.`);
            const userCharacters = await getUserBrainroots(commandSenderId);

            if (userCharacters.length === 0) {
                return msg.reply('🌿 Aún no tienes ningún Brainroot para generar ingresos.');
            }

            let totalClaimedIncome = 0;
            const now = Date.now();
            const updatedTimestamps = [];

            for (const char of userCharacters) {
                const timeSinceLastIncome = now - (char.last_income_timestamp || char.catch_timestamp);
                let intervalsPassed = Math.floor(timeSinceLastIncome / INCOME_INTERVAL_MS);

                if (intervalsPassed > 0) {
                    const incomePerInterval = Math.floor(char.price * INCOME_PERCENTAGE_PER_INTERVAL);
                    const incomeToClaim = incomePerInterval * intervalsPassed;
                    totalClaimedIncome += incomeToClaim;

                    // Actualizar a 'now' para el nuevo cooldown
                    updatedTimestamps.push(updateBrainrootIncomeTimestamp(char.user_brainroot_entry_id, now)); 
                }
            }

            await Promise.all(updatedTimestamps);

            if (totalClaimedIncome > 0) {
                user.money += totalClaimedIncome;
                await saveUserData(commandSenderId, user);
                console.log(`[Brainroots CMD Debug] ${userNameToMention} reclamó ${totalClaimedIncome} de Brainroots.`);
                return sock.sendMessage(chatJid, {
                    text: `💰 ¡Felicidades, @${userNameToMention}! Has reclamado *${MONEY_SYMBOL}${totalClaimedIncome.toLocaleString()}* de tus Brainroots.\nTu nuevo saldo: ${MONEY_SYMBOL}${user.money.toLocaleString()}`,
                    mentions: [senderOriginalJid] // Mencionar con el JID original
                }, { quoted: msg._baileysMessage });
            } else {
                console.log(`[Brainroots CMD Debug] ${userNameToMention} intentó reclamar pero no había ingresos disponibles.`);
                return msg.reply('_No hay ingresos listos para reclamar de tus Brainroots todavía. Espera un poco más._');
            }
        }

        // --- Lógica para el COMANDO DE REGALAR (.brgift o .regalarbr) ---
        if (['brgift', 'regalarbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de regalo '${commandName}' por ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);

            // Validación: Mínimo 2 argumentos (@usuario y Nombre del Brainroot)
            if (args.length < 2) {
                return msg.reply('🤔 Uso: `.brgift @usuario [Nombre del Brainroot]`. Ejemplo: `.brgift @51987654321 Snorlax`');
            }

            // 1. Identificar al destinatario (JID mencionado o por @manual)
            const mentionedJids = msg.mentionedJidList || [];
            let rawTargetJid = null; // El JID original del destinatario
            let targetDbId = null; // El LID o JID para la DB

            if (mentionedJids.length > 0) {
                rawTargetJid = mentionedJids[0];
            } else if (args[0].startsWith('@')) {
                const numPart = args[0].substring(1).split('@')[0];
                rawTargetJid = numPart + '@s.whatsapp.net';
            }

            if (!rawTargetJid) {
                return msg.reply('❌ Debes mencionar o escribir el JID completo del usuario al que quieres regalar el Brainroot (ej. `@51987654321 BrainrootName`).');
            }
            
            // Resolvemos el targetId para la DB
            if (isGroup) {
                const targetParticipant = groupParticipants.find(p => p.id === rawTargetJid);
                targetDbId = (targetParticipant && targetParticipant.lid) ? targetParticipant.lid : rawTargetJid;
            } else {
                targetDbId = rawTargetJid;
            }

            if (targetDbId === commandSenderId) {
                return msg.reply('😂 No puedes regalarte un Brainroot a ti mismo. ¡Ya lo tienes!');
            }
            // Asegurarse de que el destinatario esté registrado para evitar errores
            const targetUser = await getUserData(targetDbId);
            if (!targetUser) {
                return msg.reply(`❌ No pude encontrar los datos del usuario destinatario (@${rawTargetJid.split('@')[0]}). Asegúrate de que esté registrado en el bot.`);
            }
            const targetUserName = targetUser?.pushname || jidDecode(rawTargetJid)?.user || rawTargetJid.split('@')[0];


            // 2. Identificar el nombre del Brainroot (el resto de los argumentos)
            // Filtramos el argumento que es el @mencionado para obtener solo el nombre del brainroot
            const brainrootNameArgs = args.filter(arg => !arg.startsWith('@') || (mentionedJids.length > 0 && arg !== args[0]));
            const brainrootName = brainrootNameArgs.join(' ').trim();

            if (!brainrootName) {
                return msg.reply('🤔 ¿Qué Brainroot quieres regalar? Uso: `.brgift @usuario [Nombre del Brainroot]`');
            }

            // 3. Buscar el Brainroot por nombre
            const characterToGift = await getBrainrootsCharacterByName(brainrootName);
            if (!characterToGift) {
                return msg.reply(`❌ No conozco ningún Brainroot llamado *${brainrootName}*. Verifica el nombre.`);
            }

            // 4. Verificar si el remitente tiene el Brainroot
            const senderCollection = await getUserBrainroots(commandSenderId);
            const senderHasBrainroot = senderCollection.some(char => char.id === characterToGift.id);

            if (!senderHasBrainroot) {
                return msg.reply(`🤷‍♀️ No tienes *${characterToGift.name}* en tu colección para regalar.`);
            }

            // 5. Eliminar del remitente
            const removed = await removeBrainrootFromUser(commandSenderId, characterToGift.id);
            if (!removed) {
                console.error(`[Brainroots CMD Debug] Error inesperado al intentar eliminar ${characterToGift.name} de ${commandSenderId}.`);
                return msg.reply('❌ Ocurrió un error al intentar eliminar el Brainroot de tu inventario. Inténtalo de nuevo.');
            }

            // 6. Añadir al destinatario
            const added = await addBrainrootsToUser(targetDbId, characterToGift.id);
            if (!added) {
                console.error(`[Brainroots CMD Debug] Error inesperado al intentar añadir ${characterToGift.name} a ${targetDbId}.`);
                // Si falla aquí, deberíamos intentar devolverlo al remitente para no perderlo. (Lógica avanzada de rollback)
                return msg.reply('❌ Ocurrió un error al añadir el Brainroot al destinatario. El regalo no pudo completarse.');
            }

            // 7. Mensaje de confirmación
            console.log(`[Brainroots CMD Debug] ${userNameToMention} regaló ${characterToGift.name} a ${targetUserName}.`);
            await sock.sendMessage(chatJid, {
                text: `🎁 ¡@${userNameToMention} le ha regalado un *${characterToGift.name}* a @${targetUserName}! ¡Qué generoso/a!`,
                mentions: [senderOriginalJid, rawTargetJid] // Mencionar con JIDs originales
            }, { quoted: msg._baileysMessage });

            return;
        }


        // --- Lógica para el COMANDO DE ROBO (.brrob o .robarbr) ---
        if (['brrob', 'robarbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de robo '${commandName}' por ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);

            if (args.length < 1) {
                return msg.reply('🤔 Uso: `.brrob @usuario`. Intenta robar un Brainroot a otro usuario.');
            }

            const mentionedJids = msg.mentionedJidList || [];
            let rawTargetJid = null; // El JID original del destinatario
            let targetDbId = null; // El LID o JID para la DB

            if (mentionedJids.length > 0) {
                rawTargetJid = mentionedJids[0];
            } else if (args[0].startsWith('@')) {
                const numPart = args[0].substring(1).split('@')[0];
                rawTargetJid = numPart + '@s.whatsapp.net';
            }

            if (!rawTargetJid) {
                return msg.reply('❌ Debes mencionar o escribir el JID completo del usuario al que quieres robar.');
            }

            // Resolvemos el targetId para la DB
            if (isGroup) {
                const targetParticipant = groupParticipants.find(p => p.id === rawTargetJid);
                targetDbId = (targetParticipant && targetParticipant.lid) ? targetParticipant.lid : rawTargetJid;
            } else {
                targetDbId = rawTargetJid;
            }

            if (targetDbId === commandSenderId) { // Compara IDs resueltos
                return msg.reply('😂 No puedes robarte a ti mismo. ¡Qué tramposo!');
            }

            // Verificar cooldown del robo para el atacante
            const now = Date.now();
            if (now - (user.lastbrainrootrob || 0) < COOLDOWN_ROB_COMMAND_MS) {
                const timeLeft = COOLDOWN_ROB_COMMAND_MS - (now - (user.lastbrainrootrob || 0));
                return msg.reply(`⏳ Ya has intentado robar recientemente. Espera ${msToTime(timeLeft)} para tu próximo intento.`);
            }

            // Obtener datos del objetivo
            const targetUser = await getUserData(targetDbId);
            if (!targetUser) {
                return msg.reply(`❌ No pude encontrar los datos del usuario a robar. Asegúrate de que @${rawTargetJid.split('@')[0]} esté registrado en el bot.`);
            }
            const targetUserName = targetUser?.pushname || jidDecode(rawTargetJid)?.user || rawTargetJid.split('@')[0];

            // Verificar si el objetivo tiene Brainroots para robar
            const targetUserCollection = await getUserBrainroots(targetDbId);
            if (targetUserCollection.length === 0) {
                return msg.reply(`😅 @${targetUserName} no tiene ningún Brainroot que puedas robar.`);
            }
            
            // --- Lógica del robo ---
            console.log(`[Brainroots CMD Debug] Iniciando intento de robo de ${targetUserName} por ${userNameToMention}.`);

            const brainrootToAttemptSteal = await getRandomUserBrainroot(targetDbId);
            
            if (!brainrootToAttemptSteal) {
                console.warn(`[Brainroots CMD Debug] getRandomUserBrainroot retornó nulo para ${targetDbId}, a pesar de que la colección no está vacía.`);
                return msg.reply(`❌ Ocurrió un error al intentar identificar un Brainroot para robar de @${targetUserName}.`);
            }

            // 2. Calcular la probabilidad de éxito
            let successChance = BASE_ROB_SUCCESS_CHANCE;

            successChance -= (brainrootToAttemptSteal.rarity - 1) * RARITY_BONUS_PENALTY_PER_LEVEL;
            successChance = Math.max(0.10, Math.min(0.90, successChance));

            const roll = Math.random();

            // 3. Resultado del robo
            let outcomeMessage = '';
            let robSuccess = false;

            if (roll < successChance) { // ¡Éxito!
                robSuccess = true;
                // Eliminar del objetivo
                const removed = await removeBrainrootFromUser(targetDbId, brainrootToAttemptSteal.character_id);
                // Añadir al atacante
                const added = await addBrainrootsToUser(commandSenderId, brainrootToAttemptSteal.character_id);

                if (removed && added) {
                    outcomeMessage = `🎉 ¡Éxito! @${userNameToMention} le ha robado un *${brainrootToAttemptSteal.name}* a @${targetUserName}!`;
                } else {
                    console.error(`[Brainroots CMD Debug] Error en DB después de rollo exitoso para robar ${brainrootToAttemptSteal.name} entre ${userNameToMention} y ${targetUserName}. Removed: ${removed}, Added: ${added}`);
                    outcomeMessage = `⚠️ ¡Éxito en el intento, pero hubo un error de base de datos! El Brainroot podría no haberse movido correctamente.`;
                }
            } else { // Fallo
                outcomeMessage = `😥 ¡Fallaste! @${userNameToMention} intentó robar a @${targetUserName} pero fue descubierto y no consiguió nada.`;
            }

            // 4. Guardar cooldown del robo
            user.lastbrainrootrob = now;
            await saveUserData(commandSenderId, user);

            // 5. Enviar mensaje de resultado
            console.log(`[Brainroots CMD Debug] Robo de ${userNameToMention} a ${targetUserName} resultado: ${robSuccess ? 'ÉXITO' : 'FALLO'}`);
            await sock.sendMessage(chatJid, {
                text: outcomeMessage,
                mentions: [senderOriginalJid, rawTargetJid] // Mencionar con JIDs originales
            }, { quoted: msg._baileysMessage });

            return;
        }

        // --- Lógica para el COMANDO DE VENDER BRAINROOTS (.brsell o .venderbr) ---
        if (['brsell', 'venderbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de venta '${commandName}' por ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);

            if (args.length < 2) {
                return msg.reply('🤔 Uso: `.brsell [Nombre del Brainroot] [Precio]`. Ejemplo: `.brsell Charmander 150`');
            }

            const price = parseInt(args[args.length - 1]); // El último argumento es el precio
            if (isNaN(price) || price <= 0) {
                return msg.reply('❌ El precio debe ser un número positivo.');
            }

            const brainrootName = args.slice(0, args.length - 1).join(' ').trim();
            if (!brainrootName) {
                return msg.reply('🤔 Debes especificar el nombre del Brainroot que quieres vender.');
            }

            const characterToSell = await getBrainrootsCharacterByName(brainrootName);
            if (!characterToSell) {
                return msg.reply(`❌ No conozco ningún Brainroot llamado *${brainrootName}*. Verifica el nombre.`);
            }

            // Verificar si el vendedor tiene el Brainroot
            const senderCollection = await getUserBrainroots(commandSenderId);
            const senderHasBrainroot = senderCollection.some(char => char.id === characterToSell.id);

            if (!senderHasBrainroot) {
                return msg.reply(`🤷‍♀️ No tienes *${characterToSell.name}* en tu colección para vender.`);
            }

            // Eliminar una copia del Brainroot del inventario del vendedor
            const removed = await removeBrainrootFromUser(commandSenderId, characterToSell.id);
            if (!removed) {
                console.error(`[Brainroots CMD Debug] Error inesperado al intentar eliminar ${characterToSell.name} de ${commandSenderId} para vender.`);
                return msg.reply('❌ Ocurrió un error al intentar preparar tu Brainroot para la venta. Inténtalo de nuevo.');
            }

            // Añadirlo al mercado
            const listingId = await addBrainrootToMarket(commandSenderId, characterToSell.id, price);
            if (listingId) {
                console.log(`[Brainroots CMD Debug] ${userNameToMention} listó ${characterToSell.name} (ID:${listingId}) por ${price}.`);
                return msg.reply(`✅ Has puesto a la venta *${characterToSell.name}* por ${MONEY_SYMBOL}${price.toLocaleString()} (ID: ${listingId}).`);
            } else {
                console.error(`[Brainroots CMD Debug] Falló addBrainrootToMarket para ${characterToSell.name} de ${commandSenderId}.`);
                // Si falla aquí, deberíamos intentar devolverlo al remitente
                await addBrainrootsToUser(commandSenderId, characterToSell.id); // Intentar devolverlo
                return msg.reply('❌ Ocurrió un error al listar el Brainroot en el mercado. Tu Brainroot ha sido devuelto.');
            }
        }


        // --- Lógica para el COMANDO DE QUITAR DE LA VENTA (.brunsell o .quitarbr) ---
        if (['brunsell', 'quitarbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de desventa '${commandName}' por ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);

            if (args.length === 0) {
                return msg.reply('🤔 Uso: `.brunsell [ID del listing]`. Puedes ver el ID con `.brmarket`.');
            }

            const listingId = parseInt(args[0]);
            if (isNaN(listingId) || listingId <= 0) {
                return msg.reply('❌ El ID del listing debe ser un número positivo. Puedes verlo con `.brmarket`.');
            }

            const removedListing = await removeBrainrootFromMarket(listingId, commandSenderId); // Intentar quitar solo si es el vendedor
            if (removedListing) {
                // Devolver el Brainroot al vendedor
                await addBrainrootsToUser(commandSenderId, removedListing.character_id);
                const characterInfo = await getBrainrootsCharacterById(removedListing.character_id);
                console.log(`[Brainroots CMD Debug] ${userNameToMention} quitó de la venta ${characterInfo.name} (ID:${listingId}).`);
                return msg.reply(`✅ Has quitado *${characterInfo.name}* (ID: ${listingId}) de la venta y ha sido devuelto a tu colección.`);
            } else {
                console.log(`[Brainroots CMD Debug] Falló removeBrainrootFromMarket para ID:${listingId} por ${commandSenderId}.`);
                return msg.reply('❌ No se encontró un Brainroot en venta con ese ID o no eres el vendedor.');
            }
        }


        // --- Lógica para el COMANDO DE VER EL MERCADO (.brmarket o .brshop) ---
        if (['brmarket', 'brshop'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de mercado '${commandName}' por ${commandSenderId}.`);
            const listings = await getBrainrootsMarketListings();

            if (listings.length === 0) {
                return msg.reply('🛒 El mercado de Brainroots está vacío. ¡Usa `.brsell [nombre] [precio]` para vender los tuyos!');
            }

            let marketMessage = `*🛒 Brainroots en el Mercado:*\n\n`;
            const mentionsToSend = []; // Para las menciones en el mensaje final
            for (const listing of listings) {
                const sellerUser = await getUserData(listing.seller_id); // Obtener datos del vendedor
                const sellerOriginalJid = listing.seller_id; // Suponemos que seller_id en el listing es el JID o LID que sirve para getUserData y menciones
                const sellerName = sellerUser?.pushname || jidDecode(sellerOriginalJid)?.user || sellerOriginalJid.split('@')[0]; // Nombre del vendedor
                marketMessage += `[ID: ${listing.listing_id}] *${listing.name}* (Rareza: ${listing.rarity}/5)\n`;
                marketMessage += `   Precio: ${MONEY_SYMBOL}${listing.listing_price.toLocaleString()} | Vendedor: @${sellerName}\n`;
                mentionsToSend.push(sellerOriginalJid); // Añadir el JID original del vendedor para la mención
            }
            marketMessage += `\nUsa \`.brbuy [ID del listing]\` para comprar.`;
            console.log(`[Brainroots CMD Debug] Enviando lista del mercado a ${commandSenderId}.`);
            // Asegurarse de que mentionsToSend solo contenga JIDs únicos
            const uniqueMentions = [...new Set(mentionsToSend)];
            return sock.sendMessage(chatJid, { text: marketMessage, mentions: uniqueMentions }, { quoted: msg._baileysMessage });
        }


        // --- Lógica para el COMANDO DE COMPRAR BRAINROOTS (.brbuy o .comprarbr) ---
        if (['brbuy', 'comprarbr'].includes(commandName)) {
            console.log(`[Brainroots CMD Debug] Procesando comando de compra '${commandName}' por ${commandSenderId} en chat ${chatJid}. Args: ${args.join(' ')}`);

            if (args.length === 0) {
                return msg.reply('🤔 Uso: `.brbuy [ID del listing]`. Puedes ver el ID con `.brmarket`.');
            }

            const listingId = parseInt(args[0]);
            if (isNaN(listingId) || listingId <= 0) {
                return msg.reply('❌ El ID del listing debe ser un número positivo. Puedes verlo con `.brmarket`.');
            }

            const listing = await getBrainrootMarketListingById(listingId);
            if (!listing) {
                return msg.reply(`❌ No se encontró ningún Brainroot en venta con el ID *${listingId}*. Revisa \`.brmarket\`.`);
            }

            if (listing.seller_id === commandSenderId) { // Compara con el ID resuelto
                return msg.reply('😅 No puedes comprar tu propio Brainroot. Usa `.brunsell [ID]` para quitarlo de la venta.');
            }

            // Verificar dinero del comprador
            if (user.money < listing.listing_price) {
                return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para comprar *${listing.name}* (Precio: ${MONEY_SYMBOL}${listing.listing_price.toLocaleString()}).`);
            }

            // Deducir dinero del comprador
            user.money -= listing.listing_price;
            await saveUserData(commandSenderId, user); // Guarda por el ID resuelto del comprador

           // Añadir dinero al vendedor
            const sellerUser = await getUserData(listing.seller_id);
            const sellerOriginalJid = listing.seller_id; // JID o LID del vendedor para getUserData
            const sellerName = sellerUser?.pushname || jidDecode(sellerOriginalJid)?.user || sellerOriginalJid.split('@')[0]; // Nombre del vendedor para display
            
            if (sellerUser) {
                sellerUser.money += listing.listing_price;
                await saveUserData(listing.seller_id, sellerUser); // Guarda por el ID resuelto del vendedor
                console.log(`[Brainroots CMD Debug] Vendedor ${sellerName} (${listing.seller_id}) recibió ${listing.listing_price} por listing ${listingId}.`);
                
                // --- NUEVO: Enviar mensaje directo al vendedor ---
                try {
                    const dmSellerJid = sellerUser.phoneNumber ? `${sellerUser.phoneNumber}@s.whatsapp.net` : sellerOriginalJid; // Usar número si está, o JID original
                    if (dmSellerJid.includes('@s.whatsapp.net')) {
                        await sock.sendMessage(dmSellerJid, { 
                            text: `🎉 ¡Felicidades, @${sellerName}! Tu *${listing.name}* (ID: ${listing.listing_id}) ha sido vendido a @${userNameToMention} por ${MONEY_SYMBOL}${listing.listing_price.toLocaleString()} en el mercado de Brainroots.` +
                                  `\nTu nuevo saldo: ${MONEY_SYMBOL}${sellerUser.money.toLocaleString()}`
                        }, { mentions: [sellerOriginalJid, senderOriginalJid] }); // Mencionar a ambos en el DM al vendedor (JIDs originales)
                        console.log(`[Brainroots CMD Debug] DM de confirmación de venta enviado a ${sellerName}.`);
                    }
                } catch (dmError) {
                    console.error(`[Brainroots CMD Debug] ERROR al enviar DM de confirmación a vendedor ${sellerName} (${listing.seller_id}):`, dmError);
                }
                // --- FIN NUEVO BLOQUE ---

            } else {
                console.warn(`[Brainroots CMD Debug] Vendedor ${listing.seller_id} no encontrado para darle el dinero por listing ${listingId}. Dinero perdido.`);
            }

            // Añadir el Brainroot al comprador
            const addedToBuyer = await addBrainrootsToUser(commandSenderId, listing.character_id); // Añadir al ID resuelto del comprador
            if (!addedToBuyer) {
                console.error(`[Brainroots CMD Debug] Error añadiendo ${listing.name} a ${userNameToMention} (ID:${commandSenderId}) después de la compra.`);
                // Intentar devolver el dinero si no se pudo añadir
                user.money += listing.listing_price;
                await saveUserData(commandSenderId, user);
                if (sellerUser) {
                    sellerUser.money -= listing.listing_price;
                    await saveUserData(listing.seller_id, sellerUser);
                }
                return msg.reply('❌ Ocurrió un error al añadir el Brainroot a tu colección después de la compra. Tu dinero ha sido devuelto. Inténtalo de nuevo.');
            }

            // Quitar el listing del mercado
            await removeBrainrootFromMarket(listingId);

            console.log(`[Brainroots CMD Debug] ${userNameToMention} compró ${listing.name} (ID:${listingId}) de ${sellerName}.`);
            await sock.sendMessage(chatJid, {
                text: `🎉 ¡@${userNameToMention} ha comprado un *${listing.name}* por ${MONEY_SYMBOL}${listing.listing_price.toLocaleString()} de @${sellerName}!` +
                      `\nTu nuevo saldo: ${MONEY_SYMBOL}${user.money.toLocaleString()}`,
                mentions: [senderOriginalJid, sellerOriginalJid] // Mencionar a ambos (JIDs originales)
            }, { quoted: msg._baileysMessage });

            return;
        }

        
        // Si se llega aquí, el comando no es ninguno de los conocidos
        console.warn(`[Brainroots CMD Debug] Comando desconocido '${commandName}' en plugin Brainroots. No debería ocurrir con los alias configurados.`);
    },

    // Exportar las variables y funciones clave
    getAllCharacters: () => allCharacters,
    getRarityWeights: () => rarityWeights,
    getCooldownSpawnCommandMs: () => COOLDOWN_SPAWN_COMMAND_MS,
    getCatchWindowMs: () => CATCH_WINDOW_MS,
    getCooldownRobCommandMs: () => COOLDOWN_ROB_COMMAND_MS,
    getBaseRobSuccessChance: () => BASE_ROB_SUCCESS_CHANCE,
    getRarityBonusPenaltyPerLevel: () => RARITY_BONUS_PENALTY_PER_LEVEL,
};