// plugins/brainroots.js
// Versión modular: usa el core para BD y sincroniza personajes desde Oracle Cloud.

'use strict';

const path  = require('path');
const fs    = require('fs');
const axios = require('axios');

const { db, getUserData, saveUserData, msToTime, pickRandom, downloadAsset } = require('../../lib/bot-core');

// =============================================================================
// CONFIGURACIÓN
// =============================================================================

const COOLDOWN_ROB_COMMAND_MS        = 2 * 60 * 60 * 1000; // 2 h
const BASE_ROB_SUCCESS_CHANCE        = 0.50;
const RARITY_BONUS_PENALTY_PER_LEVEL = 0.05;

const INCOME_INTERVAL_HOURS          = 1;
const INCOME_PERCENTAGE_PER_DAY      = 0.70;
const INCOME_INTERVAL_MS             = INCOME_INTERVAL_HOURS * 60 * 60 * 1000;
const INCOME_PERCENTAGE_PER_INTERVAL = (INCOME_PERCENTAGE_PER_DAY * INCOME_INTERVAL_HOURS) / 24;

const CATCH_WINDOW_MS          = 30 * 1000;
const COOLDOWN_SPAWN_COMMAND_MS = 5 * 60 * 1000;

const MONEY_SYMBOL          = '$';
const ASSETS_BRAINROOTS_DIR = path.join(__dirname, '..', '..', 'assets', 'brainroots');
const CLOUD_ASSETS_BASE_URL = 'https://davcenter.servequake.com/stunbot/assets/brainroots';
const SYNC_API_URL          = 'https://davcenter.servequake.com/stunbot/api/sync/brainroots';

// =============================================================================
// ESTADO GLOBAL DEL PLUGIN
// =============================================================================

let currentSpawnedCharacter = null; // { ...char, spawnedJid }
let catchTimer              = null;
let allCharacters           = [];
let rarityWeights           = [];

// =============================================================================
// dbLogic — TODA la lógica SQL de este plugin queda aquí.
// Los plugins externos usan require('../../lib/bot-core').db para sus propias queries.
// =============================================================================

const dbLogic = {

    // -- Personajes -----------------------------------------------------------

    getAllCharacters: () =>
        db.prepare('SELECT * FROM brainroots_characters ORDER BY rarity ASC').all(),

    getCharacterById: (id) =>
        db.prepare('SELECT * FROM brainroots_characters WHERE id = ?').get(id),

    getCharacterByName: (name) =>
        db.prepare('SELECT * FROM brainroots_characters WHERE LOWER(name) = LOWER(?)').get(name),

    /** Upsert de un personaje (usado en la sincronización cloud) */
    upsertCharacter: db.transaction((char) => {
        db.prepare(`
            INSERT INTO brainroots_characters (id, name, image_filename, rarity, price)
            VALUES (@id, @name, @image_filename, @rarity, @price)
            ON CONFLICT(id) DO UPDATE SET
                name           = excluded.name,
                image_filename = excluded.image_filename,
                rarity         = excluded.rarity,
                price          = excluded.price;
        `).run(char);
    }),

    // -- Colección de usuario -------------------------------------------------

    addToUser: (userId, characterId) => {
        const ts = Date.now();
        db.prepare(`
            INSERT INTO user_brainroots (user_id, character_id, catch_timestamp, last_income_timestamp)
            VALUES (?, ?, ?, ?)
        `).run(userId, characterId, ts, ts);
        return true;
    },

    getUserCollection: (userId) =>
        db.prepare(`
            SELECT
                ub.id   AS user_brainroot_entry_id,
                bc.*,
                ub.catch_timestamp,
                ub.last_income_timestamp
            FROM user_brainroots ub
            JOIN brainroots_characters bc ON ub.character_id = bc.id
            WHERE ub.user_id = ?
        `).all(userId),

    updateIncomeTimestamp: (entryId, timestamp) =>
        db.prepare('UPDATE user_brainroots SET last_income_timestamp = ? WHERE id = ?')
          .run(timestamp, entryId),

    /** Elimina la entrada más antigua de un (user, character) y devuelve true si lo hizo */
    removeFromUser: (userId, characterId) => {
        const row = db.prepare(`
            SELECT id FROM user_brainroots
            WHERE user_id = ? AND character_id = ?
            ORDER BY catch_timestamp ASC
            LIMIT 1
        `).get(userId, characterId);
        if (!row) return false;
        db.prepare('DELETE FROM user_brainroots WHERE id = ?').run(row.id);
        return true;
    },

    getRandomUserBrainroot: (userId) =>
        db.prepare(`
            SELECT ub.id AS user_brainroot_entry_id, bc.*
            FROM user_brainroots ub
            JOIN brainroots_characters bc ON ub.character_id = bc.id
            WHERE ub.user_id = ?
            ORDER BY RANDOM()
            LIMIT 1
        `).get(userId),

    // -- Mercado --------------------------------------------------------------

    addToMarket: (sellerId, characterId, price) => {
        const result = db.prepare(`
            INSERT INTO brainroots_market (seller_id, character_id, price, listing_timestamp)
            VALUES (?, ?, ?, ?)
        `).run(sellerId, characterId, price, Date.now());
        return result.lastInsertRowid || null;
    },

    /**
     * Quita un listing del mercado y devuelve la fila eliminada, o null si no existe /
     * el sellerId no coincide.
     */
    removeFromMarket: (listingId, sellerId = null) => {
        const whereExtra = sellerId ? 'AND seller_id = ?' : '';
        const params     = sellerId ? [listingId, sellerId] : [listingId];
        const row = db.prepare(`SELECT * FROM brainroots_market WHERE id = ? ${whereExtra}`).get(...params);
        if (!row) return null;
        db.prepare(`DELETE FROM brainroots_market WHERE id = ? ${whereExtra}`).run(...params);
        return row;
    },

    getMarketListings: () =>
        db.prepare(`
            SELECT
                bm.id            AS listing_id,
                bm.seller_id,
                bm.price         AS listing_price,
                bm.listing_timestamp,
                bc.id            AS character_id,
                bc.name,
                bc.rarity,
                bc.price         AS base_price,
                bc.image_filename
            FROM brainroots_market bm
            JOIN brainroots_characters bc ON bm.character_id = bc.id
            ORDER BY bm.listing_timestamp ASC
        `).all(),

    getMarketListingById: (id) =>
        db.prepare(`
            SELECT
                bm.*,
                bc.name,
                bc.rarity,
                bc.image_filename
            FROM brainroots_market bm
            JOIN brainroots_characters bc ON bm.character_id = bc.id
            WHERE bm.id = ?
        `).get(id),
};

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

