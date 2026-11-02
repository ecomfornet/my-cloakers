const { loadConfig } = require('../server');
const cfg = loadConfig();

async function run() {
  const token = cfg.apiToken;
  const accountId = cfg.accountId;
  const dbId = cfg.d1DatabaseId;

  const testPaths = ['/', '/about/', '/goto.php/'];
  for (const p of testPaths) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: `SELECT 
                COUNT(*) as count_all, 
                COUNT(DISTINCT visitor_hash) as count_distinct 
              FROM url_human_visits 
              WHERE post_path = '${p}' AND visited_at >= datetime('now', '-24 hours');`
      })
    });
    const data = await res.json();
    console.log(`Path: ${p} ->`, data.result[0].results[0]);
  }
}

run().catch(console.error);
