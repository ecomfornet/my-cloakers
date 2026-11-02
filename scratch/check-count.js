const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const content = fs.readFileSync(configPath, 'utf8');
const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : '';
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';
const dbId = '7db29aa9-bd12-410d-a982-1600c940a14f';

async function query() {
  const sql = "SELECT COUNT(DISTINCT visitor_hash) as cnt FROM url_human_visits WHERE post_path = '/' AND visited_at >= datetime('now', '-24 hours');";
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  console.log('Count for / in last 24h:', data.result[0].results[0].cnt);
}

query().catch(console.error);
