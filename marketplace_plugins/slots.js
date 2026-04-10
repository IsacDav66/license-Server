// plugins/slots.js (Versión Final Optimizada con PNGs Pre-cargados)

const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { getUserData, saveUserData, msToTime } = require('../shared-economy');

// --- CONFIGURACIÓN ---
const MONEY_SYMBOL = '$';
const COOLDOWN_SLOTS_MS = 30 * 1000; // 30 segundos
const NUM_REELS = 3;
const SYMBOLS_VISIBLE_PER_REEL = 3;

// --- Configuración de Símbolos apuntando a archivos .PNG ---
const slotSymbolsConfig = [
    { id: 'cherry', image: 'cherry.png', payout: { 2: 3, 3: 10 }, weight: 15 },
    { id: 'lemon', image: 'lemon.png', payout: { 3: 15 }, weight: 12 },
    { id: 'orange', image: 'orange.png', payout: { 3: 15 }, weight: 12 },
    { id: 'plum', image: 'plum.png', payout: { 3: 20 }, weight: 10 },
    { id: 'watermelon', image: 'watermelon.png', payout: { 3: 25 }, weight: 8 },
    { id: 'bell', image: 'bell.png', payout: { 3: 50 }, weight: 6 },
    { id: 'star', image: 'star.png', payout: { 3: 75 }, weight: 4 },
    { id: 'diamond', image: 'diamond.png', payout: { 3: 100 }, weight: 3 },
    { id: 'seven', image: 'seven.png', payout: { 3: 250 }, weight: 2 }
];
const ASSETS_SLOTS_PATH = path.join(__dirname, '..', '..','assets', 'slots');
const loadedImages = new Map();

// --- CARGA RÁPIDA DE PNGS (Se ejecuta una sola vez al iniciar el bot) ---
// Este proceso es muy rápido y no debería causar problemas de arranque.
(async () => {
    console.log('[Slots Plugin] Pre-cargando imágenes de símbolos PNG...');
    for (const symbol of slotSymbolsConfig) {
        try {
            const imagePath = path.join(ASSETS_SLOTS_PATH, symbol.image);
            const loadedImage = await loadImage(imagePath);
            loadedImages.set(symbol.id, loadedImage);
        } catch (e) {
            console.error(`[Slots Plugin] ERROR: No se pudo cargar la imagen '${symbol.image}'. Asegúrate de que el archivo exista en la carpeta 'assets/slots'.`);
        }
    }
    console.log(`[Slots Plugin] ${loadedImages.size} de ${slotSymbolsConfig.length} imágenes cargadas.`);
})();


const weightedSymbolIds = [];
slotSymbolsConfig.forEach(s => {
    for (let i = 0; i < s.weight; i++) weightedSymbolIds.push(s.id);
});


// --- FUNCIONES DE LÓGICA DEL JUEGO (sin cambios) ---

async function generateSlotsImage(reelsResultSymbols) {
    const symbolSize = 80;
    const reelPaddingVertical = 15;
    const symbolVisibleHeight = symbolSize + (reelPaddingVertical * 2);
    const reelWidth = symbolSize + 40;
    const spacingBetweenReels = 15;
    const canvasPaddingHorizontal = 20;
    const canvasPaddingVertical = 20;
    const canvasWidth = (reelWidth * NUM_REELS) + (spacingBetweenReels * (NUM_REELS - 1)) + (canvasPaddingHorizontal * 2);
    const canvasHeight = (symbolVisibleHeight * SYMBOLS_VISIBLE_PER_REEL) + (canvasPaddingVertical * 2);
    
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = '#777777';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvasWidth - 8, canvasHeight - 8);

    for (let i = 0; i < NUM_REELS; i++) {
        const reelSymbolsData = reelsResultSymbols[i];
        const currentReelXStart = canvasPaddingHorizontal + i * (reelWidth + spacingBetweenReels);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(currentReelXStart, canvasPaddingVertical, reelWidth, symbolVisibleHeight * SYMBOLS_VISIBLE_PER_REEL);
        
        for (let j = 0; j < SYMBOLS_VISIBLE_PER_REEL; j++) {
            const symbolData = reelSymbolsData[j];
            const symbolImage = loadedImages.get(symbolData.id);

            if (symbolImage) {
                const symbolX = currentReelXStart + (reelWidth / 2) - (symbolSize / 2);
                const symbolY = canvasPaddingVertical + (j * symbolVisibleHeight) + reelPaddingVertical;
                ctx.drawImage(symbolImage, symbolX, symbolY, symbolSize, symbolSize);
            }
        }
    }

    const paylineY = canvasPaddingVertical + (Math.floor(SYMBOLS_VISIBLE_PER_REEL / 2) * symbolVisibleHeight) + symbolVisibleHeight / 2;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(canvasPaddingHorizontal / 2, paylineY);
    ctx.lineTo(canvasWidth - (canvasPaddingHorizontal / 2), paylineY);
    ctx.stroke();

    return canvas.toBuffer('image/png');
}

function spinReels() {
    const reelsResultSymbols = [];
    const paylineResultIds = [];
    for (let i = 0; i < NUM_REELS; i++) {
        const currentReelSymbolsData = [];
        for (let j = 0; j < SYMBOLS_VISIBLE_PER_REEL; j++) {
            const randomSymbolId = weightedSymbolIds[Math.floor(Math.random() * weightedSymbolIds.length)];
            currentReelSymbolsData.push(slotSymbolsConfig.find(s => s.id === randomSymbolId));
        }
        reelsResultSymbols.push(currentReelSymbolsData);
        paylineResultIds.push(currentReelSymbolsData[Math.floor(SYMBOLS_VISIBLE_PER_REEL / 2)].id);
    }
    return { reelsResultSymbols, paylineResultIds };
}

