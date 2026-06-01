const axios = require('axios');
const { sendMessage } = require('./telegram');
const vercel = require('./vercel');

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist', url: 'https://psyassist.uniassiist.com/api/health' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist',  url: 'https://medassist.uniassiist.com/api/health' },
  { id: 'uniassiist',      name: 'Landing',    app: 'landing',    url: 'https://uniassiist.com' },
];

async function checkHealth(url) {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    return { ok: res.status === 200, status: res.status };
  } catch (err) {
    return { ok: false, status: err.response?.status || 0 };
  }
}

async function handleCommand(text) {
  const cmd = text.trim().toLowerCase().split(' ')[0];
  const arg = text.trim().split(' ')[1];

  switch (cmd) {
    case '/status':
    case '/estado':
      return cmdStatus();

    case '/redeploy':
      return cmdRedeploy(arg);

    case '/redeploy_psyassist':
      return cmdRedeploy('psyassist');

    case '/redeploy_medassist':
      return cmdRedeploy('medassist');

    case '/reporte':
    case '/report':
      const { sendDailyReport } = require('./reporter');
      return sendDailyReport();

    case '/ayuda':
    case '/help':
    case '/start':
      return cmdHelp();

    default:
      // Ignorar mensajes que no son comandos
      break;
  }
}

async function cmdStatus() {
  let msg = `📡 *Estado actual — UniAssiist*\n\n`;

  for (const project of PROJECTS) {
    const [health, dep] = await Promise.all([
      checkHealth(project.url),
      vercel.getLatestDeployment(project.id),
    ]);

    const icon = health.ok ? '✅' : '❌';
    msg += `${icon} *${project.name}*\n`;
    msg += `  Health: ${health.ok ? 'Online' : 'FALLO (' + health.status + ')'}\n`;
    if (dep) {
      msg += `  Deploy: ${dep.state === 'READY' ? '✅ Listo' : '⚠️ ' + dep.state}\n`;
    }
    msg += '\n';
  }

  await sendMessage(msg);
}

async function cmdRedeploy(app) {
  if (!app) {
    await sendMessage(`❌ Especifica la app:\n/redeploy psyassist\n/redeploy medassist`);
    return;
  }

  const project = PROJECTS.find(p => p.app === app.toLowerCase());
  if (!project) {
    await sendMessage(`❌ App no reconocida: *${app}*\nOpciones: psyassist, medassist`);
    return;
  }

  const dep = await vercel.getLatestDeployment(project.id);
  if (!dep) {
    await sendMessage(`❌ No se encontró deployment para *${project.name}*`);
    return;
  }

  await sendMessage(`⏳ Iniciando redeploy de *${project.name}*...`);

  try {
    await vercel.redeploy(dep.uid);
    await sendMessage(`✅ Redeploy de *${project.name}* iniciado\n_Listo en ~2 minutos_`);
  } catch (err) {
    await sendMessage(`❌ Error en redeploy: ${err.message}`);
  }
}

async function cmdHelp() {
  const msg = `🤖 *UniAssiist AutoFix — Comandos*\n\n` +
    `/status — Ver estado de todas las apps\n` +
    `/redeploy psyassist — Redeploy PsyAssist\n` +
    `/redeploy medassist — Redeploy MedAssist\n` +
    `/reporte — Ver reporte ahora mismo\n` +
    `/ayuda — Esta ayuda\n\n` +
    `_El sistema revisa errores cada 10 min automáticamente_`;
  await sendMessage(msg);
}

module.exports = { handleCommand };
