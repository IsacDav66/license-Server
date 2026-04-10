// plugins/brainroots_info.js

const { 
    getUserData, msToTime, findUserName,
    getUserBrainroots
} = require('../shared-economy.js');

// Importar el plugin brainroots para acceder a sus variables de estado y configuración
const brainrootsPlugin = require('./brainroots.js'); 

const MONEY_SYMBOL = '$';

module.exports = {
    name: 'Brainroots Info',
    aliases: ['infobr', 'infobrainroots', 'inforobo', 'inforobos'],
    description: 'Información sobre Brainroots y las probabilidades de robo/spawn.',
    category: 'Brainroots',
    groupOnly: false,
    marketplace: {
        tebex_id: 7383074,
        price: "2.00",
        icon: "fa-circle-info",
        preview: {
            suggestions: ["!infobrainroots", "!inforobo"],
            responses: {
                "!infobrainroots": "*🧠 Información del Juego Brainroots:*\n\n¡Atrapa criaturas y gana dinero!\n\n*📊 Probabilidades:* \n• Rareza 1/5: 55.4%\n• Rareza 5/5: 1.1% (LEGENDARIO)",
                "!inforobo": "*⚔️ Información sobre el Robo de Brainroots:*\n\nPuedes intentar robar un Brainroot a otro jugador con el comando `.brrob @usuario`.\n\n*📊 Probabilidades de éxito:* \nTu probabilidad base de éxito es del 50%, ajustada por la rareza del Brainroot que intentes robar."
            }
        }
    },

    async execute(sock, msg, args, commandName) {
        const userId = msg.senderLid || msg.author;
        const chatJid = msg.from;
        const userNameToMention = (await getUserData(userId))?.pushname || await findUserName(userId) || userId.split('@')[0];

        // --- Bloque de Verificación de Registro (opcional para INFO, pero consistente) ---
        const user = await getUserData(userId);
        if (!user || !user.password) {
            const prefix = msg.body.charAt(0);
            return msg.reply(`👋 ¡Hola, @${userNameToMention}!\nPara ver esta información, primero necesitas registrarte. Usa: *${prefix}mifono +TuNumeroCompleto*`);
        }
        // --- Fin Bloque de Verificación de Registro ---


        // --- Comando .infobrainroots (Probabilidades de Spawn) ---
        if (commandName === 'infobr' || commandName === 'infobrainroots') {
            console.log(`[Brainroots Info] Procesando comando '${commandName}' por ${userId}.`);

            const allCharacters = brainrootsPlugin.getAllCharacters();
            const rarityWeights = brainrootsPlugin.getRarityWeights();

            if (!allCharacters || allCharacters.length === 0) {
                return msg.reply('❌ La información de Brainroots no está cargada. Contacta a un administrador.');
            }
            if (!rarityWeights || rarityWeights.length === 0) {
                return msg.reply('❌ Las probabilidades de Brainroots no están calculadas. Contacta a un administrador.');
            }

            let infoMessage = `*🧠 Información del Juego Brainroots:*\n\n`;
            infoMessage += `¡Atrapa criaturas, gana y comercia con otros jugadores.\n\n`;
            
            infoMessage += `*📊 Probabilidades de aparición por rareza:*\n`;

            const totalWeightedEntries = rarityWeights.length;
            const rarityCounts = {}; // Para contar cuántos Brainroots hay de cada rareza
            const rarityWeightsSum = {}; // Para sumar los pesos de cada rareza

            allCharacters.forEach(char => {
                if (!rarityCounts[char.rarity]) {
                    rarityCounts[char.rarity] = 0;
                    rarityWeightsSum[char.rarity] = 0;
                }
                rarityCounts[char.rarity]++;
                // Obtener el peso individual de la rareza para el cálculo
                let weightPerChar = 0;
                 switch (char.rarity) {
                    case 1: weightPerChar = 50; break;
                    case 2: weightPerChar = 25; break;
                    case 3: weightPerChar = 10; break;
                    case 4: weightPerChar = 3;  break;
                    case 5: weightPerChar = 1;  break;
                    default: weightPerChar = 1; break;
                }
                rarityWeightsSum[char.rarity] += weightPerChar;
            });

            // Ordenar las rarezas para una salida consistente
            const sortedRarities = Object.keys(rarityWeightsSum).sort((a, b) => parseInt(a) - parseInt(b));

            sortedRarities.forEach(rarityLevel => {
                const totalWeightForRarity = rarityWeightsSum[rarityLevel];
                const percentage = (totalWeightForRarity / totalWeightedEntries) * 100;
                infoMessage += `• Rareza *${rarityLevel}/5* (${rarityCounts[rarityLevel]} tipos): ${percentage.toFixed(2)}%\n`;
            });

            infoMessage += `\n*❓ ¿Por qué?* Los Brainroots más comunes (Rareza 1) tienen más "peso" en la aparición que los más raros (Rareza 5). Esto significa que el bot los elegirá con más frecuencia.`;
            infoMessage += `\nLos Brainroots de Rareza 5 son extremadamente difíciles de ver. ¡Buena suerte!`;
            
            infoMessage += `\n\n*⏳ Cooldown del comando \`.brspawn\`:* ${msToTime(brainrootsPlugin.getCooldownSpawnCommandMs())}`;
            infoMessage += `\n*⏰ Ventana de captura:* ${brainrootsPlugin.getCatchWindowMs() / 1000} segundos`;

            return msg.reply(infoMessage);
        }


        // --- Comando .inforobo (Resumen de Robo) ---
        if (commandName === 'inforobo' && args.length === 0) {
            console.log(`[Brainroots Info] Procesando comando '${commandName}' por ${userId}.`);

            const BASE_ROB_SUCCESS_CHANCE = brainrootsPlugin.getBaseRobSuccessChance();
            const RARITY_BONUS_PENALTY_PER_LEVEL = brainrootsPlugin.getRarityBonusPenaltyPerLevel();
            const COOLDOWN_ROB_COMMAND_MS = brainrootsPlugin.getCooldownRobCommandMs();

            let infoMessage = `*⚔️ Información sobre el Robo de Brainroots:*\n\n`;
            infoMessage += `Puedes intentar robar un Brainroot a otro jugador con el comando \`.brrob @usuario\`.\n`;
            infoMessage += `Si tienes éxito, le quitarás un Brainroot al azar de su colección y lo añadirás a la tuya.\n\n`;
            
            infoMessage += `*📊 Probabilidades de éxito:*`;
            infoMessage += `\nTu probabilidad base de éxito es del *${(BASE_ROB_SUCCESS_CHANCE * 100).toFixed(0)}%*.`;
            infoMessage += `\nEsta probabilidad se *ajusta* según la rareza del Brainroot que intentes robar:`;
            infoMessage += `\n• Cada nivel de rareza del Brainroot a robar te *penaliza* o *beneficia* en un *${(RARITY_BONUS_PENALTY_PER_LEVEL * 100).toFixed(0)}%*.`;
            infoMessage += `\n  (Es más difícil robar un Brainroot legendario que uno común).`;
            infoMessage += `\n\n*⏳ Cooldown:* Después de cada intento de robo, debes esperar *${msToTime(COOLDOWN_ROB_COMMAND_MS)}* antes de poder robar de nuevo.`;
            infoMessage += `\n\n_¡Ten cuidado! El robo es arriesgado, pero puede valer la pena._`;
            
            return msg.reply(infoMessage);
        }

        // --- Comando .inforobo @user (Probabilidad de Robo a un usuario específico) ---
        if (commandName === 'inforobo' && args.length > 0) {
            console.log(`[Brainroots Info] Procesando comando '${commandName} @user' por ${userId}. Args: ${args.join(' ')}`);

            const mentionedJids = msg._baileysMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            let targetJid = null;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (args[0].startsWith('@')) {
                const numPart = args[0].substring(1).split('@')[0];
                targetJid = numPart + '@s.whatsapp.net';
            }

            if (!targetJid) {
                return msg.reply('❌ Debes mencionar o escribir el JID completo del usuario al que quieres analizar (ej. `.inforobo @51987654321`).');
            }
            if (targetJid === userId) {
                return msg.reply('😂 No puedes analizar tus propias probabilidades de robo, ¡analiza a otros!');
            }

            const targetUser = await getUserData(targetJid);
            if (!targetUser) {
                return msg.reply(`❌ No pude encontrar los datos del usuario @${targetJid.split('@')[0]}. Asegúrate de que esté registrado en el bot.`);
            }
            const targetUserName = targetUser?.pushname || await findUserName(targetJid) || targetJid.split('@')[0];

            const targetUserCollection = await getUserBrainroots(targetJid);
            if (targetUserCollection.length === 0) {
                return msg.reply(`😅 @${targetUserName} no tiene ningún Brainroot. ¡No hay nada que robar!`);
            }

            const allCharacters = brainrootsPlugin.getAllCharacters();
            const BASE_ROB_SUCCESS_CHANCE = brainrootsPlugin.getBaseRobSuccessChance();
            const RARITY_BONUS_PENALTY_PER_LEVEL = brainrootsPlugin.getRarityBonusPenaltyPerLevel();

            let analysisMessage = `*🕵️‍♀️ Análisis de Robo a @${targetUserName}:*\n\n`;
            analysisMessage += `Este es un análisis de las probabilidades si intentaras robar a @${targetUserName}.\n`;
            analysisMessage += `Su colección contiene:\n`;

            const groupedTargetCharacters = {};
            targetUserCollection.forEach(char => {
                if (!groupedTargetCharacters[char.name]) {
                    groupedTargetCharacters[char.name] = {
                        name: char.name,
                        rarity: char.rarity,
                        quantity: 0
                    };
                }
                groupedTargetCharacters[char.name].quantity++;
            });
            const orderedGroupedTargetCharacters = Object.values(groupedTargetCharacters).sort((a, b) => {
                if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                return a.name.localeCompare(b.name);
            });

            orderedGroupedTargetCharacters.forEach(char => {
                analysisMessage += `• *${char.name}* x${char.quantity} (Rareza: ${char.rarity}/5)\n`;
            });
            analysisMessage += `\n`;

            // Calcular la probabilidad promedio de éxito/fallo si se robara cualquier Brainroot de ese usuario
            let totalPossibleRobChance = 0;
            targetUserCollection.forEach(char => {
                let currentChance = BASE_ROB_SUCCESS_CHANCE - ((char.rarity - 1) * RARITY_BONUS_PENALTY_PER_LEVEL);
                currentChance = Math.max(0.10, Math.min(0.90, currentChance)); // Clampear
                totalPossibleRobChance += currentChance;
            });
            const averageSuccessChance = totalPossibleRobChance / targetUserCollection.length;
            analysisMessage += `Si intentas robar un Brainroot al azar de @${targetUserName}, tu probabilidad de éxito promedio es del *${(averageSuccessChance * 100).toFixed(2)}%*.\n\n`;

            analysisMessage += `*Probabilidades de éxito por rareza del Brainroot robado (aproximado):*\n`;

            // Para cada rareza posible que el objetivo podría tener, calcular la chance.
            const uniqueRaritiesInTarget = [...new Set(targetUserCollection.map(c => c.rarity))].sort((a, b) => a - b);
            
            uniqueRaritiesInTarget.forEach(rarityLevel => {
                let chanceForRarity = BASE_ROB_SUCCESS_CHANCE - ((rarityLevel - 1) * RARITY_BONUS_PENALTY_PER_LEVEL);
                chanceForRarity = Math.max(0.10, Math.min(0.90, chanceForRarity));
                analysisMessage += `• Si el Brainroot es Rareza *${rarityLevel}/5*: *${(chanceForRarity * 100).toFixed(2)}%* de éxito.\n`;
            });

            analysisMessage += `\n*⏳ Cooldown del robo:* ${msToTime(brainrootsPlugin.getCooldownRobCommandMs())}`;


            return sock.sendMessage(chatJid, { text: analysisMessage, mentions: [userId, targetJid] }, { quoted: msg._baileysMessage });
        }
    }
};