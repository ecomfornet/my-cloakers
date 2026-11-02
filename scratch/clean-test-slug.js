const { loadConfig } = require('../server');
const cfg = loadConfig();

async function clean() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: "DELETE FROM url_human_visits WHERE post_path LIKE '/test-visitor-condition-%';" })
  });
  const data = await res.json();
  console.log('Cleaned test slug rows:', data.success);
}

clean().catch(console.error);
