// plugins/Juegos/duelo_cartas.js

const fs = require('fs');
const path = require('path');
const { getUserData, saveUserData } = require('../../lib/bot-core');

const activeDuels = new Map();
const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets', 'cartas');

// --- FUNCIÓN DE PARSEO (Ataque y Defensa) ---
function parseCard(filename) {
    const namePart = path.parse(filename).name;
    const parts = namePart.split('_');
    let def = parseInt(parts[parts.length - 1]);
    let atk = parseInt(parts[parts.length - 2]);
    let name = "";

    if (!isNaN(atk) && !isNaN(def)) {
        name = parts.slice(0, parts.length - 2).join(' ');
    } else if (!isNaN(def)) {
        atk = def;
        name = parts.slice(0, parts.length - 1).join(' ');
    } else {
        atk = Math.floor(Math.random() * 100) + 1;
        def = Math.floor(Math.random() * 100) + 1;
        name = namePart;
    }
    name = name.replace(/-/g, ' ');
    return { name, atk, def, filename };
}

// --- SOLUCIÓN AL BUG: NORMALIZAR JID ---
// Quita los sufijos :15, :2, etc. para que los IDs siempre coincidan
function normalizeJid(jid) {
    if (!jid) return null;
    return jid.split(':')[0].split('@')[0] + '@s.whatsapp.net';
}

