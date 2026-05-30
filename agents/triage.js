// Primer filtro rápido con DeepSeek (barato y rápido)
// Solo escala a Claude si el error es grave o de seguridad
const axios = require('axios');

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

async function triage(errorText, app) {
  const prompt = `Eres un agente de triage para una SaaS educativa (${app}).

ERROR EN PRODUCCION:
${errorText.slice(0, 2000)}

Clasifica este error y responde SOLO con JSON válido:
{
  "is_real_error": true/false,
  "severity": "critical|high|medium|low|noise",
  "category": "runtime|auth|database|api|security|deploy|noise",
  "is_security_threat": true/false,
  "can_auto_fix": true/false,
  "summary": "resumen en 1 línea en español",
  "escalate_to_claude": true/false
}

Reglas:
- escalate_to_claude = true solo si severity es critical/high O is_security_threat = true
- Si parece ruido (health checks normales, warnings menores) → is_real_error = false
- Si es error de autenticación repetido → is_security_threat = true`;

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const text = res.data.choices[0].message.content;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (err) {
    console.error('[Triage] Error DeepSeek:', err.message);
  }

  // Fallback: escalar a Claude
  return { is_real_error: true, severity: 'high', escalate_to_claude: true, category: 'runtime', is_security_threat: false, summary: 'Error no clasificado' };
}

module.exports = { triage };