/** Reconstruye la caché de personajes y pesos de rareza tras una sincronización */
function rebuildRarityCache(characters) {
    allCharacters = characters;
    rarityWeights = [];
    const weightMap = { 1: 50, 2: 25, 3: 10, 4: 3, 5: 1 };
    for (const char of characters) {
        const w = weightMap[char.rarity] ?? 1;
        for (let i = 0; i < w; i++) rarityWeights.push(char.id);
    }
    console.log(`[Brainroots] Caché: ${allCharacters.length} personajes, ${rarityWeights.length} pesos de rareza.`);
}

function chooseCharacterByRarity() {
    if (!rarityWeights.length) return null;
    const id   = pickRandom(rarityWeights);
    return allCharacters.find(c => c.id === id) ?? null;
}

// =============================================================================
// EXPORTACIÓN DEL MÓDULO
// =============================================================================

module.exports = {
    name:        'Brainroots',
    aliases:     ['brspawn','spawnbr','brainrootcomprar','mybr','misbr','brainrootscollection',
                  'brincome','claimbr','brgift','regalarbr','brrob','robarbr','claim',
                  'brsell','venderbr','brunsell','quitarbr','brmarket','brshop','brbuy','comprarbr'],
    description: 'Comandos de Brainroots: spawn, atrapar, colección, ingresos, regalo, robo y mercado.',
    category:    'Brainroots',
    groupOnly:   false,

    // -------------------------------------------------------------------------
    // BLOQUE MARKETPLACE
    // -------------------------------------------------------------------------
    marketplace: {
        tebex_id:             7383076,
        price:                "25.00",
        icon:                 "fa-brain",
        externalDependencies: ["axios@^1.11.0"],

        // Esquema SQLite completo del plugin (lo lee el sistema de licencias para
        // crear las tablas la primera vez que se activa).
        dbSchema: `
            CREATE TABLE IF NOT EXISTS brainroots_characters (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                name           TEXT    NOT NULL UNIQUE,
                image_filename TEXT    NOT NULL,
                rarity         INTEGER NOT NULL,
                price          INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_brainroots (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id               TEXT    NOT NULL,
                character_id          INTEGER NOT NULL REFERENCES brainroots_characters(id),
                catch_timestamp       INTEGER NOT NULL,
                last_income_timestamp INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS brainroots_market (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id         TEXT    NOT NULL,
                character_id      INTEGER NOT NULL REFERENCES brainroots_characters(id),
                price             INTEGER NOT NULL,
                listing_timestamp INTEGER NOT NULL
            );
        `,

        preview: {
            suggestions: ['!brspawn', '.claim', '!brmarket'],
            responses: {
                '!brspawn': {
                    text:  '¡Un Brainroot salvaje apareció! 💥\n*Tralarero Tralala*\nRareza: 4/5\nPrecio: $15,000\n\n_Usa .claim para atraparlo!_',
                    image: 'https://makerworld.bblmw.com/makerworld/model/USd4f2b366dfc775/design/2025-04-11_1cc7bb0854a2f.webp?x-oss-process=image/resize,w_1000/format,webp',
                },
                '.claim':    { text: '⏰ ¡Demasiado tarde! El Brainroot ya escapó o fue atrapado.' },
                '!brmarket': '*🛒 Brainroots en el Mercado:*\n\n[ID: 45] *Brr brr patapim* (Rareza 2)\nPrecio: $5,000 | Vendedor: @Admin',
            },
        },
    },

    // -------------------------------------------------------------------------
    // onLoad — sincronización cloud + caché local
    // -------------------------------------------------------------------------
    onLoad: async (sock) => {
        console.log('[Brainroots] onLoad iniciado.');

        // 1. Sincronizar personajes desde Oracle Cloud
        try {
            console.log(`[Brainroots] Sincronizando personajes desde ${SYNC_API_URL}...`);
            const { data } = await axios.get(SYNC_API_URL, { timeout: 10_000 });
            const remoteChars = Array.isArray(data) ? data : (data.characters ?? []);

            if (remoteChars.length > 0) {
                // UPSERT atómico de todos los personajes recibidos
                const upsertAll = db.transaction((chars) => {
                    const stmt = db.prepare(`
                        INSERT INTO brainroots_characters (id, name, image_filename, rarity, price)
                        VALUES (@id, @name, @image_filename, @rarity, @price)
                        ON CONFLICT(id) DO UPDATE SET
                            name           = excluded.name,
                            image_filename = excluded.image_filename,
                            rarity         = excluded.rarity,
                            price          = excluded.price;
                    `);
                    for (const c of chars) stmt.run(c);
                });
                upsertAll(remoteChars);
                console.log(`[Brainroots] ${remoteChars.length} personajes sincronizados desde la nube.`);
            } else {
                console.warn('[Brainroots] La API de sync devolvió 0 personajes; se usarán los datos locales.');
            }
        } catch (err) {
            console.warn(`[Brainroots] Error de sync cloud (continuando con BD local): ${err.message}`);
        }

        // 2. Cargar caché desde la BD local (ya actualizada o intacta)
        const localChars = dbLogic.getAllCharacters();
        if (localChars.length === 0) {
            console.warn('[Brainroots] La tabla brainroots_characters está vacía. Los comandos de spawn no funcionarán hasta que se poblen los datos.');
        }
        rebuildRarityCache(localChars);

        // 3. Asegurar que existe el directorio de assets
        if (!fs.existsSync(ASSETS_BRAINROOTS_DIR)) {
            fs.mkdirSync(ASSETS_BRAINROOTS_DIR, { recursive: true });
            console.log(`[Brainroots] Directorio de assets creado en: ${ASSETS_BRAINROOTS_DIR}`);
        }

        console.log(`[Brainroots] onLoad completado. ${allCharacters.length} personajes listos.`);
        console.log(`[Brainroots] Ventana de captura: ${CATCH_WINDOW_MS / 1000}s | Cooldown spawn: ${COOLDOWN_SPAWN_COMMAND_MS / 60_000}min.`);
    },

    // -------------------------------------------------------------------------
    // execute — lógica de todos los comandos
    // -------------------------------------------------------------------------
    async execute(sock, msg, args, commandName) {
        // -- Resolución de IDs ------------------------------------------------
        const commandSenderId = msg.senderLid || msg.author;
        const senderOriginalJid = msg.author;

        if (!commandSenderId) {
            console.error(`[Brainroots ERROR] commandSenderId es NULL para author: ${senderOriginalJid}`);
            await msg.reply('❌ Hubo un problema al identificar tu usuario. Inténtalo de nuevo.');
            return;
        }

        const chatJid          = msg.from;
        const chat             = await msg.getChat();
        const isGroup          = chat.isGroup;
        const groupParticipants = chat.groupMetadata?.participants || [];
        const user             = await getUserData(commandSenderId, msg);
        const userNameToMention = user?.pushname || senderOriginalJid.split('@')[0];

        if (!user) {
            try { await msg.reply('❌ Hubo un error al obtener tus datos. Inténtalo de nuevo.'); } catch (e) {}
            return;
        }

        // -- Verificación de registro -----------------------------------------
        if (!user.password) {
            if (!isGroup) {
                await msg.reply('🔒 Comando exclusivo de grupos.');
                return;
            }
            const prefix = msg.body.charAt(0);
            const actualSenderJid = senderOriginalJid;

            if (!user.phoneNumber) {
                user.registration_state = 'esperando_numero_telefono';
                await saveUserData(commandSenderId, user);
                return sock.sendMessage(chatJid, {
                    text: `👋 ¡Hola, @${userNameToMention}!\n\nPara interactuar con los Brainroots, necesitas registrarte. Por favor, responde:\n*${prefix}mifono +TuNumeroCompleto*`,
                    mentions: [actualSenderJid],
                }, { quoted: msg._baileysMessage });
            } else {
                user.registration_state = 'esperando_contraseña_dm';
                await saveUserData(commandSenderId, user);
                let displayPhone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber}`;
                await sock.sendMessage(chatJid, {
                    text: `🛡️ ¡Hola, @${userNameToMention}!\n\nYa tenemos tu número (*${displayPhone}*). Te enviamos un DM para que configures tu contraseña.\n‼️ Para actualizar tu número: .actualizarfono +52111222333`,
                    mentions: [actualSenderJid],
                }, { quoted: msg._baileysMessage });
                const dmJid = `${user.phoneNumber}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(dmJid, { text: '🔑 Por favor, responde con la contraseña que deseas establecer para los comandos de economía.' });
                } catch (dmErr) {
                    console.error(`[Brainroots] Error enviando DM a ${dmJid}:`, dmErr);
                    await sock.sendMessage(chatJid, {
                        text: `⚠️ @${userNameToMention}, no pude enviarte el DM. Asegúrate de poder recibir mensajes de este número.`,
                        mentions: [actualSenderJid],
                    }, { quoted: msg._baileysMessage });
                }
                return;
            }
        }

        // =====================================================================
        // COMANDO: .brspawn / .spawnbr
        // =====================================================================
        if (['brspawn', 'spawnbr'].includes(commandName)) {
            const now = Date.now();

            if (now - (user.lastbrainrootspawn || 0) < COOLDOWN_SPAWN_COMMAND_MS) {
                const left = COOLDOWN_SPAWN_COMMAND_MS - (now - (user.lastbrainrootspawn || 0));
                return msg.reply(`⏳ Ya invocaste un Brainroot recientemente. Espera ${msToTime(left)}.`);
            }

            if (currentSpawnedCharacter?.spawnedJid === chatJid) {
                return msg.reply(`🤷‍♂️ Ya hay un Brainroot activo ('${currentSpawnedCharacter.name}') en este chat.`);
            }

            const characterToSpawn = chooseCharacterByRarity();
            if (!characterToSpawn) {
                return msg.reply('❌ No hay personajes Brainroots disponibles. Revisa la configuración del bot.');
            }

            currentSpawnedCharacter = { ...characterToSpawn, spawnedJid: chatJid };

            // -- Auto-descarga de asset si no existe --------------------------
            const imagePath = path.join(ASSETS_BRAINROOTS_DIR, characterToSpawn.image_filename);
            if (!fs.existsSync(imagePath)) {
                const remoteUrl = `${CLOUD_ASSETS_BASE_URL}/${characterToSpawn.image_filename}`;
                console.log(`[Brainroots] Imagen no encontrada localmente. Descargando: ${remoteUrl}`);
                try {
                    await downloadAsset(remoteUrl, imagePath);
                    console.log(`[Brainroots] Asset descargado correctamente: ${imagePath}`);
                } catch (dlErr) {
                    console.error(`[Brainroots] Error al descargar asset para ${characterToSpawn.name}:`, dlErr.message);
                    currentSpawnedCharacter = null;
                    return msg.reply('❌ No pude obtener la imagen de este Brainroot. Inténtalo de nuevo.');
                }
            }

            try {
                const imageBuffer = fs.readFileSync(imagePath);
                const caption = `¡Un Brainroot salvaje apareció! 💥\n*${currentSpawnedCharacter.name}*\nRareza: ${currentSpawnedCharacter.rarity}/5\nPrecio: ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()}\n\nTienes *${CATCH_WINDOW_MS / 1000} segundos* para atraparlo con: \`.claim\``;

                await sock.sendMessage(chatJid, { image: imageBuffer, caption });

                user.lastbrainrootspawn = now;
                await saveUserData(commandSenderId, user);

                catchTimer = setTimeout(() => {
                    if (currentSpawnedCharacter?.id === characterToSpawn.id && currentSpawnedCharacter.spawnedJid === chatJid) {
                        sock.sendMessage(chatJid, { text: `⏰ ¡Tiempo agotado! El Brainroot '${characterToSpawn.name}' escapó...` });
                        currentSpawnedCharacter = null;
                    }
                }, CATCH_WINDOW_MS);

                console.log(`[Brainroots] '${currentSpawnedCharacter.name}' spawneado en ${chatJid}. Timer: ${CATCH_WINDOW_MS / 1000}s.`);
            } catch (err) {
                console.error('[Brainroots] Error enviando spawn:', err);
                currentSpawnedCharacter = null;
                if (catchTimer) { clearTimeout(catchTimer); catchTimer = null; }
                return msg.reply('❌ Ocurrió un error al intentar que apareciera un Brainroot.');
            }
            return;
        }

        // =====================================================================
        // COMANDO: .brainrootcomprar / .claim
        // =====================================================================
        if (['brainrootcomprar', 'claim'].includes(commandName)) {
            if (!currentSpawnedCharacter || currentSpawnedCharacter.spawnedJid !== chatJid) {
                return msg.reply('🤷‍♂️ No hay ningún Brainroot activo para atrapar en este chat.');
            }

            if (catchTimer === null) {
                return msg.reply('⏰ ¡Demasiado tarde! El Brainroot ya escapó o fue atrapado.');
            }

            if (commandName !== 'claim') {
                const guessedName = args.join(' ').trim();
                if (!guessedName) return msg.reply('🤔 Especifica el nombre del Brainroot. Ej: `.brainrootcomprar [nombre]`');
                if (guessedName.toLowerCase() !== currentSpawnedCharacter.name.toLowerCase()) {
                    return msg.reply('❌ Nombre incorrecto. Intenta de nuevo.');
                }
            }

            if (user.money < currentSpawnedCharacter.price) {
                return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para atrapar a *${currentSpawnedCharacter.name}* (Costo: ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()}).`);
            }

            user.money -= currentSpawnedCharacter.price;
            await saveUserData(commandSenderId, user);

            const added = dbLogic.addToUser(commandSenderId, currentSpawnedCharacter.id);
            if (added) {
                await sock.sendMessage(chatJid, {
                    text: `🎉 ¡Felicidades, @${userNameToMention}! Atrapaste a *${currentSpawnedCharacter.name}* por ${MONEY_SYMBOL}${currentSpawnedCharacter.price.toLocaleString()} y lo añadiste a tu colección.`,
                    mentions: [senderOriginalJid],
                }, { quoted: msg._baileysMessage });
                console.log(`[Brainroots] ${userNameToMention} atrapó a ${currentSpawnedCharacter.name}.`);
                currentSpawnedCharacter = null;
                clearTimeout(catchTimer);
                catchTimer = null;
            } else {
                await msg.reply('❌ Ocurrió un error al añadir el Brainroot a tu colección.');
            }
            return;
        }

        // =====================================================================
        // COMANDO: .mybr / .misbr / .brainrootscollection
        // =====================================================================
        if (['mybr', 'misbr', 'brainrootscollection'].includes(commandName)) {
            let targetDbId        = commandSenderId;
            let targetJidForMention = senderOriginalJid;
            let targetDisplayName = userNameToMention;

            const mentionedJids = msg.mentionedJidList || [];
            if (mentionedJids.length > 0) {
                const raw = mentionedJids[0];
                targetJidForMention = raw;
                if (isGroup) {
                    const p = groupParticipants.find(x => x.id === raw);
                    targetDbId = (p?.lid) ? p.lid : raw;
                } else {
                    targetDbId = raw;
                }
                const tUser = await getUserData(targetDbId);
                targetDisplayName = tUser?.pushname || raw.split('@')[0];
            } else if (args[0]?.startsWith('@')) {
                const numPart = args[0].substring(1).split('@')[0];
                targetJidForMention = `${numPart}@s.whatsapp.net`;
                if (isGroup) {
                    const p = groupParticipants.find(x => x.id === targetJidForMention);
                    targetDbId = (p?.lid) ? p.lid : targetJidForMention;
                } else {
                    targetDbId = targetJidForMention;
                }
                const tUser = await getUserData(targetDbId);
                targetDisplayName = tUser?.pushname || numPart;
            }

            const userCharacters = dbLogic.getUserCollection(targetDbId);

            if (userCharacters.length === 0) {
                if (targetDbId === commandSenderId) {
                    return msg.reply('🌿 Aún no tienes ningún Brainroot. ¡Usa `.brspawn` para que aparezca uno!');
                }
                return sock.sendMessage(chatJid, { text: `🌿 @${targetDisplayName} aún no tiene ningún Brainroot.`, mentions: [targetJidForMention] }, { quoted: msg._baileysMessage });
            }

            const now = Date.now();
            const grouped = {};
            let totalPotentialIncome = 0;

            for (const char of userCharacters) {
                if (!grouped[char.name]) {
                    grouped[char.name] = { name: char.name, rarity: char.rarity, price: char.price, quantity: 0, accumulatedIncome: 0 };
                }
                grouped[char.name].quantity++;
                const timeSince       = now - (char.last_income_timestamp || char.catch_timestamp);
                const intervalsPassed = Math.floor(timeSince / INCOME_INTERVAL_MS);
                if (intervalsPassed > 0) {
                    const income = Math.floor(char.price * INCOME_PERCENTAGE_PER_INTERVAL) * intervalsPassed;
                    grouped[char.name].accumulatedIncome += income;
                    totalPotentialIncome += income;
                }
            }

            const sorted = Object.values(grouped).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
            let msg_text = `*🌱 Colección de Brainroots de @${targetDisplayName}:*\n\n`;
            for (const c of sorted) {
                msg_text += `• *${c.name}* x${c.quantity} (Rareza: ${c.rarity}/5, Precio: ${MONEY_SYMBOL}${c.price.toLocaleString()})`;
                if (c.accumulatedIncome > 0) msg_text += ` → ${MONEY_SYMBOL}${c.accumulatedIncome.toLocaleString()} listo`;
                msg_text += '\n';
            }

            if (totalPotentialIncome > 0 && targetDbId === commandSenderId) {
                msg_text += `\n*💰 Ingreso total listo: ${MONEY_SYMBOL}${totalPotentialIncome.toLocaleString()}*\nUsa \`.brincome\` para reclamarlo.`;
            } else if (totalPotentialIncome > 0) {
                msg_text += `\n_💰 Ingreso listo de ${MONEY_SYMBOL}${totalPotentialIncome.toLocaleString()}._`;
            } else {
                msg_text += '\n_No hay ingresos listos todavía._';
            }

            return sock.sendMessage(chatJid, { text: msg_text, mentions: [targetJidForMention] }, { quoted: msg._baileysMessage });
        }

        // =====================================================================
        // COMANDO: .brincome / .claimbr
        // =====================================================================
        if (['brincome', 'claimbr'].includes(commandName)) {
            const userCharacters = dbLogic.getUserCollection(commandSenderId);
            if (userCharacters.length === 0) return msg.reply('🌿 Aún no tienes ningún Brainroot para generar ingresos.');

            const now = Date.now();
            let totalClaimed = 0;

            for (const char of userCharacters) {
                const timeSince       = now - (char.last_income_timestamp || char.catch_timestamp);
                const intervalsPassed = Math.floor(timeSince / INCOME_INTERVAL_MS);
                if (intervalsPassed > 0) {
                    totalClaimed += Math.floor(char.price * INCOME_PERCENTAGE_PER_INTERVAL) * intervalsPassed;
                    dbLogic.updateIncomeTimestamp(char.user_brainroot_entry_id, now);
                }
            }

            if (totalClaimed > 0) {
                user.money += totalClaimed;
                await saveUserData(commandSenderId, user);
                return sock.sendMessage(chatJid, {
                    text: `💰 ¡@${userNameToMention} reclamó *${MONEY_SYMBOL}${totalClaimed.toLocaleString()}* de sus Brainroots!\nNuevo saldo: ${MONEY_SYMBOL}${user.money.toLocaleString()}`,
                    mentions: [senderOriginalJid],
                }, { quoted: msg._baileysMessage });
            }
            return msg.reply('_No hay ingresos listos para reclamar todavía. Espera un poco más._');
        }

        // =====================================================================
        // COMANDO: .brgift / .regalarbr
        // =====================================================================
        if (['brgift', 'regalarbr'].includes(commandName)) {
            if (args.length < 2) return msg.reply('🤔 Uso: `.brgift @usuario [Nombre del Brainroot]`');

            const mentionedJids = msg.mentionedJidList || [];
            let rawTargetJid = mentionedJids[0] ?? null;
            if (!rawTargetJid && args[0]?.startsWith('@')) {
                rawTargetJid = `${args[0].substring(1).split('@')[0]}@s.whatsapp.net`;
            }
            if (!rawTargetJid) return msg.reply('❌ Debes mencionar al destinatario. Ej: `.brgift @usuario NombreBR`');

            let targetDbId = rawTargetJid;
            if (isGroup) {
                const p = groupParticipants.find(x => x.id === rawTargetJid);
                targetDbId = p?.lid ?? rawTargetJid;
            }

            if (targetDbId === commandSenderId) return msg.reply('😂 No puedes regalarte un Brainroot a ti mismo.');

            const targetUser = await getUserData(targetDbId);
            if (!targetUser) return msg.reply(`❌ No pude encontrar los datos del destinatario.`);
            const targetUserName = targetUser?.pushname || rawTargetJid.split('@')[0];

            const brainrootNameArgs = args.filter((a, i) => !(i === 0 && a.startsWith('@')));
            const brainrootName     = brainrootNameArgs.join(' ').trim();
            if (!brainrootName) return msg.reply('🤔 ¿Qué Brainroot quieres regalar? Ej: `.brgift @usuario Nombre`');

            const characterToGift = dbLogic.getCharacterByName(brainrootName);
            if (!characterToGift) return msg.reply(`❌ No conozco ningún Brainroot llamado *${brainrootName}*.`);

            const senderColl    = dbLogic.getUserCollection(commandSenderId);
            const senderHasIt   = senderColl.some(c => c.id === characterToGift.id);
            if (!senderHasIt) return msg.reply(`🤷‍♀️ No tienes *${characterToGift.name}* en tu colección.`);

            const removed = dbLogic.removeFromUser(commandSenderId, characterToGift.id);
            if (!removed) return msg.reply('❌ Error al eliminar el Brainroot de tu inventario. Inténtalo de nuevo.');

            dbLogic.addToUser(targetDbId, characterToGift.id);

            console.log(`[Brainroots] ${userNameToMention} regaló ${characterToGift.name} a ${targetUserName}.`);
            await sock.sendMessage(chatJid, {
                text: `🎁 ¡@${userNameToMention} le regaló un *${characterToGift.name}* a @${targetUserName}! ¡Qué generoso/a!`,
                mentions: [senderOriginalJid, rawTargetJid],
            }, { quoted: msg._baileysMessage });
            return;
        }

        // =====================================================================
        // COMANDO: .brrob / .robarbr
        // =====================================================================
        if (['brrob', 'robarbr'].includes(commandName)) {
            if (args.length < 1) return msg.reply('🤔 Uso: `.brrob @usuario`');

            const mentionedJids = msg.mentionedJidList || [];
            let rawTargetJid = mentionedJids[0] ?? null;
            if (!rawTargetJid && args[0]?.startsWith('@')) {
                rawTargetJid = `${args[0].substring(1).split('@')[0]}@s.whatsapp.net`;
            }
            if (!rawTargetJid) return msg.reply('❌ Debes mencionar al usuario al que quieres robar.');

            let targetDbId = rawTargetJid;
            if (isGroup) {
                const p = groupParticipants.find(x => x.id === rawTargetJid);
                targetDbId = p?.lid ?? rawTargetJid;
            }

            if (targetDbId === commandSenderId) return msg.reply('😂 No puedes robarte a ti mismo. ¡Qué tramposo!');

            const now = Date.now();
            if (now - (user.lastbrainrootrob || 0) < COOLDOWN_ROB_COMMAND_MS) {
                const left = COOLDOWN_ROB_COMMAND_MS - (now - (user.lastbrainrootrob || 0));
                return msg.reply(`⏳ Ya intentaste robar recientemente. Espera ${msToTime(left)}.`);
            }

            const targetUser = await getUserData(targetDbId);
            if (!targetUser) return msg.reply(`❌ No pude encontrar los datos del objetivo.`);
            const targetUserName = targetUser?.pushname || rawTargetJid.split('@')[0];

            const targetColl = dbLogic.getUserCollection(targetDbId);
            if (targetColl.length === 0) return msg.reply(`😅 @${targetUserName} no tiene ningún Brainroot que puedas robar.`);

            const target = dbLogic.getRandomUserBrainroot(targetDbId);
            if (!target) return msg.reply(`❌ Error al identificar un Brainroot para robar.`);

            let successChance = BASE_ROB_SUCCESS_CHANCE - (target.rarity - 1) * RARITY_BONUS_PENALTY_PER_LEVEL;
            successChance = Math.max(0.10, Math.min(0.90, successChance));

            let outcomeMessage;
            if (Math.random() < successChance) {
                const removed = dbLogic.removeFromUser(targetDbId, target.id);
                const added   = removed && dbLogic.addToUser(commandSenderId, target.id);
                outcomeMessage = (removed && added)
                    ? `🎉 ¡Éxito! @${userNameToMention} le robó un *${target.name}* a @${targetUserName}!`
                    : `⚠️ ¡Éxito en el intento, pero hubo un error de base de datos!`;
            } else {
                outcomeMessage = `😥 ¡Fallaste! @${userNameToMention} intentó robar a @${targetUserName} pero fue descubierto.`;
            }

            user.lastbrainrootrob = now;
            await saveUserData(commandSenderId, user);

            await sock.sendMessage(chatJid, {
                text: outcomeMessage,
                mentions: [senderOriginalJid, rawTargetJid],
            }, { quoted: msg._baileysMessage });
            return;
        }

        // =====================================================================
        // COMANDO: .brsell / .venderbr
        // =====================================================================
        if (['brsell', 'venderbr'].includes(commandName)) {
            if (args.length < 2) return msg.reply('🤔 Uso: `.brsell [Nombre del Brainroot] [Precio]`');

            const price = parseInt(args[args.length - 1]);
            if (isNaN(price) || price <= 0) return msg.reply('❌ El precio debe ser un número positivo.');

            const brainrootName = args.slice(0, -1).join(' ').trim();
            if (!brainrootName) return msg.reply('🤔 Debes especificar el nombre del Brainroot.');

            const charToSell = dbLogic.getCharacterByName(brainrootName);
            if (!charToSell) return msg.reply(`❌ No conozco ningún Brainroot llamado *${brainrootName}*.`);

            const coll    = dbLogic.getUserCollection(commandSenderId);
            const hasIt   = coll.some(c => c.id === charToSell.id);
            if (!hasIt) return msg.reply(`🤷‍♀️ No tienes *${charToSell.name}* en tu colección.`);

            const removed = dbLogic.removeFromUser(commandSenderId, charToSell.id);
            if (!removed) return msg.reply('❌ Error al preparar el Brainroot para la venta. Inténtalo de nuevo.');

            const listingId = dbLogic.addToMarket(commandSenderId, charToSell.id, price);
            if (listingId) {
                return msg.reply(`✅ Has puesto a la venta *${charToSell.name}* por ${MONEY_SYMBOL}${price.toLocaleString()} (ID: ${listingId}).`);
            } else {
                dbLogic.addToUser(commandSenderId, charToSell.id); // rollback
                return msg.reply('❌ Error al listar en el mercado. Tu Brainroot ha sido devuelto.');
            }
        }

        // =====================================================================
        // COMANDO: .brunsell / .quitarbr
        // =====================================================================
        if (['brunsell', 'quitarbr'].includes(commandName)) {
            if (args.length === 0) return msg.reply('🤔 Uso: `.brunsell [ID del listing]`');

            const listingId = parseInt(args[0]);
            if (isNaN(listingId) || listingId <= 0) return msg.reply('❌ El ID debe ser un número positivo.');

            const removed = dbLogic.removeFromMarket(listingId, commandSenderId);
            if (removed) {
                dbLogic.addToUser(commandSenderId, removed.character_id);
                const charInfo = dbLogic.getCharacterById(removed.character_id);
                return msg.reply(`✅ Has quitado *${charInfo?.name ?? 'el Brainroot'}* (ID: ${listingId}) de la venta y fue devuelto a tu colección.`);
            } else {
                return msg.reply('❌ No se encontró ese listing o no eres el vendedor.');
            }
        }

        // =====================================================================
        // COMANDO: .brmarket / .brshop
        // =====================================================================
        if (['brmarket', 'brshop'].includes(commandName)) {
            const listings = dbLogic.getMarketListings();

            if (listings.length === 0) {
                return msg.reply('🛒 El mercado está vacío. ¡Usa `.brsell [nombre] [precio]` para vender los tuyos!');
            }

            let marketMsg = '*🛒 Brainroots en el Mercado:*\n\n';
            const uniqueMentions = [...new Set(listings.map(l => l.seller_id))];

            for (const l of listings) {
                const sellerUser = await getUserData(l.seller_id);
                const sellerName = sellerUser?.pushname || l.seller_id.split('@')[0];
                marketMsg += `[ID: ${l.listing_id}] *${l.name}* (Rareza: ${l.rarity}/5)\n`;
                marketMsg += `   Precio: ${MONEY_SYMBOL}${l.listing_price.toLocaleString()} | Vendedor: @${sellerName}\n`;
            }
            marketMsg += '\nUsa `.brbuy [ID]` para comprar.';

            return sock.sendMessage(chatJid, { text: marketMsg, mentions: uniqueMentions }, { quoted: msg._baileysMessage });
        }

        // =====================================================================
        // COMANDO: .brbuy / .comprarbr
        // =====================================================================
        if (['brbuy', 'comprarbr'].includes(commandName)) {
            if (args.length === 0) return msg.reply('🤔 Uso: `.brbuy [ID del listing]`');

            const listingId = parseInt(args[0]);
            if (isNaN(listingId) || listingId <= 0) return msg.reply('❌ El ID debe ser un número positivo.');

            const listing = dbLogic.getMarketListingById(listingId);
            if (!listing) return msg.reply(`❌ No hay ningún Brainroot en venta con el ID *${listingId}*.`);

            if (listing.seller_id === commandSenderId) {
                return msg.reply('😅 No puedes comprarte tu propio Brainroot. Usa `.brunsell [ID]` para quitarlo.');
            }

            if (user.money < listing.price) {
                return msg.reply(`💸 No tienes suficiente dinero (${MONEY_SYMBOL}${user.money.toLocaleString()}) para comprar *${listing.name}* (Precio: ${MONEY_SYMBOL}${listing.price.toLocaleString()}).`);
            }

            // Deducir dinero al comprador
            user.money -= listing.price;
            await saveUserData(commandSenderId, user);

            // Acreditar al vendedor
            const sellerUser = await getUserData(listing.seller_id);
            const sellerName = sellerUser?.pushname || listing.seller_id.split('@')[0];
            if (sellerUser) {
                sellerUser.money += listing.price;
                await saveUserData(listing.seller_id, sellerUser);

                // DM de confirmación al vendedor
                try {
                    const dmJid = sellerUser.phoneNumber ? `${sellerUser.phoneNumber}@s.whatsapp.net` : listing.seller_id;
                    if (dmJid.includes('@s.whatsapp.net')) {
                        await sock.sendMessage(dmJid, {
                            text: `🎉 Tu *${listing.name}* (ID: ${listingId}) fue vendido a @${userNameToMention} por ${MONEY_SYMBOL}${listing.price.toLocaleString()}.\nNuevo saldo: ${MONEY_SYMBOL}${sellerUser.money.toLocaleString()}`,
                        }, { mentions: [listing.seller_id, senderOriginalJid] });
                    }
                } catch (dmErr) {
                    console.error(`[Brainroots] Error enviando DM de venta a ${sellerName}:`, dmErr);
                }
            }

            // Añadir Brainroot al comprador
            const added = dbLogic.addToUser(commandSenderId, listing.character_id);
            if (!added) {
                // Rollback
                user.money += listing.price;
                await saveUserData(commandSenderId, user);
                if (sellerUser) { sellerUser.money -= listing.price; await saveUserData(listing.seller_id, sellerUser); }
                return msg.reply('❌ Error al añadir el Brainroot a tu colección. Tu dinero fue devuelto.');
            }

            // Eliminar listing del mercado
            dbLogic.removeFromMarket(listingId);

            await sock.sendMessage(chatJid, {
                text: `🎉 ¡@${userNameToMention} compró un *${listing.name}* por ${MONEY_SYMBOL}${listing.price.toLocaleString()} de @${sellerName}!\nNuevo saldo: ${MONEY_SYMBOL}${user.money.toLocaleString()}`,
                mentions: [senderOriginalJid, listing.seller_id],
            }, { quoted: msg._baileysMessage });
            return;
        }

        console.warn(`[Brainroots] Comando desconocido '${commandName}'. Esto no debería ocurrir.`);
    },

    // -------------------------------------------------------------------------
    // API pública del plugin (para otros módulos o pruebas)
    // -------------------------------------------------------------------------
    getAllCharacters:             () => allCharacters,
    getRarityWeights:            () => rarityWeights,
    getCooldownSpawnCommandMs:   () => COOLDOWN_SPAWN_COMMAND_MS,
    getCatchWindowMs:            () => CATCH_WINDOW_MS,
    getCooldownRobCommandMs:     () => COOLDOWN_ROB_COMMAND_MS,
    getBaseRobSuccessChance:     () => BASE_ROB_SUCCESS_CHANCE,
    getRarityBonusPenaltyPerLevel: () => RARITY_BONUS_PENALTY_PER_LEVEL,
};