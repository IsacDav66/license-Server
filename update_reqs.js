const fs = require('fs');
const path = require('path');

// Mapeo de plugins y sus requerimientos
const reqs = {
    'google_ai_responder.js': ["Google Gemini API Key", "ElevenLabs API Key", "Base de Datos PostgreSQL"],
    'anti-porn.js': ["Sightengine API User & Secret"],
    'image_ocr_filter.js': ["Sightengine API User & Secret"],
    'lyrics.js': ["Genius API Token"],
    'football-bet.js': ["API-Sports.io Key", "Base de Datos PostgreSQL"],
    'ytdownload.js': ["Microservicio de Descarga Activo", "FFmpeg instalado"],
    'sticker.js': ["FFmpeg instalado en el servidor"],
    'profile.js': ["FFmpeg instalado", "Fuente Roboto-Bold.ttf"],
    'daily.js': ["Base de Datos PostgreSQL"],
    'work.js': ["Base de Datos PostgreSQL"],
    'slut.js': ["Base de Datos PostgreSQL"],
    'steal.js': ["Base de Datos PostgreSQL"],
    'robarBanco.js': ["Base de Datos PostgreSQL"],
    'millonarios.js': ["Base de Datos PostgreSQL"],
    'bank.js': ["Base de Datos PostgreSQL"],
    'balance.js': ["Base de Datos PostgreSQL"],
    'apostar.js': ["Base de Datos PostgreSQL"],
    'name_tracker_listener.js': ["Base de Datos PostgreSQL"],
    'passwordRegistrationListener.js': ["Base de Datos PostgreSQL"],
    'prize_wheel.js': ["Carpeta assets/prize_wheel", "Base de Datos PostgreSQL"],
    'roulette.js': ["Imagen roulette_base.png", "Base de Datos PostgreSQL"],
    'slots.js': ["Carpeta assets/slots", "Base de Datos PostgreSQL"],
    'duelo_cartas.js': ["Carpeta assets/cartas", "Base de Datos PostgreSQL"],
    'logro.js': ["Fuente Minecraftia.ttf", "Assets en assets/logro"],
    'raid_protector.js': ["Bot Administrador"],
    'link-deleter.js': ["Bot Administrador"],
    'anti-dox.js': ["Bot Administrador"],
    'silenciar.js': ["Bot Administrador"],
    'vote-kick.js': ["Bot Administrador"],
    // Dentro de update_reqs.js, añade esta línea al listado:
    'publicador.js': ["Python 3.x", "Script externo configurado", "Permisos de Dueño"],
};

const pluginsDir = path.join(__dirname, 'marketplace_plugins');

if (!fs.existsSync(pluginsDir)) {
    console.error("No se encontró la carpeta marketplace_plugins");
    process.exit(1);
}

fs.readdirSync(pluginsDir).forEach(file => {
    if (reqs[file]) {
        const filePath = path.join(pluginsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Solo actuar si el archivo tiene el bloque marketplace
        if (content.includes('marketplace: {')) {
            
            // 1. Eliminar requerimientos viejos si existen (para no duplicar)
            content = content.replace(/\s*requirements:\s*\[[\s\S]*?\],/, "");

            // 2. Preparar la nueva línea
            const reqList = JSON.stringify(reqs[file]);
            const newReqLine = `\n        requirements: ${reqList},`;

            // 3. Insertar justo después de 'marketplace: {'
            const updatedContent = content.replace(/marketplace:\s*{/, `marketplace: {${newReqLine}`);

            fs.writeFileSync(filePath, updatedContent);
            console.log(`✅ Requerimientos inyectados en: ${file}`);
        } else {
            console.log(`⚠️ Ignorado: ${file} (No tiene bloque marketplace)`);
        }
    }
});

console.log("\n🚀 Proceso terminado. Todos los archivos han sido actualizados.");