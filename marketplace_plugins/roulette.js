// plugins/roulette.js (Versión con Modo Dios para el Propietario)

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { getUserData, saveUserData, msToTime } = require('../shared-economy');

// --- ¡NUEVA CONFIGURACIÓN! ---
// Define el ID del propietario que siempre ganará.
const OWNER_ID = '1658008416509@lid';
// -----------------------------

const MONEY_SYMBOL = '$';
const ROULETTE_BASE_IMAGE_PATH = path.join(__dirname, '..', '..', 'assets', 'roulette_base.png');
const COOLDOWN_ROULETTE_MS = 1 * 60 * 1000;

const rouletteNumbers = {
    0: 'green', 1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black', 7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'black', 12: 'red', 13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red', 19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black', 25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red', 31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
};
const numberKeys = Object.keys(rouletteNumbers).map(Number);
const ROULETTE_LAYOUT = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

async function generateRouletteImage(winningNumber) {
    // ... (esta función no necesita cambios)
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext('2d');
    try {
        const baseImage = await loadImage(ROULETTE_BASE_IMAGE_PATH);
        ctx.drawImage(baseImage, 0, 0, 500, 500);
    } catch (err) { /* fallback */ }
    const centerX = 250, centerY = 250;
    const numbersRingRadius = 250 * 0.75;
    const numberIndexInLayout = ROULETTE_LAYOUT.indexOf(winningNumber);
    if (numberIndexInLayout === -1) return canvas.toBuffer('image/png');
    const angleRadians = (numberIndexInLayout * (360 / ROULETTE_LAYOUT.length) * Math.PI / 180) - (Math.PI / 2);
    const ballX = centerX + numbersRingRadius * Math.cos(angleRadians);
    const ballY = centerY + numbersRingRadius * Math.sin(angleRadians);
    ctx.beginPath();
    ctx.arc(ballX, ballY, 500 / 40, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'Ruleta',
    aliases: ['roulette', 'ruleta', 'rl'],
    description: 'Apuesta dinero en la ruleta (rojo/negro/verde/número).',
    category: 'Juegos',
    groupOnly: true,
    marketplace: {
        requirements: ["Imagen roulette_base.png","Base de Datos PostgreSQL"],
        tebex_id: 7383034,
        price: "10.00",
        icon: "fa-circle-dot",
        preview: {
            suggestions: ["!ruleta 500 rojo", "!rl 1000 negro"],
            responses: {
                "!ruleta 500 rojo": {
                    text: "*La bola cayó en 🔴 32 Rojo!*\n\n*🎉 ¡Felicidades! ¡Has ganado!*\nRecibes $1,000.\n\nSaldo actual: $15,450",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775768008080.webp"
                },
                "!rl 1000 negro": {
                    text: "*La bola cayó en ⚫ 17 Negro!*\n\n*🎉 ¡Felicidades! ¡Has ganado!*\nRecibes $1,000.\n\nSaldo actual: $15,450",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775768008080.webp"
                }
            }
        }
    },
    
    async execute(sock, msg, args) {
        const commandSenderId = msg.senderLid || msg.author;
        const user = await getUserData(commandSenderId, msg);

        if (!user) {
            return msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo.");
        }

        if (!user.password) {
            const userNameToMention = user.pushname || commandSenderId.split('@')[0];
            if (!user.phoneNumber) { // CASO A: Sin contraseña NI número
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(commandSenderId, user);
                const prefix = msg.body.charAt(0);
                const replyText = `👋 ¡Hola, @${userNameToMention}!\n\nPara usar la economía, necesitas registrarte. Por favor, responde en este chat con:\n*${prefix}mifono +TuNumeroCompleto*`;
                return sock.sendMessage(msg.from, { text: replyText, mentions: [commandSenderId] }, { quoted: msg._baileysMessage });
            } else { // CASO B: Tiene número PERO NO contraseña
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(commandSenderId, user);
                const replyText = `🛡️ ¡Hola, @${userNameToMention}!\n\nYa tenemos tu número (+${user.phoneNumber}). Te he enviado un DM a ese número para que configures tu contraseña. ¡Revísalo!`;
                await sock.sendMessage(msg.from, { text: replyText, mentions: [commandSenderId] }, { quoted: msg._baileysMessage });
                
                // CONVERSIÓN CRÍTICA: @c.us -> @s.whatsapp.net
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: "🔑 Responde a este mensaje con la contraseña que deseas para los comandos de economía." });
                } catch (dmError) {
                    console.error(`[Roulette Baileys] Error enviando DM a ${dmJid}:`, dmError);
                    await msg.reply("⚠️ No pude enviarte el DM. Asegúrate de que tu número sea correcto y que puedas recibir mensajes del bot.");
        }
                return;
            }
        }
        // --- FIN Bloque de Verificación ---

        const now = Date.now();
        if (now - (user.lastroulette || 0) < COOLDOWN_ROULETTE_MS) {
            const timeLeft = COOLDOWN_ROULETTE_MS - (now - (user.lastroulette || 0));
            return msg.reply(`*🎰 La mesa aún está ocupada. Espera ${msToTime(timeLeft)}.*`);
        }

        if (args.length < 2) {
            return msg.reply(`❓ Uso: \`.roulette <cantidad> <rojo|negro|verde|numero>\`\nEj: \`.roulette 100 rojo\``);
        }

        const betAmount = parseInt(args[0]);
        const betChoice = args[1].toLowerCase();

        if (isNaN(betAmount) || betAmount <= 0) {
            return msg.reply("⚠️ Debes apostar una cantidad válida y positiva.");
        }
        if (user.money < betAmount) {
            return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para esa apuesta.`);
        }

        let isValidBet = false, betType = '', payoutMultiplier = 0, winningCondition;
        if (['red', 'rojo'].includes(betChoice)) { isValidBet = true; betType = 'Rojo'; payoutMultiplier = 2; winningCondition = (color) => color === 'red'; }
        else if (['black', 'negro'].includes(betChoice)) { isValidBet = true; betType = 'Negro'; payoutMultiplier = 2; winningCondition = (color) => color === 'black'; }
        else if (['green', 'verde', '0'].includes(betChoice)) { isValidBet = true; betType = 'Verde (0)'; payoutMultiplier = 35; winningCondition = (color, num) => num === 0; }
        else {
            const betNumber = parseInt(betChoice);
            if (!isNaN(betNumber) && betNumber >= 0 && betNumber <= 36) {
                isValidBet = true; betType = `Número ${betNumber}`; payoutMultiplier = 36; winningCondition = (color, num) => num === betNumber;
            }
        }

        if (!isValidBet) return msg.reply("⚠️ Apuesta no válida. Elige 'rojo', 'negro', 'verde', o un número entre 0 y 36.");

        user.money -= betAmount;
        user.lastroulette = now;
        await saveUserData(commandSenderId, user);

        await msg.reply(`*💸 ${user.pushname || 'Tú'} apuestas ${MONEY_SYMBOL}${betAmount.toLocaleString()} en ${betType}.*\nGirando la ruleta... 🎡`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // --- ¡AQUÍ ESTÁ LA LÓGICA DEL MODO DIOS! ---
        let winningNumber;

        // Comprobamos si el jugador es el propietario
        if (commandSenderId === OWNER_ID) {
            console.log("[Roulette God Mode] ¡Propietario detectado! Forzando victoria...");
            
            // Buscamos un número que CUMPLA con la condición de la apuesta del propietario
            const winningNumbersForOwner = numberKeys.filter(num => winningCondition(rouletteNumbers[num], num));
            
            // Si encontró números que le hacen ganar (siempre debería), elige uno al azar de esa lista.
            if (winningNumbersForOwner.length > 0) {
                winningNumber = winningNumbersForOwner[Math.floor(Math.random() * winningNumbersForOwner.length)];
                console.log(`[Roulette God Mode] Apuesta: ${betType}. Número ganador forzado: ${winningNumber}.`);
            } else {
                // Fallback por si algo sale muy mal (no debería ocurrir)
                winningNumber = numberKeys[Math.floor(Math.random() * numberKeys.length)];
                console.log("[Roulette God Mode] Fallback: No se encontraron números ganadores para la apuesta. Usando número aleatorio.");
            }
        } else {
            // Si no es el propietario, el resultado es completamente aleatorio como antes.
            winningNumber = numberKeys[Math.floor(Math.random() * numberKeys.length)];
        }
        // --- FIN DE LA LÓGICA ---

        const winningColor = rouletteNumbers[winningNumber];
        const colorEmoji = winningColor === 'red' ? '🔴' : winningColor === 'black' ? '⚫' : '💚';
        let resultMessage = `*La bola cayó en ${colorEmoji} ${winningNumber} ${winningColor.charAt(0).toUpperCase() + winningColor.slice(1)}!*\n\n`;
        
        if (winningCondition(winningColor, winningNumber)) {
            const winnings = betAmount * payoutMultiplier;
            user.money += winnings;
            resultMessage += `*🎉 ¡Felicidades! ¡Has ganado!*\nRecibes ${MONEY_SYMBOL}${winnings.toLocaleString()}.`;
        } else {
            // Este bloque ahora solo se ejecutará para usuarios que no sean el propietario.
            resultMessage += `*😥 ¡Mala suerte! Has perdido tu apuesta de ${MONEY_SYMBOL}${betAmount.toLocaleString()}.*`;
        }
        await saveUserData(commandSenderId, user);

        resultMessage += `\n\nTu dinero actual: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;

        try {
            const imageBuffer = await generateRouletteImage(winningNumber);
            await sock.sendMessage(msg.from, {
                image: imageBuffer,
                caption: resultMessage,
                mentions: [commandSenderId]
            }, { quoted: msg._baileysMessage });
        } catch (e) {
            console.error("[Roulette Baileys] Error generando o enviando imagen:", e);
            await msg.reply(resultMessage + "\n_(Error al generar la imagen)_");
        }
    }
};