require('dotenv').config();
const cron = require('node-cron');

const { run: runSentinel }       = require('./agents/sentinel');
const { applyFix, redeployApp }  = require('./agents/deployer');
const { verifyDeploy }           = require('./agents/verifier');
const { sendMessage, answerCallback, getUpdates } = require('./agents/telegram');
const { scanSecurity }           = require('./agents/security');
const { sendDailyReport }        = require('./agents/reporter');
const { handleCommand }          = require('./agents/commander');
const { checkSSL }               = require('./agents/sslmonitor');
const { checkAndRollback }       = require('./agents/autorollback');

console.log('🚀 UniAssiist AutoFix Agent v2.0');
console.log('📡 Agentes activos: Sentinel · Triage · Analyzer · Security · Reporter · Commander · Verifier · AutoRollback · SSL');

// ── Schedulers ───────────────────────────────────────────────────────────────

// Cada 10 min: revisar errores en Vercel logs
cron.schedule('*/10 * * * *', () => runSentinel());

// Cada 30 min: escaneo de seguridad
cron.schedule('*/30 * * * *', () => scanSecurity());

// Cada 5 min: detectar new deploys y hacer rollback si rompen la app
cron.schedule('*/5 * * * *', () => checkAndRollback());

// 9am Lima (14:00 UTC): reporte diario
cron.schedule('0 14 * * *', () => sendDailyReport());

// 7am Lima (12:00 UTC): verificar SSL
cron.schedule('0 12 * * *', () => checkSSL());

// ── Telegram long-polling ────────────────────────────────────────────────────
async function pollTelegram() {
  try {
    const updates = await getUpdates();

    for (const update of updates) {
      // Botones inline
      const cq = update.callback_query;
      if (cq) {
        const { data, id: cbId } = cq;
        console.log(`[Telegram] Callback: ${data}`);

        try {
          if (data.startsWith('approve_')) {
            const fixId = data.slice('approve_'.length);
            await answerCallback(cbId, '⏳ Aplicando fix...');
            const result = await applyFix(fixId);
            await sendMessage(result.ok ? `✅ ${result.msg}` : `❌ ${result.msg}`);

            // Verificar que el deploy funciona después del fix
            if (result.ok) {
              const fix = result.fix;
              if (fix) verifyDeploy(fix.project.app, fix.analysis.fix_file).catch(() => {});
            }

          } else if (data.startsWith('redeploy_')) {
            const rest = data.slice('redeploy_'.length);
            const sep = rest.indexOf('__');
            const app = rest.slice(0, sep);
            const deploymentId = rest.slice(sep + 2);
            await answerCallback(cbId, '⏳ Iniciando redeploy...');
            const result = await redeployApp(app, deploymentId);
            await sendMessage(result.ok ? `🔄 ${result.msg}` : `❌ ${result.msg}`);

          } else if (data.startsWith('dismiss_')) {
            await answerCallback(cbId, '❌ Alerta ignorada');
          }
        } catch (err) {
          console.error('[Telegram] Error procesando callback:', err.message);
          await answerCallback(cbId, '❌ Error interno');
        }
      }

      // Comandos de texto (/status, /redeploy, /ayuda, etc.)
      const msg = update.message;
      if (msg && msg.text && msg.text.startsWith('/')) {
        console.log(`[Commander] Comando recibido: ${msg.text}`);
        try {
          await handleCommand(msg.text);
        } catch (err) {
          console.error('[Commander] Error:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Telegram] Error en polling:', err.message);
  }

  setTimeout(pollTelegram, 2000);
}

// ── Inicio ───────────────────────────────────────────────────────────────────
pollTelegram();
runSentinel();          // Primera revisión al arrancar
checkSSL();             // Verificar SSL al arrancar
checkAndRollback();     // Inicializar deployments conocidos

process.on('unhandledRejection', (err) => {
  console.error('[Agent] Error no manejado:', err.message);
});
