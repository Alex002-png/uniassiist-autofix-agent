const Anthropic = require('@anthropic-ai/sdk');
const github = require('./github');

const REPOS = {
  psyassist: 'psyassist-saas',
  medassist: 'medassist-saas',
};

const KEY_FILES = [
  'lib/supabase-bearer.ts',
  'lib/supabase-server.ts',
  'lib/supabase-admin.ts',
  'middleware.ts',
  'app/api/chat/route.ts',
];

async function analyzeError(app, errorLogs) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const repo = REPOS[app];

  // Leer archivos clave del repo
  const files = [];
  for (const path of KEY_FILES) {
    const file = await github.getFile(repo, path);
    if (file) files.push(`### ${path}\n\`\`\`typescript\n${file.content}\n\`\`\``);
  }

  const prompt = `Eres un agente senior de debugging para UniAssiist, una SaaS educativa en Peru.
App: ${app} | Stack: Next.js 14, TypeScript, Supabase, DeepSeek API, Vercel

## ERRORES EN PRODUCCION:
${errorLogs.slice(0, 3000)}

## CODIGO ACTUAL:
${files.join('\n\n').slice(0, 7000)}

## TAREA:
Analiza el error y genera un fix si puedes. Sé preciso y conciso.

Responde SOLO con JSON válido, sin texto extra:
{
  "can_fix": true,
  "severity": "critical|high|medium|low",
  "cause": "causa breve en español",
  "fix_file": "ruta/archivo.ts",
  "fix_content": "contenido completo del archivo corregido",
  "explanation": "qué cambió y por qué en 1-2 líneas"
}

Si no puedes generar un fix seguro, responde:
{
  "can_fix": false,
  "severity": "high",
  "cause": "causa del error",
  "fix_file": null,
  "fix_content": null,
  "explanation": "por qué no puedes auto-corregirlo"
}`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const text = msg.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error('[Analyzer] Error parsing Claude response:', e.message);
  }
  return null;
}

module.exports = { analyzeError };