module.exports = {
    name: 'Duelo de Cartas (Estratégico)',
    aliases: ['cartas', 'duelo', 'aceptarjuego'], 
    description: 'Reta a un duelo con cartas que tienen Ataque y Defensa.',
    category: 'Juegos',
    groupOnly: true,
    marketplace: {
        requirements: ["Carpeta assets/cartas","Base de Datos PostgreSQL"],
        tebex_id: 7383036,
        price: "12.00",
        icon: "fa-clone",
        preview: {
            suggestions: ["!duelo pokemon @Usuario 500", ".aceptarjuego"],
            responses: {
                "!duelo pokemon @Usuario 500": "⚔️ **¡DUELO DE CARTAS!** ⚔️\n\n@Retador reta a @Usuario.\n📂 Deck: *pokemon*\n💰 Apuesta: *$500*\n🎲 Modo: *Aleatorio*\n\n👉 Escribe **.aceptarjuego** para jugar.",
                ".aceptarjuego": {
                    text: "🎲 **Modo:** ⚔️ CHOQUE DE PODER (Ataque)\n\n💥 *Charizard* destruye a *Blastoise*.\n🏆 ¡Gana @Retador! (+$500)",
                    image: "https://tse1.explicit.bing.net/th/id/OIP.1M4ZH3Y4pqRKRUz3w3w8CQHaKP?rs=1&pid=ImgDetMain&o=7&rm=3" 
                }
            }
        }
    },

    async execute(sock, msg, args, commandName) {
        const chatId = msg.from;
        const senderId = msg.author; // ID sucio (puede tener :15)
        const senderJidClean = normalizeJid(senderId); // ID limpio

        // --- ACEPTAR DUELO ---
        if (commandName === 'aceptarjuego') {
            // Usamos el ID limpio para buscar la llave
            const duelKey = `${chatId}-${senderJidClean}`;
            const duel = activeDuels.get(duelKey);

            if (!duel) return msg.reply('⚠️ No tienes ningún duelo de cartas pendiente (o ya expiró).');

            const acceptorData = await getUserData(senderId);
            if (acceptorData.money < duel.bet) return msg.reply(`❌ Fondos insuficientes. Necesitas $${duel.bet}.`);

            activeDuels.delete(duelKey);
            
            const categoryPath = path.join(ASSETS_DIR, duel.category);
            
            try {
                const files = fs.readdirSync(categoryPath).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
                if (files.length < 2) return msg.reply('❌ No hay suficientes cartas en esta categoría.');

                const file1 = files[Math.floor(Math.random() * files.length)];
                let file2 = files[Math.floor(Math.random() * files.length)];
                while (file1 === file2) file2 = files[Math.floor(Math.random() * files.length)];

                const card1 = parseCard(file1); // Retador
                const card2 = parseCard(file2); // Aceptador

                let isAttackMode;
                if (duel.forcedMode === 'ataque') isAttackMode = true;
                else if (duel.forcedMode === 'defensa') isAttackMode = false;
                else isAttackMode = Math.random() > 0.5; 

                const modeName = isAttackMode ? "⚔️ CHOQUE DE PODER (Ataque)" : "🛡️ MURO DE RESISTENCIA (Defensa)";
                const score1 = isAttackMode ? card1.atk : card1.def;
                const score2 = isAttackMode ? card2.atk : card2.def;

                // Enviar Carta 1 (Retador)
                await sock.sendMessage(chatId, { 
                    image: { url: path.join(categoryPath, file1) },
                    caption: `👤 **${duel.challengerName}** invoca a:\n*${card1.name}*\n⚔️ Atk: ${card1.atk} | 🛡️ Def: ${card1.def}`
                });

                await new Promise(r => setTimeout(r, 1000));

                // Enviar Carta 2 (Aceptador)
                await sock.sendMessage(chatId, { 
                    image: { url: path.join(categoryPath, file2) },
                    caption: `👤 **${duel.acceptorName}** invoca a:\n*${card2.name}*\n⚔️ Atk: ${card2.atk} | 🛡️ Def: ${card2.def}`
                });

                await new Promise(r => setTimeout(r, 1000));

                let resultText = `🎲 **Modo:** ${modeName}\n\n`;
                const challengerData = await getUserData(duel.challengerId);

                if (score1 > score2) {
                    challengerData.money += duel.bet;
                    acceptorData.money -= duel.bet;
                    resultText += `💥 *${card1.name}* destruye a *${card2.name}*.\n🏆 ¡Gana @${duel.challengerId.split('@')[0]}! (+$${duel.bet})`;
                } else if (score2 > score1) {
                    acceptorData.money += duel.bet;
                    challengerData.money -= duel.bet;
                    resultText += `💥 *${card2.name}* contraataca y vence a *${card1.name}*.\n🏆 ¡Gana @${senderJidClean.split('@')[0]}! (+$${duel.bet})`;
                } else {
                    resultText += "🤝 **¡Empate técnico!** Las fuerzas se anulan. Nadie pierde dinero.";
                }

                if (score1 !== score2) {
                    await saveUserData(duel.challengerId, challengerData);
                    await saveUserData(senderId, acceptorData);
                }

                await sock.sendMessage(chatId, { text: resultText, mentions: [duel.challengerId, senderId] });

            } catch (error) {
                console.error(error);
                return msg.reply('❌ Error técnico en el sistema de duelo.');
            }
            return;
        }

        // --- INICIAR DUELO ---
        if (commandName === 'cartas' || commandName === 'duelo') {
            const category = args[0]?.toLowerCase();
            
            // Limpiamos el ID mencionado también
            const mentionedRaw = msg.mentionedJidList[0];
            const mentionedClean = normalizeJid(mentionedRaw);
            
            const betAmount = parseInt(args.find(a => !isNaN(parseInt(a)) && !a.includes('@')));
            
            const modeArg = args.find(a => ['ataque', 'atk', 'defensa', 'def'].includes(a.toLowerCase()));
            let forcedMode = null;
            if (modeArg) {
                if (modeArg.includes('at')) forcedMode = 'ataque';
                if (modeArg.includes('def')) forcedMode = 'defensa';
            }

            if (!category || !mentionedClean || isNaN(betAmount)) {
                return msg.reply('❌ Uso: `.cartas <categoría> @usuario <apuesta> [ataque/defensa]`');
            }

            if (mentionedClean === senderJidClean) return msg.reply('🤡 No puedes retarte a ti mismo.');
            
            const categoryPath = path.join(ASSETS_DIR, category);
            if (!fs.existsSync(categoryPath)) return msg.reply(`❌ La categoría "${category}" no existe.`);

            const userData = await getUserData(senderId);
            if (userData.money < betAmount) return msg.reply(`❌ No tienes fondos suficientes ($${userData.money}).`);

            // Usamos el ID limpio para la llave
            const duelKey = `${chatId}-${mentionedClean}`;
            
            activeDuels.set(duelKey, {
                challengerId: senderId,
                challengerName: msg.pushName || senderJidClean.split('@')[0],
                acceptorName: mentionedClean.split('@')[0],
                category, 
                bet: betAmount,
                forcedMode: forcedMode
            });

            setTimeout(() => { if (activeDuels.has(duelKey)) activeDuels.delete(duelKey); }, 120000);

            let modeText = "🎲 Modo: *Aleatorio*";
            if (forcedMode === 'ataque') modeText = "⚔️ Modo: *Solo Ataque*";
            if (forcedMode === 'defensa') modeText = "🛡️ Modo: *Solo Defensa*";

            return sock.sendMessage(chatId, {
                text: `⚔️ **¡DUELO DE CARTAS!** ⚔️\n\n@${senderJidClean.split('@')[0]} reta a @${mentionedClean.split('@')[0]}.\n📂 Deck: *${category}*\n💰 Apuesta: *$${betAmount}*\n${modeText}\n\n👉 Escribe **.aceptarjuego** para jugar.`,
                mentions: [senderId, mentionedClean]
            });
        }
    }
};