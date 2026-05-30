const axios = require('axios');
const { sendMessage } = require('./telegram');
const vercel = require('./vercel');

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist', url: 'https://psyassist.uniassiist.com/api/health' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist',  url: 'https://medassist.uniassiist.com/api/health' },
];

// Guarda el último deployment conocido por app
const lastDeployment = {};

async function checkAndRollback() {
  for (const project of PROJECTS) {
    try {
      await checkProject(project);
    } catch (err) {
      console.error(`[AutoRollback] Error en ${project.name}:`, err.message);
    }
  }
}

async function checkProject(project) {
  const dep = await vercel.getLatestDeployment(project.id);
  if (!dep || dep.state !== 'READY') return;

  const prev = lastDeployment[project.app];

  if (prev && prev !== dep.uid) {
    // Nuevo deploy detectado — esperar 2 min y verificar salud
    console.log(`[AutoRollback] Nuevo deploy en ${project.name}: ${dep.uid}`);
    await sleep(120000);

    let healthy = false;
    try {
      const res = await axios.get(project.url, { timeout: 10000 });
      healthy = res.status === 200;
    } catch (_) {}

    if (!healthy) {
      console.log(`[AutoRollback] ${project.name} caída después del deploy → rollback a ${prev}`);
      await sendMessage(
        `🔴 *AUTO-ROLLBACK — ${project.name}*\n\nEl nuevo deploy rompió la app.\n⏳ Volviendo al deployment anterior...`
      );
      try {
        await vercel.redeploy(prev);
        await sendMessage(`✅ *Rollback iniciado* para *${project.name}*\n_Recuperando versión anterior_`);
      } catch (err) {
        await sendMessage(`❌ *Rollback falló* para *${project.name}*: ${err.message}\n_Acción manual requerida_`);
      }
      return; // No actualiza lastDeployment — quedará en el prev que funcionaba
    }
  }

  lastDeployment[project.app] = dep.uid;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { checkAndRollback };
