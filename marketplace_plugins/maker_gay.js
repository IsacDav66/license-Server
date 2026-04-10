// plugins/maker_gay.js (Baileys Version)
// Crea una imagen "gay" usando la foto de perfil y una API externa.

const axios = require('axios'); // Usaremos axios para hacer la llamada a la API
const { jidDecode } = require('@whiskeysockets/baileys'); // Para obtener número de JID

// URL de la API
const API_URL = 'https://some-random-api.com/canvas/gay?avatar=';
// URL de imagen por defecto si no hay avatar
const DEFAULT_AVATAR_URL = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';

// Ajustar parámetros a sock, msg, args (commandName no se usa aquí pero es estándar)
const execute = async (sock, msg, args, commandName) => {
    const chatId = msg.from;
    let targetUserId = null;
    let mentionedTarget = false;
    let targetNameForCaption = ''; // Para el caption y logs

    // 1. Determinar usuario objetivo
    const baileysOriginalMsg = msg._baileysMessage;
    const mentionedJidsInMsg = baileysOriginalMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJidsInMsg.length > 0) {
        targetUserId = mentionedJidsInMsg[0]; // Tomar la primera mención
        mentionedTarget = true;
        // Intentar obtener el nombre para el log y caption
        try {
            // No necesitas obtener el objeto Contact completo aquí si solo quieres el número para el log
            // o si el pushname ya está en tu base de datos (podrías usar getUserData si fuera necesario)
            targetNameForCaption = jidDecode(targetUserId)?.user || targetUserId.split('@')[0];
        } catch (e) {
            targetNameForCaption = targetUserId.split('@')[0];
        }
        console.log(`[MakerGay Baileys] Usuario objetivo (mencionado): ${targetUserId} (${targetNameForCaption})`);
    } else {
        targetUserId =msg.senderLid || msg.author; // El remitente
        const senderContactInfo = await msg.getContact();
        targetNameForCaption = senderContactInfo.pushname || jidDecode(targetUserId)?.user || targetUserId.split('@')[0];
        console.log(`[MakerGay Baileys] Usuario objetivo (remitente): ${targetUserId} (${targetNameForCaption})`);
    }

    if (!targetUserId) { // Debería estar cubierto por la lógica anterior, pero por si acaso
         console.error("[MakerGay Baileys] No se pudo determinar un ID de usuario válido.");
         try { await msg.reply("❌ No pude identificar a quién aplicar el efecto."); } catch (e) {}
         return;
    }

    try { await msg.reply('🏳️‍🌈 Procesando imagen...'); } catch (e) {}

    // 2. Obtener URL de la foto de perfil del targetUserId
    let profilePicUrlToUse = DEFAULT_AVATAR_URL; // Usar por defecto
    try {
        const fetchedPfpUrl = await sock.profilePictureUrl(targetUserId, 'image'); // 'image' para la foto normal
        if (fetchedPfpUrl) {
            profilePicUrlToUse = fetchedPfpUrl;
            console.log(`[MakerGay Baileys] URL de avatar obtenida para ${targetNameForCaption} (${targetUserId})`);
        } else {
             console.log(`[MakerGay Baileys] ${targetNameForCaption} (${targetUserId}) no tiene foto de perfil, usando default.`);
        }
    } catch (error) {
        console.warn(`[MakerGay Baileys] No se pudo obtener avatar para ${targetNameForCaption} (${targetUserId}), usando default. Error: ${error.message}`);
        // Usar la default ya asignada
    }

    // 3. Llamar a la API externa
    const apiUrlWithAvatar = API_URL + encodeURIComponent(profilePicUrlToUse);
    console.log(`[MakerGay Baileys] Llamando a API: ${apiUrlWithAvatar}`);
    let imageBuffer = null;
    try {
        // Usar axios para obtener la imagen como arraybuffer
        const response = await axios.get(apiUrlWithAvatar, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data, 'binary'); // Convertir a Buffer de Node.js
        console.log(`[MakerGay Baileys] Imagen recibida de la API.`);
    } catch (error) {
        let errorMsg = error.message;
        if (error.response) { // Si el error es de la respuesta HTTP de la API
            errorMsg = `API respondió con estado: ${error.response.status} ${error.response.statusText}`;
            if (error.response.data) {
                try { // Intentar decodificar el cuerpo del error si es JSON o texto
                    const errorDataStr = Buffer.from(error.response.data).toString();
                    errorMsg += ` - ${errorDataStr.substring(0, 100)}`;
                } catch (e) { /* ignorar si no se puede decodificar */ }
            }
        }
        console.error(`[MakerGay Baileys] Error al llamar a la API (${apiUrlWithAvatar}):`, errorMsg);
        try { await msg.reply(`❌ Error al contactar la API para generar la imagen. (${errorMsg})`); } catch (e) {}
        return;
    }

    // 4. Enviar la imagen con Baileys
    if (imageBuffer && imageBuffer.length > 0) {
        try {
            const captionText = `Eres gay @${targetNameForCaption} 🏳️‍🌈`;
            const mentionsArray = mentionedTarget || targetUserId !== msg.author ? [targetUserId] : []; // Mencionar solo si es otra persona o fue mencionado explícitamente

            console.log(`[MakerGay Baileys] Enviando imagen generada a ${chatId}...`);
            await sock.sendMessage(chatId, {
                image: imageBuffer, // Enviar el buffer directamente
                caption: captionText,
                mentions: mentionsArray // Asegurar que se mencione al objetivo
            }, { quoted: msg._baileysMessage }); // Citar el mensaje original
            console.log(`[MakerGay Baileys] Imagen enviada.`);

        } catch (error) {
            console.error("[MakerGay Baileys] Error al enviar imagen con Baileys:", error);
            try { await msg.reply("❌ Error al preparar o enviar la imagen generada."); } catch (e) {}
        }
    } else {
         console.error("[MakerGay Baileys] imageBuffer está vacío o es inválido después de llamar a la API.");
         try { await msg.reply("❌ Hubo un problema inesperado al obtener la imagen de la API."); } catch (e) {}
    }
};

module.exports = {
    name: 'Maker Gay', // Nombre del plugin
    aliases: ['gay'], // Comando
    description: 'Aplica un filtro de arcoíris a tu avatar o al de alguien mencionado.',
    category: 'Diversión',
    // groupOnly: false, // Funciona en cualquier chat
    execute: execute,
    marketplace: {
        tebex_id: 7383068,
        price: "3.00",
        icon: "fa-rainbow",
        preview: {
            suggestions: ["!gay", "!gay @Usuario"],
            responses: {
                "!gay": {
                    text: "🏳️‍🌈 *Procesando imagen...*\n\nEres gay @Usuario 🏳️‍🌈",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775772735049.webp" // Simulación del filtro
                },
                "!gay @Usuario": {
                    text: "🌈 *Procesando imagen...*\n\nEres gay @Usuario 🏳️‍🌈",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775772735049.webp" // Simulación del filtro
                }   
            }
        }
    },
};
