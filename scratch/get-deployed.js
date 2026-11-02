const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
const content = fs.readFileSync(configPath, 'utf8');
const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : '';
const accountId = '7dc0e6c5b46881fec4f36bad5ac438a4';

async function getScript() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/homeandrecipe-com-cloaker`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  console.log('Script length:', text.length);
  fs.writeFileSync('scratch/current-deployed-script.js', text, 'utf8');
  console.log('Saved to scratch/current-deployed-script.js');
}

getScript().catch(console.error);
