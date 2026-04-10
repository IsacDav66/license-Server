// plugins/lyrics.js

const axios = require('axios');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Función para introducir un retraso
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Traducciones ---
const translations = {
    es: {
        texto1: "Por favor, proporciona el nombre de la canción.\nEjemplo:",
        texto2: [
            "🎵 Título:",
            "🎤 Artista:",
            "📃 Letra:",
            "❌ ¡Ha ocurrido un error al buscar la letra! Intenta con otro nombre o asegúrate de que el token de Genius esté configurado correctamente.",
            "ℹ️ La función de previsualización de audio no está disponible en este momento."
        ]
    }
};

// --- Función Auxiliar para Buscar Letras con Genius API y Scraping ---
async function searchLyricsGenius(term) {
    const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

    if (!GENIUS_ACCESS_TOKEN) {
        console.error("GENIUS_ACCESS_TOKEN no está definido en las variables de entorno.");
        return { status: false, message: "Genius API token no configurado." };
    }
    if (!term) return { status: false, message: "Proporciona el nombre de la canción." };

    try {
        // 1. Buscar la canción usando la API de búsqueda de Genius
        const searchResponse = await axios.get(
            `https://api.genius.com/search?q=${encodeURIComponent(term)}`,
            {
                headers: {
                    Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}`
                }
            }
        );

        const hits = searchResponse.data?.response?.hits;
        if (!hits || hits.length === 0) {
            return { status: false, message: `No se encontraron resultados en Genius para "${term}".` };
        }

        // Tomar el primer resultado más relevante
        const songData = hits[0].result;
        const lyricsPageUrl = songData.url;

        if (!lyricsPageUrl) {
            return { status: false, message: `No se encontró URL de la letra para "${songData.title} - ${songData.artist_names}".` };
        }

        // 2. Scrapear la página de la letra para obtener el texto
        const pageResponse = await axios.get(lyricsPageUrl);
        const $ = cheerio.load(pageResponse.data);

        let lyricsText = "";
        // Selector principal de Genius
        $('div[data-lyrics-container="true"]').each((i, elem) => {
            $(elem).find('br').replaceWith('\n'); // Reemplazar <br> con saltos de línea
            lyricsText += $(elem).text().trim() + '\n\n';
        });
        
        // Selector alternativo si el principal no funciona
        if (!lyricsText.trim()) {
            lyricsText = $('[class^="Lyrics__Container"]').text().trim() || $('[data-lyrics-container]').text().trim();
            // Si aún no hay letra, buscar en elementos 'p' dentro de una estructura común
            if (!lyricsText.trim()) {
                let paragraphLyrics = '';
                $('.Lyrics__Root-sc-1ynbvzw-0.jpGUoD > p').each((i, elem) => {
                    paragraphLyrics += $(elem).text().trim() + '\n\n';
                });
                lyricsText = paragraphLyrics.trim();
            }
        }


        if (!lyricsText.trim()) {
            return { status: false, message: `No se pudo extraer la letra de la página de Genius para "${songData.title} - ${songData.artist_names}".` };
        }

        // 3. Devolver los resultados
        return {
            status: true,
            creador: "Genius API & Scraping",
            title: songData.title,
            fullTitle: songData.full_title,
            artist: songData.artist_names,
            url: songData.url,
            image: songData.header_image_url || songData.image_url || "https://via.placeholder.com/500x500.png?text=Genius",
            lyrics: lyricsText.trim()
        };

    } catch (error) {
        console.error("[Genius API Error] Fallo al buscar o scrapear letras:", error.message);
        if (error.response && error.response.status === 401) {
            return { status: false, message: "Token de Genius API inválido o expirado." };
        }
        if (error.response && error.response.status === 403) {
             return { status: false, message: "Acceso denegado a la API de Genius. Posiblemente límite de tasa excedido." };
        }
        return {
            status: false,
            message: `Ocurrió un error al buscar letras en Genius: ${error.message}`,
            errorDetails: error
        };
    }
}

// --- Función Principal del Plugin (execute) ---
async function execute(sock, adaptedMessage, args, potentialCommandName) {
    const lang = 'es';
    const tradutor = translations[lang];

    const teks = args.join(' ').trim();
    if (!teks) {
        await adaptedMessage.reply(`*${tradutor.texto1} !${potentialCommandName} beret ojala*`);
        return;
    }

    try {
        const lyricsData = await searchLyricsGenius(teks);

        if (!lyricsData.status) {
            console.error(`[Lyrics Plugin] Fallo al obtener las letras: ${lyricsData.message}`);
            await adaptedMessage.reply(`*${tradutor.texto2[3]} (Detalles: ${lyricsData.message})*`);
            return;
        }

        const tituloL = lyricsData.title || "Desconocido";
        const artistaL = lyricsData.artist || "Desconocido";
        let img = lyricsData.image;

        if (!img || (typeof img === 'string' && img.includes("https://cdn.genius.com/images/default"))) {
            try {
                const urlSomeRandomAPI = `https://some-random-api.com/lyrics?title=${encodeURIComponent(artistaL + " " + tituloL)}`;
                const resSomeRandomAPI = await fetch(urlSomeRandomAPI);
                const jsonSomeRandomAPI = await resSomeRandomAPI.json();
                img = jsonSomeRandomAPI?.thumbnail?.genius;
                if (!img) throw new Error("No thumbnail from some-random-api.");
            } catch (e) {
                console.warn(`[Lyrics Plugin] Fallo al obtener miniatura de some-random-api: ${e.message}`);
                img = "https://via.placeholder.com/500x500.png?text=No+Image";
            }
        }
        
        if (!img) {
            img = "https://via.placeholder.com/500x500.png?text=No+Image";
        }

         // --- Envío de la imagen y metadatos ---
        const metaMessage = `${tradutor.texto2[0]} *${tituloL}*\n${tradutor.texto2[1]}  *${artistaL}*\n\n${tradutor.texto2[2]} \n`;
        await sock.sendMessage(
            adaptedMessage.from,
            { image: { url: img }, caption: metaMessage },
            { quoted: adaptedMessage._baileysMessage },
        );

        // --- Envío de la letra línea por línea ---
        const lyricsLines = lyricsData.lyrics.split('\n').filter(line => line.trim() !== '');
        for (const line of lyricsLines) {
            if (line.trim() !== '') { // Asegurarse de no enviar líneas vacías adicionales
                await sock.sendMessage(adaptedMessage.from, { text: line.trim() });
                await sleep(500); // <-- AUMENTAR ESTE VALOR. Probemos con 500ms
            }
        }
        
        // Mensaje final sobre la previsualización de audio
        await sock.sendMessage(adaptedMessage.from, { text: tradutor.texto2[4] });

    } catch (e) {
        console.error(`[Lyrics Plugin] Error crítico al ejecutar el comando: ${e.message}`, e);
        await adaptedMessage.reply(`*${tradutor.texto2[3]}*`);
    }
}


