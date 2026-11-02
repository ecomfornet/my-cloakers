const { loadConfig } = require('../server');
const cfg = loadConfig();

async function cleanAboutDuplicates() {
  const idsToDelete = [3581, 3584, 3587, 3588, 3719];
  const sql = `DELETE FROM url_human_visits WHERE id IN (${idsToDelete.join(',')});`;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  console.log('Delete result:', data.success);

  // Check remaining for /about/
  const res2 = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT id, post_path, visitor_hash, visited_at, country FROM url_human_visits WHERE post_path = '/about/' ORDER BY id ASC;"
    })
  });
  const data2 = await res2.json();
  console.log('Remaining rows for /about/:');
  console.table(data2.result[0].results);
  console.log('Total count for /about/:', data2.result[0].results.length);
}

cleanAboutDuplicates().catch(console.error);
