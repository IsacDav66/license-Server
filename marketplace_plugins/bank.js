// plugins/bank.js (Baileys Version)
// Comandos para depositar y retirar dinero del banco.

const { getUserData, saveUserData } = require('../../lib/bot-core');
const MONEY_SYMBOL = '$'; // Puedes cambiarlo a 💵 si prefieres

// Ajustar parámetros a sock, msg, args, commandName
const execute = async (sock, msg, args, commandName) => {
    const userId = msg.senderLid ||msg.senderLid || msg.author; // JID del remitente desde tu adaptador
    // Pasar 'msg' a getUserData para permitir la actualización del pushname
    const user = await getUserData(userId, msg);

    if (!user) {
        console.error(`[Bank Plugin Baileys] No se pudieron obtener los datos para ${userId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error("[Bank Plugin Baileys] Error enviando reply (error de datos):", e); }
        return;
    }

    const actionType = commandName.toLowerCase(); // commandName ya es el comando sin prefijo
    const amountArg = args[0] ? args[0].toLowerCase() : null;

    if (actionType === 'bank' || actionType === 'banco') {
         // msg.reply debería citar el mensaje original si así está configurado tu adaptador
         return msg.reply(`🏦 *Estado de tu Cuenta Bancaria:*\n\n`.trim() +
                             `  • Dinero en mano: ${MONEY_SYMBOL}${(user.money || 0).toLocaleString()}\n` +
                             `  • Dinero en banco: ${MONEY_SYMBOL}${(user.bank || 0).toLocaleString()}\n\n` +
                             `Usa \`.dep <cantidad|all>\` para depositar o \`.withdraw <cantidad|all>\` (o \`.with\`) para retirar.`);
    }

    let amount;

    if (actionType === 'dep' || actionType === 'deposit') {
        if (!amountArg) return msg.reply("❓ ¿Cuánto quieres depositar? Usa `.dep <cantidad>` o `.dep all`.");

        if (amountArg === 'all') {
            amount = user.money || 0;
        } else {
            amount = parseInt(amountArg);
            if (isNaN(amount) || amount <= 0) {
                return msg.reply("⚠️ Cantidad inválida para depositar. Debe ser un número positivo.");
            }
        }

        if (amount === 0 && (user.money || 0) === 0) {
             return msg.reply(`🤷 No tienes dinero para depositar.`);
        }
        if (amount === 0 && (user.money || 0) > 0 && amountArg !== 'all'){
            return msg.reply(`🤔 No puedes depositar ${MONEY_SYMBOL}0. Si quieres depositar todo, usa \`.dep all\`.`);
        }
        if ((user.money || 0) < amount) {
            return msg.reply(`❌ No tienes suficiente dinero en mano para depositar ${MONEY_SYMBOL}${amount.toLocaleString()}.\nTienes: ${MONEY_SYMBOL}${(user.money || 0).toLocaleString()}`);
        }
        // La condición amount === 0 && amountArg === 'all' && user.money === 0 ya está cubierta por la primera.

        user.money = (user.money || 0) - amount;
        user.bank = (user.bank || 0) + amount;
        await saveUserData(userId, user);
        console.log(`[Bank Plugin Baileys] ${userId} depositó ${amount}. Dinero: ${user.money}, Banco: ${user.bank}`);
        return msg.reply(`✅ Depositaste ${MONEY_SYMBOL}${amount.toLocaleString()} en el banco.\n` +
                             `Dinero en mano: ${MONEY_SYMBOL}${user.money.toLocaleString()}\n` +
                             `Dinero en banco: ${MONEY_SYMBOL}${user.bank.toLocaleString()}`);

    } else if (actionType === 'withdraw' || actionType === 'wd' || actionType === 'with') {
        if (!amountArg) return msg.reply("❓ ¿Cuánto quieres retirar? Usa `.withdraw <cantidad|all>` o `.with <cantidad|all>`.");

        if (amountArg === 'all') {
            amount = user.bank || 0;
        } else {
            amount = parseInt(amountArg);
            if (isNaN(amount) || amount <= 0) {
                return msg.reply("⚠️ Cantidad inválida para retirar. Debe ser un número positivo.");
            }
        }
        
        if (amount === 0 && (user.bank || 0) === 0) {
            return msg.reply(`🤷 No tienes dinero en el banco para retirar.`);
        }
        if (amount === 0 && (user.bank || 0) > 0 && amountArg !== 'all'){
             return msg.reply(`🤔 No puedes retirar ${MONEY_SYMBOL}0. Si quieres retirar todo, usa \`.withdraw all\` o \`.with all\`.`);
        }
        if ((user.bank || 0) < amount) {
            return msg.reply(`❌ No tienes suficiente dinero en el banco para retirar ${MONEY_SYMBOL}${amount.toLocaleString()}.\nEn banco: ${MONEY_SYMBOL}${(user.bank || 0).toLocaleString()}`);
        }
        // La condición amount === 0 && amountArg === 'all' && user.bank === 0 ya está cubierta por la primera.


        user.bank = (user.bank || 0) - amount;
        user.money = (user.money || 0) + amount;
        await saveUserData(userId, user);
        console.log(`[Bank Plugin Baileys] ${userId} retiró ${amount} (usando '${actionType}'). Dinero: ${user.money}, Banco: ${user.bank}`);
        return msg.reply(`✅ Retiraste ${MONEY_SYMBOL}${amount.toLocaleString()} del banco.\n` +
                             `Dinero en mano: ${MONEY_SYMBOL}${user.money.toLocaleString()}\n` +
                             `Dinero en banco: ${MONEY_SYMBOL}${user.bank.toLocaleString()}`);
    } else {
        // Esta condición es teóricamente inalcanzable si los aliases están bien definidos
        // y el bot.js solo llama a execute si el comando (actionType) es uno de los aliases.
        console.warn(`[Bank Plugin Baileys] Acción desconocida o no manejada: '${actionType}'`);
        return msg.reply("Comando de banco no reconocido. Usa `.dep`, `.withdraw` (o `.with`), o simplemente `.bank` para ver tu saldo.");
    }
};

module.exports = {
    name: 'Banco',
    aliases: ['bank', 'banco', 'dep', 'deposit', 'withdraw', 'wd', 'with'],
    description: 'Deposita o retira dinero. Muestra estado si se usa .bank o .banco.',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383049,
        price: "4.00",
        icon: "fa-building-columns",
        preview: {
            suggestions: ["!dep all", "!with 1000"],
            responses: {
                "!dep all": "✅ Depositaste $5,200 en el banco.\n\nDinero en mano: $0\nDinero en banco: $17,200",
                "!with 1000": "✅ Retiraste $1,000 del banco.\n\nDinero en mano: $1,000\nDinero en banco: $16,200"
            }
        }
    },
};