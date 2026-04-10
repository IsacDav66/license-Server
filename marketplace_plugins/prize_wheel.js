// plugins/prize_wheel.js (Versión con MP4s para simular GIFs)

const path = require('path');
const fs = require('fs');
const { getUserData, saveUserData, msToTime, pickRandom, findUserName } = require('../shared-economy');

const MONEY_SYMBOL = '$';
const COOLDOWN_SPIN_MS = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
// --- ASSETS ---
// Ruta base donde guardarás tus archivos MP4 de resultados.
// Ejemplo: assets/prize_wheel/spin_nada.mp4, assets/prize_wheel/spin_1.mp4, etc.
const PRIZE_WHEEL_ASSET_DIR = path.join(__dirname, '..','..', 'assets', 'prize_wheel'); // Cambiado el nombre de la constante para mayor claridad

// Opcional: Si quieres un MP4 general de la rueda girando ANTES del resultado.
// Asegúrate de que este archivo exista si lo quieres usar.
const GENERIC_SPINNING_VIDEO_PATH = path.join(PRIZE_WHEEL_ASSET_DIR, 'spinning_animation.mp4'); // Extension .mp4


// --- Premios y sus pesos (para probabilidades) ---
// La propiedad 'gifSuffix' debe coincidir EXACTAMENTE con el sufijo en tus nombres de archivo MP4.
// 'prizeValue' es la cantidad de dinero que el usuario realmente gana.
const PRIZE_WEIGHTS = [
    { prizeValue: 0, gifSuffix: 'nada', text: 'NADA', weight: 30 },
    { prizeValue: 1, gifSuffix: '1', text: '$1', weight: 20 },      // Para spin_1.mp4
    { prizeValue: 1, gifSuffix: '1.0', text: '$1', weight: 5 },     // Para spin_1.0.mp4 (el otro de $1)
    { prizeValue: 200, gifSuffix: '200', text: '$200', weight: 15 }, // Para spin_200.mp4 (asumiendo corrección a spin_200.mp4)
    { prizeValue: 5000, gifSuffix: '5k', text: '$5,000', weight: 10 },
    { prizeValue: 10, gifSuffix: '10', text: '$10', weight: 7 },
    { prizeValue: 50000, gifSuffix: '50k', text: '$50,000', weight: 5 },
    { prizeValue: 100000, gifSuffix: '100k', text: '$100,000', weight: 3 }
];

// Genera una lista ponderada de SUFIJOS de GIF (ahora MP4) para facilitar la selección aleatoria
const weightedGifSuffixList = [];
PRIZE_WEIGHTS.forEach(item => {
    for (let i = 0; i < item.weight; i++) {
        weightedGifSuffixList.push(item.gifSuffix);
    }
});

// Función para obtener un sufijo de archivo ganador aleatorio
function getRandomWinningGifSuffix() {
    return pickRandom(weightedGifSuffixList);
}

// Función para obtener los datos completos del premio a partir de su sufijo
function getPrizeDataBySuffix(gifSuffix) {
    return PRIZE_WEIGHTS.find(item => item.gifSuffix === gifSuffix);
}

