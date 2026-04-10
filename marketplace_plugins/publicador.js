// plugins/Utilidad/publicador.js
const { exec } = require('child_process');
const path = require('path');

// CONFIGURACIÓN DE RUTAS
const SCRIPT_FOLDER = 'C:\\Users\\User\\Documents\\Proyectos\\Programacion\\ScriptAuto';
const SCRIPT_NAME = 'GroupGoogle.py';
const PYTHON_CMD = 'python -u'; 

module.exports = {
    name: 'Publicador de Grupos',
    description: 'Ejecuta el script de publicación en GruposWats (Solo Owner).',
    aliases: ['publicar', 'publicargrupo'],
    category: 'Admin',
    marketplace: {
        tebex_id: 7383078,
        price: "20.00",
        icon: "fa-bullhorn",
        requirements: ["Python 3.x instalado en el servidor", "Rutas de carpetas configuradas", "Permisos de Propietario del Bot"],
        preview: {
            suggestions: ["!publicar"],
            responses: {
                "!publicar": "⏳ *Iniciando script de publicación...*\nSe está ejecutando en el servidor. Te avisaré al terminar.\n\n(80 segundos después...)\n\n✅ *Publicación Exitosa*\n\n⏱️ *Tiempo:* 78.4s\n📝 El proceso terminó correctamente."
            }
        }
    },

    async execute(sock, m, args) {
        // 1. OBTENER EL OWNER DESDE EL .ENV
        const ownerJid = process.env.BOT_OWNER_JID;

        // 2. VALIDAR SEGURIDAD
        // m.author contiene el JID del que envía el mensaje (ej: 1658008416509@lid)
        if (m.author !== ownerJid) {
            console.log(`\x1b[31m[Security] Intento de ejecución denegado para: ${m.author}\x1b[0m`);
            return await m.reply('🚫 *Acceso Denegado*\nEste comando es de uso exclusivo del propietario del bot.');
        }

        // 3. EJECUCIÓN DEL SCRIPT
        await m.reply('⏳ *Iniciando script de publicación...*\nSe está ejecutando en el servidor. Te avisaré al terminar.');

        console.log(`\x1b[33m[Script Exec] Propietario verificado. Lanzando ${SCRIPT_NAME}...\x1b[0m`);

        exec(`${PYTHON_CMD} "${SCRIPT_NAME}"`, { cwd: SCRIPT_FOLDER }, async (error, stdout, stderr) => {
            
            // Log en consola del bot para auditoría
            console.log("--- SALIDA DEL SCRIPT ---");
            console.log(stdout);
            console.log("-------------------------");

            if (error) {
                console.error(`\x1b[31m[Script Error] ${error.message}\x1b[0m`);
                return await m.reply(`❌ *Error en la ejecución:*\n\n\`\`\`${error.message}\`\`\``);
            }

            // Detección de éxito y tiempo
            const isSuccess = stdout.includes('completado_exitosamente');
            const timeMatch = stdout.match(/Tiempo total de ejecución: ([\d.]+) segundos/);
            const executionTime = timeMatch ? timeMatch[1] : 'desconocido';

            if (isSuccess) {
                await m.reply(`✅ *Publicación Exitosa*\n\n⏱️ *Tiempo:* ${executionTime}s\n📝 El proceso terminó correctamente.`);
            } else {
                const errorLog = stderr || stdout.split('\n').slice(-5).join('\n');
                await m.reply(`⚠️ *Script finalizado con advertencias.*\n\n*Logs:*\n\`\`\`${errorLog}\`\`\``);
            }
        });
    }
};