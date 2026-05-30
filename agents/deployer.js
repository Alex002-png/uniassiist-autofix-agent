const github = require('./github');
const vercel = require('./vercel');
const store = require('../store');

const REPOS = {
  psyassist: 'psyassist-saas',
  medassist: 'medassist-saas',
};

async function applyFix(fixId) {
  const fix = store.get(fixId);
  if (!fix) return { ok: false, msg: 'Fix expirado o no encontrado' };

  const { project, analysis } = fix;
  const repo = REPOS[project.app];

  const current = await github.getFile(repo, analysis.fix_file);
  if (!current) return { ok: false, msg: `No se pudo leer ${analysis.fix_file} en GitHub` };

  try {
    await github.commitFile(
      repo,
      analysis.fix_file,
      analysis.fix_content,
      `fix(auto): ${analysis.cause}\n\n${analysis.explanation}`,
      current.sha
    );
    store.delete(fixId);
    return { ok: true, msg: `Fix commiteado en \`${analysis.fix_file}\` → Vercel deploying`, fix: { project, analysis } };
  } catch (err) {
    return { ok: false, msg: `Error en GitHub: ${err.message}` };
  }
}

async function redeployApp(app, deploymentId) {
  try {
    await vercel.redeploy(deploymentId);
    return { ok: true, msg: `Redeploy de *${app}* iniciado → listo en ~2 min` };
  } catch (err) {
    return { ok: false, msg: `Error en Vercel: ${err.message}` };
  }
}

module.exports = { applyFix, redeployApp };
