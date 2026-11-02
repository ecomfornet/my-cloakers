const { loadConfig } = require('../server');
const cfg = loadConfig();

async function testTotal() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: `SELECT COUNT(DISTINCT visitor_hash) as distinct_humans, COUNT(*) as total_hits FROM url_human_visits WHERE visited_at >= datetime('now', '-24 hours');`
    })
  });
  const data = await res.json();
  console.log('Total result:', data.result[0].results[0]);
}

testTotal().catch(console.error);
