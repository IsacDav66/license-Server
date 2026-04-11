const fs = require('fs');
const path = require('path');

const VER = {
    ai: "@google/generative-ai@^0.24.1",
    baileys: "@whiskeysockets/baileys@^7.0.0-rc.9",
    axios: "axios@^1.11.0",
    bcrypt: "bcryptjs@^3.0.2",
    canvas: "canvas@^3.2.0",
    cheerio: "cheerio@^1.1.2",
    ffmpeg_inst: "@ffmpeg-installer/ffmpeg@^1.1.0",
    ffmpeg_flu: "fluent-ffmpeg@^2.1.3",
    formdata: "form-data@^4.0.3",
    jimp: "jimp@^0.22.12",
    phone: "libphonenumber-js@^1.12.13",
    fetch: "node-fetch@^3.3.2",
    pino: "pino@^9.9.4",
    sharp: "sharp@^0.32.6",
    uuid: "uuid@^11.1.0",
    sticker_form: "wa-sticker-formatter@^4.4.4",
    yt_search: "yt-search@^2.13.1",
    ytdl: "ytdl-core@npm:@distube/ytdl-core@^4.16.12"
};

const pluginData = {
    // --- INTELIGENCIA ARTIFICIAL ---
    'google_ai_responder.js': { deps: [VER.ai, VER.axios, VER.pino], sql: "" },

    // --- EDICIÓN Y MULTIMEDIA ---
    'sticker.js': { deps: [VER.baileys, VER.ffmpeg_flu, VER.sharp, VER.sticker_form], sql: "" },
    'profile.js': { deps: [VER.canvas, VER.axios, VER.uuid, VER.ffmpeg_flu, VER.ffmpeg_inst], sql: "" },
    'editarft.js': { deps: [VER.axios, VER.baileys], sql: "" },
    'logro.js': { deps: [VER.canvas, VER.axios], sql: "" },
    'brcharacters.js': { deps: [VER.canvas, VER.sharp], sql: "" },
    'maker_gay.js': { deps: [VER.axios], sql: "" },
    'chatfalse.js': { deps: [VER.canvas, VER.axios, VER.sharp], sql: "" },

    // --- JUEGOS Y ECONOMÍA ---
    'football-bet.js': {
        deps: [VER.fetch],
        sql: `CREATE TABLE IF NOT EXISTS football_matches (api_match_id INTEGER PRIMARY KEY, home_team TEXT, away_team TEXT, home_win_multiplier REAL, away_win_multiplier REAL, draw_multiplier REAL, status_short TEXT); CREATE TABLE IF NOT EXISTS user_bets (bet_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, api_match_id INTEGER, bet_choice TEXT, amount INTEGER, status TEXT DEFAULT 'PENDING');`
    },
    'brainroots.js': {
        deps: [VER.axios],
        sql: `CREATE TABLE IF NOT EXISTS brainroots_characters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, rarity INTEGER, price INTEGER); CREATE TABLE IF NOT EXISTS user_brainroots (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, character_id INTEGER, catch_timestamp INTEGER); CREATE TABLE IF NOT EXISTS brainroots_market (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT, character_id INTEGER, price INTEGER);`
    },
    'roulette.js': { deps: [VER.canvas], sql: "" },
    'slots.js': { deps: [VER.canvas], sql: "" },
    'prize_wheel.js': { deps: [], sql: "" },
    'duelo_cartas.js': { deps: [], sql: "" },

    // --- SEGURIDAD Y MODERACIÓN ---
    'anti-porn.js': { deps: [VER.axios, VER.formdata], sql: "" },
    'image_ocr_filter.js': { deps: [VER.axios, VER.formdata], sql: "" },
    'anti-dox.js': { deps: [], sql: "" },
    'raid_protector.js': { deps: [], sql: "" },
    'link-deleter.js': { deps: [], sql: "" },
    'silenciar.js': { 
        deps: [], 
        sql: `CREATE TABLE IF NOT EXISTS silenced_users (id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT, user_jid TEXT, expires_at INTEGER);`
    },

    // --- INTERNET Y UTILIDAD ---
    'lyrics.js': { deps: [VER.axios, VER.cheerio, VER.fetch], sql: "" },
    'ytdownload.js': { deps: [VER.axios], sql: "" },
    'stats_manager.js': {
        deps: [VER.axios],
        sql: `CREATE TABLE IF NOT EXISTS daily_group_stats (group_jid TEXT, member_count INTEGER, stat_date TEXT, PRIMARY KEY(group_jid, stat_date));`
    },
    'message-counter.js': { deps: [], sql: `ALTER TABLE users ADD COLUMN message_count INTEGER DEFAULT 0;` },
    'publicador.js': { deps: [], sql: "" }
};

const pluginsDir = path.join(__dirname, 'marketplace_plugins');

fs.readdirSync(pluginsDir).forEach(file => {
    const data = pluginData[file];
    if (data) {
        const filePath = path.join(pluginsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Limpieza de metadatos antiguos
        content = content.replace(/\s*externalDependencies:\s*\[[\s\S]*?\],/, "");
        content = content.replace(/\s*dbSchema:\s*`[\s\S]*?`,/, "");

        const depStr = data.deps.length > 0 ? `\n        externalDependencies: ${JSON.stringify(data.deps)},` : "";
        const sqlStr = data.sql ? `\n        dbSchema: \` ${data.sql.trim()} \`,` : "";

        // Inyectar en el objeto marketplace
        const updatedContent = content.replace(/marketplace:\s*{/, `marketplace: {${depStr}${sqlStr}`);

        fs.writeFileSync(filePath, updatedContent);
        console.log(`✅ Metadata inyectada en: ${file}`);
    }
});

console.log("\n🚀 Todos los plugins detectados han sido actualizados.");