const axios = require('axios');

const TEAM_ID = 'alex002-pngs-projects';
const api = () => axios.create({
  baseURL: 'https://api.vercel.com',
  headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  timeout: 15000,
});

async function getLatestDeployment(projectId) {
  try {
    const res = await api().get('/v6/deployments', {
      params: { teamId: TEAM_ID, projectId, limit: 1 },
    });
    return res.data.deployments?.[0] || null;
  } catch {
    return null;
  }
}

async function getDeploymentLogs(deploymentId) {
  try {
    const res = await api().get(`/v2/deployments/${deploymentId}/events`, {
      params: { direction: 'backward', limit: 300 },
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

async function redeploy(deploymentId) {
  const res = await api().post(
    '/v13/deployments',
    { deploymentId },
    { params: { teamId: TEAM_ID, forceNew: 1 } }
  );
  return res.data;
}

module.exports = { getLatestDeployment, getDeploymentLogs, redeploy };