// --- ESTRUCTURA DEL PLUGIN PARA BAILEYS ---
module.exports = {
    name: 'Ruleta de Premios',
    aliases: ['spin', 'girar', 'ruedapremios'],
    description: 'Gira la ruleta de premios y gana dinero.',
    category: 'Juegos',
    groupOnly: false,
    marketplace: {
        requirements: ["Carpeta assets/prize_wheel","Base de Datos PostgreSQL"],
        tebex_id: 7383033,
        price: "8.00",
        icon: "fa-dharmachakra",
        preview: {
            suggestions: ["!spin", "!girar"],
            responses: {
                "!spin": {
                    text: "🎡 Girando la ruleta de premios...\n\n*🎉 ¡FELICIDADES! ¡Has ganado $5,000!*",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775767506170.webp"
                },
                "!girar": {
                    text: "🎡 Girando la ruleta de premios...\n\n*🎉 ¡FELICIDADES! ¡Has ganado $5,000!*",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775767506170.webp"
                }
            }
        }
    },

    async execute(sock, msg, args) {
        const commandSenderId =msg.senderLid || msg.author;
        const user = await getUserData(commandSenderId, msg);
        const userNameToMention = user?.pushname || await findUserName(commandSenderId) || commandSenderId.split('@')[0];
        
        // Bloque de Verificación de Registro (sin cambios)
        if (!user || !user.password) {
            if (!user.phoneNumber) {
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(commandSenderId, user);
                const prefix = msg.body.charAt(0);
                const replyText = `👋 ¡Hola, @${userNameToMention}!\n\nPara usar la ruleta de premios, necesitas registrarte. Por favor, responde en este chat con:\n*${prefix}mifono +TuNumeroCompleto*`;
                return sock.sendMessage(msg.from, { text: replyText, mentions: [commandSenderId] }, { quoted: msg._baileysMessage });
            } else {
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(commandSenderId, user);
                const replyText = `🛡️ ¡Hola, @${userNameToMention}!\n\nYa tenemos tu número (+${user.phoneNumber}). Te he enviado un DM a ese número para que configures tu contraseña. ¡Revísalo!`;
                await sock.sendMessage(msg.from, { text: replyText, mentions: [commandSenderId] }, { quoted: msg._baileysMessage });
                
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: "🔑 Responde a este mensaje con la contraseña que deseas para los comandos de economía." });
                } catch (dmError) {
                    console.error(`[Prize Wheel Baileys] Error enviando DM a ${dmJid}:`, dmError);
                    await msg.reply("⚠️ No pude enviarte el DM. Asegúrate de que tu número sea correcto y que puedas recibir mensajes del bot.");
                }
                return;
            }
        }
        // Fin Bloque de Verificación de Registro

        const now = Date.now();
        if (now - (user.lastspin || 0) < COOLDOWN_SPIN_MS) {
            const timeLeft = COOLDOWN_SPIN_MS - (now - (user.lastspin || 0));
            return msg.reply(`*⏳ La ruleta está en cooldown. Espera ${msToTime(timeLeft)} antes de girar de nuevo.*`);
        }

        // --- Inicio del proceso de envío de video ---
        // 1. (Opcional) Envía un MP4 general de la rueda girando para anticipación
        let sentGenericSpinningVideo = false; // Cambiado el nombre de la variable
        try {
            if (fs.existsSync(GENERIC_SPINNING_VIDEO_PATH)) {
                const spinningVideoBuffer = fs.readFileSync(GENERIC_SPINNING_VIDEO_PATH); // Lee el MP4
                await sock.sendMessage(msg.from, { video: spinningVideoBuffer, gifPlayback: true }, { quoted: msg._baileysMessage });
                sentGenericSpinningVideo = true;
                await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa para que el video se reproduzca
            } else {
                await msg.reply('🎡 Girando la ruleta de premios...'); // Si no hay MP4 genérico, solo texto.
                await new Promise(resolve => setTimeout(resolve, 1500)); // Pequeña pausa
            }
        } catch (videoError) { // Cambiado el nombre de la variable
            console.error('[Prize Wheel] Error al enviar el MP4 de spinning genérico:', videoError.message);
            await msg.reply('🎡 Girando la ruleta de premios...'); // Fallback a texto
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // 2. Determina el sufijo del archivo ganador y luego el valor del premio
        const winningGifSuffix = getRandomWinningGifSuffix();
        const winningPrizeData = getPrizeDataBySuffix(winningGifSuffix);

        if (!winningPrizeData) {
            console.error(`[Prize Wheel] Error crítico: No se encontró la data para el sufijo de archivo '${winningGifSuffix}'`);
            await msg.reply('❌ Ocurrió un error interno al determinar el premio.');
            return;
        }

        const winningPrizeValue = winningPrizeData.prizeValue;
        const winningPrizeText = winningPrizeData.text;

        user.lastspin = now;
        if (winningPrizeValue > 0) {
            user.money += winningPrizeValue;
        }
        await saveUserData(commandSenderId, user);

        let resultMessage = '';
        if (winningPrizeValue > 0) {
            resultMessage = `*🎉 ¡FELICIDADES, ${userNameToMention}! Has ganado ${MONEY_SYMBOL}${winningPrizeText}!*`;
        } else {
            resultMessage = `*😥 ¡Mala suerte, ${userNameToMention}! Has caído en ${winningPrizeText}. Inténtalo de nuevo la próxima vez.*`;
        }
        resultMessage += `\n\nTu dinero actual: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;

        // 3. Envía el MP4 específico del resultado
        const resultVideoFileName = `spin_${winningGifSuffix}.mp4`; // Extension .mp4
        const resultVideoPath = path.join(PRIZE_WHEEL_ASSET_DIR, resultVideoFileName);

        try {
            if (fs.existsSync(resultVideoPath)) {
                const resultVideoBuffer = fs.readFileSync(resultVideoPath); // Lee el MP4
                await sock.sendMessage(msg.from, {
                    video: resultVideoBuffer,
                    gifPlayback: true, // Esto hace que se comporte como GIF en WhatsApp
                    caption: resultMessage,
                    mentions: [commandSenderId]
                }, { quoted: msg._baileysMessage });
            } else {
                console.error(`[Prize Wheel] ERROR: Video de resultado no encontrado: ${resultVideoPath}. Asegúrate de que el nombre del archivo y la extensión sean correctos.`);
                await msg.reply(resultMessage + "\n_(Error al cargar la animación del resultado. ¡Asegúrate de que el MP4 exista y el nombre sea correcto!)_");
            }
        } catch (e) {
            console.error("[Prize Wheel Baileys] Error enviando video de resultado:", e);
            await msg.reply(resultMessage + "\n_(Error al enviar la animación del resultado)_");
        }
    }
};