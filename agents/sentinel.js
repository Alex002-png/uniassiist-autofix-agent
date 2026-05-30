const vercel = require('./vercel');
const { triage } = require('./triage');
const { analyzeError } = require('./analyzer');
const { sendMessage } = require('./telegram');
const store = require('../store');

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist', url: 'https://psyassist.uniassiist.com/api/health' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist',  url: 'https://medassist.uniassiist.com/api/health' },
];

const seenErrors = new Set();

async function checkProject(project) {
  const dep = await vercel.getLatestDeployment(project.id);
  if (!dep) return;

  // Deploy fallido en Vercel
  if (dep.state === 'ERROR') {
    const key = `err_deploy_${dep.uid}`;
    if (seenErrors.has(key)) return;
    seenErrors.add(key);
    await alert(project, `Deployment fallido en Vercel\nUID: ${dep.uid}`, dep.uid, true, null);
    return;
  }

  // Logs con errores en runtime
  const logs = await vercel.getDeploymentLogs(dep.uid);
  const errLines = logs
    .filter(e => e.text && /error|Error|TypeError|500|unhandled/i.test(e.text))
    .map(e => e.text)
    .join('\n')
    .slice(0, 3000);

  if (!errLines) return;

  const key = `err_log_${dep.uid}_${errLines.slice(0, 40)}`;
  if (seenErrors.has(key)) return;
  seenErrors.add(key);

  // ── DeepSeek triage (barato y rápido) ───────────────────────────────────────
  console.log(`[Sentinel] Error en ${project.name} — triageando con DeepSeek...`);
  const triageResult = await triage(errLines, project.app);

  if (!triageResult.is_real_error) {
    console.log(`[Sentinel] Ruido ignorado en ${project.name}: ${triageResult.summary}`);
    return;
  }

  await alert(project, errLines, dep.uid, triageResult.escalate_to_claude, triageResult);
}

async function alert(project, errorText, deploymentId, escalate, triageResult) {
  const sevEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  const fixId = `fix_${project.app}_${Date.now()}`;

  // Alerta simple sin Claude (errores medium/low)
  if (!escalate && triageResult) {
    const emoji = sevEmoji[triageResult.severity] || '⚠️';
    let msg = `${emoji} *${project.name}* — ${triageResult.category}\n\n`;
    msg += `*${triageResult.summary}*\n`;
    msg += `_Severidad: ${triageResult.severity} — No requiere fix automático_`;
    await sendMessage(msg, [[
      { text: '🔄 Redeploy', callback_data: `redeploy_${project.app}__${deploymentId}` },
      { text: '❌ Ignorar', callback_data: `dismiss_${fixId}` },
    ]]);
    return;
  }

  // ── Análisis profundo con Claude ─────────────────────────────────────────────
  console.log(`[Sentinel] Escalando a Claude para análisis de ${project.name}...`);
  const analysis = await analyzeError(project.app, errorText);
  const emoji = sevEmoji[analysis?.severity] || '⚠️';

  let msg = `${emoji} *${project.name}* — Error detectado\n\n`;
  msg += `*Causa:* ${analysis?.cause || 'Error en producción'}\n`;

  const buttons = [];

  if (analysis?.can_fix && analysis.fix_file && analysis.fix_content) {
    msg += `*Fix:* \`${analysis.fix_file}\`\n`;
    msg += `_${analysis.explanation}_\n`;
    store.set(fixId, { project, analysis, deploymentId });
    buttons.push([
      { text: '✅ Aplicar Fix', callback_data: `approve_${fixId}` },
      { text: '❌ Ignorar', callback_data: `dismiss_${fixId}` },
    ]);
    buttons.push([{ text: '🔄 Solo Redeploy', callback_data: `redeploy_${project.app}__${deploymentId}` }]);
  } else {
    msg += `_El agente no puede auto-corregir este error._\n`;
    if (analysis?.explanation) msg += `_${analysis.explanation}_\n`;
    buttons.push([
      { text: '🔄 Redeploy', callback_data: `redeploy_${project.app}__${deploymentId}` },
      { text: '❌ Ignorar', callback_data: `dismiss_${fixId}` },
    ]);
  }

  await sendMessage(msg, buttons);
}

async function run() {
  console.log(`[Sentinel] ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })} — Revisando...`);
  for (const project of PROJECTS) {
    try {
      await checkProject(project);
    } catch (err) {
      console.error(`[Sentinel] Error revisando ${project.name}:`, err.message);
    }
  }
}

module.exports = { run };
