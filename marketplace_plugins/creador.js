// plugins/creador.js
const fs = require('fs'); // Necesitamos 'fs' para leer el archivo del sticker
const path = require('path'); // Necesitamos 'path' para construir la ruta al sticker

module.exports = {
    name: "Creador",
    aliases: ["creador"],
    description: "Muestra información sobre el creador del bot Stun y envía un sticker.", // Descripción actualizada
    category: "Info",
    marketplace: {
        tebex_id: 7383039,
        price: "2.00",
        icon: "fa-user-gear",
        preview: {
            suggestions: ["!creador"],
            responses: {
                "!creador": {
                    text: "♨️𝙎𝙩𝙪𝙣 𝘽𝙤𝙩 | 𝙂𝙧𝙪𝙥𝙤 𝘼𝙣𝙖𝙧𝙦𝙪𝙞𝙘𝙤 ♨️\n\n𝙐𝙣𝙞𝙘𝙤 𝙘𝙧𝙚𝙖𝙙𝙤𝙧 @51959442730\n𝘿𝙚𝙨𝙖𝙧𝙧𝙤𝙡𝙡𝙤 𝙚𝙣 𝙉𝙤𝙙𝙚𝙅𝙎\n2025",
                    image: "https://i.pinimg.com/originals/2e/2d/71/2e2d71661da0568bce11847e896c9e91.jpg" // Simula el sticker
                    
                }
            }
        }
    },

    async execute(sock, m) {
        // JID completo del creador para la mención interna de WhatsApp
        const creatorJid = "51959442730@s.whatsapp.net"; 
        
        // Solo el número para mostrar en el texto de la mención
        const creatorNumberForText = creatorJid.split('@')[0]; 

        // Construcción del mensaje con el formato específico solicitado
        const message = `♨️𝙎𝙩𝙪𝙣 𝘽𝙤𝙩 | 𝙂𝙧𝙪𝙥𝙤 𝘼𝙣𝙖𝙧𝙦𝙪𝙞𝙘𝙤 ♨️\n\n` +
                        `𝙐𝙣𝙞𝙘𝙤 𝙘𝙧𝙚𝙖𝙙𝙤𝙧  @${creatorNumberForText} \n` + // Aquí se inserta la mención
                        `𝘿𝙚𝙨𝙖𝙧𝙧𝙤𝙡𝙡𝙤 𝙚𝙣 𝙉𝙤𝙙𝙚𝙅𝙎\n` +
                        `2025`;

        // --- Configuración del Sticker ---
        // Construye la ruta al sticker. 
        // __dirname es el directorio actual (plugins). Subimos un nivel (..) para ir al raíz del bot,
        // luego entramos en 'assets' y luego en 'creator'.
        const stickerFileName = 'sticker.webp'; // <--- ¡CAMBIA ESTO AL NOMBRE REAL DE TU ARCHIVO!
        const stickerPath = path.join(__dirname, '../../assets/creator', stickerFileName);
        
        try {
            // 1. Envía el mensaje de texto primero
            await sock.sendMessage(
                m.from, // El ID del chat (grupo o privado)
                { 
                    text: message, 
                    mentions: [creatorJid] // Array de JIDs para que WhatsApp realice la mención
                },
                { quoted: m._baileysMessage } // Opcional: Para que el mensaje sea una respuesta
            );

            // 2. Verifica si el archivo del sticker existe y luego envíalo
            if (fs.existsSync(stickerPath)) {
                const stickerBuffer = fs.readFileSync(stickerPath); // Lee el archivo
                await sock.sendMessage(
                    m.from, 
                    { sticker: stickerBuffer } // Envía el sticker como un Buffer
                    // Nota: Los stickers generalmente no se citan, pero puedes añadir { quoted: m._baileysMessage } aquí si lo deseas.
                );
                console.log(`[Creador Plugin] Sticker '${stickerFileName}' enviado con éxito.`);
            } else {
                console.warn(`[Creador Plugin] Advertencia: El archivo de sticker no se encontró en la ruta: ${stickerPath}`);
                await sock.sendMessage(m.from, { text: "⚠️ No pude enviar el sticker del creador. Asegúrate de que el archivo exista en `assets/creator`." });
            }

        } catch (error) {
            console.error("[Creador Plugin ERROR] Fallo al enviar mensaje o sticker:", error);
            await m.reply("❌ Ocurrió un error al intentar mostrar la información del creador o enviar el sticker.");
        }
    },
};