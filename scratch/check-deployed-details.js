const { loadConfig } = require('../server');
const cfg = loadConfig();

async function checkDeployed() {
  const token = cfg.apiToken;
  const accountId = cfg.accountId;

  // List scripts
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('--- ALL WORKER SCRIPTS ---');
  for (const s of data.result || []) {
    console.log(`- ${s.id} (modified: ${s.modified_on})`);
  }

  // Get script content for homeandrecipe-cloaker or homeandrecipe-com-cloaker
  for (const name of ['homeandrecipe-cloaker', 'homeandrecipe-com-cloaker']) {
    try {
      const sRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${name}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sRes.ok) {
        const text = await sRes.text();
        console.log(`\n--- SCRIPT ${name} ---`);
        console.log('Length:', text.length);
        // Find THRESHOLD_COUNT, ACTIVATION_METHOD, and query in text
        const thresholdMatch = text.match(/THRESHOLD_COUNT\s*=\s*(\d+)/);
        const methodMatch = text.match(/ACTIVATION_METHOD\s*=\s*["']([^"']+)["']/);
        const queryMatch = text.match(/SELECT\s+[^;]+url_human_visits[^;]+/i);
        console.log('THRESHOLD_COUNT in worker:', thresholdMatch ? thresholdMatch[1] : 'not found');
        console.log('ACTIVATION_METHOD in worker:', methodMatch ? methodMatch[1] : 'not found');
        console.log('Query in worker:', queryMatch ? queryMatch[0] : 'not found');
      }
    } catch (e) {
      console.log(`Error fetching ${name}:`, e.message);
    }
  }
}

checkDeployed().catch(console.error);
