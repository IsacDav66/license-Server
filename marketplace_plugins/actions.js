// plugins/actions_dynamic.js (Versión Estable y Completa)

const axios = require('axios');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// --- CONFIGURACIÓN ---
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const OWNER_ID = '1658008416509@lid';

// --- CONFIGURACIÓN ANTI-SPAM ---
const MAX_ACTIONS_PER_HOUR = 3;
const ACTION_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const ACTION_USAGE_DB_PATH = path.join(__dirname, '..', '..', 'db', 'action_usage.json');
let actionUsage = {}; // Guardará { userId: [timestamp1, ...] }
const managementCooldowns = new Map(); // Cooldown simple para comandos de gestión
// ------------------------------------

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const ACTIONS_DB_PATH = path.join(__dirname, '..', '..', 'db', 'custom_actions.json');
const PROTECTION_DB_PATH = path.join(__dirname, '..', '..', 'db', 'action_protection.json');
const SETTINGS_DB_PATH = path.join(__dirname, '..', '..', 'db', 'actions_settings.json');


// --- ACCIONES BASE ---
const baseActionDetails = {
    kiss: {
        textWithMention: (actor, target) => `${actor} le dio un beso a ${target} 😘`,
        textSelf: (actor) => `${actor} se mandó un beso al aire 😘`,
        textNoMention: (actor) => `${actor} está repartiendo besos al azar 😘`,
        mediaUrls: [
            "https://media.tenor.com/R-oYdfpAGpUAAAPo/pin-back.mp4",
            "https://media.tenor.com/cQzRWAWrN6kAAAPo/ichigo-hiro.mp4",
            "https://media.tenor.com/xDCr6DNYcZEAAAPo/sealyx-frieren-beyond-journey%27s-end.mp4",
            "https://media.tenor.com/YhGc7aQAI4oAAAPo/megumi-kato-kiss.mp4",
            "https://media.tenor.com/ZDqsYLDQzIUAAAPo/shirayuki-zen-kiss-anime.mp4",
            "https://media.tenor.com/OByUsNZJyWcAAAPo/emre-ada.mp4"
        ]
    },
    slap: {
        textWithMention: (actor, target) => `${actor} le dio una cachetada a ${target} 😠`,
        textSelf: (actor) => `${actor} se golpeó solo/a... ¿por qué? 🤔`,
        textNoMention: (actor) => `${actor} está buscando a quién cachetear 😠`,
        mediaUrls: [
            "https://media.tenor.com/wOCOTBGZJyEAAAPo/chikku-neesan-girl-hit-wall.mp4",
            "https://media.tenor.com/Ws6Dm1ZW_vMAAAPo/girl-slap.mp4",
            "https://media.tenor.com/XiYuU9h44-AAAAPo/anime-slap-mad.mp4",
            "https://media.tenor.com/Sv8LQZAoQmgAAAPo/chainsaw-man-csm.mp4",
            "https://media.tenor.com/68_5cN3wpJcAAAPo/slap-anime-girl.mp4",
            "https://media.tenor.com/WYmal-WAnksAAAPo/yuzuki-mizusaka-nonoka-komiya.mp4"
        ]
    },
    spank: {
        textWithMention: (actor, target) => `${actor} le dio una nalgada a ${target} 😏`,
        textSelf: (actor) => `${actor} intentó darse una nalgada... ¡qué flexibilidad! 😂`,
        textNoMention: (actor) => `${actor} anda con ganas de dar nalgadas 😏`,
        mediaUrls: [
        "https://media.tenor.com/Sp7yE5UzqFMAAAPo/spank-slap.mp4",
        "https://media.tenor.com/iz6t2EwKeYMAAAPo/rikka-takanashi-chunibyo.mp4",
        "https://media.tenor.com/sdSmiixaAj0AAAPo/anime-anime-girl.mp4",
        "https://media.tenor.com/Tj6GzyCetQwAAAPo/spank-rank.mp4",
        "https://media.tenor.com/uER90n0laEEAAAPo/anime-spanking.mp4",
        "https://media.tenor.com/CAesvxP0KyEAAAPo/shinobu-kocho-giyuu-tomioka.mp4"
        ]
    },
    hug: {
        textWithMention: (actor, target) => `${actor} abrazó tiernamente a ${target} 🤗`,
        textSelf: (actor) => `${actor} se dio un auto-abrazo. ¡Quiérete mucho! 🤗`,
        textNoMention: (actor) => `${actor} está regalando abrazos 🤗`,
        mediaUrls: [
            "https://media.tenor.com/2HxamDEy7XAAAAPo/yukon-child-form-embracing-ulquiorra.mp4",
            "https://media.tenor.com/7f9CqFtd4SsAAAPo/hug.mp4",
            "https://media.tenor.com/IpGw3LOZi2wAAAPo/hugtrip.mp4",
            "https://media.tenor.com/HBTbcCNvLRIAAAPo/syno-i-love-you-syno.mp4",
            "https://media.tenor.com/nsqfGxcuD2cAAAPo/hug-comfortable.mp4"
        ]
    },
    pat: {
        textWithMention: (actor, target) => `${actor} le dio unas palmaditas en la cabeza a ${target} 😊`,
        textSelf: (actor) => `${actor} se dio palmaditas en la cabeza. ¡Buen chico/a! 😊`,
        textNoMention: (actor) => `${actor} está dando palmaditas al aire 😊`,
        mediaUrls: [
            "https://media.tenor.com/kIh2QZ7MhBMAAAPo/tsumiki-anime.mp4",
            "https://media.tenor.com/wLqFGYigJuIAAAPo/mai-sakurajima.mp4",
            "https://media.tenor.com/E6fMkQRZBdIAAAPo/kanna-kamui-pat.mp4",
            "https://media.tenor.com/fro6pl7src0AAAPo/hugtrip.mp4", // Esta URL parece más de abrazo, considera cambiarla
            "https://media.tenor.com/N41zKEDABuUAAAPo/anime-head-pat-anime-pat.mp4",
            "https://media.tenor.com/7xrOS-GaGAIAAAPo/anime-pat-anime.mp4"
        ]
    },
    cum: {
        nsfw: true,
        textWithMention: (actor, target) => `${actor} se vino en ${target} 😳`,
        textSelf: (actor) => `${actor} se vino en todo el grupo 😳`,
        textNoMention: (actor) => `${actor} está repartiendo cum al azar 😳`,
        mediaUrls: [
            "https://media.tenor.com/G7OxpqAjv4MAAAPo/nut-orgasm.mp4",
            "https://media.tenor.com/8HmBaAMzUr0AAAPo/cum-anime.mp4",
            "https://media.tenor.com/kTxV4---9JoAAAPo/cry-about-it-meme-gif-cry-about-it-meme.mp4",
            "https://img4.gelbooru.com//images/f6/7b/f67bab2796c7ce66fafcd9d5403a838a.gif",
            "https://img.xbooru.com//images/19/66b17936aeabc5f4f39e7d0523b774a4c56ca461.gif?23979",
            "https://xbooru.com/images/19/8ff572c1f3542b17f2d96ec47a5fba2e29b67929.gif",
            "https://xbooru.com/images/19/c37384c7bffd348d36eb3476d6319b5cbd33b360.gif",
            "https://cdn.hentaigifz.com/58180/pink-hair-hentai-facial.gif",
            
        ]
    },
     coger: {
        nsfw: true,
        textWithMention: (actor, target) => `${actor} se cogio a ${target} 🥵`,
        textSelf: (actor) => `${actor} se cogio a todo el grupo 🥵`,
        textNoMention: (actor) => `${actor} está con ganas de coger 🥵`,
        mediaUrls: [
            "https://media.tenor.com/fVw_E74xYnUAAAAM/couple-anime.gif",
            "https://pa1.aminoapps.com/6166/533f549255d3874a79aee11354a550ec0a273358_hq.gif",
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCPiZ_KvnaLdhQs5jdC23TxLxYGoena6b5iA&s",
            "https://media.tenor.com/5Me54nLWWE8AAAAM/anime-sex-sign.gif",
            "https://cdn.hentaigifz.com/90294/anime-gif.gif",
            "https://gifspx.com/gifs-animados-x/gspx_terminando-de-repasar-la-leccion-con-mi-amigo.gif",
            "https://cdn.hentaigifz.com/84940/hentai-cumshot.gif",

        ]
    },
    cry: {
        textWithMention: (actor, target) => `${actor} lloro por ${target} 😭`,
        textSelf: (actor) => `${actor} esta llorando 😭`,
        textNoMention: (actor) => `${actor} esta llorando 😭`,
        mediaUrls: [
           "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUydTlnbGF1MTRndTIwbnN4dXRrbnpobmozdTFoZnIybjg1N2FmNnhiciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ROF8OQvDmxytW/giphy.gif",
           "https://media1.tenor.com/m/swPvcgbqz7EAAAAC/sad-anime.gif",
           "https://media.tenor.com/Bt0hLGWGkUAAAAPo/anime-cry.mp4",
           "https://gifdb.com/images/high/sad-anime-boy-crying-in-the-rain-lwbg24vjooefw5gx.gif",
           "https://i.pinimg.com/originals/32/82/a8/3282a83025d5f2eb8bfa799bbf13874b.gif",
           "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyYXl1dTllNGhiZjI1NzY3c3AwY3FrdndsZzM2aXQybmJlN2d1M2tyNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/zQnzQCW8IhjkA/200w.gif"
        ]
    },
};

