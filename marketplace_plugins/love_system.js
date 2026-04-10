// plugins/Social/love_system.js (Versión Corregida con Lectura Directa)

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const LOVE_DATA_PATH = path.join(__dirname, '..', '..', 'db', 'love_data.json');
const TEXT_MODEL_NAME = 'gemini-2.5-flash';
const COOLDOWN_MS = 60 * 1000; // 1 minuto de cooldown por usuario para evitar spam de análisis

let loveData = {};
const analysisCooldowns = new Map();

let textModel;
if (GOOGLE_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        textModel = genAI.getGenerativeModel({ model: TEXT_MODEL_NAME });
    } catch (e) {
        console.error('[Love System] Error al inicializar Gemini:', e.message);
    }
}

function loadLoveData() {
    try {
        const dbDir = path.dirname(LOVE_DATA_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        if (fs.existsSync(LOVE_DATA_PATH)) {
            loveData = JSON.parse(fs.readFileSync(LOVE_DATA_PATH, 'utf8'));
            console.log('[Love System] Base de datos de afinidad cargada a la caché.');
        }
    } catch (e) { console.error('[Love System] Error al cargar love_data.json:', e); }
}

function saveLoveData() {
    try {
        fs.writeFileSync(LOVE_DATA_PATH, JSON.stringify(loveData, null, 2));
    } catch (e) { console.error('[Love System] Error al guardar love_data.json:', e); }
}

async function analyzeSentiment(messageText) {
    if (!textModel) return 0;
    const prompt = `Analiza el siguiente mensaje y califica el sentimiento del autor hacia la persona con la que habla (Sofía) en una escala de -10 a +10. Tu respuesta DEBE ser solo el número.

Mensaje: "${messageText}"

Puntaje (-10 a +10):`;
    try {
        const result = await textModel.generateContent(prompt);
        const score = parseInt(result.response.text().trim(), 10);
        return isNaN(score) ? 0 : Math.max(-10, Math.min(10, score));
    } catch (e) {
        console.error('[Love System] Error en el análisis de sentimiento:', e.message);
        return 0;
    }
}

async function updateLoveLevel(userId, userName, messageText) {
    const now = Date.now();
    if (analysisCooldowns.has(userId) && (now - analysisCooldowns.get(userId) < COOLDOWN_MS)) return;
    analysisCooldowns.set(userId, now);

    if (!loveData[userId]) {
        loveData[userId] = { name: userName, level: 50 };
    }
    
    const scoreChange = await analyzeSentiment(messageText);
    
    if (scoreChange !== 0) {
        loveData[userId].level = Math.max(0, Math.min(100, (loveData[userId].level || 50) + scoreChange));
        loveData[userId].name = userName;
        console.log(`[Love System] Afinidad de ${userName} cambió por ${scoreChange}. Nuevo nivel: ${loveData[userId].level}`);
        saveLoveData();
    }
}

/**
 * ¡FUNCIÓN CORREGIDA!
 * Obtiene el nivel de afinidad de un usuario LEYENDO DIRECTAMENTE DEL ARCHIVO JSON.
 */
function getLoveLevel(userId) {
    try {
        // Leemos el archivo cada vez que se llama a esta función.
        if (fs.existsSync(LOVE_DATA_PATH)) {
            const currentData = JSON.parse(fs.readFileSync(LOVE_DATA_PATH, 'utf8'));
            // Devolvemos el nivel del usuario si existe en el archivo, o 50 si no.
            return currentData[userId] ? currentData[userId].level : 50;
        }
    } catch (e) {
        console.error('[Love System] Error al leer love_data.json en getLoveLevel:', e);
    }
    // Si el archivo no existe o hay un error, devolvemos el valor de la caché como fallback.
    return loveData[userId] ? loveData[userId].level : 50;
}

module.exports = {
    name: 'Sistema de Afinidad',
    aliases: ['lovelevel', 'afinidad', 'love'],
    description: 'Muestra tu nivel de afinidad con Sofía.',
    category: 'Social',
    updateLoveLevel,
    getLoveLevel,
    marketplace: {
        tebex_id: 7383021,
        price: "10.00",
        icon: "fa-heart-circle-check",
        preview: {
            suggestions: ["!lovelevel", "!afinidad"],
            responses: {
                "!lovelevel": "¡OMG, Usuario! Nuestra afinidad es de *94%*.\n❤️❤️❤️❤️❤️❤️❤️❤️❤️🖤\nMe caes súper bien, eres de mis personas favoritas uwu 🥰",
                "!afinidad": "Hmm, Usuario, nuestra afinidad es de *45%*.\n❤️❤️❤️❤️🖤🖤🖤🖤🖤🖤\nSupongo que está bien, ni fu ni fa."
            }
        }
    },
    

    onLoad: () => {
        loadLoveData();
    },

    async execute(sock, msg) {
        const userId = msg.author;
        // Ahora esta llamada siempre devolverá el valor más actualizado del archivo JSON.
        const level = getLoveLevel(userId);
        const userName = (await msg.getContact()).pushname || userId.split('@')[0];

        const filledHearts = Math.floor(level / 10);
        const emptyHearts = 10 - filledHearts;
        const meter = '❤️'.repeat(filledHearts) + '🖤'.repeat(emptyHearts);

        let message;
        if (level >= 90) {
            message = `¡OMG, ${userName}! Nuestra afinidad es de *${level}%*.\n${meter}\nMe caes súper bien, eres de mis personas favoritas uwu 🥰`;
        } else if (level >= 70) {
            message = `Nuestra afinidad es de *${level}%*, ${userName}.\n${meter}\nMe agrada hablar contigo, eres genial 😊.`;
        } else if (level >= 40) {
            message = `Hmm, ${userName}, nuestra afinidad es de *${level}%*.\n${meter}\nSupongo que está bien, ni fu ni fa.`;
        } else if (level >= 20) {
            message = `Nuestra afinidad es de *${level}%*, ${userName}.\n${meter}\nMeh, como que no conectamos mucho, ¿no? 😒`;
        } else {
            message = `...Nuestra afinidad es de *${level}%*, ${userName}.\n${meter}\nMejor ni hablemos. 🙄`;
        }

        await msg.reply(message);
    }
};