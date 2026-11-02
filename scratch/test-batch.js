const { loadConfig } = require('../server');
const cfg = loadConfig();

async function testBatch() {
  const sql = `
    SELECT 
      post_path, 
      COUNT(DISTINCT visitor_hash) as unique_humans,
      COUNT(*) as total_hits,
      MAX(visited_at) as last_visit,
      GROUP_CONCAT(DISTINCT country) as countries
    FROM url_human_visits 
    WHERE visited_at >= datetime('now', '-24 hours')
    GROUP BY post_path
    ORDER BY unique_humans DESC
    LIMIT 5;
    SELECT COUNT(DISTINCT visitor_hash) as total_unique_humans, COUNT(*) as total_hits FROM url_human_visits WHERE visited_at >= datetime('now', '-24 hours');
  `;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  console.log('Result array length:', data.result.length);
  console.log('Query 1 top post:', data.result[0].results[0]);
  console.log('Query 2 overall totals:', data.result[1].results[0]);
}

testBatch().catch(console.error);