// --- GESTIÓN DE BASES DE DATOS ---
let customActions = {};
let protectionData = {};
let nsfwEnabled = true;
const notifiedUsers = new Map();

function loadDatabases() {
    try {
        const dbDir = path.dirname(ACTIONS_DB_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        if (fs.existsSync(ACTIONS_DB_PATH)) customActions = JSON.parse(fs.readFileSync(ACTIONS_DB_PATH, 'utf-8'));
        else fs.writeFileSync(ACTIONS_DB_PATH, JSON.stringify({}, null, 2));
        
        if (fs.existsSync(PROTECTION_DB_PATH)) {
            const rawData = JSON.parse(fs.readFileSync(PROTECTION_DB_PATH, 'utf-8'));
            protectionData = Array.isArray(rawData.users) ? {} : rawData;
        } else {
             fs.writeFileSync(PROTECTION_DB_PATH, JSON.stringify({}, null, 2));
        }

        if (fs.existsSync(SETTINGS_DB_PATH)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_DB_PATH, 'utf-8'));
            nsfwEnabled = settings.nsfw !== false;
        } else {
            saveSettings();
        }

        if (fs.existsSync(ACTION_USAGE_DB_PATH)) {
            actionUsage = JSON.parse(fs.readFileSync(ACTION_USAGE_DB_PATH, 'utf-8'));
        } else {
            fs.writeFileSync(ACTION_USAGE_DB_PATH, JSON.stringify({}, null, 2));
        }
    } catch (e) { console.error("[Actions Plugin] Error al cargar bases de datos:", e); }
}

