const { triage } = require('./triage');
const { sendMessage } = require('./telegram');
const vercel = require('./vercel');

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist' },
];

const seenThreats = new Set();

async function scanSecurity() {
  console.log('[Security] Escaneando amenazas de seguridad...');
  for (const project of PROJECTS) {
    try {
      await scanProject(project);
    } catch (err) {
      console.error(`[Security] Error en ${project.name}:`, err.message);
    }
  }
}

async function scanProject(project) {
  const dep = await vercel.getLatestDeployment(project.id);
  if (!dep) return;

  const logs = await vercel.getDeploymentLogs(dep.uid);

  // Brute force: múltiples 401/403
  const authFailures = logs.filter(e => e.text && /401|403|Unauthorized|Forbidden/i.test(e.text));
  if (authFailures.length >= 10) {
    const key = `bruteforce_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      const triageResult = await triage(
        `${authFailures.length} fallos de autenticación (401/403) en logs de ${project.name}`,
        project.app
      );
      if (triageResult.is_security_threat) {
        let msg = `🔴 *ALERTA DE SEGURIDAD — ${project.name}*\n\n`;
        msg += `🔐 *${authFailures.length} intentos de autenticación fallidos*\n`;
        msg += `_Posible ataque de fuerza bruta o enumeración de usuarios_\n\n`;
        msg += `*Acción recomendada:* Revisar Supabase Auth → Users y considerar bloqueo`;
        await sendMessage(msg);
      }
    }
  }

  // API abuse: volumen inusual de requests
  const requestLines = logs.filter(e => e.text && /\bGET\b|\bPOST\b|\bPUT\b|\bDELETE\b/.test(e.text));
  if (requestLines.length >= 300) {
    const key = `apiabuse_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      let msg = `🟠 *ABUSO DE API — ${project.name}*\n\n`;
      msg += `📈 *${requestLines.length} requests detectados* en el último deploy\n`;
      msg += `_Posible bot o scraping masivo — revisa Supabase logs_`;
      await sendMessage(msg);
    }
  }

  // Secret leak: API keys en logs
  const secretPatterns = /sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|eyJ[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}/;
  const leakedLines = logs.filter(e => e.text && secretPatterns.test(e.text));
  if (leakedLines.length > 0) {
    const key = `secretleak_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      let msg = `🔴 *SECRETO EXPUESTO — ${project.name}*\n\n`;
      msg += `🔑 *Posible API key o token detectado en logs de producción*\n`;
      msg += `_Revoca y rota el secreto INMEDIATAMENTE en tu panel de claves_`;
      await sendMessage(msg);
    }
  }
}

module.exports = { scanSecurity };
