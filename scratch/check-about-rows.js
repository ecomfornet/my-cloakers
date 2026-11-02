const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const token = fs.readFileSync(configPath, 'utf8').match(/oauth_token = "([^"]+)"/)[1];
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';
const dbId = '7db29aa9-bd12-410d-a982-1600c940a14f';

async function checkAboutRows() {
  const sql = "SELECT post_path, visitor_hash, visited_at, country FROM url_human_visits WHERE post_path = '/about/' ORDER BY visited_at DESC LIMIT 10;";
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  console.log('Rows for /about/:', JSON.stringify(data.result[0].results, null, 2));

  const countSql = "SELECT COUNT(*) as total_rows, COUNT(DISTINCT visitor_hash) as distinct_humans FROM url_human_visits WHERE post_path = '/about/' AND visited_at >= datetime('now', '-24 hours');";
  const res2 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: countSql })
  });
  const data2 = await res2.json();
  console.log('Counts for /about/:', data2.result[0].results[0]);
}

checkAboutRows().catch(console.error);