function saveCustomActions() { try { fs.writeFileSync(ACTIONS_DB_PATH, JSON.stringify(customActions, null, 2)); } catch (e) {} }
function saveProtectionData() { try { fs.writeFileSync(PROTECTION_DB_PATH, JSON.stringify(protectionData, null, 2)); } catch (e) {} }
function saveSettings() { try { fs.writeFileSync(SETTINGS_DB_PATH, JSON.stringify({ nsfw: nsfwEnabled }, null, 2)); } catch (e) {} }
function saveActionUsage() { try { fs.writeFileSync(ACTION_USAGE_DB_PATH, JSON.stringify(actionUsage, null, 2)); } catch (e) {} }

loadDatabases();

// --- FUNCIONES AUXILIARES ---
function msToTime(duration) {
    if (duration < 0) duration = 0;
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const seconds = Math.floor((duration / 1000) % 60);
    return `${minutes}m ${seconds}s`;
}

async function downloadFile(url, outputPath) {
    let finalUrl = url;
    if (url.includes('share.google')) {
        console.log('[Actions Downloader] Enlace de Google Share detectado. Extrayendo URL directa...');
        try {
            // Hacemos la petición disfrazados de un navegador Chrome en Windows
            const pageResponse = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                }
            });
            const html = pageResponse.data;

            // Buscamos la URL dentro de una etiqueta <img>, que es más directa.
            // Esta regex busca un `src=` seguido de una URL que contenga '.gif' o '.webp'
            const match = html.match(/src="([^"]+\.(gif|webp|jpeg|jpg|png))"/);
            
            if (match && match[1]) {
                finalUrl = match[1];
                console.log(`[Actions Downloader] URL directa extraída desde <img> tag: ${finalUrl.substring(0, 70)}...`);
            } else {
                // Si lo anterior falla, volvemos a intentar con la meta tag como plan B
                const metaMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
                if (metaMatch && metaMatch[1]) {
                    finalUrl = metaMatch[1];
                    console.log(`[Actions Downloader] URL directa extraída desde meta tag: ${finalUrl.substring(0, 70)}...`);
                } else {
                    throw new Error('No se pudo encontrar la URL del GIF en el HTML de Google Share (ni en <img> ni en meta tags).');
                }
            }
        } catch (e) {
            console.error('[Actions Downloader] Error al procesar Google Share:', e.message);
            throw e;
        }
    }
    const response = await axios.get(finalUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(outputPath);
    return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error = null;
        writer.on('error', err => { error = err; writer.close(); reject(err); });
        writer.on('close', () => { if (!error) resolve(outputPath); });
    });
}

