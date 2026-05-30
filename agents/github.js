const axios = require('axios');

const OWNER = 'Alex002-png';
const api = () => axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  },
  timeout: 15000,
});

async function getFile(repo, path, branch = 'main') {
  try {
    const res = await api().get(`/repos/${OWNER}/${repo}/contents/${path}`, {
      params: { ref: branch },
    });
    return {
      content: Buffer.from(res.data.content, 'base64').toString('utf-8'),
      sha: res.data.sha,
      path,
    };
  } catch {
    return null;
  }
}

async function commitFile(repo, path, content, message, sha, branch = 'main') {
  const res = await api().put(`/repos/${OWNER}/${repo}/contents/${path}`, {
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch,
  });
  return res.data;
}

module.exports = { getFile, commitFile };
