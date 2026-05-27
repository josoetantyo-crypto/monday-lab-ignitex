// Vercel serverless function — handles admin writes to GitHub
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, session, sessions } = req.body || {};
  const GH_TOKEN = process.env.GITHUB_TOKEN;
  const GH_REPO  = process.env.GITHUB_REPO;
  const FILE_URL = `https://api.github.com/repos/${GH_REPO}/contents/sessions.json`;

  try {
    // Fetch current file from GitHub
    const ghRes = await fetch(FILE_URL, {
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    const ghData = await ghRes.json();
    const sha     = ghData.sha;
    const current = ghData.content
      ? JSON.parse(Buffer.from(ghData.content.replace(/\n/g, ''), 'base64').toString())
      : [];

    let updated = current;

    if (action === 'upsert' && session) {
      const idx = updated.findIndex(s => s.id === session.id);
      idx >= 0 ? (updated[idx] = session) : updated.push(session);
      updated.sort((a, b) => a.id - b.id);
    } else if (action === 'seed' && Array.isArray(sessions)) {
      // Bulk upsert (from seed-helper)
      sessions.forEach(s => {
        const idx = updated.findIndex(x => x.id === s.id);
        idx >= 0 ? (updated[idx] = s) : updated.push(s);
      });
      updated.sort((a, b) => a.id - b.id);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Write back to GitHub
    const content = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');
    const msg = action === 'seed'
      ? `Seed ${sessions.length} sessions`
      : `Update session #${session?.id} → ${session?.status}`;

    await fetch(FILE_URL, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: msg, content, sha })
    });

    res.status(200).json({ ok: true, count: updated.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
