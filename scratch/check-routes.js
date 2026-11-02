const { loadConfig } = require('../server');
const cfg = loadConfig();

async function checkRoutes() {
  const token = cfg.apiToken;
  const zoneId = '14e66166a4afce65534e5edc22393e23';

  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('--- ACTIVE WORKER ROUTES FOR ZONE ---');
  console.log(JSON.stringify(data.result, null, 2));
}

checkRoutes().catch(console.error);