function calculateWinnings(paylineIds, betAmount) {
    let multiplier = 0;
    let winDesc = "";
    const symbolConfig = slotSymbolsConfig.find(s => s.id === paylineIds[0]);

    if (paylineIds.every(id => id === paylineIds[0])) {
        if (symbolConfig?.payout['3']) {
            multiplier = symbolConfig.payout['3'];
            winDesc = `3 x ${symbolConfig.id}`;
        }
    } else if (paylineIds.filter(id => id === 'cherry').length === 2) {
        const cherryConfig = slotSymbolsConfig.find(s => s.id === 'cherry');
        multiplier = cherryConfig.payout['2'];
        winDesc = `2 x ${cherryConfig.id}`;
    }
    return { amount: betAmount * multiplier, description: winDesc };
}

// --- ESTRUCTURA DEL PLUGIN PARA BAILEYS ---
module.exports = {
    name: 'Tragamonedas',
    aliases: ['slots', 'slot', 'tragamonedas'],
    description: 'Juega al tragamonedas y prueba tu suerte.',
    category: 'Juegos',
    groupOnly: true,
    marketplace: {
        requirements: ["Carpeta assets/slots","Base de Datos PostgreSQL"],
        tebex_id: 7383035,
        price: "7.00",
        icon: "fa-icons",
        preview: {
            suggestions: ["!slots 200"],
            responses: {
                "!slots 200": {
                    text: "*🎉 ¡GANASTE $2,000! 🎉*\nCon 3 x Seven.\n\nTu dinero actual: $8,400",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775768168261.webp"
                }
            }
        }
    },

        async execute(sock, msg, args, commandName, finalUserIdFromMain = null) { // <--- AÑADIDO finalUserIdFromMain
                const user = await getUserData(finalUserIdFromMain, msg); // <--- USAR finalUserIdFromMain aquí

        // Bloque de Verificación de Registro
        if (!user || !user.password) {
                        const senderContactInfo = await msg.getContact(); // Obtener info del contacto del remitente
            const userNameToMention = user.pushname || senderContactInfo.pushname || msg.author.split('@')[0]; // Usar pushname del user, luego del contacto, luego JID

            if (!user.phoneNumber) {
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(finalUserIdFromMain, user); // <--- Usa finalUserIdFromMain
                const prefix = msg.body.charAt(0);
                const replyText = `👋 ¡Hola, @${userNameToMention}!\n\nPara jugar, necesitas registrarte. Por favor, responde con:\n*${prefix}mifono +TuNumeroCompleto*`;
                return sock.sendMessage(msg.from, { text: replyText, mentions: [msg.author] }, { quoted: msg._baileysMessage });
            } else {
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(finalUserIdFromMain, user); // <--- Usa finalUserIdFromMain
                const replyText = `🛡️ ¡Hola, @${userNameToMention}!\n\nYa tenemos tu número (+${user.phoneNumber}). Te envié un DM para que configures tu contraseña.`;
                await sock.sendMessage(msg.from, { text: replyText, mentions: [msg.author] }, { quoted: msg._baileysMessage });
                
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: "🔑 Responde con la contraseña que deseas para los comandos de economía." });
                } catch (dmError) {
                    await msg.reply("⚠️ No pude enviarte el DM. Asegúrate de que tu número sea correcto.");
                }
                return;
            }
        }

        const now = Date.now();
        if (now - (user.lastslots || 0) < COOLDOWN_SLOTS_MS) {
            const timeLeft = COOLDOWN_SLOTS_MS - (now - (user.lastslots || 0));
            return msg.reply(`*🎰 El tragamonedas está caliente. Espera ${msToTime(timeLeft)}.*`);
        }
        if (args.length < 1) {
            return msg.reply(`❓ Uso: \`.slots <cantidad>\``);
        }
        const betAmount = parseInt(args[0]);
        if (isNaN(betAmount) || betAmount <= 0) {
            return msg.reply("⚠️ Debes apostar una cantidad válida y positiva.");
        }
        if (user.money < betAmount) {
            return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para esa apuesta.`);
        }
        
        user.money -= betAmount;
        user.lastslots = now;
        await saveUserData(finalUserIdFromMain, user); 

        const { reelsResultSymbols, paylineResultIds } = spinReels();
        const { amount: winnings, description: winDesc } = calculateWinnings(paylineResultIds, betAmount);

        let resultMessage = "";
        if (winnings > 0) {
            user.money += winnings;
            resultMessage = `*🎉 ¡GANASTE ${MONEY_SYMBOL}${winnings.toLocaleString()}! 🎉*\nCon ${winDesc}.`;
        } else {
            resultMessage = `*😥 Suerte para la próxima...*`;
        }
        await saveUserData(finalUserIdFromMain, user);
        resultMessage += `\n\nTu dinero actual: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;

        try {
            // Comprobar si todas las imágenes necesarias están cargadas antes de intentar generar.
            if (loadedImages.size < slotSymbolsConfig.length) {
                console.error("[Slots Baileys] No todas las imágenes de símbolos se cargaron. Saltando la generación de imagen.");
                throw new Error("Faltan recursos de imagen.");
            }
            const imageBuffer = await generateSlotsImage(reelsResultSymbols);
            await sock.sendMessage(msg.from, {
                image: imageBuffer,
                caption: resultMessage,
                mentions: [msg.author]
            }, { quoted: msg._baileysMessage });
        } catch (e) {
            console.error("[Slots Baileys] Error generando o enviando imagen:", e);
            await msg.reply(resultMessage + "\n_(Error al generar la imagen)_");
        }
    }
};