function getAllActions() { return { ...baseActionDetails, ...customActions }; }

function determineTarget(msg) {
    const baileysMsg = msg._baileysMessage;
    const mentionedJids = msg.mentionedJidList || [];
    if (mentionedJids.length > 0) return { targetJid: mentionedJids[0] };
    const quotedMsg = baileysMsg.message?.extendedTextMessage?.contextInfo;
    if (quotedMsg?.quotedMessage) return { targetJid: quotedMsg.participant || msg.from };
    return { targetJid: null };
}

function buildResponse(action, senderJid, targetJid, commandName) {
    const senderMention = `@${senderJid.split('@')[0]}`;
    let responseText = "";
    let jidsToMention = [senderJid];
    if (action.isCustom) {
        const phrase = action.phrase || `le hizo *${commandName}* a`;
        const emoji = action.emoji || '👾';
        if (targetJid) {
            if (jidNormalizedUser(targetJid) === jidNormalizedUser(senderJid)) responseText = `${senderMention} se ${phrase.replace(/ a$/, '')} a sí mismo ${emoji}`;
            else {
                const targetMention = `@${targetJid.split('@')[0]}`;
                responseText = `${senderMention} ${phrase} ${targetMention} ${emoji}`;
                jidsToMention.push(targetJid);
            }
        } else responseText = `${senderMention} ${phrase} todos ${emoji}`;
    } else {
        if (targetJid) {
            if (jidNormalizedUser(targetJid) === jidNormalizedUser(senderJid)) responseText = action.textSelf(senderMention);
            else {
                const targetMention = `@${targetJid.split('@')[0]}`;
                responseText = action.textWithMention(senderMention, targetMention);
                jidsToMention.push(targetJid);
            }
        } else responseText = action.textNoMention(senderMention);
    }
    return { responseText, jidsToMention };
}

async function convertToMp4(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath).outputOptions(['-movflags faststart', '-pix_fmt yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'])
            .toFormat('mp4').save(outputPath).on('end', () => resolve(outputPath)).on('error', (err) => reject(err));
    });
}

async function cleanupFiles(files) { for (const file of files) { if (file) try { await fsPromises.unlink(file); } catch (e) {} } }

async function executeAction(sock, msg, commandUsed, actionData) {
    const senderId = msg.author;
    const now = Date.now();
    const userHistory = actionUsage[senderId] || [];
    const recentHistory = userHistory.filter(timestamp => now - timestamp < ACTION_WINDOW_MS);

    if (recentHistory.length >= MAX_ACTIONS_PER_HOUR) {
        const oldestTimestamp = recentHistory[0];
        const timeToWait = ACTION_WINDOW_MS - (now - oldestTimestamp);
        return msg.reply(`🚫 Has alcanzado el límite de ${MAX_ACTIONS_PER_HOUR} acciones por hora.\n\n⏳ Debes esperar *${msToTime(timeToWait)}* para usar otra.`);
    }
    
    if (actionData.nsfw && !nsfwEnabled) return msg.reply('🔞 Los comandos NSFW están actualmente desactivados.');
    const { targetJid } = determineTarget(msg);
    const protectionStatus = protectionData[targetJid];

    if (protectionStatus === 'user_enabled') {
        const notificationKey = `${senderId}->${targetJid}`;
        if (notifiedUsers.has(notificationKey)) return;
        notifiedUsers.set(notificationKey, true);
        return msg.reply(`🛡️ El usuario @${targetJid.split('@')[0]} tiene las acciones desactivadas.`, { mentions: [targetJid] });
    }
    
    recentHistory.push(now);
    actionUsage[senderId] = recentHistory;
    saveActionUsage();
    
    const { responseText, jidsToMention } = buildResponse(actionData, senderId, targetJid, commandUsed);
    if (!actionData.mediaUrls || actionData.mediaUrls.length === 0) {
        return sock.sendMessage(msg.from, { text: responseText, mentions: jidsToMention }, { quoted: msg._baileysMessage });
    }
    let mediaUrls = [...actionData.mediaUrls];
    let success = false;
    const maxRetries = Math.min(mediaUrls.length, 3);
    for (let i = 0; i < maxRetries && !success; i++) {
        const randomIndex = Math.floor(Math.random() * mediaUrls.length);
        const randomUrl = mediaUrls.splice(randomIndex, 1)[0];
        const uniqueId = uuidv4();
        let originalExt = '.tmp';
        try { originalExt = path.extname(new URL(randomUrl).pathname) || '.gif'; } catch (e) {}
        const inputPath = path.join(TEMP_DIR, `${uniqueId}${originalExt}`);
        const outputPath = path.join(TEMP_DIR, `${uniqueId}.mp4`);
        try {
            await downloadFile(randomUrl, inputPath);
            const finalMediaPath = ['.gif', '.webp', '.tmp'].includes(originalExt) ? await convertToMp4(inputPath, outputPath) : inputPath;
            await sock.sendMessage(msg.from, { video: { url: finalMediaPath }, caption: responseText, gifPlayback: true, mentions: jidsToMention }, { quoted: msg._baileysMessage });
            success = true;
        } catch (error) { console.error(`[Actions] Falló URL (intento ${i+1}/${maxRetries}): ${randomUrl} | Error: ${error.message}`);
        } finally { await cleanupFiles([inputPath, outputPath]); }
    }
    if (!success) await sock.sendMessage(msg.from, { text: responseText + " (Fallo visual 😢)", mentions: jidsToMention }, { quoted: msg._baileysMessage });
}

