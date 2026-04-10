// plugins/logro.js (Versión Final con node-canvas para todo el dibujo, incluyendo texto)

const axios = require('axios');
const { createCanvas, loadImage, registerFont } = require('canvas'); // <-- ¡AÑADIDO registerFont!
const path = require('path');
const fs = require('fs');
const { jidDecode } = require('@whiskeysockets/baileys');
// const { execFile } = require('child_process'); // <-- ¡COMENTADO/ELIMINADO!
// const { promisify } = require('util'); // <-- ¡COMENTADO/ELIMINADO!
const { getUserData } = require('../shared-economy.js');
const { findUserName } = require('../shared-economy.js');

// Cargar las variables de entorno si no se han cargado ya
require('dotenv').config();

// const execFileAsync = promisify(execFile); // <-- ¡COMENTADO/ELIMINADO!

// --- RUTAS Y CONFIGURACIÓN ---
const ASSETS_PATH = path.join(__dirname, '..', '..', 'assets', 'logro');
const BACKGROUND_PATH = path.join(ASSETS_PATH, 'achievement_background.png');
const FONT_PATH = path.join(ASSETS_PATH, 'Minecraftia.ttf'); // Asegúrate de que la 'M' es mayúscula y la ruta correcta
const ICON_PATH = path.join(ASSETS_PATH, 'crafting_table.png');
const DEFAULT_AVATAR_PATH = path.join(__dirname, '..','..', 'assets', 'chatfalse', 'default_avatar.png');

// --- REGISTRAR LA FUENTE CON NODE-CANVAS AL INICIO DEL SCRIPT ---
// Esto se ejecuta una sola vez cuando el plugin es cargado.
try {
    registerFont(FONT_PATH, { family: 'Minecraftia' });
    console.log('[Logro Plugin] Fuente Minecraftia.ttf registrada con node-canvas.');
} catch (fontRegisterError) {
    console.error('[Logro Plugin] Error CRÍTICO al registrar la fuente con node-canvas:', fontRegisterError.message);
    // Si la fuente no se registra aquí, el texto no aparecerá con la fuente correcta.
}


// --- Cargar JIDs Inmunes desde .env ---
const IMMUNE_JIDS = process.env.IMMUNE_JIDS ? process.env.IMMUNE_JIDS.split(',').map(jid => jid.trim()) : [];
console.log(`[Logro Plugin] JIDs Inmunes cargados (no pueden ser objetivo): ${IMMUNE_JIDS.length > 0 ? IMMUNE_JIDS.join(', ') : 'Ninguno'}`);

// --- FUNCIÓN DE UTILIDAD PARA TEXTO ADAPTATIVO (SIN CAMBIOS) ---
/**
 * Calcula un tamaño de fuente adaptativo basado en la longitud del texto.
 * @param {string} text El texto a medir.
 * @param {number} baseSize El tamaño de fuente inicial deseado.
 * @param {number} minSize El tamaño de fuente mínimo permitido.
 * @param {number} maxChars El número máximo de caracteres antes de empezar a reducir la fuente.
 * @returns {number} El tamaño de fuente adaptativo.
 */
function getAdaptivePointSize(text, baseSize, minSize, maxChars) {
    if (text.length <= maxChars) {
        return baseSize;
    }
    const actualTextLength = Math.max(text.length, 1);
    const scaleFactor = maxChars / actualTextLength;
    return Math.max(minSize, Math.floor(baseSize * scaleFactor));
}

