const { loadConfig } = require('../server');
const cfg = loadConfig();

async function run() {
  const token = cfg.apiToken;
  const accountId = cfg.accountId;
  const dbId = cfg.d1DatabaseId;

  // 1. Table schema
  const res1 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='url_human_visits';" })
  });
  const data1 = await res1.json();
  console.log('--- TABLE SCHEMA ---');
  console.log(data1.result?.[0]?.results?.[0]?.sql || 'No table found');

  // 2. Count comparison: COUNT(*) vs COUNT(DISTINCT visitor_hash)
  const res2 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT post_path, COUNT(*) as total_rows, COUNT(DISTINCT visitor_hash) as unique_humans, MAX(visited_at) as latest FROM url_human_visits WHERE visited_at >= datetime('now', '-24 hours') GROUP BY post_path ORDER BY unique_humans DESC LIMIT 10;"
    })
  });
  const data2 = await res2.json();
  console.log('--- TOP 10 PATHS (LAST 24H) ---');
  console.table(data2.result?.[0]?.results || []);
}

run().catch(console.error);
