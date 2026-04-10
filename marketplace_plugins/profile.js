// plugins/profile.js (Versión Final y Completa - Corregido Detección de Objetivo)

const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { getUserData, pool } = require('../shared-economy');

// --- Importar jidDecode de Baileys (Asumiendo @whiskeysockets/baileys) ---
const { jidDecode } = require('@whiskeysockets/baileys'); 

// --- CONFIGURACIÓN ---
// Le decimos a fluent-ffmpeg que use el paquete que instalamos
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// URL base de tu sitio web desde donde se servirán las imágenes
const WEB_URL_BASE = 'https://davcenter.servequake.com';
// Directorio para archivos temporales
const TEMP_DIR = path.join(__dirname, '..', 'temp');

const MONEY_SYMBOL = '💰';
const EXP_SYMBOL = '⭐';

// --- REGISTRO DE FUENTE ---
// Asegúrate de tener /assets/fonts/Roboto-Bold.ttf en tu proyecto
try {
    const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Bold.ttf');
    registerFont(fontPath, { family: 'Roboto' });
} catch (e) {
    console.warn('[Profile Plugin] No se pudo registrar la fuente. Se usará la fuente por defecto del sistema.');
}


// --- FUNCIONES AUXILIARES ---

/**
 * Procesa y carga una imagen desde una URL.
 * Descarga el archivo, lo convierte a PNG si es WebP, y devuelve un objeto de imagen de Canvas.
 * @param {string} imageUrlPath - La ruta relativa de la imagen (ej. /socianark/uploads/...).
 * @returns {Promise<import('canvas').Image|null>} - Un objeto de imagen de Canvas o null si falla.
 */
async function processAndLoadImage(imageUrlPath) {
    if (!imageUrlPath) return null;

    const imageUrl = `${WEB_URL_BASE}${imageUrlPath}`;
    const uniqueId = uuidv4();
    const tempInputPath = path.join(TEMP_DIR, `${uniqueId}.webp`);
    const tempOutputPath = path.join(TEMP_DIR, `${uniqueId}.png`);
    let image = null;

    try {
        await fs.mkdir(TEMP_DIR, { recursive: true }); // Asegurarse de que el directorio exista

        // 1. Descargar la imagen simulando ser un navegador
        const axiosConfig = {
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' }
        };
        const response = await axios.get(imageUrl, axiosConfig);
        const writer = require('fs').createWriteStream(tempInputPath);
        await new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error = null;
            writer.on('error', err => { error = err; writer.close(); reject(err); });
            writer.on('close', () => { if (!error) resolve(true); });
        });

        // 2. Convertir de WebP a PNG usando FFmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(tempInputPath)
                .save(tempOutputPath)
                .on('end', resolve)
                .on('error', (err) => reject(new Error(`FFmpeg falló al convertir: ${err.message}`)));
        });

        // 3. Cargar la imagen PNG convertida
        image = await loadImage(tempOutputPath);
        
    } catch (error) {
        console.error(`[Profile Image Processor] Fallo al procesar ${imageUrl}:`, error.message);
    } finally {
        // 4. Limpieza garantizada de AMBOS archivos temporales
        try { await fs.unlink(tempInputPath); } catch (e) {}
        try { await fs.unlink(tempOutputPath); } catch (e) {}
    }

    return image;
}

