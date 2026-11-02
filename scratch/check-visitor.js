const { loadConfig } = require('../server');
const cfg = loadConfig();

async function checkVisitor() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT id, post_path, visitor_hash, visited_at, country FROM url_human_visits WHERE visitor_hash = 'f4bf2c3378ef72cfa09be0441191beda' ORDER BY id ASC;"
    })
  });
  const data = await res.json();
  console.log('Visits by this hash:');
  console.table(data.result[0].results);
}

checkVisitor().catch(console.error);
