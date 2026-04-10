// plugins/ayuda.js (Baileys Version - Menú con Imagen y Texto)

const fs = require('fs');
const path = require('path');

const color = { /* ... (tus colores ANSI aquí, no es necesario cambiar) ... */ };

const categoryEmojis = {
    'Economía': '💰', 'Juegos': '🎮', 'Utilidad': '🛠️',
    'Inteligencia Artificial': '🤖', 'Diversión': '🎉', 'Administración': '⚙️',
    'Configuración': '🔧', 'General': 'ℹ️', 'Moderación': '🛡️',
    'Multimedia': '🎥', 'Descargas': '⬇️', 'Dueño': '👑',
    'Grupo': '👥', 'Reportes': '📊', 'Utilidades': '🧰',
    'Internet': '🌐', 'Edicion': '✂️', 'Social': '💬',
    'Brainroots': '🪴', 'Info': '📚', 'Otros': '❓'
};

// URL de la imagen principal para el menú de ayuda
const MAIN_MENU_IMAGE_URL = 'https://i.pinimg.com/originals/2e/2d/71/2e2d71661da0568bce11847e896c9e91.jpg';

let allAvailableCommands = [];

function normalizeNameForAlias(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n').replace(/Ñ/g, 'N').replace(/ /g, '-').toLowerCase();
}

function groupCommandsByCategory(commands) {
    if (!Array.isArray(commands)) return {};
    const commandsByCategory = {};
    const filteredCommands = commands.filter(cmd => cmd.category !== 'Interno');
    filteredCommands.forEach(cmd => {
        const category = cmd.category || 'Otros';
        if (!commandsByCategory[category]) commandsByCategory[category] = [];
        commandsByCategory[category].push(cmd);
    });
    return commandsByCategory;
}

function buildCategoryHelpText(categoryName, commands, usedPrefix) {
    let text = `*「 ${categoryEmojis[categoryName] || '📂'} ${categoryName} 」*\n\n`;
    commands.forEach(cmd => {
        text += `✅ *${usedPrefix}${cmd.aliases[0]}*\n`;
        if (cmd.aliases.length > 1) {
            text += `   ↳ _Alias: ${cmd.aliases.slice(1).map(a => `${usedPrefix}${a}`).join(', ')}_\n`;
        }
        text += `   ↦ _${cmd.description || 'Sin descripción.'}_\n\n`;
    });
    text += `_Regresar al menú principal con ${usedPrefix}ayuda_`;
    return text.trim();
}

function generateCategoryAliases(commandsList) {
    const commandsByCategory = groupCommandsByCategory(commandsList);
    return Object.keys(commandsByCategory).map(category => `menu-${normalizeNameForAlias(category)}`);
}

module.exports = {
    name: 'Menú de Ayuda',
    aliases: ['help', 'ayuda', 'comandos', 'cmds', 'menu'],
    description: 'Muestra un menú visual con todas las categorías de comandos.',
    category: 'Utilidad',
    marketplace: {
        tebex_id: 7383015, // Recuerda crear este paquete en Tebex y poner el ID real
        price: "3.00",
        icon: "fa-list-check",
        preview: {
            suggestions: ["!menu", "!menu-moderacion"],
            responses: {
                "!menu": {
                    text: "🤖 *Menú de Comandos* 🤖\n\nExplora nuestras categorías. Escribe el comando indicado para ver sus detalles.\n\n💰 *Economía*\n↳ \`!menu-economia\`\n\n🛡️ *Moderación*\n↳ \`!menu-moderacion\`\n\n⚙️ *Administración*\n↳ \`!menu-administracion\`\n\n♨️ *Stun Bot - Grupo Anárquico* ♨️",
                    image: "https://i.pinimg.com/originals/2e/2d/71/2e2d71661da0568bce11847e896c9e91.jpg"
                },
                "!menu-moderacion": {
                    text: "*「 🛡️ Moderación 」*\n\n✅ *!ban*\n   ↳ _Expulsa y bloquea a un usuario._\n\n✅ *!mute*\n   ↳ _Evita que un usuario envíe mensajes._\n\n✅ *!unban*\n   ↳ _Remueve el bloqueo de un usuario._\n\n_Regresar al menú principal con !ayuda_"
                }
            }
        }
    },

    async execute(sock, adaptedMessage, args, potentialCommandName, commandsList, registerDynamicAlias) {
        allAvailableCommands = Array.isArray(commandsList) ? commandsList : [];

        if (typeof registerDynamicAlias === 'function' && allAvailableCommands.length > 0) {
            const dynamicAliasesToRegister = generateCategoryAliases(allAvailableCommands);
            dynamicAliasesToRegister.forEach(alias => registerDynamicAlias(alias, module.exports));
        }

        const usedPrefix = adaptedMessage.body.charAt(0) || '!';
        const commandsByCategory = groupCommandsByCategory(allAvailableCommands);
        const categories = Object.keys(commandsByCategory).sort((a, b) => a.localeCompare(b));

        if (categories.length === 0) {
            return adaptedMessage.reply("No hay comandos disponibles en este momento.");
        }

        const normalizedPotentialCommandName = normalizeNameForAlias(potentialCommandName);
        const categoryCommandRegex = /^menu-([a-z0-9-]+)$/;
        const match = normalizedPotentialCommandName.match(categoryCommandRegex);

        // --- Lógica para SUBCOMANDOS DE CATEGORÍA ---
        if (match) {
            const rawNormalizedCategoryName = match[1];
            const actualCategory = categories.find(cat => normalizeNameForAlias(cat) === rawNormalizedCategoryName);
            if (actualCategory) {
                const categoryCommands = commandsByCategory[actualCategory];
                const helpText = buildCategoryHelpText(actualCategory, categoryCommands, usedPrefix);
                return sock.sendMessage(adaptedMessage.from, { text: helpText });
            }
        }

        // --- ¡ESTE ES EL CAMBIO PRINCIPAL! ---
        // Lógica para el MENÚ PRINCIPAL con una sola imagen y texto.
        
        // 1. Construir el texto del menú principal
        let menuText = "🤖 *Menú de Comandos* 🤖\n\n";
        menuText += "Explora nuestras categorías. Escribe el comando indicado para ver sus detalles.\n\n";

        categories.forEach(category => {
            const emoji = categoryEmojis[category] || '📂';
            const subCommand = `${usedPrefix}menu-${normalizeNameForAlias(category)}`;
            menuText += `${emoji} *${category}*\n`;
            menuText += `↳ \`${subCommand}\`\n\n`;
        });

        menuText += "♨️ *Stun Bot - Grupo Anárquico* ♨️";

        // 2. Enviar el mensaje con imagen y el texto como 'caption'
        try {
            await sock.sendMessage(adaptedMessage.from, {
                image: { url: MAIN_MENU_IMAGE_URL },
                caption: menuText
            }, { quoted: adaptedMessage._baileysMessage });

            console.log(`[${this.name}] Menú de imagen enviado con éxito a ${adaptedMessage.from}.`);

        } catch (error) {
            console.error(`[ERROR AYUDA] No se pudo enviar el menú de imagen:`, error);
            // Fallback a un mensaje de texto simple si la imagen falla
            await adaptedMessage.reply(menuText);
        }
    }
};