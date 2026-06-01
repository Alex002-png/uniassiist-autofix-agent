const { exec } = require('child_process');
const util = require('util');
const { triage } = require('./triage');
const { sendMessage } = require('./telegram');
const vercel = require('./vercel');

const execAsync = util.promisify(exec);

const PROJECTS = [
  { id: 'psyassist-saas', name: 'PsyAssist', app: 'psyassist' },
  { id: 'medassist-saas',  name: 'MedAssist',  app: 'medassist' },
];

const seenThreats = new Set();

async function scanSecurity() {
  console.log('[Security] Escaneando amenazas de seguridad...');

  await checkVPSFirewall();

  for (const project of PROJECTS) {
    try {
      await scanProject(project);
    } catch (err) {
      console.error(`[Security] Error en ${project.name}:`, err.message);
    }
  }
}

// ── 0. Firewall VPS ────────────────────────────────────────────────────────
async function checkVPSFirewall() {
  try {
    const { stdout } = await execAsync('ufw status');
    if (/inactive/i.test(stdout)) {
      const key = 'vps_firewall_inactive';
      if (!seenThreats.has(key)) {
        seenThreats.add(key);
        await sendMessage(
          `🔴 *ALERTA VPS — Firewall DESACTIVADO*\n\n` +
          `El UFW está inactivo. El servidor está expuesto.\n` +
          `Conéctate al VPS y ejecuta:\n` +
          `\`ufw allow 22 && ufw allow 443 && ufw enable\``
        );
      }
    } else {
      seenThreats.delete('vps_firewall_inactive');
    }
  } catch {
    // UFW no instalado o sin permisos — ignorar silenciosamente
  }
}

async function scanProject(project) {
  const dep = await vercel.getLatestDeployment(project.id);
  if (!dep) return;

  const logs = await vercel.getDeploymentLogs(dep.uid);

  // ── 1. Brute force: múltiples 401/403 ──────────────────────────────────
  const authFailures = logs.filter(e => e.text && /401|403|Unauthorized|Forbidden/i.test(e.text));
  if (authFailures.length >= 10) {
    const key = `bruteforce_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      const triageResult = await triage(
        `${authFailures.length} fallos de autenticación en logs de ${project.name}`,
        project.app
      );
      if (triageResult.is_security_threat) {
        await sendMessage(
          `🔴 *ATAQUE DE FUERZA BRUTA — ${project.name}*\n\n` +
          `🔐 *${authFailures.length} intentos fallidos de autenticación*\n` +
          `_Posible enumeración de usuarios o ataque de diccionario_\n\n` +
          `*Acción:* Revisar Supabase Auth → Users y buscar IPs repetidas`
        );
      }
    }
  }

  // ── 2. Rate limit attack: muchos 429 ────────────────────────────────────
  const rateLimitHits = logs.filter(e => e.text && /429|Too Many Requests|Demasiadas solicitudes/i.test(e.text));
  if (rateLimitHits.length >= 20) {
    const key = `ratelimit_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      await sendMessage(
        `🟠 *ATAQUE DE RATE LIMIT — ${project.name}*\n\n` +
        `⚡ *${rateLimitHits.length} bloqueos por exceso de requests*\n` +
        `_Alguien está bombardeando la API — posible bot_\n\n` +
        `*Acción:* Revisar Vercel Functions → logs para identificar el usuario`
      );
    }
  }

  // ── 3. API abuse: volumen inusual ───────────────────────────────────────
  const requestLines = logs.filter(e => e.text && /\bGET\b|\bPOST\b|\bPUT\b|\bDELETE\b/.test(e.text));
  if (requestLines.length >= 300) {
    const key = `apiabuse_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      await sendMessage(
        `🟠 *ABUSO DE API — ${project.name}*\n\n` +
        `📈 *${requestLines.length} requests detectados* en el último deploy\n` +
        `_Posible bot o scraping masivo_\n\n` +
        `*Acción:* Revisar Supabase logs y Vercel Analytics`
      );
    }
  }

  // ── 4. Secret leak: API keys en logs ────────────────────────────────────
  const secretPatterns = /sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|eyJ[a-zA-Z0-9]{50,}|AKIA[A-Z0-9]{16}|dp-[a-zA-Z0-9]{20,}/;
  const leakedLines = logs.filter(e => e.text && secretPatterns.test(e.text));
  if (leakedLines.length > 0) {
    const key = `secretleak_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      await sendMessage(
        `🔴 *SECRETO EXPUESTO — ${project.name}*\n\n` +
        `🔑 *API key o token detectado en logs de producción*\n` +
        `_REVOCA Y ROTA EL SECRETO INMEDIATAMENTE_\n\n` +
        `*Acción:* Ir a Vercel/Supabase/DeepSeek y rotar la clave comprometida`
      );
    }
  }

  // ── 5. SQL/Prompt injection attempt ────────────────────────────────────
  const injectionPatterns = /(\bUNION\b.*\bSELECT\b|\bDROP\b.*\bTABLE\b|1=1|'\s*OR\s*'|\[INSTRUC|IGNORE PREVIOUS|jailbreak)/i;
  const injectionLines = logs.filter(e => e.text && injectionPatterns.test(e.text));
  if (injectionLines.length > 0) {
    const key = `injection_${project.app}_${dep.uid}`;
    if (!seenThreats.has(key)) {
      seenThreats.add(key);
      await sendMessage(
        `🔴 *INTENTO DE INYECCIÓN — ${project.name}*\n\n` +
        `💉 *${injectionLines.length} patrones de inyección detectados en logs*\n` +
        `_Posible SQL injection o prompt injection_\n\n` +
        `*Acción:* Revisar logs completos en Vercel y Supabase`
      );
    }
  }
}

module.exports = { scanSecurity };
