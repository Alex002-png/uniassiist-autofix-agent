const axios = require('axios');
const { sendMessage } = require('./telegram');

const HEALTH_URLS = {
  psyassist: 'https://psyassist.uniassiist.com/api/health',
  medassist:  'https://medassist.uniassiist.com/api/health',
};

// Llamar después de applyFix exitoso — verifica que el deploy nuevo funciona
async function verifyDeploy(app, fixFile) {
  console.log(`[Verifier] Esperando 90s para que Vercel complete el deploy de ${app}...`);
  await sleep(90000);

  const url = HEALTH_URLS[app];
  if (!url) return;

  let healthy = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      if (res.status === 200) { healthy = true; break; }
    } catch (_) {}
    if (attempt < 3) await sleep(30000);
  }

  if (healthy) {
    await sendMessage(
      `✅ *Verificación exitosa*\n\n*${app}* responde correctamente después del fix en \`${fixFile}\``
    );
  } else {
    await sendMessage(
      `❌ *Fix no resolvió el problema*\n\n*${app}* sigue sin responder\n_Revisa manualmente o usa /redeploy ${app}_`
    );
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { verifyDeploy };
