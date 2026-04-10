// plugins/group-link-change-listener.js

const { jidDecode } = require('@whiskeysockets/baileys');
const { Client } = require('pg');

const knownInviteCodes = new Map();
const TARGET_GROUP_JID = "120363241724220394@g.us"; // El JID que estás monitoreando
// --- NECESITAS PONER EL ID NUMÉRICO CORRESPONDIENTE DE TU BD AQUÍ ---
const TARGET_GROUP_DB_NUMERIC_ID = 1; // <--- REEMPLAZA ESTE 1 CON EL ID REAL DE TU TABLA
// --------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;

module.exports = {
    name: 'Group Link DB Updater (Numeric ID)',
    description: `Actualiza el enlace en la BD (usando ID numérico) y notifica cambios para el grupo ${TARGET_GROUP_JID}.`,
    category: 'Dueño',
    isListener: true,
    marketplace: {
        tebex_id: 7383028,
        price: "15.00",
        icon: "fa-database",
        preview: {
            suggestions: ["Cambiar link en WhatsApp"],
            responses: {
                "Cambiar link en WhatsApp": "🔗 *¡Cambio en el Enlace de Invitación!* 🔗\n\n*Grupo:* StunBot VIP\n*Nuevo Enlace:* https://chat.whatsapp.com/L1nkNuev0\n💾 _Enlace actualizado en la base de datos automáticamente._"
            }
        }
    },

    async initialize(sock) {
        if (!sock || typeof sock.ev !== 'object' || typeof sock.ev.on !== 'function') { /* ... */ return; }
        if (!DATABASE_URL) {
            console.error('[Group Link DB Updater] DATABASE_URL no está definida. Actualización de BD desactivada.');
        }
        if (TARGET_GROUP_DB_NUMERIC_ID === 1 && TARGET_GROUP_JID !== "PON_TU_JID_AQUI_SI_ID_ES_1") { // Una pequeña advertencia
            console.warn(`[Group Link DB Updater WARN] TARGET_GROUP_DB_NUMERIC_ID está como 1. Asegúrate de que sea el ID correcto para ${TARGET_GROUP_JID} en tu tabla 'datos_grupo'.`);
        }


        console.log(`[Group Link DB Updater] Inicializando. Escuchando cambios SOLO para el grupo: ${TARGET_GROUP_JID} (BD ID: ${TARGET_GROUP_DB_NUMERIC_ID})`);

        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                const groupJidFromEvent = update.id;
                if (!groupJidFromEvent || groupJidFromEvent !== TARGET_GROUP_JID) {
                    continue;
                }
                
                console.log(`[Group Link DB Updater] PROCEDIENDO con update para GRUPO OBJETIVO: ${groupJidFromEvent}`);
                // ... (logs del objeto update y metadata como antes) ...

                let currentFullMetadata;
                try {
                    currentFullMetadata = await sock.groupMetadata(groupJidFromEvent);
                    if (!currentFullMetadata) { continue; }
                } catch (e) { continue; }

                const lastKnownCodeInCache = knownInviteCodes.get(groupJidFromEvent);
                const effectiveCurrentInviteCode = update.hasOwnProperty('inviteCode') ? update.inviteCode : currentFullMetadata.inviteCode;
                const newLinkForDB = effectiveCurrentInviteCode ? `https://chat.whatsapp.com/${effectiveCurrentInviteCode}` : null;

                console.log(`[Group Link DB Updater - Check] Group: ${groupJidFromEvent}, EffectiveCode: '${effectiveCurrentInviteCode}', LastKnownInCache: '${lastKnownCodeInCache}'`);

                if (effectiveCurrentInviteCode !== lastKnownCodeInCache) {
                    let notificationMessage = "";
                    let anInviteCodeChanged = false;
                    let headerText = `🔗 *¡Cambio en el Enlace de Invitación del Grupo!* 🔗\n\n` +
                                     `*Grupo:* ${currentFullMetadata.subject || groupJidFromEvent}\n`;

                    if (effectiveCurrentInviteCode && lastKnownCodeInCache) {
                        notificationMessage = headerText + `El enlace de invitación ha sido *cambiado*.\n` +
                                           `*Nuevo Enlace:* ${newLinkForDB}\n`;
                        anInviteCodeChanged = true;
                    } else if (effectiveCurrentInviteCode && (lastKnownCodeInCache === undefined || lastKnownCodeInCache === null)) {
                        notificationMessage = headerText + `Se ha generado un *nuevo enlace* de invitación:\n` +
                                           `*Enlace:* ${newLinkForDB}\n`;
                        anInviteCodeChanged = true;
                    } else if ((effectiveCurrentInviteCode === undefined || effectiveCurrentInviteCode === null) && lastKnownCodeInCache) {
                        notificationMessage = headerText + `El enlace de invitación anterior (https://chat.whatsapp.com/${lastKnownCodeInCache}) ha sido *revocado*.\n` +
                                           `Actualmente no hay un enlace de invitación activo.\n`;
                        anInviteCodeChanged = true;
                    }
                    
                    if (DATABASE_URL && anInviteCodeChanged) {
                        const pgClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
                        try {
                            await pgClient.connect();
                            console.log(`[Group Link DB Updater] Conectado a PostgreSQL para actualizar grupo ID ${TARGET_GROUP_DB_NUMERIC_ID} (JID: ${groupJidFromEvent}).`);
                            
                            const query = `
                                UPDATE datos_grupo 
                                SET link = $1, updated_at = NOW() 
                                WHERE id = $2; 
                            `;
                            // newLinkForDB será la URL completa o NULL si se revocó
                            const values = [newLinkForDB, TARGET_GROUP_DB_NUMERIC_ID]; // Usar el ID numérico
                            const res = await pgClient.query(query, values);

                            if (res.rowCount > 0) {
                                console.log(`[Group Link DB Updater] BD actualizada para ID ${TARGET_GROUP_DB_NUMERIC_ID}. Link: ${newLinkForDB || 'NULL'}.`);
                                if (notificationMessage) notificationMessage += `\n💾 _Enlace actualizado en la base de datos._`;
                            } else {
                                console.warn(`[Group Link DB Updater WARN] No se encontró el grupo con ID numérico ${TARGET_GROUP_DB_NUMERIC_ID} en la BD para actualizar, o el enlace ya era el mismo.`);
                                if (notificationMessage) notificationMessage += `\n⚠️ _El grupo (ID ${TARGET_GROUP_DB_NUMERIC_ID}) no se encontró en la BD para actualizar el enlace, o el enlace no cambió._`;
                                // Aquí NO intentamos insertar porque no tenemos forma de saber si el ID numérico es correcto para una nueva entrada
                                // si la fila no existe. El INSERT tendría que ser manual en la BD si el ID numérico es nuevo.
                            }
                        } catch (dbError) {
                            console.error(`[Group Link DB Updater ERROR DB] Falló al actualizar BD para ID ${TARGET_GROUP_DB_NUMERIC_ID}:`, dbError);
                            if (notificationMessage) notificationMessage += `\n❌ _Error al actualizar el enlace en la base de datos: ${dbError.code || dbError.message}_`;
                        } finally {
                            await pgClient.end().catch(err => console.error("[Group Link DB Updater] Error cerrando conexión PG:", err));
                        }
                    } else if (!DATABASE_URL && anInviteCodeChanged) {
                        console.warn("[Group Link DB Updater WARN] DATABASE_URL no definida. No se actualizó la BD.");
                    }

                    if (anInviteCodeChanged && notificationMessage.trim() !== "") {
                        // ... (lógica de autor y envío del mensaje de notificación como antes) ...
                        let actorText = "Un administrador";
                        let mentionsArray = [];
                        if (update.author) {
                            try {
                                const decodedAuthor = jidDecode(update.author);
                                actorText = `@${decodedAuthor.user}`;
                                mentionsArray.push(update.author);
                                notificationMessage += `\n*Acción realizada por:* ${actorText}`;
                            } catch (e) {  notificationMessage += `\n*Acción realizada por:* (ID: ${update.author})`; }
                        } else {
                             notificationMessage += `\n_(No se pudo identificar al administrador que realizó la acción)_`;
                        }
                        
                        console.log(`[Group Link DB Updater] PREPARANDO NOTIFICACIÓN para ${groupJidFromEvent}.`);
                        try {
                            await sock.sendMessage(groupJidFromEvent, {
                                text: notificationMessage,
                                mentions: mentionsArray.length > 0 ? mentionsArray : undefined
                            });
                            console.log(`[Group Link DB Updater] Notificación ENVIADA a ${groupJidFromEvent}.`);
                        } catch (err) {
                            console.error(`[Group Link DB Updater ERROR] Enviando notificación a ${groupJidFromEvent}:`, err);
                        }
                    } else if (anInviteCodeChanged) {
                        // Esto pasaría si anInviteCodeChanged es true pero notificationMessage está vacío, lo cual no debería suceder con la lógica actual.
                        console.log(`[Group Link DB Updater INFO] anInviteCodeChanged es true, pero notificationMessage está vacío para ${groupJidFromEvent}. No se envía notificación de chat.`);
                    }


                    // Actualizar el caché local
                    if (effectiveCurrentInviteCode) {
                        knownInviteCodes.set(groupJidFromEvent, effectiveCurrentInviteCode);
                    } else {
                        knownInviteCodes.delete(groupJidFromEvent);
                    }
                } else { // effectiveCurrentInviteCode === lastKnownCodeInCache
                     // console.log(`[Group Link DB Updater INFO] No hubo cambio numérico/de existencia en 'inviteCode' para ${groupJidFromEvent}. Actual: '${effectiveCurrentInviteCode}', Conocido: '${lastKnownCodeInCache}'.`);
                     if (effectiveCurrentInviteCode !== undefined) {
                         if (effectiveCurrentInviteCode) knownInviteCodes.set(groupJidFromEvent, effectiveCurrentInviteCode);
                         else knownInviteCodes.delete(groupJidFromEvent);
                     }
                }
                // console.log(`[Group Link DB Updater] === Fin procesamiento update para JID: ${groupJidFromEvent} ===`);
            } // Fin del bucle for
            // console.log(`[Group Link DB Updater] === Fin del Evento 'groups.update' ===\n`);
        });

        console.log('[Group Link DB Updater] Listener para groups.update registrado exitosamente.');
    }
};