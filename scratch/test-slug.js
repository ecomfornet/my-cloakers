const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const content = fs.readFileSync(configPath, 'utf8');
const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : '';
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';
const dbId = '7db29aa9-bd12-410d-a982-1600c940a14f';

async function testSlugWorkflow() {
  const testSlug = '/about/';
  console.log(`Checking current analytics for slug: ${testSlug}`);

  const checkSql = `SELECT COUNT(DISTINCT visitor_hash) as cnt FROM url_human_visits WHERE post_path = '${testSlug}' AND visited_at >= datetime('now', '-24 hours');`;
  let res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: checkSql })
  });
  let data = await res.json();
  const currentCount = data.result[0].results[0].cnt;
  console.log(`Current 24h count for ${testSlug}: ${currentCount}`);

  // Fetch https://homeandrecipe.com/about/ right now
  const liveRes = await fetch('https://homeandrecipe.com/about/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  const html = await liveRes.text();
  const hasScript = html.includes('ACTIVATION_METHOD') || html.includes('[CF Worker]');
  console.log(`Current /about/ status: ${liveRes.status} | Has Redirect Injected: ${hasScript} (Expected: ${currentCount >= 4})`);

  if (hasScript) {
    const targetMatch = html.match(/var target = "([^"]+)";/);
    console.log(`Redirect Target in HTML: ${targetMatch ? targetMatch[1] : 'none'}`);
  }
}

testSlugWorkflow().catch(console.error);
