const fs = require('fs');
const path = require('path');

// --- DICCIONARIO DE LÓGICA SQLITE PARA INYECTAR ---
const LOGICA_MODULAR = {
    // Si el plugin usa Brainroots, le pegamos estas funciones
    brainroots: `
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
`,
    // Si el plugin usa Fútbol, le pegamos estas
    futbol: `
const fbDB = {
    getMatch: (id) => db.prepare('SELECT * FROM football_matches WHERE api_match_id = ?').get(id),
    saveMatch: (m) => { const cols = Object.keys(m); const placeholders = cols.map(() => '?').join(', '); const updates = cols.map(c => \`"\${c}" = excluded."\${c}"\`).join(', '); db.prepare(\`INSERT INTO football_matches (\${cols.join(',')}) VALUES (\${placeholders}) ON CONFLICT(api_match_id) DO UPDATE SET \${updates}\`).run(...Object.values(m)); },
    getOpen: () => db.prepare("SELECT * FROM football_matches WHERE status_short NOT IN ('FT', 'AET', 'PEN')").all(),
    getSettlable: () => db.prepare("SELECT DISTINCT fm.* FROM football_matches fm JOIN user_bets ub ON fm.api_match_id = ub.api_match_id WHERE fm.status_short IN ('FT') AND ub.status = 'PENDING'").all(),
    addBet: (u, m, c, a) => db.prepare('INSERT INTO user_bets (user_id, api_match_id, bet_choice, amount, bet_timestamp) VALUES (?, ?, ?, ?, ?)').run(u, m, c, a, Date.now()).lastInsertRowid,
    getPendingBets: (u) => db.prepare('SELECT ub.*, fm.home_team, fm.away_team FROM user_bets ub JOIN football_matches fm ON ub.api_match_id = fm.api_match_id WHERE ub.user_id = ? AND ub.status = "PENDING"').all(u),
    getBetsToSettle: (id) => db.prepare('SELECT * FROM user_bets WHERE api_match_id = ? AND status = "PENDING"').all(id),
    updateBet: (id, s) => db.prepare('UPDATE user_bets SET status = ? WHERE bet_id = ?').run(s, id),
    getRecentBets: (u, l) => db.prepare('SELECT * FROM user_bets WHERE user_id = ? AND status != "PENDING" LIMIT ?').all(u, l),
    getAllSettled: (u) => db.prepare('SELECT * FROM user_bets WHERE user_id = ? AND status IN ("WON", "LOST")').all(u)
};
`
};

const pluginsDir = path.join(__dirname, 'marketplace_plugins');

fs.readdirSync(pluginsDir).forEach(file => {
    if (!file.endsWith('.js')) return;
    const filePath = path.join(pluginsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Corregir el require al bot-core (ahora en /lib/)
    content = content.replace(/require\(['"].*shared-economy['"]\)/g, "require('../../lib/bot-core')");
    content = content.replace(/require\(['"].*bot-core['"]\)/g, "require('../../lib/bot-core')");

    // 2. Inyectar Lógica de Base de Datos si se detecta uso
    let injection = "";
    if (content.includes('Brainroots') || content.includes('br')) injection += LOGICA_MODULAR.brainroots;
    if (content.includes('football') || content.includes('partidos')) injection += LOGICA_MODULAR.futbol;

    if (injection && !content.includes('const brDB') && !content.includes('const fbDB')) {
        // Insertar después de los requires iniciales
        const lines = content.split('\n');
        lines.splice(2, 0, injection);
        content = lines.join('\n');
    }

    // 3. Mapear llamadas antiguas a los nuevos objetos internos
    // Ejemplo: getAllBrainrootsCharacters() -> brDB.getAll()
    const mappings = {
        'getAllBrainrootsCharacters': 'brDB.getAll',
        'getBrainrootsCharacterByName': 'brDB.getByName',
        'addBrainrootsToUser': 'brDB.addToUser',
        'getUserBrainroots': 'brDB.getUserColl',
        'updateBrainrootIncomeTimestamp': 'brDB.updateIncome',
        'removeBrainrootFromUser': 'brDB.remove',
        'getRandomUserBrainroot': 'brDB.getRandom',
        'getOpenFootballMatches': 'fbDB.getOpen',
        'addUserBet': 'fbDB.addBet',
        'getUserPendingBets': 'fbDB.getPendingBets'
        // Añade más si detectas otros errores
    };

    Object.keys(mappings).forEach(oldFn => {
        const regex = new RegExp(oldFn + '\\(', 'g');
        content = content.replace(regex, mappings[oldFn] + '(');
    });

    fs.writeFileSync(filePath, content);
    console.log(`🛠️ Plugin modularizado: ${file}`);
});

console.log("\n🚀 Todos los plugins han sido independizados del Core.");