function drawTextWithShadow(ctx, text, x, y, font, color, shadowColor) {
    ctx.font = font;
    ctx.fillStyle = shadowColor;
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function drawImageInCircle(ctx, image, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    const aspect = image.height / image.width;
    let newWidth, newHeight;
    if (image.width > image.height) {
        newHeight = radius * 2;
        newWidth = newHeight / aspect;
    } else {
        newWidth = radius * 2;
        newHeight = newWidth * aspect;
    }
    const imgX = x - newWidth / 2;
    const imgY = y - newHeight / 2;
    ctx.drawImage(image, imgX, imgY, newWidth, newHeight);
    ctx.restore();
}

async function generateProfileImage(userData, socialData) {
    const canvasWidth = 800;
    const canvasHeight = 450;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // 1. FONDO BASE Y PORTADA
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const coverImage = await processAndLoadImage(userData.coverPhotoPath);
    if (coverImage) {
        const hRatio = canvasWidth / coverImage.width;
        const vRatio = canvasHeight / coverImage.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvasWidth - coverImage.width * ratio) / 2;
        const centerShift_y = (canvasHeight - coverImage.height * ratio) / 2;
        ctx.drawImage(coverImage, 0, 0, coverImage.width, coverImage.height, centerShift_x, centerShift_y, coverImage.width * ratio, coverImage.height * ratio);
    }

    // 2. SUPERPOSICIÓN OSCURA (para legibilidad)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 3. FOTO DE PERFIL Y BORDE
    const pfpRadius = 75;
    const pfpX = canvasWidth / 2;
    const pfpY = 140;
    const profileImage = await processAndLoadImage(userData.profilePhotoPath);
    if (profileImage) {
        drawImageInCircle(ctx, profileImage, pfpX, pfpY, pfpRadius);
    }
    ctx.beginPath();
    ctx.arc(pfpX, pfpY, pfpRadius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.stroke();

    // 4. TEXTOS (la capa final)
    ctx.textAlign = 'center';
    drawTextWithShadow(ctx, userData.pushname || 'Usuario', pfpX, pfpY + pfpRadius + 45, 'bold 40px Roboto', 'white', '#000000');
    // 4. DIBUJAR ESTADÍSTICAS
    const statsY = canvasHeight - 60;
    
    // Calculamos el dinero total sumando el de la mano y el del banco.
    // Usamos `|| 0` como medida de seguridad por si algún valor fuera nulo.
    const totalMoney = (userData.money || 0) + (userData.bank || 0);

    const statColumns = [
        { label: 'SEGUIDORES', value: socialData.followers.toLocaleString() },
        { label: 'SIGUIENDO', value: socialData.following.toLocaleString() },
        { label: `${MONEY_SYMBOL} DINERO`, value: totalMoney.toLocaleString() },
        { label: `${EXP_SYMBOL} EXPERIENCIA`, value: userData.exp.toLocaleString() },
    ];
    statColumns.forEach((stat, index) => {
        const x = (canvasWidth / statColumns.length) * (index + 0.5);
        drawTextWithShadow(ctx, stat.value, x, statsY, 'bold 32px Roboto', 'white', '#000000');
        drawTextWithShadow(ctx, stat.label, x, statsY + 30, '20px Roboto', '#cccccc', '#000000');
    });

    return canvas.toBuffer('image/png');
}


// --- ESTRUCTURA DEL PLUGIN PARA BAILEYS ---
module.exports = {
    name: 'Perfil',
    aliases: ['profile', 'perfil', 'me'],
    description: 'Muestra tu perfil o el de otro usuario (mencionando o respondiendo).',
    category: 'Economía',
    marketplace: {
        requirements: ["FFmpeg instalado","Fuente Roboto-Bold.ttf"],
        tebex_id: 7383043,
        price: "15.00",
        icon: "fa-address-card",
        preview: {
            suggestions: ["!perfil", "!perfil @Usuario"],
            responses: {
                "!perfil": {
                    text: "🎨 *Generando tu perfil personalizado...*",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775769931513.webp" // Simulación de la tarjeta canvas
                },
                "!perfil @Usuario": {
                    text: "🎨 *Generando perfil de @Usuario...*",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775769931513.webp"
                }
            }
        }
    },

    async execute(sock, msg, args, commandName, finalUserIdFromMain = null) { // Acepta finalUserIdFromMain
        try {
            await msg.reply('🎨 Generando perfil, por favor espera...');

            // --- LÓGICA REVISADA PARA DETERMINAR EL OBJETIVO (priorizando LID) ---
            let targetId;
            let targetJidForDisplay; // Para usar el JID original para el display si se resuelve LID

            const mentionedJids = msg.mentionedJidList || [];
            const originalMsg = msg._baileysMessage;
            const quotedParticipantJid = originalMsg.message?.extendedTextMessage?.contextInfo?.participant;

            // Obtener la metadata del grupo si es un chat de grupo
            const chat = await msg.getChat();
            const isGroup = chat.isGroup;
            const groupParticipants = chat.groupMetadata?.participants || [];

            if (mentionedJids.length > 0) {
                // Prioridad 1: Se mencionó a alguien en el comando.
                const rawMentionedJid = mentionedJids[0];
                targetJidForDisplay = rawMentionedJid; // Guardamos el JID original para mostrar

                if (isGroup) {
                    // Intentamos encontrar el LID del participante mencionado
                    const mentionedParticipant = groupParticipants.find(p => p.id === rawMentionedJid);
                    targetId = (mentionedParticipant && mentionedParticipant.lid) ? mentionedParticipant.lid : rawMentionedJid;
                    console.log(`[Profile Plugin] Objetivo por mención: ${targetId.split('@')[0]} (LID/JID)`);
                } else {
                    targetId = rawMentionedJid; // Si no es grupo, usamos el JID directamente
                    console.log(`[Profile Plugin] Objetivo por mención (Privado): ${targetId.split('@')[0]}`);
                }
            } else if (quotedParticipantJid) {
                // Prioridad 2: El comando es una respuesta a un mensaje.
                targetJidForDisplay = quotedParticipantJid; // Guardamos el JID original para mostrar

                if (isGroup) {
                    // Intentamos encontrar el LID del participante citado
                    const quotedParticipant = groupParticipants.find(p => p.id === quotedParticipantJid);
                    targetId = (quotedParticipant && quotedParticipant.lid) ? quotedParticipant.lid : quotedParticipantJid;
                    console.log(`[Profile Plugin] Objetivo por respuesta: ${targetId.split('@')[0]} (LID/JID)`);
                } else {
                    targetId = quotedParticipantJid; // Si no es grupo, usamos el JID directamente
                    console.log(`[Profile Plugin] Objetivo por respuesta (Privado): ${targetId.split('@')[0]}`);
                }
            } else {
                // Prioridad 3 (Default): El objetivo es el autor del comando.
                targetId = finalUserIdFromMain; // Usa el ID ya resuelto (LID o JID) del main
                targetJidForDisplay = msg.author; // Guarda el JID original del autor para mención
                console.log(`[Profile Plugin] Objetivo por autor del comando: ${targetId.split('@')[0]} (LID/JID)`);
            }
            // --- FIN DE LA LÓGICA DE OBJETIVO ---

            // 1. Obtener datos básicos del objetivo
            // No pasamos `msg` aquí, porque `msg` es del autor del comando, no del target.
            // La actualización del pushname del target ocurrirá cuando el propio target interactúe.
            const userData = await getUserData(targetId, null); 
            if (!userData || !userData.password) {
                // Para determinar si el mensaje de "no registrado" es para uno mismo o para otro.
                const isSelf = (targetId === finalUserIdFromMain || targetId === msg.author); // Compara con ambos posibles IDs del autor
                const replyText = isSelf 
                    ? '🔒 Debes estar registrado para ver tu perfil. Usa `.work` para iniciar.'
                    : '🔒 Este usuario no está registrado y no tiene un perfil para mostrar.';
                return msg.reply(replyText);
            }

            // 2. Obtener datos sociales (seguidores/siguiendo) del objetivo
            let socialData = { followers: 0, following: 0 };
            try {
                const followersQuery = 'SELECT COUNT(*) FROM followers WHERE "followingId" = $1';
                const followingQuery = 'SELECT COUNT(*) FROM followers WHERE "followerId" = $1';
                
                const [followersRes, followingRes] = await Promise.all([
                    pool.query(followersQuery, [targetId]),
                    pool.query(followingQuery, [targetId])
                ]);
                
                socialData.followers = parseInt(followersRes.rows[0].count, 10);
                socialData.following = parseInt(followingRes.rows[0].count, 10);
            } catch (dbError) {
                console.error('[Profile Plugin] Error al consultar datos de seguidores:', dbError);
            }
            
            // 3. Generar la imagen del perfil
            const imageBuffer = await generateProfileImage(userData, socialData);
            
            // 4. Enviar la imagen
            await sock.sendMessage(msg.from, {
                image: imageBuffer,
                // Mencionamos el JID original del objetivo para que la mención sea correcta en WhatsApp.
                mentions: [targetJidForDisplay] 
            }, { quoted: msg._baileysMessage });

        } catch (error) {
            console.error('[Profile Plugin] Error en la ejecución del comando:', error);
            await msg.reply('❌ Hubo un error inesperado al generar el perfil.');
        }
    }
};