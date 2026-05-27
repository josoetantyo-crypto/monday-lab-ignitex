export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const GH_TOKEN = process.env.GITHUB_TOKEN;
  const GH_REPO  = process.env.GITHUB_REPO;
  const FILE_URL = `https://api.github.com/repos/${GH_REPO}/contents/sessions.json`;

  try {
    const ghRes = await fetch(FILE_URL, {
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
      }
    });
    const ghData = await ghRes.json();
    const sessions = ghData.content
      ? JSON.parse(Buffer.from(ghData.content.replace(/\n/g, ''), 'base64').toString())
      : [];

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
