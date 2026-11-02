const { loadConfig } = require('../server');
const cfg = loadConfig();

async function checkRecentVisits() {
  const token = cfg.apiToken;
  const accountId = cfg.accountId;
  const dbId = cfg.d1DatabaseId;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT id, post_path, visitor_hash, visited_at, country FROM url_human_visits ORDER BY id DESC LIMIT 15;"
    })
  });
  const data = await res.json();
  console.log('--- RECENT VISITS IN D1 ---');
  console.table(data.result[0].results);

  // Also check total unique humans across the whole DB in last 24h
  const res2 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT COUNT(DISTINCT visitor_hash) as real_distinct_humans_24h, COUNT(*) as total_rows_24h FROM url_human_visits WHERE visited_at >= datetime('now', '-24 hours');"
    })
  });
  const data2 = await res2.json();
  console.log('--- REAL TOTALS LAST 24H ---');
  console.table(data2.result[0].results);
}

checkRecentVisits().catch(console.error);
