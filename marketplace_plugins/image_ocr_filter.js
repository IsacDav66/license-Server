// plugins/Listeners/image_ocr_filter.js (Versión con Expulsión Automática)

const { downloadContentFromMessage, jidNormalizedUser, jidDecode } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIGURACIÓN ---
const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;
const OWNER_ID = '1658008416509@lid'; // Tu ID para evitar auto-expulsión

const FORBIDDEN_TEXT = ['doxeo', 'reniec'];
const MODERATION_JID = '120363419450783030@g.us';

async function getImageBuffer(baileysMsg) {
    if (!baileysMsg || !baileysMsg.message?.imageMessage) return null;
    try {
        const stream = await downloadContentFromMessage(baileysMsg.message.imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (e) {
        console.error('[OCR Filter] Error al descargar la imagen:', e);
        return null;
    }
}

module.exports = {
    name: 'Filtro de Texto en Imágenes (OCR)',
    description: 'Detecta palabras prohibidas en imágenes, elimina el mensaje y expulsa al usuario.',
    isListener: true,
    marketplace: {
        requirements: ["Sightengine API User & Secret"],
        tebex_id: 7383029,
        price: "20.00",
        icon: "fa-magnifying-glass-chart",
        preview: {
            suggestions: ["Prueba Doxeo", "Prueba Reniec"], // Sin comillas simples internas
            responses: {
                "Prueba Doxeo": {
                    text: "🚨 *¡ACCIÓN DE MODERACIÓN!* 🚨\n\nLa imagen contenía texto prohibido (doxeo) y ha sido eliminada.\n\n*Consecuencia:* El usuario ha sido expulsado.",
                    image: "https://i.ibb.co/6P0L8yN/ocr-preview-demo.png"
                },
                "Prueba Reniec": {
                    text: "🚨 *¡ALERTA DE SEGURIDAD!* 🚨\n\nSe detectó intento de consulta de datos privados (Reniec). Mensaje interceptado.",
                    image: "https://i.ibb.co/6P0L8yN/ocr-preview-demo.png"
                }
            }
        }
    },
    
    async checkMessage(sock, msg) {
        if (msg.type !== 'image' || !msg.from.endsWith('@g.us') || msg.fromMe || msg.from === MODERATION_JID) {
            return false;
        }
        if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
            return false;
        }
        
        const chatId = msg.from;
        const senderId = msg.author;
        const originalBaileysMsg = msg._baileysMessage;

        try {
            const chat = await msg.getChat();
            if (!chat || !chat.groupMetadata || !chat.groupMetadata.participants) {
                return false;
            }
            const groupMetadata = chat.groupMetadata;
            
            const botJids = [];
            if (process.env.BOT_JID_SWA) botJids.push(process.env.BOT_JID_SWA);
            if (process.env.BOT_JID_LID) botJids.push(process.env.BOT_JID_LID);
            const botParticipant = groupMetadata.participants.find(p => botJids.includes(p.id) || (p.lid && botJids.includes(p.lid)));

            if (!botParticipant || !botParticipant.admin) {
                return false;
            }

            const imageBuffer = await getImageBuffer(originalBaileysMsg);
            if (!imageBuffer) return false;

            const formData = new FormData();
            formData.append('media', imageBuffer, { filename: 'image.jpg' });
            formData.append('models', 'text,ocr');
            formData.append('api_user', SIGHTENGINE_API_USER);
            formData.append('api_secret', SIGHTENGINE_API_SECRET);

            const response = await axios.post('https://api.sightengine.com/1.0/check.json', formData, { headers: formData.getHeaders() });
            
            const detectedTextContent = response.data?.text?.content;
            if (detectedTextContent) {
                const detectedText = detectedTextContent.toLowerCase();
                const foundForbiddenWord = FORBIDDEN_TEXT.find(word => detectedText.includes(word.toLowerCase()));

                if (foundForbiddenWord) {
                    console.log(`[OCR Filter] ¡Palabra prohibida "${foundForbiddenWord}" detectada en imagen de ${senderId.split('@')[0]}!`);
                    const reason = `Texto prohibido detectado en imagen ("${foundForbiddenWord}")`;

                    // --- ACCIONES DE MODERACIÓN ---
                    
                    // 1. Reenviar a moderación (como evidencia)
                    try {
                        const caption = `🚨🚨 EXPULSIÓN AUTOMÁTICA 🚨🚨\n\n*Grupo:* ${groupMetadata.subject}\n*Usuario:* @${senderId.split('@')[0]}\n*Palabra detectada:* ${foundForbiddenWord}`;
                        await sock.sendMessage(MODERATION_JID, { image: imageBuffer, caption: caption, mentions: [senderId] });
                    } catch (e) { console.error("[OCR Filter] Error al reenviar a moderación:", e); }

                    // 2. Eliminar el mensaje ofensivo
                    try {
                        await sock.sendMessage(chatId, { delete: originalBaileysMsg.key });
                    } catch (e) { console.error("[OCR Filter] Error al eliminar el mensaje:", e); }

                    // 3. Anunciar la expulsión en el grupo
                    try {
                        const announcementText = `🚨 *¡ACCIÓN DE MODERACIÓN!* 🚨\n\nLa imagen de @${senderId.split('@')[0]} contenía texto prohibido y ha sido eliminada.\n\n*Consecuencia:* El usuario será expulsado del grupo.`;
                        await sock.sendMessage(chatId, { text: announcementText, mentions: [senderId] });
                        // Damos una pequeña pausa para que el mensaje se lea antes de la expulsión
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (e) { console.error("[OCR Filter] Error al enviar anuncio de expulsión:", e); }

                    // 4. ¡EXPULSAR AL USUARIO!
                    // Medida de seguridad para no auto-expulsarte
                    if (senderId === OWNER_ID) {
                        console.log(`[OCR Filter] Se evitó la auto-expulsión del propietario.`);
                        await sock.sendMessage(chatId, { text: `⚠️ Se detectó una palabra prohibida en la imagen del propietario, pero se ha evitado la auto-expulsión.` });
                        return true;
                    }

                    try {
                        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                        console.log(`[OCR Filter] ¡Usuario ${senderId.split('@')[0]} expulsado del grupo!`);
                    } catch (e) {
                        console.error("[OCR Filter] Error al expulsar al usuario (¿es un admin?):", e);
                        // Si falla, lo anunciamos
                        await sock.sendMessage(chatId, { text: `⚠️ No pude expulsar al usuario @${senderId.split('@')[0]}. Es posible que también sea administrador.`, mentions: [senderId] });
                    }

                    return true; // Mensaje manejado
                }
            }
        } catch (error) {
            console.error('[OCR Filter] Error durante el análisis de imagen:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        }

        return false;
    }
};