const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const token = fs.readFileSync(configPath, 'utf8').match(/oauth_token = "([^"]+)"/)[1];
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';
const dbId = '7db29aa9-bd12-410d-a982-1600c940a14f';

async function clean() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: "DELETE FROM url_human_visits WHERE visitor_hash LIKE 'sim_about_%';" })
  });
  const data = await res.json();
  console.log('Cleaned test entries:', data.success);
}

clean().catch(console.error);
