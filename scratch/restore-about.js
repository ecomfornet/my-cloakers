const { loadConfig } = require('../server');
const cfg = loadConfig();

async function deleteLastRow() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.d1DatabaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "DELETE FROM url_human_visits WHERE id = (SELECT MAX(id) FROM url_human_visits WHERE post_path = '/about/');"
    })
  });
  const data = await res.json();
  console.log('Cleaned last row:', data.success);

  const res2 = await fetch('http://localhost:5050/api/analytics/posts');
  const d = await res2.json();
  const p = d.posts.find(x => x.post_path === '/about/');
  console.log('Restored /about/ post:', p);
}

deleteLastRow().catch(console.error);
