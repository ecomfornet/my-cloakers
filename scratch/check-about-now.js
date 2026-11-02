const { loadConfig } = require('../server');
const cfg = loadConfig();

async function checkAbout() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT post_path, COUNT(DISTINCT visitor_hash) as unique_humans, COUNT(*) as total_rows FROM url_human_visits WHERE post_path = '/about/' AND visited_at >= datetime('now', '-24 hours');"
    })
  });
  const data = await res.json();
  console.log('/about/ status:', data.result[0].results);
}

checkAbout().catch(console.error);
