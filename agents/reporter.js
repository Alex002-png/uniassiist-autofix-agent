const axios = require('axios');
const { sendMessage } = require('./telegram');
const vercel = require('./vercel');

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist', url: 'https://psyassist.uniassiist.com/api/health' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist',  url: 'https://medassist.uniassiist.com/api/health' },
];

async function checkHealth(url) {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    return { ok: res.status === 200, status: res.status };
  } catch (err) {
    return { ok: false, status: err.response?.status || 0 };
  }
}

async function sendDailyReport() {
  console.log('[Reporter] Generando reporte diario...');
  const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });

  let msg = `📊 *Reporte Diario UniAssiist*\n_${now} — Lima_\n\n`;

  for (const project of PROJECTS) {
    const [health, dep] = await Promise.all([
      checkHealth(project.url),
      vercel.getLatestDeployment(project.id),
    ]);

    const icon = health.ok ? '✅' : '❌';
    msg += `${icon} *${project.name}*\n`;
    msg += `  Health: ${health.ok ? 'Online ✓' : 'CAÍDO (' + health.status + ')'}\n`;

    if (dep) {
      const depState = dep.state === 'READY' ? '✅ Listo' : '⚠️ ' + dep.state;
      const depDate = new Date(dep.createdAt).toLocaleString('es-PE', {
        timeZone: 'America/Lima', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      msg += `  Deploy: ${depState} (${depDate})\n`;
    }
    msg += '\n';
  }

  msg += `🤖 _Sistema AutoFix activo 24/7_\n`;
  msg += `_Usa /status para revisar en cualquier momento_`;

  await sendMessage(msg);
}

module.exports = { sendDailyReport };
