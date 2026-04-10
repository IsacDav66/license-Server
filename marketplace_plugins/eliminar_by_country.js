const { parsePhoneNumber } = require('libphonenumber-js'); // Importa la librería

// Importar solo la utilidad necesaria de Baileys directamente
// Si esta línea aún genera una advertencia para jidNormalizedUser, podría ser
// un problema intrínseco de la librería Baileys/Itsukichann y se puede ignorar
// si el bot funciona, o considerar pasar jidNormalizedUser desde bot.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys'); 

// --- ¡NUEVO! JIDs de usuarios autorizados para usar este comando ---
const AUTHORIZED_COMMAND_USERS_JIDS = [
    '51959442730@s.whatsapp.net',
    '51988388664@s.whatsapp.net',
    // Asegúrate de que estos JIDs sean los exactos que el bot recibe
];
// --- FIN NUEVO ---

// Mapea nombres de países/gentilicios comunes a códigos ISO 3166-1 alpha-2
const countryMap = {
    'argentinos': 'AR',
    'argentina': 'AR',
    'ar': 'AR',
    'mexicanos': 'MX',
    'mexico': 'MX',
    'mx': 'MX',
    'colombianos': 'CO',
    'colombia': 'CO',
    'co': 'CO',
    'chilenos': 'CL',
    'chile': 'CL',
    'cl': 'CL',
    'peruanos': 'PE',
    'peru': 'PE',
    'pe': 'PE',
    'venezolanos': 'VE',
    'venezuela': 'VE',
    've': 'VE',
    'ecuatorianos': 'EC',
    'ecuador': 'EC',
    'ec': 'EC',
    'bolivianos': 'BO',
    'bolivia': 'BO',
    'bo': 'BO',
    'uruguayos': 'UY',
    'uruguay': 'UY',
    'uy': 'UY',
    'paraguayos': 'PY',
    'paraguay': 'PY',
    'py': 'PY',
    'espanoles': 'ES',
    'españa': 'ES',
    'es': 'ES',
    'brasileños': 'BR',
    'brasil': 'BR',
    'br': 'BR',
    'estadounidenses': 'US',
    'usa': 'US',
    'us': 'US',
    // Puedes añadir más según necesites
};

// Almacenamiento de cooldown para el comando por grupo
const commandCooldowns = new Map(); // Map<groupId, lastExecutionTime>
const GLOBAL_COMMAND_COOLDOWN = 30 * 1000; // 30 segundos de cooldown para el comando general en un grupo


