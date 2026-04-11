// plugins/Utilidad/stats_manager.js
const { pool } = require('../shared-economy.js');

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


// ID del grupo a monitorear
const TARGET_GROUP_JID = '120363241724220394@g.us'; 

module.exports = {
    name: 'Estadísticas Dinámicas',
    description: 'Genera gráficos de crecimiento basados en X días.',
    aliases: ['stats', 'grafico', 'evolucion'],
    category: 'Admin',
    isListener: true,
    marketplace: {
        externalDependencies: ["axios@^1.11.0"],
        dbSchema: ` CREATE TABLE IF NOT EXISTS daily_group_stats (group_jid TEXT, member_count INTEGER, stat_date TEXT, PRIMARY KEY(group_jid, stat_date)); `,
        tebex_id: 7383018,
        price: "12.00",
        icon: "fa-chart-line",
        preview: {
            suggestions: ["!stats", "!evolucion"],
            responses: {
                "!stats": {
                    text: "📊 *ESTADÍSTICAS DEL GRUPO*\n\n📅 *Período:* Últimos 7 registros\n👥 *Total actual:* 1,540\n✨ *Crecimiento:* 📈 +12",
                    image: "https://quickchart.io/chart?c=%7Btype:%27line%27,data:%7Blabels:[%271/4%27,%272/4%27,%273/4%27,%274/4%27,%275/4%27,%276/4%27,%277/4%27],datasets:[%7Blabel:%27Miembros%27,data:[1480,1495,1510,1520,1535,1538,1540],borderColor:%27rgb(37,211,102)%27,fill:false%7D]%7D%7D"
                },
                "!evolucion": {
                    text: "⏳ Generando visualización de crecimiento...",
                    image: "https://quickchart.io/chart?c=%7Btype:%27sparkline%27,data:%7Bdatasets:[%7Bdata:[10,15,8,12,18,20,25],borderColor:%27blue%27%7D]%7D%7D"
                }
            }
        }
    },

    async onLoad(sock) {
        try {
            const metadata = await sock.groupMetadata(TARGET_GROUP_JID);
            const count = metadata.participants.length;
            await pool.query(`
                INSERT INTO daily_group_stats (group_jid, member_count, stat_date)
                VALUES ($1, $2, CURRENT_DATE)
                ON CONFLICT (group_jid, stat_date) DO NOTHING;
            `, [TARGET_GROUP_JID, count]);
        } catch (e) {}
    },

    async execute(sock, m, args) {
        // Capturar el número de días del argumento (ej: .stats 7)
        // Por defecto 7, mínimo 2, máximo 30 para que el gráfico se vea bien
        let days = parseInt(args[0]) || 7;
        if (days < 2) days = 2;
        if (days > 30) days = 30; 

        await this.sendVisualChart(sock, m, days);
    },

    async sendVisualChart(sock, m, days) {
        try {
            // 1. Obtener los últimos X registros solicitados
            const res = await pool.query(`
                SELECT stat_date, member_count 
                FROM daily_group_stats 
                WHERE group_jid = $1 
                ORDER BY stat_date DESC LIMIT $2
            `, [TARGET_GROUP_JID, days]);

            // Invertimos el array para que el gráfico vaya de pasado a presente
            const rows = res.rows.reverse();

            if (rows.length < 2) {
                return m.reply(`⚠️ *Datos insuficientes:* Aún no tengo registros de al menos 2 días para comparar.`);
            }

            // 2. Preparar datos
            const labels = rows.map(r => {
                const d = new Date(r.stat_date);
                return `${d.getDate()}/${d.getMonth() + 1}`;
            });
            const data = rows.map(r => r.member_count);

            // 3. Calcular métricas (Hoy vs El primer día del rango solicitado)
            const hoy = data[data.length - 1];
            const inicioRango = data[0];
            const diff = hoy - inicioRango;
            const diffText = diff >= 0 ? `📈 +${diff}` : `📉 ${diff}`;
            const diasReales = rows.length;

            // 4. Configuración del Gráfico
            const chartConfig = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Miembros',
                        data: data,
                        fill: true,
                        backgroundColor: 'rgba(37, 211, 102, 0.1)',
                        borderColor: '#25D366',
                        borderWidth: 3,
                        pointRadius: days > 15 ? 2 : 4, // Puntos más pequeños si hay muchos días
                        lineTension: 0.3
                    }]
                },
                options: {
                    title: {
                        display: true,
                        text: `EVOLUCIÓN: ÚLTIMOS ${diasReales} DÍAS`,
                        fontColor: '#128C7E',
                        fontSize: 16
                    },
                    legend: { display: false },
                    scales: {
                        yAxes: [{ ticks: { fontStyle: 'bold' } }]
                    }
                }
            };

            const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&bkg=white&width=800&height=400`;

            const caption = `📊 *ESTADÍSTICAS DEL GRUPO*\n\n` +
                          `📅 *Período:* Últimos ${diasReales} registros\n` +
                          `👥 *Total actual:* ${hoy}\n` +
                          `✨ *Crecimiento:* ${diffText}\n\n` +
                          `_Comparando dato de hoy vs hace ${diasReales - 1} días activos._`;

            await sock.sendMessage(m.from, { 
                image: { url: chartUrl }, 
                caption: caption 
            }, { quoted: m._baileysMessage });

        } catch (error) {
            console.error(error);
            m.reply('❌ Error al procesar las estadísticas.');
        }
    }
};