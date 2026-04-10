// plugins/robarBanco.js (Versión Simplificada 24/7 con Cooldown)

const { getUserData, saveUserData, getAllUserData } = require('../shared-economy.js');

// --- CONFIGURACIÓN DEL ROBO ---
const ROBO_MIN_MONEY = 5000; // Mínimo de dinero en mano para intentar.
const ROBO_BASE_CHANCE = 40; // 40% de probabilidad base.
const ROBO_CHANCE_BONUS_PER_500 = 5; // +5% por cada $500 extra apostados.
const ROBO_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Cooldown de 24 horas por intento.
const VICTIM_PROTECTION_MS = 12 * 60 * 60 * 1000; // 12 horas de inmunidad para la víctima.

/**
 * Función de utilidad para convertir milisegundos a un formato legible.
 * @param {number} ms - Milisegundos a convertir.
 * @returns {string} - El tiempo formateado.
 */
function formatTimeRemaining(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: 'Robar Banco (PvP)',
    aliases: ['robarbanco', 'bankrob'],
    description: 'Intenta robar dinero del banco de otro usuario. ¡Alto riesgo, alta recompensa!',
    category: 'Economía',
    groupOnly: true,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383045,
        price: "12.00",
        icon: "fa-vault",
        preview: {
            suggestions: ["!robarbanco", "!bankrob"],
            responses: {
                "!robarbanco": "💥 *¡GOLPE EXITOSO!* 💥\n\n@Atacante ha asaltado el banco de @Víctima y se ha llevado un botín de **$25,000**! 💸",
                "!bankrob": "❌ *¡ROBO FALLIDO!* ❌\n\n¡La alarma sonó! @Atacante fue descubierto intentando robar y perdió **$5,000** en la huida. 🔒"
            }
        }
    },
    // Ya no es un listener, es un comando normal.
    
    async execute(sock, msg, args) {
        const attackerId =msg.senderLid || msg.author;
        const attackerData = await getUserData(attackerId, msg);

        // 1. VERIFICAR COOLDOWN DEL ATACANTE
        const lastRobTime = attackerData.lastbankrob || 0;
        if (Date.now() - lastRobTime < ROBO_COOLDOWN_MS) {
            const remainingTime = formatTimeRemaining(ROBO_COOLDOWN_MS - (Date.now() - lastRobTime));
            return msg.reply(`⏳ Debes recuperarte de tu último golpe. Podrás intentar otro robo en *${remainingTime}*.`);
        }

        // 2. VERIFICAR REQUISITOS DEL ATACANTE
        if (attackerData.money < ROBO_MIN_MONEY) {
            return msg.reply(`💰 Necesitas tener al menos *$${ROBO_MIN_MONEY.toLocaleString()}* en mano para planear el robo.`);
        }

        // 3. BUSCAR VÍCTIMAS POTENCIALES
        const allUsers = await getAllUserData();
        const potentialVictims = Object.values(allUsers)
            .filter(user => 
                user.bank > 500 &&                                // Que tengan al menos $500 en el banco para que valga la pena.
                user.userId !== attackerId &&                     // Que no sea el propio atacante.
                (Date.now() > (user.robprotection || 0))       // Que no estén bajo protección.
            );

        if (potentialVictims.length === 0) {
            return msg.reply('🔒 No hay objetivos jugosos disponibles en este momento. Parece que todos los bancos están vacíos o sus dueños están alerta.');
        }

        await msg.reply('🚨 ¡Preparando el golpe! Buscando un objetivo vulnerable...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa dramática

        // 4. SELECCIONAR VÍCTIMA Y CALCULAR ROBO
        const victimData = potentialVictims[Math.floor(Math.random() * potentialVictims.length)];
        const victimId = victimData.userId;
        
        let investment = attackerData.money; // El atacante apuesta todo su dinero en mano.
        let successChance = ROBO_BASE_CHANCE + Math.floor((investment - ROBO_MIN_MONEY) / 500) * ROBO_CHANCE_BONUS_PER_500;
        successChance = Math.min(successChance, 95); // Límite máximo de probabilidad.
        
        const roll = Math.random() * 100;

        // Establecer el cooldown del atacante AHORA, independientemente del resultado.
        attackerData.lastbankrob = Date.now();

        if (roll < successChance) {
            // 5. ROBO EXITOSO
            const robPercentage = 0.10 + Math.random() * 0.20; // Roba entre 10% y 30%
            const stolenAmount = Math.floor(victimData.bank * robPercentage);

            attackerData.money += stolenAmount;
            victimData.bank -= stolenAmount;
            victimData.robprotection = Date.now() + VICTIM_PROTECTION_MS;

            await saveUserData(attackerId, attackerData);
            await saveUserData(victimId, victimData);

            const attackerMention = `@${attackerId.split('@')[0]}`;
            const victimMention = `@${victimId.split('@')[0]}`;
            
            const successMessage = `💥 *¡GOLPE EXITOSO!* 💥\n\n${attackerMention} ha asaltado el banco de ${victimMention} y se ha llevado un botín de **$${stolenAmount.toLocaleString()}**!\n\nLa víctima ahora está protegida por 12 horas.`;
            await sock.sendMessage(msg.from, { text: successMessage, mentions: [attackerId, victimId] });

        } else {
            // 6. ROBO FALLIDO
            const penalty = investment;
            attackerData.money = 0; // Pierde todo el dinero en mano.

            await saveUserData(attackerId, attackerData);
            
            const attackerMention = `@${attackerId.split('@')[0]}`;
            
            const failMessage = `❌ *¡ROBO FALLIDO!* ❌\n\n¡La alarma sonó! ${attackerMention} fue descubierto intentando robar y perdió **$${penalty.toLocaleString()}** en la huida.\n\n¡Mejor suerte la próxima vez! 🔒`;
            await sock.sendMessage(msg.from, { text: failMessage, mentions: [attackerId] });
        }
    }
};