module.exports = {
    name: "Eliminar por País",
    aliases: ['eliminar', 'kickbycountry', 'eliminarargentinos', 'kickbycode'],
    description: "Elimina usuarios de un grupo según su código de país. Uso: !eliminar <código_país_o_nombre> (ej: !eliminar AR, !eliminar argentinos)",
    category: "Dueño",
    groupOnly: true, // Este comando solo funciona en grupos
    isAdminCommand: true, // Propiedad personalizada para indicar que es un comando de administrador
    marketplace: {
        tebex_id: 7383061,
        price: "18.00",
        icon: "fa-globe",
        preview: {
            suggestions: ["!eliminar AR", "!eliminar peruanos"],
            responses: {
                "!eliminar AR": "🔍 Buscando participantes con código de país AR para eliminar...\n\n¡Atención! Se intentará eliminar 15 miembros. Esto tomará tiempo debido al cooldown de seguridad.",
                "!eliminar peruanos": "✅ Proceso de eliminación finalizado. Se eliminaron 8 miembros con código de país PE."
            }
        }
    },

    async execute(sock, m, args) {
        const chat = await m.getChat();
        const groupId = chat.id._serialized;
        const senderId = m.author; // JID del remitente del mensaje

        // --- ¡NUEVA LÓGICA DE VERIFICACIÓN DE AUTORIZACIÓN! ---
        if (!AUTHORIZED_COMMAND_USERS_JIDS.includes(senderId)) {
            await m.reply("❌ No estás autorizado para usar este comando.");
            console.warn(`[ELIMINAR PAÍS] Intento de uso no autorizado por ${senderId}`);
            return;
        }
        // --- FIN NUEVA LÓGICA ---

        // 1. Verificar Cooldown del comando para evitar spam
        const now = Date.now();
        if (commandCooldowns.has(groupId) && (now - commandCooldowns.get(groupId) < GLOBAL_COMMAND_COOLDOWN)) {
            const remaining = Math.ceil((GLOBAL_COMMAND_COOLDOWN - (now - commandCooldowns.get(groupId))) / 1000);
            await m.reply(`⚠️ Este comando tiene un cooldown de ${GLOBAL_COMMAND_COOLDOWN / 1000} segundos en este grupo. Por favor espera ${remaining} segundos.`);
            return;
        }

        if (!chat.isGroup) {
            await m.reply("❌ Este comando solo puede ser usado en grupos.");
            return;
        }

        if (args.length === 0) {
            await m.reply("⚠️ Debes especificar el código de país (ej: AR, MX) o el gentilicio (ej: argentinos). Uso: `!eliminar <código_país_o_nombre>`");
            return;
        }

        let targetCountryInput = args[0].toLowerCase();
        let targetCountryCode = countryMap[targetCountryInput] || targetCountryInput.toUpperCase(); // Intenta mapear, si no, asume que es un código

        // Validación básica del código de país
        if (!/^[A-Z]{2}$/.test(targetCountryCode)) {
            await m.reply("❌ Código de país inválido. Debe ser un código ISO 3166-1 alpha-2 de 2 letras (ej: AR, MX) o un nombre reconocido (ej: argentinos).");
            return;
        }

        await m.reply(`Buscando participantes con código de país ${targetCountryCode} para eliminar...`);

        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participants = groupMetadata.participants;

            // 2. Verificar si el bot es administrador del grupo
            // sock.user.id es el JID del bot. jidNormalizedUser lo asegura en el formato correcto para comparación.
            const botId = jidNormalizedUser(sock.user.id); 
            const botParticipant = participants.find(p => p.id === botId);
            const isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
            if (!isBotAdmin) {
                await m.reply("❌ No soy administrador en este grupo. No puedo eliminar miembros.");
                return;
            }

            // 3. Verificar si el remitente (quien usa el comando) es administrador del grupo
            // Esta verificación de senderAdmin es redundante si solo usuarios autorizados pueden usar el comando,
            // pero la mantengo por si la lista AUTHORIZED_COMMAND_USERS_JIDS incluye no-admins en el futuro.
            const senderParticipant = participants.find(p => p.id === senderId);
            const isSenderAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
            if (!isSenderAdmin) {
                await m.reply("❌ Solo los administradores pueden usar este comando.");
                return;
            }

            let membersToKick = [];
            for (const participant of participants) {
                // Saltar al bot y al remitente del comando
                if (participant.id === botId || participant.id === senderId) continue;
                // No eliminar a otros administradores del grupo (a menos que se especifique lo contrario, lo cual no es el caso aquí)
                if (participant.admin) continue;

                try {
                    const phoneNumberJid = participant.id; // Ej: "54911xxxx@s.whatsapp.net"
                    const phoneNumberStr = phoneNumberJid.split('@')[0]; // Extrae "54911xxxx"

                    let parsed;
                    try {
                        // Intenta parsear con el código de país objetivo como región por defecto (útil para números nacionales sin prefijo internacional)
                        parsed = parsePhoneNumber(phoneNumberStr, targetCountryCode); 
                    } catch (parseError) {
                        // Si falla, intenta parsear sin región, dejando que la librería infiera
                        try {
                            parsed = parsePhoneNumber(phoneNumberStr);
                        } catch (e) {
                            console.warn(`[ELIMINAR PAÍS] Error al parsear número ${phoneNumberStr} (fallback): ${e.message}`);
                            continue; // Salta a la siguiente participante si el parseo falla
                        }
                    }
                    
                    // Si el número es válido y su país coincide con el objetivo
                    if (parsed && parsed.isValid() && parsed.country === targetCountryCode) {
                        membersToKick.push(participant.id);
                    }
                } catch (e) {
                    console.warn(`[ELIMINAR PAÍS] Error general al procesar participante ${participant.id}: ${e.message}`);
                    // Continúa con el siguiente participante
                }
            }

            if (membersToKick.length === 0) {
                await m.reply(`✅ No se encontraron miembros con el código de país ${targetCountryCode} para eliminar.`);
                return;
            }

            await m.reply(`¡Atención! Se intentará eliminar ${membersToKick.length} miembros con código de país ${targetCountryCode}. Esto tomará tiempo debido al cooldown de 2 segundos por cada eliminación.`);

            let kickedCount = 0;
            for (const memberJid of membersToKick) {
                try {
                    // Volver a verificar si el miembro sigue en el grupo antes de intentar eliminarlo
                    const currentParticipants = (await sock.groupMetadata(groupId)).participants;
                    const memberStillInGroup = currentParticipants.some(p => p.id === memberJid);

                    if (memberStillInGroup) {
                        await sock.groupParticipantsUpdate(groupId, [memberJid], 'remove');
                        kickedCount++;
                        console.log(`[ELIMINAR PAÍS] Miembro ${memberJid} (${targetCountryCode}) eliminado.`);
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Cooldown de 2 segundos entre eliminaciones
                    } else {
                        console.log(`[ELIMINAR PAÍS] Miembro ${memberJid} ya no está en el grupo. Saltando.`);
                    }
                } catch (kickError) {
                    console.error(`[ELIMINAR PAÍS] Error al eliminar a ${memberJid}: ${kickError.message}`);
                    // Esperar el cooldown de todas formas para evitar saturar la API incluso si falla la eliminación
                    await new Promise(resolve => setTimeout(resolve, 2000)); 
                    // Si es un error de permisos (por ejemplo, el objetivo es admin o el bot perdió sus permisos)
                    if (kickError.output?.statusCode === 403) {
                         await m.reply(`❌ No pude eliminar a ${memberJid.split('@')[0]}. Podría ser un administrador o hay un problema de permisos.`);
                    }
                }
            }

            commandCooldowns.set(groupId, now); // Establecer el cooldown del comando después de la ejecución exitosa

            await m.reply(`✅ Proceso de eliminación finalizado. Se eliminaron ${kickedCount} miembros con código de país ${targetCountryCode}.`);

        } catch (error) {
            console.error("[ELIMINAR PAÍS] Error grave en el plugin:", error);
            await m.reply("❌ Ocurrió un error inesperado al intentar eliminar a los miembros. Asegúrate de que el bot sea administrador.");
        }
    }
};