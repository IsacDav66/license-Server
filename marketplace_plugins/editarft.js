// plugins/editarft.js
const axios = require('axios');

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

require('dotenv').config(); // Asegúrate de que dotenv esté configurado

// --- Importar downloadMediaMessage de Baileys ---
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // <--- ¡AÑADIDO ESTO!

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY;
const NANOBANANA_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

module.exports = {
    name: 'EditarFt',
    aliases: ['editarft'],
    category: 'Edicion',
    description: 'Edita una foto (adjunta o de perfil) usando Nano Banana AI con un prompt dado.',
    groupOnly: false, // Puede usarse en grupos y chats privados
    marketplace: {
        externalDependencies: ["axios@^1.11.0","@whiskeysockets/baileys@^7.0.0-rc.9"],
        tebex_id: 7383054,
        price: "15.00",
        icon: "fa-wand-magic-sparkles",
        preview: {
            suggestions: ["!editarft Hazlo realista", "!editarft @Usuario hazlo anime"],
            responses: {
                "!editarft Hazlo realista": {
                    text: "⌛ Obteniendo tu foto de perfil y procesando con Nano Banana AI...\n\n✨ Tu foto editada con éxito:",
                    image: "https://media.seadanceai.com/images/nano-banana_11.webp" 
                },
                "!editarft @Usuario hazlo anime": {
                    text: "⌛ Procesando foto de perfil de @Usuario...\n\n✨ Resultado del estilo Anime:",
                    image: "https://ml.globenewswire.com/Resource/Download/db288b79-72fd-4d0c-aec2-9af171a2882e/nano-banana-ai.jpg"
                }
            }
        }
    },

    /**
     * Función principal que se ejecuta cuando se detecta el comando.
     * @param {import('@whiskeysockets/baileys').WASocket} sock - La instancia del socket de Baileys.
     * @param {object} adaptedMessage - Objeto de mensaje adaptado para facilitar el uso.
     * @param {string[]} args - Los argumentos del comando (sin el prefijo ni el nombre del comando).
     */
    async execute(sock, adaptedMessage, args) {
        if (!NANOBANANA_API_KEY) {
            await adaptedMessage.reply('❌ La clave API de Nano Banana AI no está configurada. Contacta al administrador del bot.');
            console.error('ERROR: NANOBANANA_API_KEY no está definida en .env');
            return;
        }

        let imageBuffer = null;
        let mimeType = null;
        let prompt = '';
        let sourceDescription = ''; // Para el mensaje de "Obteniendo foto de..."

        // --- 1. INTENTAR OBTENER IMAGEN ADJUNTA ---
        // Verificamos si el mensaje es una imagen Y si viene con un comando.
        // Si el mensaje es tipo imagen y contiene el comando, el prompt está en el caption.
        // Si el mensaje es tipo imagen pero NO contiene el comando, esto no debería ejecutarse como comando .editarft
        // La lógica actual ya filtra por comandos, así que adaptedMessage.body debería ser el caption si es una imagen con comando.
        
        // Si el mensaje es una imagen y el comando fue `.editarft` (con o sin argumentos extra en el caption)
        if (adaptedMessage.type === 'image') {
            try {
                // adaptedMessage._baileysMessage contiene el objeto de mensaje original de Baileys
                // Usar la función importada `downloadMediaMessage`
                imageBuffer = await downloadMediaMessage(
                    adaptedMessage._baileysMessage,
                    'buffer',
                    {}, // Opciones, se puede dejar vacío si no se necesita { reupload: true }
                    { logger: sock.logger } // Pasa el logger del socket si es necesario para debug
                );
                mimeType = adaptedMessage._baileysMessage.message.imageMessage.mimetype;
                
                // El prompt será lo que quede de args después de quitar el comando, o el caption si es solo la imagen.
                // Si el comando es ".editarft ponle un gorro", args = ["ponle", "un", "gorro"]
                // Si el comando es ".editarft" y el caption es "ponle un gorro", args = [], prompt del caption
                prompt = args.join(' ').trim();
                if (!prompt && adaptedMessage.body) { // Si no hay args pero sí hay body (caption), usar el body.
                    // Esto maneja el caso donde el usuario solo pone ".editarft" y el prompt es el resto del caption.
                    // Sin embargo, si el caption es ".editarft ponle un gorro", args ya lo capturará.
                    // Esto es para el caso donde el mensaje es literalmente "ponle un gorro" y el comando ".editarft" está implícito en el parseo del comando si body coincide.
                    // La lógica del bot.js ya se encarga de que adaptedMessage.body tenga el caption completo, incluyendo el comando.
                    // Así que necesitamos extraer el prompt DESPUÉS del comando.
                    const commandBody = adaptedMessage.body.toLowerCase();
                    const aliasUsed = module.exports.aliases.find(alias => commandBody.startsWith(`.${alias.toLowerCase()}`));
                    if (aliasUsed) {
                        prompt = adaptedMessage.body.slice(aliasUsed.length + 1).trim(); // +1 para el punto
                    } else {
                        prompt = adaptedMessage.body.trim(); // Fallback
                    }
                }

                sourceDescription = 'la imagen adjunta';

                // Si se detectó una imagen adjunta, ya tenemos la imagen y el posible prompt del caption.
                // No necesitamos buscar fotos de perfil en este caso.
            } catch (dlError) {
                console.error('Error al descargar la imagen adjunta:', dlError);
                await adaptedMessage.reply('❌ No pude descargar la imagen adjunta. Asegúrate de que no sea un mensaje muy antiguo o corrupto.');
                return;
            }
        }

        // --- 2. SI NO HAY IMAGEN ADJUNTA, USAR FOTO DE PERFIL ---
        if (!imageBuffer) { // Solo si no se encontró una imagen adjunta
            let targetJid;

            if (adaptedMessage.mentionedJidList && adaptedMessage.mentionedJidList.length > 0) {
                targetJid = adaptedMessage.mentionedJidList[0];
                // El prompt comienza después de la mención
                const mentionIndex = args.findIndex(arg => arg.includes('@')); 
                if (mentionIndex !== -1) {
                    prompt = args.slice(mentionIndex + 1).join(' ').trim();
                } else {
                    prompt = args.join(' ').trim();
                }
                sourceDescription = `la foto de perfil de ${targetJid.split('@')[0]}`;
            } else {
                // Si no hay mención, usa el JID del remitente
                targetJid = adaptedMessage.author;
                prompt = args.join(' ').trim();
                sourceDescription = `tu foto de perfil (${targetJid.split('@')[0]})`;
            }

            if (!targetJid) {
                await adaptedMessage.reply('❌ No se pudo determinar la fuente de la foto. Adjunta una imagen, menciona a un usuario o usa el comando sin mención para tu propia foto de perfil.');
                return;
            }

            try {
                const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                if (!ppUrl) {
                    await adaptedMessage.reply(`❌ No se encontró foto de perfil para el usuario ${targetJid.split('@')[0]}.`);
                    return;
                }
                const imageResponse = await axios.get(ppUrl, { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(imageResponse.data);
                mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
            } catch (ppError) {
                console.error(`Error al obtener o descargar la foto de perfil para ${targetJid}:`, ppError);
                await adaptedMessage.reply(`❌ Ocurrió un error al obtener la foto de perfil para ${targetJid.split('@')[0]}.`);
                return;
            }
        }

        // --- 3. VALIDAR PROMPT ---
        if (!prompt) {
            await adaptedMessage.reply('Por favor, proporciona un prompt para la edición. Ejemplos:\n- Adjunta una imagen con la descripción: `.editarft Un sombrero de vaquero`\n- Con mención: `.editarft @usuario Un gorro de fiesta`\n- Para tu foto de perfil: `.editarft Un fondo abstracto`');
            return;
        }

        await adaptedMessage.reply(`⌛ Obteniendo ${sourceDescription} y procesando con Nano Banana AI...`);

        try {
            const base64Image = imageBuffer.toString('base64');

            // 4. Preparar la solicitud a la API de Nano Banana (Gemini)
            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: prompt }, // El prompt de texto para la edición
                            {
                                inlineData: { // Usar camelCase como se ve en la documentación de Gemini
                                    mimeType: mimeType, // Usar camelCase
                                    data: base64Image // La imagen original en Base64
                                }
                            }
                        ]
                    }
                ]
            };

            const apiUrlWithKey = `${NANOBANANA_API_URL}?key=${NANOBANANA_API_KEY}`;
            
            // 5. Realizar la llamada a la API
            const nanoBananaResponse = await axios.post(apiUrlWithKey, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // 6. Extraer la imagen editada de la respuesta
            const responseData = nanoBananaResponse.data;
            let editedImageBase64 = null;
            let editedImageMimeType = 'image/jpeg'; 

            if (responseData && responseData.candidates && responseData.candidates.length > 0) {
                const firstCandidate = responseData.candidates[0];
                if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
                    for (const part of firstCandidate.content.parts) {
                        if (part.inlineData && part.inlineData.data) { // Usar camelCase
                            editedImageBase64 = part.inlineData.data;   // Usar camelCase
                            editedImageMimeType = part.inlineData.mimeType || 'image/jpeg'; // Usar camelCase
                            break; // Se encontró la imagen, salir del bucle
                        }
                    }
                }
            }

            if (editedImageBase64) {
                const editedImageBuffer = Buffer.from(editedImageBase64, 'base64');
                // 7. Enviar la imagen editada de vuelta al chat
                await sock.sendMessage(
                    adaptedMessage.from,
                    { image: editedImageBuffer, caption: `✨ Tu foto editada con Nano Banana AI:\n_"${prompt}"_` },
                    { quoted: adaptedMessage._baileysMessage } // Usar el mensaje original para la cita
                );
            } else {
                console.error('Nano Banana AI API no devolvió una imagen en el formato esperado:', responseData);
                await adaptedMessage.reply('❌ No se pudo obtener la imagen editada de Nano Banana AI. Revisa la consola para más detalles o intenta un prompt diferente.');
            }

        } catch (error) {
            console.error('Error al editar la foto con Nano Banana AI:', error.response ? error.response.data : error.message);
            await adaptedMessage.reply(`❌ Ocurrió un error al editar la foto: ${error.response?.data?.error?.message || error.message}.`);
            if (error.response && error.response.status === 403) {
                 await adaptedMessage.reply('Puede que la clave API no sea válida o no tenga permisos para usar este modelo.');
            } else if (error.response && error.response.status === 400) {
                await adaptedMessage.reply('El prompt o la imagen pueden haber causado un error en la API de Nano Banana. Intenta un prompt diferente.');
            }
        }
    }
};