// --- Exportación del Plugin ---
module.exports = {
    name: "Lyrics Search (Genius Official)",
    aliases: ["lirik", "lyrics", "lyric", "letra"],
    description: "Busca la letra de una canción usando la API oficial de Genius y la envía línea por línea.",
    category: "Internet",
    groupOnly: false,
    execute,
    // --- NUEVO: CONFIGURACIÓN PARA EL MARKETPLACE ---
    marketplace: {
        requirements: ["Genius API Token"],
        tebex_id: 7383038,
        price: "5.00",
        icon: "fa-music",
        preview: {
            suggestions: ["!lyrics queen bohemian rhapsody", "!letra champions"],
            responses: {
                "!lyrics queen bohemian rhapsody": {
                    text: "🎵 Título: *Bohemian Rhapsody*\n🎤 Artista: *Queen*\n\nLetra:\n\n_Is this the real life?_\n_Is this just fantasy?_\n_Caught in a landslide..._\n_No escape from reality..._\n\n(Enviando letra completa línea por línea 🎤)",
                    // Imagen icónica de Queen II / Bohemian Rhapsody
                    image: "https://th.bing.com/th/id/R.7a91344b5d5ace88615e7f0c771024f8?rik=g6WYz%2fRXGEuJvA&riu=http%3a%2f%2fwww.cityandcity.it%2fwp-content%2fuploads%2f2015%2f10%2fbohemian-rhapsody.jpg&ehk=mTpSCtO78Ndu63Nz2ImO21wTye9T9wptJwWMljNoO00%3d&risl=&pid=ImgRaw&r=0"
                },
                "!letra champions": {
                    text: "🎵 Título: *We Are The Champions*\n🎤 Artista: *Queen*\n\nLetra:\n\n_I've paid my dues..._\n_Time after time..._\n_I've done my sentence..._\n_But committed no crime..._\n\n(Enviando letra completa línea por línea 🏆)",
                    image: "https://tse2.mm.bing.net/th/id/OIP.quF-3huJJr8Xt1rquiGAMQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3"
                }
            }
        },
         requirements: ["Genius API Token"]
    },
};