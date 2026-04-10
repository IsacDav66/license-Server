// plugins/millonarios.js (Baileys Version)
// Muestra un ranking de los usuarios con más dinero.

const { getAllUserData, getUserData } = require('../shared-economy');
const { jidDecode } = require('@whiskeysockets/baileys'); // Para obtener el número del JID si falta pushname
const MONEY_SYMBOL = '$'; // Puedes cambiarlo a 💵 si prefieres

module.exports = {
    name: 'Ranking Millonarios',
    aliases: ['millonarios', 'topmoney', 'rankmoney', 'ricos', 'ranking', 'topricos'],
    description: 'Muestra el top 10 de usuarios con más dinero (en mano + banco).',
    category: 'Economía',
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383053,
        price: "3.00",
        icon: "fa-trophy",
        preview: {
            suggestions: ["!ricos", "!ranking"],
            responses: {
                "!ricos": "🏆 *TOP MILLONARIOS* 🏆\n\n🥇 *StunBot* - $1,500,000\n🥈 *StunDoc* - $1,200,000\n🥉 *Sofia* - $900,000\n\nTu posición: #5",
                "!ranking": "🏆 *TOP MILLONARIOS* 🏆\n\n🥇 *StunBot* - $1,500,000\n🥈 *StunDoc* - $1,200,000\n🥉 *Sofia* - $900,000\n\nTu posición: #5"
            }
        }
    },

    // Ajustar parámetros a sock, msg, args, commandName
    async execute(sock, msg, args, commandName) {
        console.log("[Millonarios Plugin Baileys] Iniciando obtención de ranking...");
        
        const allUserData = await getAllUserData();

        if (!allUserData || Object.keys(allUserData).length === 0) {
            console.log("[Millonarios Plugin Baileys] No hay datos de usuarios en allUserData.");
            try { await msg.reply("🏦 Aún no hay datos de usuarios para mostrar un ranking o la base de datos está vacía."); } catch(e) { console.error("[Millonarios Plugin Baileys] Error enviando reply (sin datos):", e); }
            return;
        }

        const usersArray = [];
        for (const userId in allUserData) {
            const userEntry = allUserData[userId];

            const moneyInHand = (typeof userEntry.money === 'number' && !isNaN(userEntry.money)) ? userEntry.money : 0;
            const moneyInBank = (typeof userEntry.bank === 'number' && !isNaN(userEntry.bank)) ? userEntry.bank : 0;
            const totalMoney = moneyInHand + moneyInBank;

            let displayName = "Usuario Desconocido";
            if (userEntry.pushname && typeof userEntry.pushname === 'string' && userEntry.pushname.trim() !== "") {
                displayName = userEntry.pushname;
            } else if (userId) {
                // Usar jidDecode para obtener el número de teléfono como fallback del nombre
                const decodedJid = jidDecode(userId);
                displayName = decodedJid?.user || userId.split('@')[0]; // '.user' contiene el número
            }
            
            usersArray.push({
                id: userId,
                name: displayName,
                totalMoney: totalMoney
            });
        }

        usersArray.sort((a, b) => b.totalMoney - a.totalMoney);
        const topUsers = usersArray.slice(0, 10);

        if (topUsers.length === 0) {
            try { await msg.reply("🏦 Ningún usuario tiene dinero para mostrar en el ranking en este momento."); } catch(e) { console.error("[Millonarios Plugin Baileys] Error enviando reply (sin usuarios con dinero):", e); }
            return;
        }

        let rankingMessage = `🏆 *TOP MILLONARIOS DEL BOT* 🏆\n\n`;
        rankingMessage += `(Dinero en Mano + Dinero en Banco)\n-------------------------------------\n`;

        topUsers.forEach((userRankEntry, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = ` ${index + 1}.`;

            // Mostrar el nombre guardado (que ya tiene el fallback al número si pushname no existe)
            rankingMessage += `${medal} *${userRankEntry.name}* - ${MONEY_SYMBOL}${userRankEntry.totalMoney.toLocaleString('es-PE')}\n`;
        });
        rankingMessage += `-------------------------------------\n`;

        const requesterId =msg.senderLid || msg.author; // JID del que ejecuta el comando
        // Pasar 'msg' a getUserData para asegurar que el pushname del solicitante esté actualizado
        const requesterDataCurrent = await getUserData(requesterId, msg); 
        const requesterRankIndex = usersArray.findIndex(u => u.id === requesterId);

        if (requesterDataCurrent) {
            const displayNameForRequester = requesterDataCurrent.pushname || (jidDecode(requesterId)?.user || requesterId.split('@')[0]);
            if (requesterRankIndex !== -1) {
                const rankedRequesterData = usersArray[requesterRankIndex]; // Ya tenemos los datos del ranking
                if (requesterRankIndex >= 10) { 
                    rankingMessage += `\nTu posición: #${requesterRankIndex + 1} *${displayNameForRequester}* con ${MONEY_SYMBOL}${rankedRequesterData.totalMoney.toLocaleString('es-PE')}`;
                } else {
                    // Si ya está en el top 10, su info ya se mostró. Opcionalmente, podrías añadir un mensaje como:
                    // rankingMessage += `\n¡Felicidades, *${displayNameForRequester}*, estás en el top!`;
                }
            } else {
                 // Esto sucedería si el solicitante tiene 0 dinero total o no está en usersArray por alguna razón.
                 const totalMoneyRequester = (requesterDataCurrent.money || 0) + (requesterDataCurrent.bank || 0);
                 if (totalMoneyRequester > 0) {
                     rankingMessage += `\n¡Sigue así, *${displayNameForRequester}*! Tu fortuna de ${MONEY_SYMBOL}${totalMoneyRequester.toLocaleString('es-PE')} aún no te coloca en el top, ¡pero vas por buen camino!`;
                 } else {
                    rankingMessage += `\n¡Sigue jugando, *${displayNameForRequester}*! Aún no tienes suficiente para el ranking.`;
                 }
            }
        }

        try {
            // msg.reply debería citar el mensaje original si así está configurado tu adaptador
            await msg.reply(rankingMessage.trim());
        } catch (error) {
            console.error("[Millonarios Plugin Baileys] Error al enviar mensaje de ranking:", error);
            // Fallback si el envío falla
            await sock.sendMessage(msg.from, { text: "No pude mostrar el ranking en este momento. Intenta de nuevo más tarde." }, { quoted: msg._baileysMessage });
        }
        console.log("[Millonarios Plugin Baileys] Ranking enviado.");
    }
};