module.exports = {
    name: 'Logro de Minecraft',
    aliases: ['logro', 'achievement'],
    description: 'Crea una imagen de "Logro Desbloqueado" de Minecraft.',
    category: 'Diversión',
    marketplace: {
        requirements: ["Fuente Minecraftia.ttf","Assets en assets/logro"],
        tebex_id: 7383065,
        price: "7.00",
        icon: "fa-cube",
        preview: {
            suggestions: ["!logro Matar al Dragon", "!achievement Bot Pro"],
            responses: {
                "!logro Matar al Dragon": {
                    text: "¡Felicidades por tu nuevo logro! 🏆",
                    image: "https://i.ibb.co/V3Yx8X8/achievement-preview.png"
                },
                "!achievement Bot Pro": {
                    text: "¡Felicidades por tu nuevo logro! 🏆",
                    image: "https://i.ibb.co/V3Yx8X8/achievement-preview.png"
                }
            }
        }
    },


    async execute(sock, msg, args) {
        // tempImagePath ya no se usa, ya que no usamos ImageMagick
        // let tempImagePath = ''; 
        try {
            const baileysMsg = msg._baileysMessage;
            const allMentionedJids = baileysMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            let targetJid;
            let textArgs = [...args];

            if (allMentionedJids.length > 0) {
                targetJid = allMentionedJids[0];
                textArgs = args.filter(arg => !arg.startsWith('@') || !allMentionedJids.some(jid => arg.includes(jid.split('@')[0])));
            } else {
                targetJid =msg.senderLid || msg.author;
            }

            // --- VERIFICACIÓN DE USUARIO INMUNE COMO OBJETIVO ---
            if (IMMUNE_JIDS.includes(targetJid)) {
                console.log(`[Logro Plugin] Intento de crear logro para JID inmune (${targetJid}) bloqueado por ${msg.author}`);
                const targetDisplayNameData = await getUserData(targetJid);
                const nameToShowInImmuneMsg = targetDisplayNameData?.pushname || await findUserName(targetJid) || jidDecode(targetJid)?.user || 'ese usuario';
                return msg.reply(`🛡️ No se puede crear un logro para ${nameToShowInImmuneMsg}. ¡Está protegido/a!`);
            }

            const achievementText = textArgs.join(' ');
            if (!achievementText) {
                return msg.reply('⛏️ Escribe el texto para el logro.');
            }
            await msg.reply('🛠️ Crafteando tu logro...');

            let avatarBuffer;
            try {
                const pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
                avatarBuffer = (await axios.get(pfpUrl, { responseType: 'arraybuffer' })).data;
            } catch {
                avatarBuffer = fs.readFileSync(DEFAULT_AVATAR_PATH);
            }
            
            let displayName;
            const userData = await getUserData(targetJid);
            if (userData?.pushname) {
                displayName = userData.pushname;
            } else {
                displayName = await findUserName(targetJid) || jidDecode(targetJid)?.user || 'Aventurero';
            }
            
            let backgroundImg, iconImg, avatarImg;
            try {
                backgroundImg = await loadImage(BACKGROUND_PATH);
                iconImg = await loadImage(ICON_PATH);
                avatarImg = await loadImage(avatarBuffer);
                if (!backgroundImg || !iconImg || !avatarImg) {
                    throw new Error("Una de las imágenes base no se pudo cargar.");
                }
            } catch (loadError) {
                console.error("[Logro Plugin] Error al cargar las imágenes en canvas:", loadError);
                throw new Error("No se pudieron cargar los recursos para dibujar la imagen.");
            }

            const canvas = createCanvas(640, 128);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;

            // Dibuja el fondo, avatar e icono primero
            ctx.drawImage(backgroundImg, 0, 0, 640, 128);
            ctx.drawImage(avatarImg, 40, (128 - 80) / 2, 80, 80);
            ctx.drawImage(iconImg, 140 - 2, 55 - 30, 32, 32);

            // --- "HORNEAR" TEXTO COMPLETAMENTE CON NODE-CANVAS ---
            const title = `¡Logro Desbloqueado de ${displayName}!`;
            const bottomDisplayName = displayName;

            // CÁLCULO DE TAMAÑOS DE FUENTE ADAPTATIVOS
            const BASE_TITLE_POINTSIZE = 23;
            const MIN_TITLE_POINTSIZE = 16;
            const MAX_TITLE_CHARS = 30;
            const adaptiveTitlePointSize = getAdaptivePointSize(title, BASE_TITLE_POINTSIZE, MIN_TITLE_POINTSIZE, MAX_TITLE_CHARS);
            // Ajuste para la línea base del texto en Canvas (Y = línea base)
            const titleY = 50 + (BASE_TITLE_POINTSIZE - adaptiveTitlePointSize) / 2 + (adaptiveTitlePointSize * 0.75);

            const BASE_ACHIEVEMENT_POINTSIZE = 26;
            const MIN_ACHIEVEMENT_POINTSIZE = 12;
            const MAX_ACHIEVEMENT_CHARS = 35;
            const adaptiveAchievementPointSize = getAdaptivePointSize(achievementText, BASE_ACHIEVEMENT_POINTSIZE, MIN_ACHIEVEMENT_POINTSIZE, MAX_ACHIEVEMENT_CHARS);
            const achievementY = 100 + (BASE_ACHIEVEMENT_POINTSIZE - adaptiveAchievementPointSize) / 2 + (adaptiveAchievementPointSize * 0.75);

            const BOTTOM_DISPLAY_POINTSIZE = 20;
            const bottomDisplayNameY = 105 + (BOTTOM_DISPLAY_POINTSIZE * 0.75);


            // Dibujar Título
            ctx.font = `${adaptiveTitlePointSize}px Minecraftia`; // Usar el nombre de familia registrado
            ctx.fillStyle = 'yellow';
            ctx.textAlign = 'left';
            ctx.fillText(title, 180, titleY);

            // Dibujar Texto del Logro
            ctx.font = `${adaptiveAchievementPointSize}px Minecraftia`; // Usar el nombre de familia registrado
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.fillText(achievementText, 140, achievementY);

            
            // --- FIN DEL DIBUJO CON NODE-CANVAS ---


            const finalImageBuffer = canvas.toBuffer('image/png');
            if (!finalImageBuffer || finalImageBuffer.length === 0) {
                throw new Error("El canvas generó un buffer vacío después de dibujar el texto.");
            }
            
            await sock.sendMessage(msg.from, {
                image: finalImageBuffer,
                caption: `¡Felicidades, ${displayName}, por tu nuevo logro! 🏆`
            }, { quoted: msg._baileysMessage });

        } catch (error) {
            console.error('[Logro Plugin] Error:', error);
            // Ya no hay stderr de ImageMagick, solo errores de Node.js o Canvas
            await msg.reply('❌ Ocurrió un error al craftear la imagen.');
        } finally {
            // Ya no hay tempImagePath que eliminar si no usamos ImageMagick
        }
    }
};