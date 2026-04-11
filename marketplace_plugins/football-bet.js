// plugins/football-bet.js (Baileys Version - API-Sports.io)
require('dotenv').config();

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

const fbDB = {
    getMatch: (id) => db.prepare('SELECT * FROM football_matches WHERE api_match_id = ?').get(id),
    saveMatch: (m) => { const cols = Object.keys(m); const placeholders = cols.map(() => '?').join(', '); const updates = cols.map(c => `"${c}" = excluded."${c}"`).join(', '); db.prepare(`INSERT INTO football_matches (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT(api_match_id) DO UPDATE SET ${updates}`).run(...Object.values(m)); },
    getOpen: () => db.prepare("SELECT * FROM football_matches WHERE status_short NOT IN ('FT', 'AET', 'PEN')").all(),
    getSettlable: () => db.prepare("SELECT DISTINCT fm.* FROM football_matches fm JOIN user_bets ub ON fm.api_match_id = ub.api_match_id WHERE fm.status_short IN ('FT') AND ub.status = 'PENDING'").all(),
    addBet: (u, m, c, a) => db.prepare('INSERT INTO user_bets (user_id, api_match_id, bet_choice, amount, bet_timestamp) VALUES (?, ?, ?, ?, ?)').run(u, m, c, a, Date.now()).lastInsertRowid,
    getPendingBets: (u) => db.prepare('SELECT ub.*, fm.home_team, fm.away_team FROM user_bets ub JOIN football_matches fm ON ub.api_match_id = fm.api_match_id WHERE ub.user_id = ? AND ub.status = "PENDING"').all(u),
    getBetsToSettle: (id) => db.prepare('SELECT * FROM user_bets WHERE api_match_id = ? AND status = "PENDING"').all(id),
    updateBet: (id, s) => db.prepare('UPDATE user_bets SET status = ? WHERE bet_id = ?').run(s, id),
    getRecentBets: (u, l) => db.prepare('SELECT * FROM user_bets WHERE user_id = ? AND status != "PENDING" LIMIT ?').all(u, l),
    getAllSettled: (u) => db.prepare('SELECT * FROM user_bets WHERE user_id = ? AND status IN ("WON", "LOST")').all(u)
};

const { default: fetch } = require('node-fetch');

const {
    getUserData, saveUserData, msToTime,
    getFootballMatch, saveFootballMatch, getOpenFootballMatches,
    getSettlableFootballMatches, addUserBet, getUserPendingBets,
    getBetsForMatchToSettle, updateBetStatus, getUserRecentSettledBets,
    getAllUserSettledBets // <--- NUEVA IMPORTACIÓN (necesitará una función en shared-economy.js)
} = require('../../lib/bot-core');

const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const MONEY_SYMBOL = '$';
const SETTLEMENT_INTERVAL_MS = 10 * 60 * 1000;
const MATCH_FETCH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_BET_AMOUNT = 500;
const HOME_AWAY_MULTIPLIER_MIN = 1.6;
const HOME_AWAY_MULTIPLIER_MAX = 3.5;
const DRAW_MULTIPLIER_MIN = 2.8;
const DRAW_MULTIPLIER_MAX = 4.5;

let settlementInterval;
let matchFetchInterval;
let isUpdatingMatches = false;
let isSettlingBets = false;

