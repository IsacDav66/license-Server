
// plugins/sticker.js

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

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const stream = require('stream');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// --- Configuración ---
const STICKER_NAME = "𝕲𝖗𝖚𝖕𝖔 𝕬𝖓𝖆𝖗𝖖𝖚𝖎𝖈𝖔 ♨️";
const STICKER_AUTHOR = "𝙎𝙩𝙪𝙣 𝘽𝙤𝙩 ♨️";
const MAX_VIDEO_DURATION_SECONDS = 7; // Duración máxima para stickers de video/gif
const STICKER_DIMENSION = 512; // Dimensión para el sticker (512x512)
const MAX_STICKER_SIZE_BYTES = 300 * 1024; // 300 KB en bytes
const MIN_COMPRESSION_QUALITY = 20; // Calidad mínima aceptable para la compresión (0-100)
// --- Fin Configuración ---

// Función para verificar si ffmpeg está instalado
function checkFFmpeg() {
    return new Promise((resolve) => {
        exec('ffmpeg -version', (error) => {
            if (error) {
                console.warn("\x1b[31m[STICKER_PLUGIN_WARN] ffmpeg no parece estar instalado o no está en el PATH. Los stickers de video/GIF no funcionarán.\x1b[0m");
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}
let ffmpegAvailable = false;
checkFFmpeg().then(available => ffmpegAvailable = available);


module.exports = {
    name: 'Creador de Stickers',
    aliases: ['s', 'sticker', 'stiker', 'stickergif', 'sgif'],
    description: 'Convierte imágenes, videos cortos o GIFs en stickers. Responde a un medio o envíalo con el comando como caption.',
    category: 'Utilidad',
    // --- NUEVO: ESTO ES LO QUE LEE LA WEB ---
    marketplace: {
        externalDependencies: ["@whiskeysockets/baileys@^7.0.0-rc.9","fluent-ffmpeg@^2.1.3","sharp@^0.32.6","wa-sticker-formatter@^4.4.4"],
        requirements: ["FFmpeg instalado en el servidor"],
        tebex_id: 7383011,
        price: "5.00",
        icon: "fa-sticky-note",
        preview: {
            suggestions: [".s", ".sgif"],
            responses: {
                ".s": { 
                    text: "⏳ Procesando sticker...", 
                    image: "https://www.animeunited.com.br/oomtumtu/2022/05/335d9b9a5abd5135a776047f2796574b.jpg" // URL de un sticker real o imagen
                },
                ".sgif": {
                    text: "⏳ Convirtiendo video a sticker animado...",
                    image: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJndndndndndndndndndndndndndndndndndndndndndndndnd/3o7TKMGpxx322D97JC/giphy.gif"
                }
            }
        }
    },

    // --- FIN NUEVO ---

    async execute(sock, msg, args) {
        const { from, type: messageType, _baileysMessage: baileysMsg } = msg;
        let mediaType = null;
        let messageWithMedia = null;

        // 1. Determinar si el comando es una respuesta a un mensaje con media o si el propio mensaje tiene media
        if (baileysMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            messageWithMedia = baileysMsg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (messageWithMedia.imageMessage) mediaType = 'image';
            else if (messageWithMedia.videoMessage) mediaType = 'video';
        } else if (baileysMsg.message?.imageMessage) {
            messageWithMedia = baileysMsg.message;
            mediaType = 'image';
        } else if (baileysMsg.message?.videoMessage) {
            messageWithMedia = baileysMsg.message;
            mediaType = 'video';
        }

        if (!mediaType || !messageWithMedia) {
            return msg.reply('Por favor, envía una imagen/video/GIF con el comando `.s` o responde a uno con `.s` para crear un sticker.');
        }

        let mediaContentMessage;
        if (mediaType === 'image') {
            mediaContentMessage = messageWithMedia.imageMessage;
        } else if (mediaType === 'video') {
            mediaContentMessage = messageWithMedia.videoMessage;
        }

        if (!mediaContentMessage) {
            return msg.reply('No se pudo encontrar el contenido multimedia.');
        }

        await msg.reply('⏳ Procesando sticker...');

        try {
            const streamMedia = await downloadContentFromMessage(mediaContentMessage, mediaType);
            let mediaBuffer = Buffer.from([]);
            for await (const chunk of streamMedia) {
                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
            }

            let stickerBufferRaw;

            if (mediaType === 'image') {
                stickerBufferRaw = await sharp(mediaBuffer)
                    .resize(STICKER_DIMENSION, STICKER_DIMENSION, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toBuffer();
            } else if (mediaType === 'video') {
                if (!ffmpegAvailable) {
                    return msg.reply('⚠️ No se pueden crear stickers de video/GIF porque `ffmpeg` no está instalado o configurado correctamente en el servidor del bot.');
                }

                const tempInputPath = path.join(__dirname, `temp_sticker_input_${Date.now()}.mp4`);
                await fs.promises.writeFile(tempInputPath, mediaBuffer);

                stickerBufferRaw = await new Promise((resolve, reject) => {
                    const outputPath = path.join(__dirname, `temp_sticker_output_${Date.now()}.webp`);
                    ffmpeg(tempInputPath)
                        .outputOptions([
                            `-vcodec`, `libwebp`,
                            `-pix_fmt`, `yuva420p`,
                            `-vf`, `scale=${STICKER_DIMENSION}:${STICKER_DIMENSION}:force_original_aspect_ratio=decrease,format=rgba,pad=${STICKER_DIMENSION}:${STICKER_DIMENSION}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1:1,fps=15`,
                            `-loop`, `0`,
                            `-ss`, `00:00:00.0`,
                            `-t`, `${MAX_VIDEO_DURATION_SECONDS}`,
                            `-preset`, `default`,
                            `-an`,
                            `-quality`, `75` // Calidad inicial de ffmpeg
                        ])
                        .toFormat('webp')
                        .on('error', (err) => {
                            console.error('[STICKER_PLUGIN_ERROR] Error ffmpeg:', err);
                            fs.promises.unlink(tempInputPath).catch(e => console.error("Error eliminando temp input:", e));
                            fs.promises.unlink(outputPath).catch(e => console.error("Error eliminando temp output (on error):", e));
                            reject(new Error('Error al convertir el video/GIF a sticker.'));
                        })
                        .on('end', async () => {
                            try {
                                const resultBuffer = await fs.promises.readFile(outputPath);
                                await fs.promises.unlink(tempInputPath);
                                await fs.promises.unlink(outputPath);
                                resolve(resultBuffer);
                            } catch (readError) {
                                reject(readError);
                            }
                        })
                        .save(outputPath);
                });
            }

            if (stickerBufferRaw) {
                let currentQuality = 100; // Calidad inicial para wa-sticker-formatter
                let bufferWithMetadata = null;

                // Bucle de compresión si el sticker excede el tamaño máximo
                do {
                    const finalSticker = new Sticker(stickerBufferRaw, {
                        pack: STICKER_NAME,
                        author: STICKER_AUTHOR,
                        type: mediaType === 'video' ? StickerTypes.FULL : StickerTypes.DEFAULT,
                        quality: currentQuality,
                    });

                    bufferWithMetadata = await finalSticker.toBuffer();

                    // Si el sticker sigue siendo demasiado grande y aún podemos reducir la calidad
                    if (bufferWithMetadata.length > MAX_STICKER_SIZE_BYTES && currentQuality > MIN_COMPRESSION_QUALITY) {
                        currentQuality -= 10; // Reducir calidad en 10%
                        console.log(`[STICKER_PLUGIN_INFO] Sticker demasiado grande (${(bufferWithMetadata.length / 1024).toFixed(2)} KB). Reduciendo calidad a ${currentQuality}%.`);
                    } else {
                        // Salir del bucle si el tamaño es aceptable o si la calidad ya es mínima
                        break;
                    }
                } while (true); // Bucle infinito que se rompe explícitamente

                if (bufferWithMetadata) {
                    await sock.sendMessage(from, {
                        sticker: bufferWithMetadata,
                    }, { quoted: baileysMsg });
                } else {
                    await msg.reply('No se pudo generar el sticker después de la compresión.');
                }

            } else {
                await msg.reply('No se pudo generar el sticker.');
            }

        } catch (error) {
            console.error('[ERROR EN PLUGINS/STICKER.JS]', error);
            await msg.reply(`❌ Ocurrió un error al crear el sticker: ${error.message}`);
        }
    }
};