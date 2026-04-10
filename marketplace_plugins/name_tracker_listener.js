// plugins/name_tracker_listener.js
const { updateUserName } = require('../shared-economy.js'); // <-- CAMBIADO

module.exports = {
    name: 'Rastreador de Nombres',
    description: 'Escucha mensajes para guardar el pushname de los usuarios en PostgreSQL.',
    isListener: true,
    marketplace: {
        requirements: ["Base de Datos PostgreSQL"],
        tebex_id: 7383030,
        price: "3.00",
        icon: "fa-id-card",
        preview: {
            suggestions: ["¿Quién soy?", "!test-tracker"],
            responses: {
                "¿Quién soy?": "🤖 *Rastreador de Nombres:* He guardado tu nombre como 'StunDoc' en la base de datos SQL.",
                "!test-tracker": "✅ *Sync:* Nombre y JID vinculados correctamente en PostgreSQL."
            }
        }
    },

    async checkMessage(sock, msg) {
        // La lógica interna no cambia en absoluto.
        const chatInfo = await msg.getChat();
        if (!chatInfo.isGroup || msg.fromMe) return false;

        const senderId =msg.senderLid || msg.author;
        const contactInfo = await msg.getContact();
        const senderName = contactInfo?.pushname;

        if (senderId && senderName) {
            updateUserName(senderId, senderName);
        }
        
        return false;
    }
};