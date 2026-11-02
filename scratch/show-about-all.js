const { loadConfig } = require('../server');
const cfg = loadConfig();

async function showAboutRows() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT id, post_path, visitor_hash, visited_at, country FROM url_human_visits WHERE post_path = '/about/' ORDER BY id ASC;"
    })
  });
  const data = await res.json();
  console.table(data.result[0].results);
}

showAboutRows().catch(console.error);
