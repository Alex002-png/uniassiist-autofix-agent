const tls = require('tls');
const { sendMessage } = require('./telegram');

const DOMAINS = [
  'uniassiist.com',
  'psyassist.uniassiist.com',
  'medassist.uniassiist.com',
];

async function checkSSL() {
  console.log('[SSL] Verificando certificados SSL...');
  for (const domain of DOMAINS) {
    try {
      const daysLeft = await getSSLDaysLeft(domain);
      console.log(`[SSL] ${domain}: ${daysLeft} días restantes`);

      if (daysLeft <= 7) {
        await sendMessage(
          `🔴 *SSL CRÍTICO — ${domain}*\n\n⚠️ Vence en *${daysLeft} días*\n_Renueva AHORA o la app mostrará error de seguridad_`
        );
      } else if (daysLeft <= 30) {
        await sendMessage(
          `🟡 *SSL Warning — ${domain}*\n\n⏰ Vence en *${daysLeft} días*\n_Programa la renovación en Hostinger_`
        );
      }
    } catch (err) {
      console.error(`[SSL] No se pudo verificar ${domain}:`, err.message);
    }
  }
}

function getSSLDaysLeft(domain) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, domain, { servername: domain }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) return reject(new Error('No se pudo leer el certificado'));
      const daysLeft = Math.floor((new Date(cert.valid_to) - new Date()) / 86400000);
      resolve(daysLeft);
    });
    socket.setTimeout(10000, () => { socket.destroy(); reject(new Error('Timeout')); });
    socket.on('error', reject);
  });
}

module.exports = { checkSSL };
