// plugins/brcharacters.js

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas'); // Mantenemos createCanvas y loadImage de 'canvas'
const sharp = require('sharp'); // ¡Importamos sharp!

// Importamos la función necesaria desde shared-economy.js
const { getAllBrainrootsCharacters } = require('../shared-economy');

const MONEY_SYMBOL = '$'; // Símbolo de dinero
const ASSETS_BRAINROOTS_DIR = path.join(__dirname, '..', 'assets', 'brainroots'); // Ruta a las imágenes de los Brainroots

module.exports = {
    name: 'Lista de Brainroots (Imagen Híbrida)', // Nombre actualizado
    aliases: ['brlistimg', 'listabrimg', 'personajesbrimg', 'brcharsimg'],
    description: 'Genera una imagen con todos los personajes Brainroots, usando Sharp para las imágenes y Canvas para la composición y texto.',
    category: 'Brainroots',
    groupOnly: false,
    marketplace: {
        tebex_id: 7383075,
        price: "7.00",
        icon: "fa-images",
        preview: {
            suggestions: ["!brlistimg"],
            responses: {
                "!brlistimg": {
                    text: "*📚 Lista de Personajes Brainroots 📚*\n\nGenerando catálogo visual de criaturas...",
                    image: "https://davcenter.servequake.com/socianark/uploads/post_images/1658008416509@lid-1775773402936.webp" 
                }
            }
        }
    },

    async execute(sock, m) {
        try {
            const allCharacters = await getAllBrainrootsCharacters();

            if (!allCharacters || allCharacters.length === 0) {
                return m.reply('❌ No se encontraron personajes Brainroots disponibles para generar la imagen.');
            }

            // Ordenar los personajes por rareza (descendente) y luego por nombre (ascendente)
            const sortedCharacters = allCharacters.sort((a, b) => {
                if (b.rarity !== a.rarity) {
                    return b.rarity - a.rarity; // Mayor rareza primero
                }
                return a.name.localeCompare(b.name); // Alfabéticamente por nombre si la rareza es igual
            });

            // --- Configuración del Canvas ---
            const PADDING = 20; // Espaciado general
            const ITEM_HEIGHT = 90; // Altura asignada para cada elemento de personaje (imagen + texto)
            const IMAGE_SIZE = 70;  // Tamaño de la miniatura del personaje (ej. 70x70 pixeles)
            const TEXT_X_START = PADDING + IMAGE_SIZE + 20; // Posición X donde empieza el texto (después de la imagen)
            const LINE_HEIGHT = 20; // Altura aproximada de cada línea de texto

            const CANVAS_WIDTH = 650; // Ancho fijo de la imagen final

            // Calculamos la altura del canvas dinámicamente
            const TITLE_HEIGHT = 60; // Altura para el área del título
            const CANVAS_HEIGHT = PADDING + TITLE_HEIGHT + sortedCharacters.length * ITEM_HEIGHT + PADDING;

            const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            const ctx = canvas.getContext('2d');

            // --- Dibujar el Fondo ---
            ctx.fillStyle = '#1a202c'; // Fondo oscuro azul-gris
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // --- Dibujar el Título ---
            ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif'; // Fuente y tamaño para el título
            ctx.fillStyle = '#e2e8f0'; // Color de texto claro para el título
            ctx.textAlign = 'center'; // Centrar el texto
            ctx.fillText('📚 Personajes Brainroots 📚', CANVAS_WIDTH / 2, PADDING + 35);

            let currentY = PADDING + TITLE_HEIGHT; // Posición Y inicial para el primer personaje

            // --- Dibujar cada Personaje ---
            for (let i = 0; i < sortedCharacters.length; i++) {
                const char = sortedCharacters[i];
                const imagePath = path.join(ASSETS_BRAINROOTS_DIR, char.image_filename);

                const itemTopY = currentY + (ITEM_HEIGHT * i); // Posición Y superior de la fila actual del personaje
                const imageDrawY = itemTopY + (ITEM_HEIGHT - IMAGE_SIZE) / 2; // Centra verticalmente la imagen en su altura asignada

                // Dibujar una línea separadora entre los elementos (opcional, mejora la legibilidad)
                if (i > 0) {
                    ctx.strokeStyle = '#4a5568'; // Color para la línea separadora
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(PADDING, itemTopY);
                    ctx.lineTo(CANVAS_WIDTH - PADDING, itemTopY);
                    ctx.stroke();
                }

                // *** CAMBIO CLAVE AQUÍ: Usamos SHARP para cargar/redimensionar y obtener un BUFFER ***
                try {
                    if (fs.existsSync(imagePath)) {
                        const imageBufferFromSharp = await sharp(imagePath)
                            .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }) // Redimensiona manteniendo la proporción, con fondo transparente
                            .png() // Convertir a PNG para que Canvas lo lea sin problemas de formato original
                            .toBuffer();

                        // Ahora, cargamos este BUFFER (que es PNG) en Canvas.loadImage
                        const charImage = await loadImage(imageBufferFromSharp); 
                        ctx.drawImage(charImage, PADDING, imageDrawY, IMAGE_SIZE, IMAGE_SIZE);
                    } else {
                        console.warn(`[Brainroots Characters List IMG] Advertencia: Imagen no encontrada para ${char.name} (${char.image_filename}).`);
                        // Si la imagen falla, dibujar un marcador de posición
                        ctx.fillStyle = '#e53e3e'; // Cuadrado rojo
                        ctx.fillRect(PADDING, imageDrawY, IMAGE_SIZE, IMAGE_SIZE);
                        ctx.fillStyle = '#ffffff'; // Texto blanco
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('NO IMG', PADDING + IMAGE_SIZE / 2, imageDrawY + IMAGE_SIZE / 2 + 5);
                    }
                } catch (imgProcessError) {
                    console.error(`[Brainroots Characters List IMG ERROR] Fallo al procesar la imagen ${char.name} con Sharp/Canvas: ${imgProcessError.message}`);
                    // Dibujar un marcador de posición en caso de error de procesamiento de imagen
                    ctx.fillStyle = '#e53e3e';
                    ctx.fillRect(PADDING, imageDrawY, IMAGE_SIZE, IMAGE_SIZE);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('ERROR', PADDING + IMAGE_SIZE / 2, imageDrawY + IMAGE_SIZE / 2 + 5);
                }
                // *** FIN CAMBIO CLAVE ***

                ctx.textAlign = 'left'; // Alinear texto a la izquierda
                ctx.fillStyle = '#e2e8f0'; // Color de texto claro

                // Nombre del Personaje
                ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
                ctx.fillText(char.name, TEXT_X_START, itemTopY + PADDING + 5);

                // Rareza
                ctx.font = '16px "Segoe UI", Arial, sans-serif';
                ctx.fillText(`Rareza: ${char.rarity}/5`, TEXT_X_START, itemTopY + PADDING + 5 + LINE_HEIGHT);

                // Precio
                ctx.fillText(`Precio: ${MONEY_SYMBOL}${char.price.toLocaleString()}`, TEXT_X_START, itemTopY + PADDING + 5 + LINE_HEIGHT * 2);
            }

            // --- Convertir Canvas a Buffer y Enviar ---
            const finalImageBuffer = canvas.toBuffer('image/png'); // Convierte la imagen a un Buffer PNG

            await sock.sendMessage(m.from, { image: finalImageBuffer, caption: '*📚 Lista de Personajes Brainroots 📚*' }, { quoted: m._baileysMessage });
            console.log(`[Brainroots Characters List IMG] Imagen de lista enviada a ${m.from}.`);

        } catch (error) {
            console.error("[Brainroots Characters List IMG ERROR] Fallo general al generar o enviar la imagen:", error);
            await m.reply("❌ Ocurrió un error al intentar generar la imagen de la lista de personajes Brainroots. Asegúrate de que las librerías 'canvas' y 'sharp' estén instaladas correctamente (¡y sus dependencias del sistema!).");
        }
    },
};