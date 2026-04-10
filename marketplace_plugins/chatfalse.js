// plugins/chatfalse.js (Versión Final y Definitiva con Nombres sobre Stickers)

const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const { jidDecode, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getUserData } = require('../shared-economy.js');
const { findUserName } = require('../shared-economy.js'); // <-- CAMBIADO

// --- AGREGAR ESTA LÍNEA AL INICIO DE TUS IMPORTS ---
const sharp = require('sharp');
// ---------------------------------------------------

// --- RUTAS Y CONFIGURACIÓN ---
const BACKGROUND_PATH = path.join(__dirname, '..', '..','assets', 'chatfalse','whatsapp_background.png');
const DEFAULT_AVATAR_PATH = path.join(__dirname, '..', '..','assets', 'chatfalse', 'default_avatar.png');
const STICKER_MAX_SIZE = 150; // Tamaño reducido para más realismo

// --- FUNCIONES DE UTILIDAD ---
function getWrappedTextMetrics(context, text, maxWidth) {
    if (!text) return { lineCount: 0, longestLineWidth: 0 };
    const words = text.split(' ');
    let line = '', lineCount = 1, longestLineWidth = 0;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            longestLineWidth = Math.max(longestLineWidth, context.measureText(line.trim()).width);
            line = words[n] + ' ';
            lineCount++;
        } else { line = testLine; }
    }
    longestLineWidth = Math.max(longestLineWidth, context.measureText(line.trim()).width);
    return { lineCount, longestLineWidth };
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (context.measureText(testLine).width > maxWidth && n > 0) {
            context.fillText(line.trim(), x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else { line = testLine; }
    }
    context.fillText(line.trim(), x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

module.exports = {
    name: 'Chat Falso',
    aliases: ['chatfalso', 'fakechat'],
    description: 'Crea una imagen de un chat falso. Responde a una imagen para simular un sticker.',
    category: 'Diversión',
    marketplace: {
        tebex_id: 7383063,
        price: "10.00",
        icon: "fa-comment-dots",
        preview: {
            suggestions: ["!chatfalso @Usuario Hola!", "!fakechat @Bot Como vas?"],
            responses: {
                "!chatfalso @Usuario Hola!": {
                    text: "_Chat simulado..._ 🤫",
                    image: "https://i.ibb.co/6P0L8yN/fake-chat-preview.png" // Simulación de la captura
                },
                "!fakechat @Bot Como vas?": {
                    text: "_Chat simulado..._ 🤫",
                    image: "https://i.ibb.co/6P0L8yN/fake-chat-preview.png" // Simulación de la captura
                }

            }
        }
    },

    async execute(sock, msg, args) {
        const rawImmuneJids = process.env.IMMUNE_JIDS ? process.env.IMMUNE_JIDS.split(',').map(jid => jid.trim()) : [];
        const normalizedImmuneJids = rawImmuneJids.map(jid => {
            // Si el JID del .env viene como '@numero', lo convertimos a 'numero@s.whatsapp.net'
            if (jid.startsWith('@')) {
                const numberPart = jid.substring(1); // Quitar el '@'
                return `${numberPart}@s.whatsapp.net`;
            }
            return jid; // Si ya tiene el formato completo, lo usamos
        });

        try {
            // 1. ANÁLISIS DE LA ENTRADA
            const baileysOriginalMsg = msg._baileysMessage;

            // Recopilar todas las menciones del contextInfo del mensaje principal y el mensaje citado
            let contextInfoFromMessage = null;
            if (baileysOriginalMsg.message?.extendedTextMessage?.contextInfo) {
                contextInfoFromMessage = baileysOriginalMsg.message.extendedTextMessage.contextInfo;
            } else if (baileysOriginalMsg.message?.imageMessage?.contextInfo) {
                contextInfoFromMessage = baileysOriginalMsg.message.imageMessage.contextInfo;
            } else if (baileysOriginalMsg.message?.stickerMessage?.contextInfo) {
                contextInfoFromMessage = baileysOriginalMsg.message.stickerMessage.contextInfo;
            }
            
            const quotedMsgInfo = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo;
            const allMentionedJidsFromBaileys = [...new Set([...(contextInfoFromMessage?.mentionedJid || []), ...(quotedMsgInfo?.mentionedJid || [])])];

            let targetJid;
            let textArgs = [...args]; // Una copia de los argumentos iniciales que serán el texto

            // --- Lógica para determinar targetJid y construir fakeText ---

            // 1. Intentar encontrar targetJid en args[0]. Si es una mención válida, la usamos y la removemos de textArgs.
            if (args.length > 0 && args[0].startsWith('@')) {
                const userPartFromArg = jidDecode(args[0].substring(1))?.user;
                if (userPartFromArg) {
                    // Buscar si esta mención explícita en args[0] es reconocida por Baileys
                    const matchedJid = allMentionedJidsFromBaileys.find(jid => jidDecode(jid)?.user === userPartFromArg);
                    if (matchedJid) {
                        targetJid = matchedJid;
                        textArgs = args.slice(1); // Remover este argumento de la lista para el texto
                    }
                }
            }

            // 2. Si targetJid aún no está establecido, usar la primera mención reconocida por Baileys.
            if (!targetJid && allMentionedJidsFromBaileys.length > 0) {
                targetJid = allMentionedJidsFromBaileys[0];
                // En este caso, no hemos quitado args[0] porque no era el target o no se validó.
                // El filtrado final se encargará de cualquier mención restante.
            }

            // 3. Fallback: Si no se encontró ningún JID objetivo a través de menciones, usar al autor del comando.
            if (!targetJid) {
                targetJid = msg.author; // msg.author ya es el JID completo (ej. 51987654321@s.whatsapp.net)
                console.log(`[ChatFalso Debug] Fallback: targetJid establecido a msg.author: ${targetJid}`);
            }
            console.log(`[ChatFalso Debug] Target JID final antes de verificación de inmunidad: ${targetJid}`);


            // Construir fakeText filtrando **cualquier** argumento que parezca una mención.
            // Esto asume que los argumentos que son solo "@numero" son parámetros del comando.
            const fakeText = textArgs.filter(arg => {
                // Mantener el argumento si no empieza con '@' o si es solo '@' (raro, pero para seguridad)
                // Si empieza con '@' y tiene más caracteres (ej. '@12345'), lo filtramos.
                return !(arg.startsWith('@') && arg.length > 1);
            }).join(' ');

            // --- Fin de lógica para targetJid y fakeText ---

                        // --- VERIFICACIÓN DE USUARIO INMUNE PARA EL TARGET SIMULADO ---
            console.log(`[ChatFalso Debug] JID en .env (raw):`, rawImmuneJids);
            console.log(`[ChatFalso Debug] JID en .env (normalized):`, normalizedImmuneJids);
            console.log(`[ChatFalso Debug] Target JID para el chat falso:`, targetJid);
            
            // Comparar el targetJid (ej. 51987654321@s.whatsapp.net) con la lista normalizada
            if (normalizedImmuneJids.includes(targetJid)) {
                console.log(`[ChatFalso Debug] ¡Target JID (${targetJid}) ENCONTRADO en la lista de inmunes! Bloqueando...`);
                const targetUser = await getUserData(targetJid);
                const nameToShow = targetUser?.pushname || findUserName(targetJid) || jidDecode(targetJid)?.user || 'ese usuario';
                return msg.reply(`🛡️ No se puede crear un chat falso para ${nameToShow}. ¡Está protegido/a!`);
            }
            console.log(`[ChatFalso Debug] Target JID (${targetJid}) NO encontrado en la lista de inmunes. Continuando...`);
            // --- FIN VERIFICACIÓN DE USUARIO INMUNE ---

            let stickerBuffer = null;
            let mediaToDownload = null; 

            // Prioridad para el mensaje citado
            const quotedMsg = quotedMsgInfo?.quotedMessage;
            if (quotedMsg?.imageMessage || quotedMsg?.stickerMessage) {
                mediaToDownload = {
                    key: {
                        remoteJid: msg.from,
                        id: quotedMsgInfo.stanzaId,
                        participant: quotedMsgInfo.participant
                    },
                    message: quotedMsg
                };
                console.log('[ChatFalso] Imagen/sticker detectado en mensaje citado.');
            } 
            // Si no hay citado, verifica si el mensaje actual contiene una imagen/sticker adjunto
            else if (baileysOriginalMsg.message?.imageMessage || baileysOriginalMsg.message?.stickerMessage) {
                mediaToDownload = {
                    key: baileysOriginalMsg.key, 
                    message: baileysOriginalMsg.message
                };
                console.log('[ChatFalso] Imagen/sticker detectado en el mensaje actual.');
            }

            if (mediaToDownload) {
                try {
                    stickerBuffer = await downloadMediaMessage(
                        mediaToDownload,
                        'buffer', {}
                    );

                    // --- NUEVA LÓGICA: CONVERSIÓN DE STICKER A PNG SI ES WEBP ---
                    // Los archivos WebP a menudo comienzan con 'RIFF' seguido de 4 bytes de tamaño y luego 'WEBP'
                    // Esta es una verificación simple de los magic bytes para intentar identificar WebP.
                    if (stickerBuffer && stickerBuffer.length >= 12 && stickerBuffer.slice(0, 12).toString('ascii', 0, 12).startsWith('RIFF') && stickerBuffer.slice(8, 12).toString('ascii') === 'WEBP') {
                        console.log('[ChatFalso] Sticker detectado como WebP, intentando convertir a PNG.');
                        try {
                            stickerBuffer = await sharp(stickerBuffer)
                                .toFormat('png')
                                .toBuffer();
                            console.log('[ChatFalso] Sticker WebP convertido a PNG exitosamente.');
                        } catch (conversionError) {
                            console.error('[ChatFalso] Error al convertir sticker WebP a PNG:', conversionError);
                            return msg.reply('❌ No pude procesar el sticker (error al convertirlo).');
                        }
                    }
                    // --- FIN NUEVA LÓGICA DE CONVERSIÓN ---

                } catch (downloadError) {
                    console.error('[ChatFalso] Error al descargar la imagen/sticker:', downloadError);
                    return msg.reply('❌ No pude descargar la imagen/sticker adjunto.');
                }
            }

            if (!fakeText && !stickerBuffer) {
                return msg.reply('❌ Escribe un texto, adjunta una imagen/sticker, o responde a uno.');
            }

            await msg.reply('🎨 Creando captura de pantalla falsa...');

    
            
            // 2. OBTENER DATOS DEL USUARIO (Esta sección usa targetJid, que ahora es correcto)
            let avatarBuffer, displayName;
            try {
                const pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
                avatarBuffer = (await axios.get(pfpUrl, { responseType: 'arraybuffer' })).data;
            } catch {
                avatarBuffer = fs.readFileSync(DEFAULT_AVATAR_PATH);
            }
            
            const economyData = await getUserData(targetJid);
            if (economyData?.pushname) displayName = economyData.pushname;
            else displayName = await findUserName(targetJid) || jidDecode(targetJid)?.user || 'Usuario';

            // 3. GENERACIÓN DE LA IMAGEN
            const avatarImg = await loadImage(avatarBuffer);
            const backgroundImg = await loadImage(BACKGROUND_PATH);
            const stickerImg = stickerBuffer ? await loadImage(stickerBuffer) : null;
            
            const tempCanvas = createCanvas(1, 1);
            const tempCtx = tempCanvas.getContext('2d');
            
            const padding = { top: 15, right: 15, bottom: 25, left: 15, time: 10 };
            const nameHeight = 25;
            const textLineHeight = 22;
            const stickerPaddingTop = 8;
            const maxTextWidth = 450;
            const hasText = !!fakeText;
            const hasSticker = !!stickerImg;
            
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            
            tempCtx.font = `bold 16px "Segoe UI", sans-serif`;
            const nameWidth = tempCtx.measureText(displayName).width;
            tempCtx.font = `16px "Segoe UI", sans-serif`;
            const textMetrics = getWrappedTextMetrics(tempCtx, fakeText, maxTextWidth);
            tempCtx.font = `12px "Segoe UI", sans-serif`;
            const timeWidth = tempCtx.measureText(timeString).width;
            
            let bubbleHeight = 0, bubbleWidth = 0;
            if (hasText) {
                bubbleHeight = (textMetrics.lineCount * textLineHeight) + padding.top + padding.bottom + nameHeight;
                let contentWidth = Math.max(nameWidth, textMetrics.longestLineWidth);
                if (textMetrics.lineCount === 1) {
                    contentWidth = Math.max(contentWidth, textMetrics.longestLineWidth + timeWidth + padding.time);
                }
                bubbleWidth = contentWidth + padding.left + padding.right;
            }

            let stickerHeight = 0, stickerWidth = 0;
            if (hasSticker) {
                const ratio = Math.min(STICKER_MAX_SIZE / stickerImg.width, STICKER_MAX_SIZE / stickerImg.height);
                stickerWidth = stickerImg.width * ratio;
                stickerHeight = stickerImg.height * ratio;
            }

            const finalContentWidth = Math.max(bubbleWidth, stickerWidth);
            let finalContentHeight = 0; // MODIFICACIÓN CLAVE AQUÍ
            if (hasText) {
                finalContentHeight += bubbleHeight;
                if (hasSticker) { // Si el sticker sigue al texto, añade el padding entre ellos
                    finalContentHeight += stickerPaddingTop;
                }
            }
            if (hasSticker) {
                finalContentHeight += nameHeight; // Siempre cuenta la altura del nombre encima del sticker
                finalContentHeight += stickerHeight;
            }


            const horizontalPadding = 40, verticalPadding = 40;
            const canvasWidth = finalContentWidth + 75 + horizontalPadding;
            const canvasHeight = finalContentHeight + verticalPadding;
            
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = ctx.createPattern(backgroundImg, 'repeat');
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            const chatStartX = horizontalPadding / 2;
            const chatStartY = verticalPadding / 2;
            const contentX = chatStartX + 75;
            let currentY = chatStartY; // Se mantiene la inicialización


            ctx.save();
            ctx.beginPath();
            ctx.arc(chatStartX + 30, chatStartY + 30, 30, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, chatStartX, chatStartY, 60, 60);
            ctx.restore();
            
            // 1. DIBUJAR BURBUJA DE TEXTO (si existe)
               if (hasText) {
                ctx.fillStyle = '#202C33';
                const bubbleRadius = 12;

                // Parámetros de la cola
                const tailWidth = 10; // Este es el "ancho potencial" de la cola si no hay recesión
                const tailHeight = 12;
                const tailVerticalOffsetFromTop = 3;

                // --- NUEVO VALOR A AJUSTAR: Cuánto recede la cola ---
                // Un valor positivo hará que la cola sea más corta y parezca "entrar" en la burbuja.
                // Si este valor es igual o mayor que 'tailWidth', la cola desaparecerá o se ocultará.
                const tailRecessionAmount = 10; // Inicia en 0 (cola visible con su tailWidth completo)
                // ------------------------------------------------------------------

                // Calcular el "ancho real" de la cola (cuánto sobresale realmente)
                const actualTailProtrusion = Math.max(0, tailWidth - tailRecessionAmount); // Asegura que no sea negativo

                // Definir los puntos clave de la burbuja y la cola
                const bubbleLeft = contentX;
                const bubbleTop = currentY;
                const bubbleRight = contentX + bubbleWidth;
                const bubbleBottom = currentY + bubbleHeight;

                // Puntos de inicio y fin de la cola en el borde izquierdo de la burbuja
                const tailStartOnBubbleY = bubbleTop + tailVerticalOffsetFromTop;
                const tailEndOnBubbleY = bubbleTop + tailVerticalOffsetFromTop + tailHeight;
                
                // Punta de la cola (ahora usa actualTailProtrusion para su posición X)
                const tailTipX = bubbleLeft - actualTailProtrusion;
                const tailTipY = tailStartOnBubbleY + (tailHeight / 2);

                // Punto de control para las curvas cuadráticas de la cola (también usa actualTailProtrusion)
                const controlXForTail = bubbleLeft - (actualTailProtrusion * 0.5); // Ajusta el 0.5 si quieres otra curvatura

                ctx.beginPath();
                ctx.moveTo(bubbleLeft + bubbleRadius, bubbleTop);
                
                // 2. Dibujar el borde superior
                ctx.lineTo(bubbleRight - bubbleRadius, bubbleTop);
                
                // 3. Esquina superior derecha
                ctx.quadraticCurveTo(bubbleRight, bubbleTop, bubbleRight, bubbleTop + bubbleRadius);
                
                // 4. Borde derecho
                ctx.lineTo(bubbleRight, bubbleBottom - bubbleRadius);
                
                // 5. Esquina inferior derecha
                ctx.quadraticCurveTo(bubbleRight, bubbleBottom, bubbleRight - bubbleRadius, bubbleBottom);
                
                // 6. Borde inferior
                ctx.lineTo(bubbleLeft + bubbleRadius, bubbleBottom);
                
                // 7. Esquina inferior izquierda
                ctx.quadraticCurveTo(bubbleLeft, bubbleBottom, bubbleLeft, bubbleBottom - bubbleRadius);
                
                // 8. Borde izquierdo desde la esquina inferior izquierda hasta el final de la base de la cola
                ctx.lineTo(bubbleLeft, tailEndOnBubbleY);
                ctx.quadraticCurveTo(controlXForTail, tailEndOnBubbleY, tailTipX, tailTipY);
                ctx.quadraticCurveTo(controlXForTail, tailStartOnBubbleY, bubbleLeft, tailStartOnBubbleY);
                ctx.lineTo(bubbleLeft, bubbleTop + bubbleRadius);
                ctx.quadraticCurveTo(bubbleLeft, bubbleTop, bubbleLeft + bubbleRadius, bubbleTop);
                
                ctx.closePath();
                ctx.fill();
                // --- FIN MODIFICACIÓN CLAVE ---

                ctx.fillStyle = '#00A884';
                ctx.font = 'bold 16px "Segoe UI", sans-serif';
                ctx.fillText(displayName, contentX + padding.left, currentY + padding.top + 10);
                
                ctx.fillStyle = '#E9EDEF';
                ctx.font = '16px "Segoe UI", sans-serif';
                drawWrappedText(ctx, fakeText, contentX + padding.left, currentY + padding.top + nameHeight + 18, maxTextWidth, textLineHeight);
                
                ctx.fillStyle = '#8696A0';
                ctx.font = '12px "Segoe UI", sans-serif';
                ctx.fillText(timeString, contentX + bubbleWidth - timeWidth - padding.right, currentY + bubbleHeight - 10);
                
                currentY += bubbleHeight; 
                if (hasSticker) {
                    currentY += stickerPaddingTop;
                }
            }
            // ELIMINAR ESTE 'else if' YA QUE LA LÓGICA SE MUEVE ABAJO:
            // else if (hasSticker) {
            //     ctx.fillStyle = '#00A884';
            //     ctx.font = 'bold 16px "Segoe UI", sans-serif';
            //     ctx.fillText(displayName, contentX, currentY + 15);
            //     currentY += nameHeight;
            // }

            // 2. DIBUJAR STICKER (si existe)
             if (hasSticker) {
                // MODIFICACIÓN: Dibujar el globo de fondo para el nombre del sticker
                const nameBubbleHorizontalPadding = 12; // Espaciado horizontal dentro del globo del nombre
                const nameBubbleVerticalPadding = 6;    // Espaciado vertical dentro del globo del nombre
                const nameBubbleTextHeight = 16;        // Altura del texto del nombre (tamaño de fuente)
                
                const calculatedNameBubbleWidth = nameWidth + (nameBubbleHorizontalPadding * 2);
                const calculatedNameBubbleHeight = nameBubbleTextHeight + (nameBubbleVerticalPadding * 2);
                const nameBubbleRadius = 8; // Radio de las esquinas para el globo del nombre

                // Dibujar el fondo del globo del nombre
                ctx.fillStyle = '#202C33'; // Mismo color oscuro que el globo de texto principal
                roundRect(ctx, contentX, currentY, calculatedNameBubbleWidth, calculatedNameBubbleHeight, nameBubbleRadius);
                ctx.fill();

                // === CÓDIGO ELIMINADO: Ya no se dibuja el pequeño triángulo que apunta al avatar ===
                // ctx.beginPath();
                // ctx.moveTo(contentX, currentY); // Esquina superior izquierda del globo
                // ctx.lineTo(contentX - 10, currentY + (calculatedNameBubbleHeight / 2)); // Punto medio de la "cola"
                // ctx.lineTo(contentX, currentY + calculatedNameBubbleHeight); // Esquina inferior izquierda del globo
                // ctx.closePath();
                // ctx.fill();
                // =================================================================================

                // Dibujar el nombre del usuario encima del globo
                ctx.fillStyle = '#00A884'; // Color verde para el nombre, consistente con el globo de texto
                ctx.font = 'bold 16px "Segoe UI", sans-serif';
                // Ajustar la posición Y del texto para centrarlo verticalmente en el nuevo globo
                const nameTextY = currentY + (calculatedNameBubbleHeight / 2) + (nameBubbleTextHeight / 2) - 2; // -2 para ajuste fino
                ctx.fillText(displayName, contentX + nameBubbleHorizontalPadding, nameTextY);
                
                currentY += calculatedNameBubbleHeight; // Avanzar Y después del globo del nombre
                
                ctx.drawImage(stickerImg, contentX, currentY, stickerWidth, stickerHeight);

                // --- MODIFICACIONES PARA EL GLOBO DE LA HORA ---
                const timeBubbleHeight = 16; // Altura del globo de la hora
                const timeBubbleRadius = 8; // Radio de las esquinas del globo
                const timeHorizontalPadding = 10; // Espaciado horizontal dentro del globo
                const timeVerticalPadding = 2; // Espaciado vertical dentro del globo
                const timeTextHeight = 12; // Altura del texto de la hora (tamaño de fuente)

                // Posicionamiento
                // currentY aquí es el inicio del sticker.
                // Queremos que el globo de la hora esté en la parte inferior derecha del sticker.
                const offsetFromStickerBottom = -15; // Cantidad a bajar el globo desde el borde inferior del sticker
                const offsetFromStickerRight = 8; // Cantidad a alejar el globo del borde derecho del sticker

                const calculatedTimeBubbleWidth = timeWidth + (timeHorizontalPadding * 2);

                const timeBgX = contentX + stickerWidth - calculatedTimeBubbleWidth - offsetFromStickerRight;
                const timeBgY = currentY + stickerHeight - timeBubbleHeight - offsetFromStickerBottom; // Posición Y ajustada
                
                ctx.fillStyle = '#202C33'; // Mismo color oscuro del globo de texto principal, no transparente
                roundRect(ctx, timeBgX, timeBgY, calculatedTimeBubbleWidth, timeBubbleHeight, timeBubbleRadius);
                ctx.fill();

                ctx.fillStyle = '#E9EDEF'; // Color claro para el texto de la hora
                ctx.font = '12px "Segoe UI", sans-serif';
                // Ajustar la posición Y del texto para centrarlo verticalmente en el nuevo globo
                const timeTextY = timeBgY + (timeBubbleHeight / 2) + (timeTextHeight / 2) - 1; // Ajuste fino para centrado
                ctx.fillText(timeString, timeBgX + timeHorizontalPadding, timeTextY);
                // --- FIN DE MODIFICACIONES PARA EL GLOBO DE LA HORA ---
            }
            
            const finalImageBuffer = canvas.toBuffer('image/png');
            await sock.sendMessage(msg.from, {
                image: finalImageBuffer,
                caption: `_Chat simulado..._ 🤫`
            }, { quoted: baileysOriginalMsg });

        } catch (error) {
            console.error('[ChatFalso Canvas] Error:', error);
            await msg.reply('❌ Ocurrió un error al dibujar la imagen del chat.');
        }
    }
};