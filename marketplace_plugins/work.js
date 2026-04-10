// plugins/work.js (Baileys Version)
// Comando para trabajar y ganar recompensas, con nuevo flujo de registro.

const axios = require('axios'); // Para descargar imágenes desde URL
const { getUserData, saveUserData, msToTime, pickRandom } = require('../shared-economy'); // setUserRegistrationState y clearUserRegistrationState no se usan directamente aquí, pero sí en el flujo de registro que este comando inicia.

const COOLDOWN_WORK_MS = 10 * 60 * 1000; // 10 minutos
const MONEY_SYMBOL = '💵';
const EXP_SYMBOL = '⭐';

// Mismas URLs de trabajos
const jobs = [
    { text: "Trabajas como cortador de galletas 🍪", moneyEarned: 100, img: "https://th.bing.com/th/id/R.55e10b871427974ca5fb30925f09313b?rik=AW%2bZzb9RfZmKrA&riu=http%3a%2f%2fpm1.aminoapps.com%2f6498%2fde1fb2ac69b2c44330a44d37fc513d05e4890cd9_00.jpg&ehk=BNfUAc0KY56X7AVEnB0Fjf1PiHxAXU%2bdoDSV8ZFVwjQ%3d&risl=&pid=ImgRaw&r=0" },
    { text: "Trabajas para una empresa militar privada 🎖️", moneyEarned: 120, img: "https://i.pinimg.com/originals/ba/26/09/ba2609705507fb66bdce02a85614472a.jpg" },
    { text: "Organizaste un evento de cata de vinos 🍷", moneyEarned: 200, img: "https://th.bing.com/th/id/OIP.5hdIQbv6cLiDNpIc4VcuhQHaFP?cb=thvnextc1&rs=1&pid=ImgDetMain" },
    { text: "Reparaste el DeLorean de Doc Brown ⚡", moneyEarned: 180, img: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/65484c0f-247d-4dd6-bc0e-d23692d712e1/dfuv5h1-85108be2-f66b-4fb5-9b77-b6daebfc4071.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzY1NDg0YzBmLTI0N2QtNGRkNi1iYzBlLWQyMzY5MmQ3MTJlMVwvZGZ1djVoMS04NTEwOGJlMi1mNjZiLTRmYjUtOWI3Ny1iNmRhZWJmYzQwNzEuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.Pn-gKU95A2Mf-c5Uf94CCAqfi1FBU1Z16CNf-PKpuqE" },
    { text: "Ayudaste a programar este bot 🤖", moneyEarned: 220, img: "https://e1.pxfuel.com/desktop-wallpaper/484/178/desktop-wallpaper-anime-programming-anime-programmer.jpg" },
    { text: "Fuiste minero de Bitcoin por un día ⛏️", moneyEarned: 170, img: "https://th.bing.com/th/id/OIP.wpbC8Tn2sHETOVHM1JP07wHaHC?cb=thvnextc1&rs=1&pid=ImgDetMain" },
    { text: "Te convertiste en un streamer famoso 🎮", moneyEarned: 250, img: "https://as1.ftcdn.net/v2/jpg/05/62/98/28/1000_F_562982867_quxwUdvhalu0fUgYxMhk8HiIiZGuy3en.jpg" },
    { text: "Cocinaste como chef de 3 estrellas Michelin 👨‍🍳", moneyEarned: 300, img: "https://th.bing.com/th/id/OIP.mBh-RB3RLBpXrb_L7s9UmwHaIN?cb=thvnextc1&rs=1&pid=ImgDetMain" },
    { text: "Descubriste la cura para el resfriado común 🧪", moneyEarned: 280, img: "https://img.freepik.com/fotos-premium/laboratorio-cientifico-chica-manga-anime-estilo-ilustracion-generativa-ai_850000-19342.jpg?w=2000" },
    { text: "Encontraste un tesoro pirata perdido 🗺️", moneyEarned: 240, img: "https://multianime.com.mx/wp-content/uploads/2020/08/animeYT-regresa-anime-ilegal-streaming-anime-pirateria.jpg" },
    { text: "Vendiste limonada en la esquina 🍋", moneyEarned: 50, img: "https://thumb.ac-illust.com/bf/bf203fb3aff99476f540627c8a8d5b9d_t.jpeg" },
    { text: "Paseaste perros del vecindario 🐕", moneyEarned: 80, img: "https://th.bing.com/th/id/OIP.c7va0mYCHbSeQEbeGgbIMwHaFl?cb=thvnextc1&rs=1&pid=ImgDetMain" },
];

// Ajustar parámetros a sock, msg, args, commandName (commandName no se usa aquí pero es estándar)
const execute = async (sock, msg, args, commandName) => {
    const senderContactInfo = await msg.getContact(); // Desde tu adaptador
    if (!senderContactInfo) {
        console.error(`[Work Plugin Baileys] No se pudo obtener el contacto del remitente.`);
        try { await msg.reply("❌ No pude identificarte. Inténtalo de nuevo."); } catch(e) { console.error("[Work Plugin Baileys] Error enviando reply de no identificación:", e); }
        return;
    }
    const commandSenderId =msg.senderLid || msg.author; // JID del remitente: numero@s.whatsapp.net o participante@g.us
    const chatId = msg.from; // ID del chat donde se envió el mensaje
    
    // Obtener/actualizar datos del usuario. 'msg' ayuda a actualizar pushname.
    const user = await getUserData(commandSenderId, msg);

    if (!user) {
        console.error(`[Work Plugin Baileys] No se pudieron obtener los datos del usuario para ${commandSenderId}`);
        try { await msg.reply("❌ Hubo un error al obtener tus datos. Inténtalo de nuevo."); } catch(e) { console.error("[Work Plugin Baileys] Error enviando reply de error de datos:", e); }
        return;
    }

    // --- VERIFICACIÓN DE REGISTRO COMPLETO (Contraseña y Número de Teléfono) ---
    if (!user.password) { // Si el usuario (commandSenderId) NO tiene contraseña en la BD
        const currentChatInfo = await msg.getChat(); // Desde tu adaptador
        if (!currentChatInfo.isGroup) {
            await msg.reply("🔒 Comando exclusivo de grupos. Por favor, usa este comando en un grupo para iniciar tu registro o usar las funciones de economía.");
            return;
        }

        const userNameToMention = user.pushname || commandSenderId.split('@')[0];

        if (!user.phoneNumber) {
            // CASO A: NO TIENE CONTRASEÑA NI NÚMERO DE TELÉFONO REGISTRADO EN LA BD
            user.registration_state = 'esperando_numero_telefono';
            await saveUserData(commandSenderId, user); // Guardar estado para commandSenderId
            
            console.log(`[Work Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) no tiene contraseña ni teléfono. Solicitando número. Estado: esperando_numero_telefono.`);
            
            const currentPrefix = msg.body.charAt(0);
            await sock.sendMessage(chatId, {
                text: `👋 ¡Hola @${userNameToMention}!\n\n` +
                      `Para usar las funciones de economía, primero necesitamos registrar tu número de teléfono.\n\n` +
                      `Por favor, responde en ESTE CHAT GRUPAL con el comando:\n` +
                      `*${currentPrefix}mifono +TUNUMEROCOMPLETO*\n` +
                      `(Ej: ${currentPrefix}mifono +11234567890)\n\n` +
                      `Tu nombre de perfil actual es: *${user.pushname || 'No detectado'}*.`,
                mentions: [commandSenderId] // Mencionar al commandSenderId
            }, { quoted: msg._baileysMessage }); // Citar el mensaje original
            return;

        } else { // CASO B: Tiene número (en user.phoneNumber de la BD para commandSenderId) PERO NO contraseña
            user.registration_state = 'esperando_contraseña_dm';
            await saveUserData(commandSenderId, user);
            
            console.log(`[Work Plugin Baileys] Usuario ${commandSenderId} (${userNameToMention}) tiene teléfono (+${user.phoneNumber}). Estado 'esperando_contraseña_dm' establecido para ${commandSenderId}.`);

            let displayPhoneNumber = user.phoneNumber;
            if (user.phoneNumber && !String(user.phoneNumber).startsWith('+')) {
                displayPhoneNumber = `+${user.phoneNumber}`;
            }

            await sock.sendMessage(chatId, {
                text: `🛡️ ¡Hola @${userNameToMention}!\n\n` +
                      `Ya tenemos tu número de teléfono registrado (*${displayPhoneNumber}*).\n` +
                      `Ahora, para completar tu registro, te he enviado un mensaje privado (DM) a ese número para que configures tu contraseña. Por favor, revisa tus DMs.\n`+
                      `‼️ Si quieres actualizar tu numero escribe .actualizarfono +52111222333 RECUERDA INCLUIR TODO TU NUMERO Y CODIGO DE PAIS\n`,
                mentions: [commandSenderId]
            }, { quoted: msg._baileysMessage });
            
            // El DM se envía al JID construido a partir del phoneNumber guardado para commandSenderId
            const dmChatJidToSendTo = `${user.phoneNumber}@s.whatsapp.net`; // En Baileys, los JIDs de usuario terminan en @s.whatsapp.net
            const dmMessageContent = "🔑 Por favor, responde a este mensaje con la contraseña que deseas establecer para los comandos de economía.";
            
            console.log(`[Work Plugin Baileys DM DEBUG] Intentando enviar DM para contraseña.`);
            console.log(`[Work Plugin Baileys DM DEBUG] Target para DM (construido desde phoneNumber): ${dmChatJidToSendTo}`);
            
            try {
                // En Baileys, simplemente envías el mensaje al JID del usuario.
                await sock.sendMessage(dmChatJidToSendTo, { text: dmMessageContent });
                console.log(`[Work Plugin Baileys DM SUCCESS] DM para contraseña enviado exitosamente a ${dmChatJidToSendTo}.`);
            } catch(dmError){
                console.error(`[Work Plugin Baileys DM ERROR] Error enviando DM para contraseña a ${dmChatJidToSendTo}:`, dmError);
                // No se puede usar msg.reply aquí porque msg es del chat grupal.
                // Se podría enviar un mensaje de error al grupo si el DM falla catastróficamente.
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${userNameToMention}, no pude enviarte el DM para la contraseña. Asegúrate de que puedes recibir mensajes de este número.`,
                    mentions: [commandSenderId]
                }, { quoted: msg._baileysMessage });
            }
            return; 
        }
    }
    // --- FIN VERIFICACIÓN DE REGISTRO ---

    // --- Lógica del Comando .work (si ya está registrado) ---
    const now = Date.now();
    const timeSinceLastWork = now - (user.lastwork || 0);

    if (timeSinceLastWork < COOLDOWN_WORK_MS) {
        const timeLeft = COOLDOWN_WORK_MS - timeSinceLastWork;
        return msg.reply(`*😜 Estás cansado, debes esperar ${msToTime(timeLeft)} para volver a trabajar.*`);
    }

    const earnedExp = Math.floor(Math.random() * 3000) + 500;
    if (typeof user.exp !== 'number' || isNaN(user.exp)) user.exp = 0;
    user.exp += earnedExp;

    const job = pickRandom(jobs);
    if (!job || job.moneyEarned === undefined) {
        console.error("[Work Plugin Baileys] Error: 'job' o 'job.moneyEarned' es undefined.");
        await msg.reply("❌ Ocurrió un error interno al seleccionar un trabajo. Intenta de nuevo.");
        return;
    }

    const earnedAmount = Number(job.moneyEarned);
    if (isNaN(earnedAmount)) {
        console.error("[Work Plugin Baileys] Error: 'earnedAmount' no es un número después de la conversión.");
        await msg.reply("❌ Ocurrió un error con las ganancias del trabajo. Intenta de nuevo.");
        return;
    }
    
    if (typeof user.money !== 'number' || isNaN(user.money)) user.money = 0;
    user.money += earnedAmount;
    user.lastwork = now;

    await saveUserData(commandSenderId, user); // Guardar los datos actualizados del trabajo

    const caption = `*🏢 ${job.text}*\n\n` +
                    `${EXP_SYMBOL} *EXP Ganada:* ${earnedExp.toLocaleString()}\n` +
                    `${MONEY_SYMBOL} *Dinero Ganado:* ${earnedAmount.toLocaleString()}\n\n` +
                    `*Tu Saldo Actual:*\n` +
                    `${EXP_SYMBOL} EXP: ${user.exp.toLocaleString()}\n` +
                    `${MONEY_SYMBOL} Dinero: ${user.money.toLocaleString()}`;

    console.log(`[Work Plugin Baileys] Usuario ${commandSenderId} (${user.pushname || 'N/A'}) trabajó como '${job.text}'. EXP: +${earnedExp}, Dinero Ganado: +${earnedAmount}, Saldo Dinero: ${user.money}`);
    
    try {
        if (job.img) {
            // Descargar la imagen desde la URL y luego enviarla
            const imageResponse = await axios.get(job.img, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
            
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: caption,
                // mimetype: 'image/jpeg' // Opcional, Baileys suele detectarlo.
            }, { quoted: msg._baileysMessage });
        } else {
            await msg.reply(caption); // msg.reply ya cita el mensaje original por defecto
        }
    } catch (error) {
        console.error(`[Work Plugin Baileys] Error al enviar imagen para el trabajo:`, error);
        await msg.reply(caption + `\n\n_(Error al cargar imagen del trabajo)_`);
    }
};

module.exports = {
    name: 'Trabajar',
    aliases: ['work', 'trabajar', 'chambear'],
    description: 'Trabaja para ganar EXP y Dinero (con cooldown).',
    category: 'Economía',
    execute,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383044,
        price: "5.00",
        icon: "fa-briefcase",
        preview: {
            suggestions: ["!work", "!chambear"],
            responses: {
                "!work": {
                    text: "*🏢 Ayudaste a programar este bot 🤖*\n\n⭐ *EXP Ganada:* 1,500\n💵 *Dinero Ganado:* 220\n\n*Tu Saldo Actual:* $5,400",
                    image: "https://e1.pxfuel.com/desktop-wallpaper/484/178/desktop-wallpaper-anime-programming-anime-programmer.jpg"
                },
                "!chambear": {
                    text: "*🏢 Trabajas para una empresa militar privada 🎖️*\n\n⭐ *EXP Ganada:* 1,200\n💵 *Dinero Ganado:* 120\n\n*Tu Saldo Actual:* $3,200",
                    image: "https://i.pinimg.com/originals/ba/26/09/ba2609705507fb66bdce02a85614472a.jpg"
                }
            }
        }
    },
};