module.exports = {
    name: 'Acciones Dinámicas (Personalizable)',
    aliases: [
        ...Object.keys(baseActionDetails),
        'addaction', 'delaction', 'listactions', 
        'offactions', 'onactions',
        'sinproteccion', 'conproteccion', 'nsfw'
    ],
    description: 'Realiza o gestiona acciones interactivas y su privacidad.',
    category: 'Diversión',
    groupOnly: false,
    marketplace: {
        tebex_id: 7383066,
        price: "15.00",
        icon: "fa-person-rays",
        preview: {
            suggestions: ["!kiss @Usuario", "!slap @Usuario", "!hug @Usuario"],
            responses: {
                "!kiss @Usuario": {
                    text: "@Usuario le dio un beso a @Objetivo 😘",
                    image: "https://c.tenor.com/xDCr6DNYcZEAAAAd/tenor.gif"
                },
                "!slap @Usuario": {
                    text: "@Usuario le dio una cachetada a @Objetivo 😠",
                    image: "https://c.tenor.com/Ws6Dm1ZW_vMAAAAC/tenor.gif"
                },
                "!hug @Usuario": {
                    text: "@Usuario abrazó tiernamente a @Objetivo 🤗",
                    image: "https://c.tenor.com/J7eGDvGeP9IAAAAC/tenor.gif"
                }

            }
        }
    },
    
    async checkMessage(sock, msg) {
        const body = msg.body || "";
        const prefix = body.charAt(0);
        if (!['.', '!', '#'].includes(prefix)) return false;
        const commandUsed = body.slice(1).split(' ')[0].toLowerCase();
        const allActions = getAllActions();
        const managementCommands = ['addaction', 'delaction', 'listactions', 'offactions', 'onactions', 'sinproteccion', 'conproteccion', 'nsfw'];
        if (managementCommands.includes(commandUsed)) return false;
        if (allActions[commandUsed]) {
            await executeAction(sock, msg, commandUsed, allActions[commandUsed]);
            return true;
        }
        return false;
    },

    async execute(sock, msg, args, commandUsed) {
        const senderId = msg.author;
        const now = Date.now();
        const managementCooldown = 10 * 1000;
        const lastUse = managementCooldowns.get(senderId);
        if (lastUse && (now - lastUse < managementCooldown)) {
             const timeLeftSec = Math.ceil((managementCooldown - (now - lastUse)) / 1000);
             return msg.reply(`⏳ ¡Comando rápido! Espera ${timeLeftSec} segundos.`);
        }
        managementCooldowns.set(senderId, now);
        
        switch (commandUsed) {
            case 'addaction': {
                const [newName, newUrl, ...phraseParts] = args;
                if (!newName || !newUrl || !newUrl.startsWith('http')) return msg.reply('Uso: `.addaction <nombre> <url> <frase y emoji>`');
                if (baseActionDetails[newName]) return msg.reply('🔒 No puedes modificar acciones base.');
                if (customActions[newName]) {
                    customActions[newName].mediaUrls.push(newUrl);
                    saveCustomActions();
                    return msg.reply(`✅ Nueva URL agregada a ".${newName}".`);
                }
                let phrase = `le hizo *${newName}* a`;
                let emoji = "✨";
                if (phraseParts.length > 0) {
                    const lastPart = phraseParts[phraseParts.length - 1];
                    if (/\p{Emoji}/u.test(lastPart) || lastPart.length <= 2) {
                        emoji = lastPart;
                        phrase = phraseParts.slice(0, -1).join(' ');
                    } else {
                        phrase = phraseParts.join(' ');
                    }
                }
                customActions[newName] = { isCustom: true, mediaUrls: [newUrl], phrase: (phrase.trim() || `le hizo *${newName}* a`), emoji };
                saveCustomActions();
                return msg.reply(`✨ Acción ".${newName}" creada!`);
            }
            case 'delaction': {
                const name = args[0]?.toLowerCase();
                if (!name) return msg.reply('Uso: .delaction <nombre>');
                if (baseActionDetails[name]) return msg.reply('🔒 Protegido.');
                if (!customActions[name]) return msg.reply('⚠️ No existe.');
                delete customActions[name];
                saveCustomActions();
                return msg.reply(`🗑️ Acción ".${name}" eliminada.`);
            }
            case 'listactions': {
                const customList = Object.keys(customActions).map(k => `.${k}`).join(', ');
                const baseList = Object.keys(baseActionDetails).map(k => `.${k}`).join(', ');
                return msg.reply(`📜 *Acciones:*\n\n*Base:* ${baseList}\n\n*Comunidad:* ${customList || "(Ninguna)"}`);
            }
            case 'offactions': {
                const userId = msg.author;
                const status = protectionData[userId];
                if (status === 'owner_disabled') return msg.reply('❌ Tu protección ha sido desactivada por el propietario.');
                if (status === 'user_enabled') return msg.reply('🛡️ Ya tienes las acciones desactivadas.');
                protectionData[userId] = 'user_enabled';
                saveProtectionData();
                return msg.reply('✅ ¡Protección activada!');
            }
            case 'onactions': {
                const userId = msg.author;
                const status = protectionData[userId];
                if (status === 'owner_disabled') return msg.reply('❌ Tu protección ha sido desactivada por el propietario.');
                if (!status) return msg.reply('🔓 Ya tenías las acciones activadas.');
                delete protectionData[userId];
                saveProtectionData();
                return msg.reply('✅ ¡Protección desactivada!');
            }
            case 'sinproteccion': {
                if (msg.author !== OWNER_ID) return;
                const targetId = msg.mentionedJidList[0];
                if (!targetId) return msg.reply('Debes mencionar a un usuario.');
                protectionData[targetId] = 'owner_disabled';
                saveProtectionData();
                return msg.reply(`🔓 La protección de @${targetId.split('@')[0]} ha sido forzosamente desactivada.`, { mentions: [targetId] });
            }
            case 'conproteccion': {
                if (msg.author !== OWNER_ID) return;
                const targetId = msg.mentionedJidList[0];
                if (!targetId) return msg.reply('Debes mencionar a un usuario.');
                if (!protectionData[targetId]) return msg.reply(`El usuario @${targetId.split('@')[0]} no tenía restricción.`, { mentions: [targetId] });
                delete protectionData[targetId];
                saveProtectionData();
                return msg.reply(`✅ Se ha restaurado el control de protección a @${targetId.split('@')[0]}.`, { mentions: [targetId] });
            }
            case 'nsfw': {
                if (msg.author !== OWNER_ID) {
                    return msg.reply('❌ Comando exclusivo para el propietario del bot.');
                }
                const mode = args[0]?.toLowerCase();
                if (mode === 'on') {
                    nsfwEnabled = true;
                    saveSettings();
                    return msg.reply('✅ Modo NSFW para acciones ha sido *ACTIVADO*.');
                } else if (mode === 'off') {
                    nsfwEnabled = false;
                    saveSettings();
                    return msg.reply('✅ Modo NSFW para acciones ha sido *DESACTIVADO*.');
                } else {
                    const status = nsfwEnabled ? 'Activado' : 'Desactivado';
                    return msg.reply(`Uso: \`.nsfw on\` o \`.nsfw off\`\nEstado actual: *${status}*`);
                }
            }
        }
    }
};