const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const content = fs.readFileSync(configPath, 'utf8');
const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : '';
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';

async function check() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Workers:', JSON.stringify(data.result ? data.result.map(w => ({ id: w.id, modified_on: w.modified_on })) : data, null, 2));

  // Check routes on homeandrecipe.com zone
  const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=homeandrecipe.com`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const zoneData = await zoneRes.json();
  const zoneId = zoneData.result[0].id;
  console.log('Zone ID:', zoneId);

  const routesRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const routesData = await routesRes.json();
  console.log('Routes:', JSON.stringify(routesData.result, null, 2));
}

check().catch(console.error);