function getRandomMultiplier(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

// Función para obtener datos de la API-Sports.io (sin cambios)
async function fetchApiSportsData(endpoint) {
    if (!API_SPORTS_KEY) {
        console.error("\x1b[31m[Football Bet CRÍTICO]\x1b[0m API_SPORTS_KEY no definida. Verifica tu archivo .env.");
        return null;
    }

    const requestUrl = `${API_SPORTS_BASE_URL}${endpoint}`;
    console.log(`\x1b[35m[Football Bet API]\x1b[0m Haciendo petición a: ${requestUrl}`);

    try {
        if (typeof fetch !== 'function') {
            console.error("\x1b[31m[Football Bet CRÍTICO]\x1b[0m 'fetch' no es una función. Asegúrate de que 'node-fetch' está instalado correctamente o que tu versión de Node.js (18+) soporta fetch nativo.");
            return null;
        }
        const response = await fetch(requestUrl, {
            headers: { 'x-apisports-key': API_SPORTS_KEY }
        });
        
        const data = await response.json();

        if (!response.ok) {
            console.error(`\x1b[31m[Football Bet API ERROR]\x1b[0m Fallo HTTP ${response.status} ${response.statusText} para ${requestUrl}`);
            console.error(`\x1b[31m[Football Bet API ERROR]\x1b[0m Detalles del error (API-Sports):`, data);
            
            if (response.status === 403) {
                console.error("\x1b[31m[Football Bet API ERROR]\x1b[0m Error 403 Forbidden: API Key inválida o no tienes permisos. Verifica tu suscripción en API-Sports.");
            } else if (response.status === 429) {
                console.error("\x1b[31m[Football Bet API ERROR]\x1b[0m Error 429 Too Many Requests: Has excedido los límites de tu plan gratuito. Espera un tiempo.");
            }
            return null;
        }

        if (data && data.errors && Object.keys(data.errors).length > 0) {
            console.error(`\x1b[31m[Football Bet API ERROR]\x1b[0m La API respondió OK (200), pero contiene errores lógicos:`, data.errors);
            return null;
        }
        
        console.log(`\x1b[32m[Football Bet API]\x1b[0m Datos recibidos para ${endpoint}. Partidos encontrados: ${data && data.response ? data.response.length : 0}`);
        return data;
    } catch (error) {
        console.error("\x1b[31m[Football Bet API ERROR]\x1b[0m Fallo en la petición a la API (posiblemente de red):", error);
        return null;
    }
}

// Función para actualizar partidos en la base de datos (sin cambios)
async function updateMatchesFromAPI(sock) {
    console.log("\x1b[36m[Football Bet]\x1b[0m 🔄 Actualizando partidos de la API...");
    const currentTimestamp = Date.now();

    const data = await fetchApiSportsData('/fixtures?live=all');

    if (data && data.response) {
        let totalMatchesProcessed = 0;
        let totalMatchesSaved = 0;
        
        for (const match of data.response) {
            totalMatchesProcessed++;
            const fixture = match.fixture;
            const league = match.league;
            const teams = match.teams;
            const goals = match.goals;
            const score = match.score;

            // Filtro para ligas de interés (opcional)
            // const relevantLeagueIds = [ 
            //     1,   // World Cup
            //     2,   // Champions League
            //     39,  // Premier League
            //     140, // La Liga
            //     135, // Serie A
            //     78,  // Bundesliga
            //     94,  // Primeira Liga
            // ];
            // if (!relevantLeagueIds.includes(league.id)) {
            //     console.log(`\x1b[37m[Football Bet]\x1b[0m Ignorando partido de liga no relevante: ${league.name} (ID: ${league.id})`);
            //     continue;
            // }

            console.log(`\x1b[34m[Football Bet Match]\x1b[0m Procesando partido ID ${fixture.id} (${teams.home.name} vs ${teams.away.name}) de Liga: ${league.name} (ID: ${league.id}, Tipo: ${league.type})`);
            
            const matchStatusLong = fixture.status.long;
            const matchStatusShort = fixture.status.short;
            const elapsed = fixture.status.elapsed;
            const homeGoals = goals.home;
            const awayGoals = goals.away;
            const fulltimeHomeGoals = score.fulltime.home;
            const fulltimeAwayGoals = score.fulltime.away;

            const safeElapsed = elapsed !== null ? elapsed : null;
            const safeHomeGoals = homeGoals !== null ? homeGoals : null;
            const safeAwayGoals = awayGoals !== null ? awayGoals : null;
            const safeFulltimeHomeGoals = fulltimeHomeGoals !== null ? fulltimeHomeGoals : null;
            const safeFulltimeAwayGoals = fulltimeAwayGoals !== null ? fulltimeAwayGoals : null;

            const existingMatch = await getFootballMatch(fixture.id);
            let homeWinMult = existingMatch ? existingMatch.home_win_multiplier : null;
            let awayWinMult = existingMatch ? existingMatch.away_win_multiplier : null;
            let drawMult = existingMatch ? existingMatch.draw_multiplier : null;

            if ((!homeWinMult || !awayWinMult || !drawMult) && !['FT', 'AET', 'PEN', 'CANC', 'POSTP'].includes(matchStatusShort)) {
                homeWinMult = getRandomMultiplier(HOME_AWAY_MULTIPLIER_MIN, HOME_AWAY_MULTIPLIER_MAX);
                awayWinMult = getRandomMultiplier(HOME_AWAY_MULTIPLIER_MIN, HOME_AWAY_MULTIPLIER_MAX);
                drawMult = getRandomMultiplier(DRAW_MULTIPLIER_MIN, DRAW_MULTIPLIER_MAX);
                console.log(`\x1b[35m[Football Bet Odds]\x1b[0m Cuotas generadas para ${fixture.id}: HOME ${homeWinMult} | AWAY ${awayWinMult} | DRAW ${drawMult}`);
            } else if (existingMatch) {
                 console.log(`\x1b[35m[Football Bet Odds]\x1b[0m Cuotas existentes para ${fixture.id}: HOME ${homeWinMult} | AWAY ${awayWinMult} | DRAW ${drawMult}`);
            }

            try {
                await saveFootballMatch({
                    api_match_id: fixture.id,
                    league_id: league.id,
                    home_team: teams.home.name,
                    away_team: teams.away.name,
                    kick_off_timestamp: fixture.timestamp * 1000,
                    status_long: matchStatusLong,
                    status_short: matchStatusShort,
                    elapsed: safeElapsed,
                    home_goals: safeHomeGoals,
                    away_goals: safeAwayGoals,
                    fulltime_home_goals: safeFulltimeHomeGoals,
                    fulltime_away_goals: safeFulltimeAwayGoals,
                    home_win_multiplier: homeWinMult,
                    away_win_multiplier: awayWinMult,
                    draw_multiplier: drawMult,
                    last_api_update: currentTimestamp
                });
                totalMatchesSaved++;
            } catch (dbErr) {
                console.error(`\x1b[31m[Football Bet ERROR]\x1b[0m Fallo al guardar el partido ${fixture.id} en la DB:`, dbErr);
            }
        }
        console.log(`\x1b[32m[Football Bet]\x1b[0m ✅ ${totalMatchesProcessed} partidos procesados de la API. ${totalMatchesSaved} partidos guardados/actualizados.`);
    } else {
        console.log("\x1b[33m[Football Bet]\x1b[0m No se encontraron partidos en la respuesta de la API o la respuesta es inválida.");
    }
}

// Función para liquidar apuestas (sin cambios, ya usa los multiplicadores de la DB)
async function settleBets(sock) {
    console.log("\x1b[36m[Football Bet]\x1b[0m 💸 Iniciando liquidación de apuestas...");
    const matchesToSettle = await getSettlableFootballMatches();

    if (matchesToSettle.length === 0) {
        console.log("[Football Bet] No hay partidos terminados con apuestas pendientes.");
        return;
    }

    for (const match of matchesToSettle) {
        const bets = await getBetsForMatchToSettle(match.api_match_id);

        if (bets.length === 0) {
            continue;
        }

        const homeScore = match.fulltime_home_goals;
        const awayScore = match.fulltime_away_goals;
        let actualWinner = 'DRAW';

        if (homeScore === null || awayScore === null) {
            console.warn(`\x1b[33m[Football Bet WARN]\x1b[0m No se pudo liquidar partido ${match.api_match_id} (${match.home_team} vs ${match.away_team}) por falta de goles a tiempo completo. Estado: ${match.status_short}`);
            continue;
        }

        if (homeScore > awayScore) {
            actualWinner = 'HOME_WIN';
        } else if (awayScore > homeScore) {
            actualWinner = 'AWAY_WIN';
        }

        for (const bet of bets) {
            const user = await getUserData(bet.user_id);
            if (!user) {
                console.error(`\x1b[31m[Football Bet ERROR]\x1b[0m Usuario ${bet.user_id} no encontrado durante la liquidación de apuesta ${bet.bet_id}.`);
                await updateBetStatus(bet.bet_id, 'ERROR');
                continue;
            }

            let message = `⚽ *Liquidación de Apuesta #${bet.bet_id}* ⚽\n` +
                          `Partido: *${match.home_team} vs ${match.away_team}*\n` +
                          `Resultado Final: *${homeScore} - ${awayScore}*\n` +
                          `Tu apuesta: ${bet.bet_choice === 'HOME_WIN' ? match.home_team + ' gana' : (bet.bet_choice === 'AWAY_WIN' ? match.away_team + ' gana' : 'Empate')}\n`;

            if (bet.bet_choice === actualWinner) {
                let winnings = 0;
                if (actualWinner === 'DRAW') {
                    winnings = Math.floor(bet.amount * (match.draw_multiplier || DRAW_MULTIPLIER_MIN));
                } else if (actualWinner === 'HOME_WIN') {
                    winnings = Math.floor(bet.amount * (match.home_win_multiplier || HOME_AWAY_MULTIPLIER_MIN));
                } else { // AWAY_WIN
                    winnings = Math.floor(bet.amount * (match.away_win_multiplier || HOME_AWAY_MULTIPLIER_MIN));
                }

                user.money = (user.money || 0) + winnings;
                await saveUserData(bet.user_id, user);
                await updateBetStatus(bet.bet_id, 'WON');
                message += `🎉 ¡Ganaste! Recibes ${MONEY_SYMBOL}${winnings.toLocaleString()}\n` +
                           `Saldo actual: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;
            } else {
                await updateBetStatus(bet.bet_id, 'LOST');
                message += `😔 Perdiste. Mejor suerte la próxima vez.\n` +
                           `Saldo actual: ${MONEY_SYMBOL}${user.money.toLocaleString()}`;
            }

            try {
                await sock.sendMessage(bet.user_id, { text: message });
            } catch (msgError) {
                console.error(`\x1b[31m[Football Bet ERROR]\x1b[0m Error enviando mensaje de liquidación a ${bet.user_id}:`, msgError);
            }
        }
    }
    console.log("\x1b[36m[Football Bet]\x1b[0m ✅ Liquidación de apuestas finalizada.");
}

async function executeFootballBackgroundTasks(sock) {
    if (isUpdatingMatches || isSettlingBets) {
        console.log("\x1b[33m[Football Bet]\x1b[0m Tareas de fondo de fútbol ya en progreso. Saltando ejecución.");
        return;
    }

    try {
        isUpdatingMatches = true;
        await updateMatchesFromAPI(sock);
    } catch (err) {
        console.error("\x1b[31m[Football Bet ERROR]\x1b[0m Error en updateMatchesFromAPI durante ejecución manual:", err);
    } finally {
        isUpdatingMatches = false;
    }

    try {
        isSettlingBets = true;
        await settleBets(sock);
    } catch (err) {
        console.error("\x1b[31m[Football Bet ERROR]\x1b[0m Error en settleBets durante ejecución manual:", err);
    } finally {
        isSettlingBets = false;
    }
}

const initialize = async (sock) => {
    if (settlementInterval) clearInterval(settlementInterval);
    if (matchFetchInterval) clearInterval(matchFetchInterval);

    console.log("\x1b[36m[Football Bet]\x1b[0m Tareas de actualización y liquidación de fútbol configuradas para ejecución manual. Se activarán con el primer comando.");
};

const execute = async (sock, msg, args, commandName, finalUserIdForEconomy) => {
    const userId = finalUserIdForEconomy;
    console.log(`\x1b[33m[Football Bet Debug]\x1b[0m execute llamado para "${commandName}" con userId: "${userId}"`);

    const user = await getUserData(userId, msg);

    if (!user) { 
        console.error(`\x1b[31m[Football Bet ERROR]\x1b[0m No se pudieron obtener datos del usuario para ${userId}.`);
        return msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo.");
    }

    // --- ¡¡¡ ELIMINAR ESTA LÍNEA !!! ---
    // await executeFootballBackgroundTasks(sock); 
    // --- FIN DE LA ELIMINACIÓN ---

    switch (commandName.toLowerCase()) {
        case 'partidos':
        case 'futbol':
            // Para !partidos, SÍ queremos una actualización global si no se ha hecho en X tiempo
            // Reintroduciremos la actualización aquí, pero con un control para no hacerla cada vez.
            // Para las apuestas, solo actualizaremos si el partido no tiene cuotas.
            await executeFootballBackgroundTasks(sock); // Mantenemos la actualización global aquí
            await handleListMatches(sock, msg, user);
            break;
        case 'apostarfutbol':
            await handlePlaceBet(sock, msg, user, args);
            break;
        case 'misapuestas':
            await handleMyBets(sock, msg, user); // Esta función ya consulta la API por ID
            break;
        case 'ultimasapuestas':
            await handleRecentBets(sock, msg, user); // Esta función no necesita API para el estado actual
            break;
        default:
            msg.reply("Comando de fútbol no reconocido. Usa `!partidos`, `!apostarfutbol <ID_PARTIDO> <CANTIDAD> <GANADOR>`, `!misapuestas` o `!ultimasapuestas`.");
            break;
    }
};
async function handleListMatches(sock, msg, user) {
    const openMatches = await fbDB.getOpen();
    
    console.log(`\x1b[33m[Football Bet Debug]\x1b[0m Partidos recuperados de la DB para !partidos: ${openMatches.length} partidos.`, 
        openMatches.map(m => ({
            id: m.api_match_id,
            home: m.home_team,
            away: m.away_team,
            status: m.status_short,
            kickOff: new Date(m.kick_off_timestamp).toLocaleString('es-ES', { timeZone: 'America/Lima' }),
            odds: { home: m.home_win_multiplier, away: m.away_win_multiplier, draw: m.draw_multiplier }
        }))
    );

    if (openMatches.length === 0) {
        return msg.reply("No hay partidos programados o en vivo disponibles para apostar en este momento. Intenta de nuevo más tarde.");
    }

    let message = "⚽ *Partidos Disponibles para Apostar* ⚽\n\n";
    for (const match of openMatches) {
        const kickOffTimestamp = typeof match.kick_off_timestamp === 'string' 
            ? parseInt(match.kick_off_timestamp) 
            : match.kick_off_timestamp;

        const kickOffDate = new Date(kickOffTimestamp);
        
        const now = Date.now();
        const timeToKickOff = kickOffTimestamp - now;
        
        let statusText = match.status_long;
        if (match.status_short === 'NS') {
            statusText = `Inicia en: ${msToTime(timeToKickOff)}`;
        } else if (['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(match.status_short)) {
            statusText = `*EN VIVO* (${match.home_goals || 0}-${match.away_goals || 0}) - ${match.elapsed}'`;
        } else if (['FT', 'AET', 'PEN'].includes(match.status_short)) {
            statusText = `*FINALIZADO* (${match.fulltime_home_goals || 0}-${match.fulltime_away_goals || 0})`;
        }

        const homeOdds = match.home_win_multiplier ? `x${match.home_win_multiplier}` : 'N/A';
        const awayOdds = match.away_win_multiplier ? `x${match.away_win_multiplier}` : 'N/A';
        const drawOdds = match.draw_multiplier ? `x${match.draw_multiplier}` : 'N/A';

        message += `*ID:* ${match.api_match_id}\n` +
                   `📅 ${kickOffDate.toLocaleString('es-ES', { timeZone: 'America/Lima' })}\n` +
                   `🏟️ *${match.home_team}* vs *${match.away_team}*\n` +
                   `Cuotas: ${match.home_team} ${homeOdds} | Empate ${drawOdds} | ${match.away_team} ${awayOdds}\n` +
                   `Estado: ${statusText}\n` +
                   `-----------------------------------\n`;
    }
    message += "\nPara apostar, usa: `!apostarfutbol <ID_PARTIDO> <CANTIDAD> <GANADOR>`\n" +
               "Ej: `!apostarfutbol 12345 1000 HOME` (apuesta por el equipo local)\n" +
               "Ej: `!apostarfutbol 12345 500 AWAY` (apuesta por el equipo visitante)\n" +
               "Ej: `!apostarfutbol 12345 200 DRAW` (apuesta por el empate)";
    return msg.reply(message);
}

async function handlePlaceBet(sock, msg, user, args) {
    if (args.length < 3) {
        return msg.reply("❓ Uso incorrecto. Usa: `!apostarfutbol <ID_PARTIDO> <CANTIDAD> <GANADOR>`\n" +
                         "GANADOR puede ser `HOME`, `AWAY` o `DRAW`.");
    }

    const matchId = parseInt(args[0]);
    const amount = parseInt(args[1]);
    const betChoiceStr = args[2].toUpperCase();

    if (isNaN(matchId) || matchId <= 0) {
        return msg.reply("⚠️ ID de partido inválido. Debe ser un número positivo.");
    }
    if (isNaN(amount) || amount < MIN_BET_AMOUNT) {
        return msg.reply(`⚠️ Cantidad de apuesta inválida. Debe ser al menos ${MONEY_SYMBOL}${MIN_BET_AMOUNT.toLocaleString()}.`);
    }

    let betChoice;
    switch (betChoiceStr) {
        case 'HOME':
            betChoice = 'HOME_WIN';
            break;
        case 'AWAY':
            betChoice = 'AWAY_WIN';
            break;
        case 'DRAW':
            betChoice = 'DRAW';
            break;
        default:
            return msg.reply("⚠️ Elección de ganador inválida. Debe ser `HOME`, `AWAY` o `DRAW`.");
    }

    if (user.money < amount) {
        return msg.reply(`❌ No tienes suficiente dinero en mano para apostar ${MONEY_SYMBOL}${amount.toLocaleString()}.\nTienes: ${MONEY_SYMBOL}${user.money.toLocaleString()}`);
    }

    const match = await getFootballMatch(matchId);
    if (!match) {
        return msg.reply(`❌ Partido con ID ${matchId} no encontrado en la base de datos.`);
    }

    if (['FT', 'AET', 'PEN', 'CANC', 'POSTP'].includes(match.status_short)) {
        return msg.reply(`❌ No se pueden realizar apuestas para el partido ${match.home_team} vs ${match.away_team} porque su estado es *${match.status_long}*.`);
    }
    
    if (!match.home_win_multiplier || !match.away_win_multiplier || !match.draw_multiplier) {
         console.warn(`\x1b[33m[Football Bet WARN]\x1b[0m Partido ${matchId} no tiene cuotas válidas almacenadas. Intentando regenerar...`);
         await updateMatchesFromAPI(sock);
         return msg.reply(`⚠️ Las cuotas para el partido ${match.home_team} vs ${match.away_team} no están disponibles. Intenta tu apuesta de nuevo en un momento.`);
    }

    user.money -= amount;
    await saveUserData(user.userId, user);
    const betId = await fbDB.addBet(user.userId, matchId, betChoice, amount);

    if (betId) {
        let betMessage = `✅ Apuesta #${betId} de ${MONEY_SYMBOL}${amount.toLocaleString()} realizada con éxito!\n` +
                         `Partido: *${match.home_team} vs ${match.away_team}*\n` +
                         `Tu elección: ${betChoice === 'HOME_WIN' ? match.home_team : (betChoice === 'AWAY_WIN' ? match.away_team : 'Empate')} gana.\n` +
                         `Cuota: x${betChoice === 'HOME_WIN' ? match.home_win_multiplier : (betChoice === 'AWAY_WIN' ? match.away_win_multiplier : match.draw_multiplier)}\n` +
                         `Posible ganancia: ${MONEY_SYMBOL}${Math.floor(amount * (betChoice === 'HOME_WIN' ? match.home_win_multiplier : (betChoice === 'AWAY_WIN' ? match.away_win_multiplier : match.draw_multiplier))).toLocaleString()}\n` +
                         `Saldo restante: ${MONEY_SYMBOL}${user.money.toLocaleString()}.\n\n` +
                         "¡Buena suerte!";
        return msg.reply(betMessage);
    } else {
        user.money += amount;
        await saveUserData(user.userId, user);
        return msg.reply("❌ Ocurrió un error al registrar tu apuesta. Se te ha reembolsado el dinero. Inténtalo de nuevo.");
    }
}

// --- FUNCIÓN PARA CALCULAR GANANCIAS/PÉRDIDAS NETAS ---
async function calculateNetWinnings(userId) {
    console.log(`\x1b[33m[Football Bet Debug]\x1b[0m Calculando ganancias netas para usuario: ${userId}`);
    const settledBets = await getAllUserSettledBets(userId); // Obtener TODAS las apuestas liquidadas

    console.log(`\x1b[33m[Football Bet Debug]\x1b[0m Apuestas liquidadas encontradas para ${userId}: ${settledBets.length}`, settledBets.map(b => ({id:b.bet_id, status: b.status, amount: b.amount, choice: b.bet_choice, matchId: b.api_match_id})));


    let totalAmountBet = 0;
    let totalWinnings = 0;
    let totalLosses = 0;
    let netGain = 0;

    for (const bet of settledBets) {
        console.log(`\x1b[33m[Football Bet Debug]\x1b[0m Procesando apuesta #${bet.bet_id}, estado: ${bet.status}, cantidad: ${bet.amount}`);
        
        // Sumar la cantidad apostada solo para apuestas que no fueron reembolsadas
        if (bet.status !== 'REFUNDED') {
            totalAmountBet += bet.amount;
        }

        if (bet.status === 'WON') {
            const match = await getFootballMatch(bet.api_match_id); // Necesitamos el partido para sus cuotas

            if (!match) {
                console.warn(`\x1b[33m[Football Bet WARN]\x1b[0m Partido ${bet.api_match_id} no encontrado para calcular ganancias de apuesta ${bet.bet_id}. Saltando cálculo de ganancias para esta apuesta.`);
                continue;
            }
            
            // --- NUEVO LOG: Verificar multiplicadores ---
            console.log(`\x1b[33m[Football Bet Debug]\x1b[0m Apuesta #${bet.bet_id} GANADA. Elección: ${bet.bet_choice}. Cuotas del partido (HOME: ${match.home_win_multiplier}, AWAY: ${match.away_win_multiplier}, DRAW: ${match.draw_multiplier})`);

            let multiplier = 0;
            if (bet.bet_choice === 'DRAW') {
                multiplier = match.draw_multiplier || DRAW_MULTIPLIER_MIN;
            } else if (bet.bet_choice === 'HOME_WIN') {
                multiplier = match.home_win_multiplier || HOME_AWAY_MULTIPLIER_MIN;
            } else { // AWAY_WIN
                multiplier = match.away_win_multiplier || HOME_AWAY_MULTIPLIER_MIN;
            }
            const currentWinnings = Math.floor(bet.amount * multiplier);
            totalWinnings += currentWinnings;
            console.log(`\x1b[32m[Football Bet Debug]\x1b[0m Apuesta #${bet.bet_id} Ganó ${MONEY_SYMBOL}${currentWinnings.toLocaleString()} (Apostado: ${bet.amount}, Mult: ${multiplier})`);

        } else if (bet.status === 'LOST') {
            totalLosses += bet.amount;
            console.log(`\x1b[31m[Football Bet Debug]\x1b[0m Apuesta #${bet.bet_id} PERDIDA. (Apostado: ${bet.amount})`);
        }
        // Las apuestas 'REFUNDED' no se cuentan como ganancia/pérdida, solo se descuenta lo apostado de totalAmountBet arriba
    }

    netGain = totalWinnings - totalAmountBet;

    console.log(`\x1b[36m[Football Bet Debug]\x1b[0m Resumen Final para ${userId}: Total Apostado=${totalAmountBet}, Total Ganado=${totalWinnings}, Total Perdido=${totalLosses}, Ganancia Neta=${netGain}`);
    return { totalAmountBet, totalWinnings, totalLosses, netGain };
}

async function handleMyBets(sock, msg, user) {
    const pendingBets = await fbDB.getPendingBets(user.userId);
    // --- NUEVO: Calcular ganancias netas ---
    const { totalAmountBet, totalWinnings, totalLosses, netGain } = await calculateNetWinnings(user.userId);

    let message = `📝 *Tus Apuestas Pendientes* 📝\n\n`;
    
    if (pendingBets.length === 0) {
        message += "Actualmente no tienes apuestas pendientes.\n";
    } else {
        for (const bet of pendingBets) {
            const kickOffTimestamp = typeof bet.kick_off_timestamp === 'string' 
                ? parseInt(bet.kick_off_timestamp) 
                : bet.kick_off_timestamp;
                
            const kickOffDate = new Date(kickOffTimestamp);
            const now = Date.now();
            
            let currentMatchStatusText = "Cargando...";
            
            try {
                const apiData = await fetchApiSportsData(`/fixtures?id=${bet.api_match_id}`);
                if (apiData && apiData.response && apiData.response.length > 0) {
                    const liveFixture = apiData.response[0].fixture;
                    const liveGoals = apiData.response[0].goals;
                    const statusShort = liveFixture.status.short;
                    const statusLong = liveFixture.status.long;
                    const elapsed = liveFixture.status.elapsed;

                    if (statusShort === 'NS') {
                        currentMatchStatusText = `Inicia en: ${msToTime(liveFixture.timestamp * 1000 - now)}`;
                    } else if (['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(statusShort)) {
                        currentMatchStatusText = `*EN VIVO* (${liveGoals.home || 0}-${liveGoals.away || 0}) - ${elapsed}'`;
                    } else if (['FT', 'AET', 'PEN'].includes(statusShort)) {
                        const fulltimeScore = apiData.response[0].score.fulltime;
                        currentMatchStatusText = `*FINALIZADO* (${fulltimeScore.home || 0}-${fulltimeScore.away || 0})`;
                    } else {
                        currentMatchStatusText = statusLong;
                    }
                } else {
                    currentMatchStatusText = bet.match_status_long || 'Desconocido';
                }
            } catch (apiError) {
                console.error(`\x1b[31m[Football Bet ERROR]\x1b[0m Fallo al obtener estado en vivo para partido ${bet.api_match_id}:`, apiError);
                currentMatchStatusText = bet.match_status_long || 'Error al actualizar';
            }

            message += `*ID Apuesta:* ${bet.bet_id}\n` +
                       `Partido: *${bet.home_team} vs ${bet.away_team}*\n` +
                       `Apostado: ${MONEY_SYMBOL}${bet.amount.toLocaleString()}\n` +
                       `Elección: ${bet.bet_choice === 'HOME_WIN' ? bet.home_team : (bet.bet_choice === 'AWAY_WIN' ? bet.away_team : 'Empate')}\n` +
                       `Estado Actual: ${currentMatchStatusText}\n` +
                       `Fecha Inicio: ${kickOffDate.toLocaleString('es-ES', { timeZone: 'America/Lima' })}\n` +
                       `-----------------------------------\n`;
        }
    }

    message += `\n📊 *Resumen de Apuestas Liquidadas:*\n` +
               `  • Total Apostado: ${MONEY_SYMBOL}${totalAmountBet.toLocaleString()}\n` +
               `  • Total Ganado: ${MONEY_SYMBOL}${totalWinnings.toLocaleString()}\n` +
               `  • Ganancia Neta: ${MONEY_SYMBOL}${netGain.toLocaleString()} ${netGain >= 0 ? '🎉' : '😔'}`;

    return sock.sendMessage(msg.from, { text: message });
}

// --- MODIFICADO: handleRecentBets para usar calculateNetWinnings (si se desea un resumen global) ---
// Opcional: Si quieres mostrar el resumen global en !ultimasapuestas también, descomenta.
// Por ahora, solo se muestra en !misapuestas para no duplicar.
async function handleRecentBets(sock, msg, user) {
    const recentBets = await getUserRecentSettledBets(user.userId, 5);

    if (recentBets.length === 0) {
        return msg.reply("No tienes apuestas liquidadas recientemente.");
    }

    let message = "📋 *Tus Últimas 5 Apuestas Liquidadas* 📋\n\n";
    for (const bet of recentBets) {
        const kickOffTimestamp = typeof bet.kick_off_timestamp === 'string' 
            ? parseInt(bet.kick_off_timestamp) 
            : bet.kick_off_timestamp;
        const kickOffDate = new Date(kickOffTimestamp);
        
        // Calcular la ganancia/pérdida para esta apuesta individual
        let betResultText = ``;
        if (bet.status === 'WON') {
            const match = await getFootballMatch(bet.api_match_id);
            let multiplier = 0;
            if (bet.bet_choice === 'DRAW') {
                multiplier = match?.draw_multiplier || DRAW_MULTIPLIER_MIN;
            } else if (bet.bet_choice === 'HOME_WIN') {
                multiplier = match?.home_win_multiplier || HOME_AWAY_MULTIPLIER_MIN;
            } else { // AWAY_WIN
                multiplier = match?.away_win_multiplier || HOME_AWAY_MULTIPLIER_MIN;
            }
            const winnings = Math.floor(bet.amount * multiplier);
            betResultText = `(Ganaste ${MONEY_SYMBOL}${winnings.toLocaleString()})`;
        } else if (bet.status === 'LOST') {
            betResultText = `(Perdiste ${MONEY_SYMBOL}${bet.amount.toLocaleString()})`;
        } else if (bet.status === 'REFUNDED') {
            betResultText = `(Reembolsado ${MONEY_SYMBOL}${bet.amount.toLocaleString()})`;
        }


        message += `*ID Apuesta:* ${bet.bet_id}\n` +
                   `Partido: *${bet.home_team} vs ${bet.away_team}*\n` +
                   `Resultado: ${bet.fulltime_home_goals || 0} - ${bet.fulltime_away_goals || 0}\n` +
                   `Apostado: ${MONEY_SYMBOL}${bet.amount.toLocaleString()}\n` +
                   `Elección: ${bet.bet_choice === 'HOME_WIN' ? bet.home_team : (bet.bet_choice === 'AWAY_WIN' ? bet.away_team : 'Empate')}\n` +
                   `Estado: *${bet.status.toUpperCase()}* ${betResultText}\n` +
                   `Fecha Inicio: ${kickOffDate.toLocaleString('es-ES', { timeZone: 'America/Lima' })}\n` +
                   `-----------------------------------\n`;
    }
    
    // --- OPCIONAL: También mostrar el resumen global aquí ---
    // const { totalAmountBet, totalWinnings, totalLosses, netGain } = await calculateNetWinnings(user.userId);
    // message += `\n📊 *Resumen Global de Apuestas:*\n` +
    //            `  • Total Apostado: ${MONEY_SYMBOL}${totalAmountBet.toLocaleString()}\n` +
    //            `  • Total Ganado: ${MONEY_SYMBOL}${totalWinnings.toLocaleString()}\n` +
    //            `  • Ganancia Neta: ${MONEY_SYMBOL}${netGain.toLocaleString()} ${netGain >= 0 ? '🎉' : '😔'}`;

    return msg.reply(message);
}


module.exports = {
    name: 'Apuestas Fútbol',
    aliases: ['partidos', 'futbol', 'apostarfutbol', 'misapuestas', 'ultimasapuestas'],
    description: 'Apuesta en partidos de fútbol y gestiona tus apuestas.',
    category: 'Juegos',
    initialize,
    isListener: true,
    execute,
    marketplace: {
        externalDependencies: ["node-fetch@^3.3.2"],
        dbSchema: ` CREATE TABLE IF NOT EXISTS football_matches (api_match_id INTEGER PRIMARY KEY, home_team TEXT, away_team TEXT, home_win_multiplier REAL, away_win_multiplier REAL, draw_multiplier REAL, status_short TEXT); CREATE TABLE IF NOT EXISTS user_bets (bet_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, api_match_id INTEGER, bet_choice TEXT, amount INTEGER, status TEXT DEFAULT 'PENDING'); `,
        requirements: ["API-Sports.io Key","Base de Datos PostgreSQL"],
        tebex_id: 7383037,
        price: "20.00",
        icon: "fa-futbol",
        preview: {
            suggestions: ["!partidos", "!misapuestas"],
            responses: {
                "!partidos": "⚽ *Partidos Disponibles* ⚽\n\n*ID:* 10245\n🏟️ *Real Madrid* vs *Barcelona*\nCuotas: RM x1.85 | Empate x3.20 | FCB x2.10\nEstado: NS (Inicia en 2h 15m)\n-------------------\n*ID:* 10246\n🏟️ *Man. City* vs *Arsenal*\nEstado: *EN VIVO* (1-0) - 65'",
                "!misapuestas": "📝 *Tus Apuestas Pendientes* 📝\n\nID: #45\nRM vs FCB ($1,000 a Home)\nEstado: Pendiente"
            }
        }
    },
};